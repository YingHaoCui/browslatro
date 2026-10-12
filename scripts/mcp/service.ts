import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { WebSocketServer } from "ws";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GameBroker } from "./broker.ts";
import { createGameMcpServer } from "./tools.ts";
import { allowedOrigin, authenticated } from "./access.ts";
import { failure, isToolName } from "../../src/mcp/protocol.ts";

export interface ServiceOptions {
  readonly buildDir: string;
  readonly origins?: readonly string[];
  readonly token?: string;
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > 64_000) throw new Error("payload_too_large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createGameService(options: ServiceOptions) {
  const broker = new GameBroker();
  const root = resolve(options.buildDir);
  const origins = options.origins ?? [];
  const token = options.token ?? "";
  const activeMcp = new Set<McpServer>();
  let draining = false;
  const server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://service").pathname;
      if (path === "/healthz") return json(res, 200, { ok: true });
      if (path === "/readyz")
        return json(res, draining ? 503 : 200, { ok: !draining });
      if (draining)
        return json(
          res,
          503,
          failure(
            "shutting_down",
            "Service is restarting; reconnect and re-list games.",
          ),
        );
      if (path === "/mcp" || path === "/mcp/bridge") {
        if (!allowedOrigin(req, origins))
          return json(
            res,
            403,
            failure("origin_rejected", "Origin is not allowed."),
          );
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "access-control-allow-origin": req.headers.origin ?? "",
            vary: "Origin",
            "access-control-allow-headers":
              "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id",
            "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
          });
          res.end();
          return;
        }
        if (!authenticated(req, token))
          return json(
            res,
            401,
            failure("unauthorized", "MCP bearer token is required."),
          );
        if (req.headers.origin) {
          res.setHeader("access-control-allow-origin", req.headers.origin);
          res.setHeader("vary", "Origin");
          res.setHeader(
            "access-control-expose-headers",
            "MCP-Protocol-Version, MCP-Session-Id",
          );
        }
        if (req.method !== "POST")
          return json(res, 405, {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32000,
              message:
                "Use POST. Stateless MCP does not expose a GET event stream or DELETE session.",
            },
          });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(
            res,
            415,
            failure("invalid_request", "Use application/json."),
          );
        const input = await readJson(req);
        if (path === "/mcp/bridge") {
          const body = input as { tool?: unknown; args?: unknown };
          if (typeof body?.tool !== "string" || !isToolName(body.tool))
            return json(res, 400, failure("unknown_tool", "Unknown tool."));
          const controller = new AbortController();
          const onClose = () => {
            if (!res.writableEnded) controller.abort();
          };
          res.once("close", onClose);
          const result = await broker.call(
            body.tool,
            body.args ?? {},
            controller.signal,
          );
          res.off("close", onClose);
          if (!res.destroyed) json(res, 200, result);
          return;
        }
        const mcp = createGameMcpServer((name, args, signal) =>
          broker.call(name, args, signal),
        );
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        activeMcp.add(mcp);
        res.once("close", () => {
          activeMcp.delete(mcp);
          void mcp.close();
        });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, input);
        return;
      }
      if (path.startsWith("/mcp") || path.startsWith("/api/"))
        return json(res, 404, failure("not_found", "Unknown endpoint."));
      if (req.method !== "GET" && req.method !== "HEAD")
        return json(
          res,
          405,
          failure("method_not_allowed", "Use GET or HEAD."),
        );
      const decoded = decodeURIComponent(path);
      const file = resolve(root, `.${decoded}`);
      if (
        (file !== root && !file.startsWith(`${root}${sep}`)) ||
        decoded.split("/").some((segment) => segment.startsWith("."))
      )
        return json(res, 403, failure("forbidden", "Invalid asset path."));
      let target = file;
      let info = await stat(target).catch(() => null);
      if (!info?.isFile()) {
        if (extname(path))
          return json(res, 404, failure("not_found", "Asset does not exist."));
        target = resolve(root, "index.html");
        info = await stat(target);
      }
      res.writeHead(200, {
        "content-type": mime[extname(target)] ?? "application/octet-stream",
        "content-length": info.size,
        "cache-control": path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      if (req.method === "HEAD") res.end();
      else
        createReadStream(target)
          .on("error", () => res.destroy())
          .pipe(res);
    })().catch((error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const tooLarge =
        error instanceof Error && error.message === "payload_too_large";
      json(
        res,
        tooLarge ? 413 : 400,
        failure(
          tooLarge ? "payload_too_large" : "invalid_request",
          tooLarge
            ? "Request exceeds 64 KB."
            : "Request could not be processed.",
        ),
      );
    });
  });
  server.requestTimeout = 45_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 65_000;
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 512_000 });
  const alive = new WeakMap<import("ws").WebSocket, boolean>();
  server.on("upgrade", (req, socket, head) => {
    if (
      new URL(req.url ?? "/", "http://service").pathname !== "/mcp/game" ||
      draining ||
      !req.headers.origin ||
      !allowedOrigin(req, origins)
    ) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (connection) => {
      alive.set(connection, true);
      connection.on("pong", () => alive.set(connection, true));
      connection.on("error", () => connection.terminate());
      broker.connect(connection);
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!alive.get(socket)) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, 30_000);
  heartbeat.unref();
  server.once("close", () => clearInterval(heartbeat));
  return {
    server,
    broker,
    async close() {
      draining = true;
      clearInterval(heartbeat);
      broker.close();
      await Promise.allSettled([...activeMcp].map((mcp) => mcp.close()));
      const force = setTimeout(() => {
        for (const socket of sockets.clients) socket.terminate();
        server.closeAllConnections();
      }, 5000);
      force.unref();
      await Promise.all([
        new Promise<void>((done) => sockets.close(() => done())),
        new Promise<void>((done) => server.close(() => done())),
      ]);
      clearTimeout(force);
    },
  };
}
