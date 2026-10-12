import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer } from "ws";
import { GameBroker } from "./broker.ts";
import { failure, isToolName } from "../../src/mcp/protocol.ts";

export function localRequest(req: IncomingMessage): boolean {
  const host = req.headers.host ?? "";
  const address = req.socket.remoteAddress;
  return (
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address ?? "") &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) &&
    (!req.headers.origin ||
      req.headers.origin === `http://${host}` ||
      req.headers.origin === `https://${host}`)
  );
}

function respond(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function gameBridgePlugin(): Plugin {
  const setup = (
    server: ViteDevServer["httpServer"],
    addMiddleware: (
      handler: (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void,
      ) => void,
    ) => void,
  ) => {
    if (!server) return;
    const broker = new GameBroker();
    const sockets = new WebSocketServer({
      noServer: true,
      maxPayload: 512_000,
    });
    server.on(
      "upgrade",
      (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (req.url !== "/mcp/game") return;
        if (!localRequest(req) || !req.headers.origin) {
          socket.destroy();
          return;
        }
        sockets.handleUpgrade(req, socket, head, (connection) => {
          broker.connect(connection);
        });
      },
    );
    server.on("close", () => {
      broker.close();
      sockets.close();
    });
    addMiddleware((req, res, next) => {
      if (req.url !== "/mcp/bridge") return next();
      if (!localRequest(req))
        return respond(
          res,
          403,
          failure(
            "origin_rejected",
            "Only local same-origin access is supported.",
          ),
        );
      if (
        req.method !== "POST" ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return respond(
          res,
          405,
          failure("invalid_request", "Use POST application/json."),
        );
      void (async () => {
        const controller = new AbortController();
        const onClose = () => {
          if (!res.writableEnded) controller.abort();
        };
        res.on("close", onClose);
        try {
          let input = "";
          for await (const chunk of req) {
            input += String(chunk);
            if (Buffer.byteLength(input) > 64_000)
              return respond(
                res,
                413,
                failure("payload_too_large", "Request exceeds 64 KB."),
              );
          }
          const body = JSON.parse(input) as { tool?: unknown; args?: unknown };
          if (typeof body?.tool !== "string" || !isToolName(body.tool))
            return respond(
              res,
              400,
              failure("unknown_tool", "Unknown game tool."),
            );
          const result = await broker.call(
            body.tool,
            body.args ?? {},
            controller.signal,
          );
          if (!res.destroyed) respond(res, 200, result);
        } catch {
          if (!res.destroyed)
            respond(
              res,
              400,
              failure("invalid_request", "Invalid bridge request."),
            );
        } finally {
          res.off("close", onClose);
        }
      })();
    });
  };
  return {
    name: "browslatro:mcp-bridge",
    configureServer(server) {
      setup(server.httpServer, (handler) => server.middlewares.use(handler));
    },
    configurePreviewServer(server) {
      setup(server.httpServer, (handler) => server.middlewares.use(handler));
    },
  };
}
