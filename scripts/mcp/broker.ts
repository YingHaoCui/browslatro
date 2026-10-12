import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import {
  failure,
  toolSchemas,
  type GameObservation,
  type ToolName,
  type ToolResult,
} from "../../src/mcp/protocol.ts";

interface Session {
  readonly socket: WebSocket;
  state?: GameObservation;
}
interface Pending {
  readonly sessionId: string;
  readonly finish: (result: ToolResult) => void;
}

export function socketText(data: RawData): string {
  return (
    Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data)
  ).toString("utf8");
}

export class GameBroker {
  private readonly sessions = new Map<string, Session>();
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<() => void>();

  connect(socket: WebSocket): string {
    const sessionId = randomUUID();
    const session: Session = { socket };
    this.sessions.set(sessionId, session);
    socket.send(JSON.stringify({ type: "connected", sessionId }));
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(socketText(data)) as {
          type?: string;
          state?: GameObservation;
          requestId?: string;
          result?: ToolResult;
        };
        if (
          message.type === "state" &&
          message.state &&
          Number.isInteger(message.state.revision) &&
          message.state.revision >= 0 &&
          typeof message.state.ready === "boolean" &&
          typeof message.state.phase === "string"
        ) {
          session.state = { ...message.state, sessionId };
          this.listeners.forEach((listener) => listener());
        }
        if (
          message.type === "result" &&
          typeof message.requestId === "string" &&
          typeof message.result?.ok === "boolean"
        ) {
          const request = this.pending.get(message.requestId);
          if (request?.sessionId === sessionId) request.finish(message.result);
        }
      } catch {
        socket.close(1008, "Invalid bridge message");
      }
    });
    socket.on("close", () => {
      this.sessions.delete(sessionId);
      for (const request of this.pending.values()) {
        if (request.sessionId === sessionId)
          request.finish(
            failure(
              "disconnected",
              "Browser disconnected. Re-list games; do not replay an uncertain action.",
            ),
          );
      }
      this.listeners.forEach((listener) => listener());
    });
    return sessionId;
  }

  async call(
    tool: ToolName,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const parsed = toolSchemas[tool].safeParse(input);
    if (!parsed.success)
      return failure("invalid_arguments", parsed.error.message);
    if (tool === "list_games") {
      return {
        ok: true,
        games: [...this.sessions.entries()]
          .filter(([, session]) => session.state)
          .map(([sessionId, session]) => ({
            sessionId,
            revision: session.state?.revision,
            phase: session.state?.phase,
            ready: session.state?.ready,
          })),
      };
    }
    const args = parsed.data as { sessionId: string };
    const session = this.sessions.get(args.sessionId);
    if (!session?.state || session.socket.readyState !== WebSocket.OPEN)
      return failure(
        "session_not_found",
        "Enable MCP control in the browser, then call list_games.",
      );
    if (tool === "wait_for_state_change") {
      const wait = toolSchemas.wait_for_state_change.parse(input);
      return new Promise((resolve) => {
        const finish = (result: ToolResult) => {
          clearTimeout(timer);
          this.listeners.delete(check);
          signal?.removeEventListener("abort", abort);
          resolve(result);
        };
        const check = () => {
          const current = this.sessions.get(args.sessionId)?.state;
          if (!current)
            return finish(failure("disconnected", "Browser disconnected."));
          if (
            current.revision > wait.afterRevision &&
            (!wait.readyOnly || current.ready)
          )
            finish({
              ok: true,
              status: current.ready ? "ready" : "changed",
              state: current,
            });
        };
        const abort = () => finish(failure("cancelled", "Wait cancelled."));
        this.listeners.add(check);
        const timer = setTimeout(
          () => finish({ ok: true, status: "timeout", state: session.state }),
          wait.timeoutMs,
        );
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        else check();
      });
    }
    return new Promise((resolve) => {
      const requestId = randomUUID();
      const finish = (result: ToolResult) => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      const abort = () =>
        finish(
          failure(
            "cancelled",
            "Request cancelled; inspect current state before retrying an action.",
          ),
        );
      const timer = setTimeout(
        () =>
          finish(
            failure(
              "browser_timeout",
              "Browser did not respond. Action outcome may be unknown; inspect current state before retrying.",
            ),
          ),
        15_000,
      );
      this.pending.set(requestId, { sessionId: args.sessionId, finish });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) return abort();
      session.socket.send(
        JSON.stringify({ type: "call", requestId, tool, args }),
      );
    });
  }

  close(): void {
    for (const session of this.sessions.values())
      session.socket.close(1001, "Server shutting down");
  }
}
