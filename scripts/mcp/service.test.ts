import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { WebSocket } from "ws";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeEach, afterEach, expect, test } from "vitest";
import { createGameService } from "./service";
import { socketText } from "./broker";
import type { ToolResult } from "../../src/mcp/protocol";

let app: ReturnType<typeof createGameService>;
let url: string;
let root: string;
const browsers: WebSocket[] = [];
const clients: Client[] = [];

beforeEach(async () => {
  root = await mkdtemp(resolve(".yarn", "service-test-"));
  await mkdir(resolve(root, "assets"));
  await writeFile(resolve(root, "index.html"), "<html>Browslatro</html>");
  await writeFile(
    resolve(root, "assets/test.wasm"),
    Buffer.from([0, 97, 115, 109]),
  );
  app = createGameService({
    buildDir: root,
    origins: ["https://game.internal"],
    token: "test-token",
  });
  await new Promise<void>((done) => app.server.listen(0, "127.0.0.1", done));
  const address = app.server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  for (const browser of browsers.splice(0)) browser.terminate();
  await app.close();
  await rm(root, { recursive: true });
});

async function browser(revision: number) {
  const socket = new WebSocket(`${url.replace("http:", "ws:")}/mcp/game`, {
    origin: "https://game.internal",
  });
  browsers.push(socket);
  const sessionId = await new Promise<string>((done) =>
    socket.once("message", (data) =>
      done((JSON.parse(socketText(data)) as { sessionId: string }).sessionId),
    ),
  );
  socket.send(
    JSON.stringify({
      type: "state",
      state: { sessionId, revision, phase: "hand", ready: true },
    }),
  );
  socket.on("message", (data) => {
    const call = JSON.parse(socketText(data)) as {
      type: string;
      requestId: string;
      tool: string;
    };
    if (call.type === "call")
      socket.send(
        JSON.stringify({
          type: "result",
          requestId: call.requestId,
          result: {
            ok: true,
            state: { sessionId, revision, phase: "hand", ready: true },
          },
        }),
      );
  });
  await new Promise<void>((done) => setTimeout(done, 10));
  return sessionId;
}

async function client() {
  const value = new Client({ name: "intranet-test", version: "1" });
  await value.connect(
    new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
      requestInit: { headers: { authorization: "Bearer test-token" } },
    }),
  );
  clients.push(value);
  return value;
}

test("standard HTTP MCP initializes, discovers tools and isolates browser sessions", async () => {
  const a = await browser(10);
  const b = await browser(20);
  const mcp = await client();
  expect((await mcp.listTools()).tools.map((tool) => tool.name)).toContain(
    "play_hand",
  );
  const list = (await mcp.callTool({ name: "list_games", arguments: {} }))
    .structuredContent as ToolResult;
  expect(list.games).toEqual([
    { sessionId: a, revision: 10, phase: "hand", ready: true },
    { sessionId: b, revision: 20, phase: "hand", ready: true },
  ]);
  expect(
    (
      (await mcp.callTool({ name: "get_state", arguments: { sessionId: b } }))
        .structuredContent as ToolResult
    ).state?.revision,
  ).toBe(20);
  expect(
    (
      (await mcp.callTool({ name: "get_state", arguments: { sessionId: a } }))
        .structuredContent as ToolResult
    ).state?.revision,
  ).toBe(10);
});
test("serves the SPA, assets and probes without exposing project files", async () => {
  expect(await (await fetch(`${url}/`)).text()).toContain("Browslatro");
  expect((await fetch(`${url}/some/route`)).status).toBe(200);
  const asset = await fetch(`${url}/assets/test.wasm`);
  expect(asset.headers.get("content-type")).toBe("application/wasm");
  expect(asset.headers.get("cache-control")).toContain("immutable");
  expect((await fetch(`${url}/healthz`)).status).toBe(200);
  expect((await fetch(`${url}/readyz`)).status).toBe(200);
  expect((await fetch(`${url}/.env`)).status).toBe(403);
  expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
});
test("enforces optional token and browser origin without blocking trusted native clients", async () => {
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool: "list_games" }),
  };
  expect((await fetch(`${url}/mcp/bridge`, init)).status).toBe(401);
  expect(
    (
      await fetch(`${url}/mcp/bridge`, {
        ...init,
        headers: {
          ...init.headers,
          authorization: "Bearer test-token",
          origin: "https://evil.example",
        },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`${url}/mcp/bridge`, {
        ...init,
        headers: { ...init.headers, authorization: "Bearer test-token" },
      })
    ).status,
  ).toBe(200);
  const preflight = await fetch(`${url}/mcp`, {
    method: "OPTIONS",
    headers: { origin: "https://game.internal" },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(
    "https://game.internal",
  );
});
test("returns wait timeouts over standard HTTP MCP", async () => {
  const sessionId = await browser(10);
  const mcp = await client();
  const waited = (
    await mcp.callTool({
      name: "wait_for_state_change",
      arguments: { sessionId, afterRevision: 10, timeoutMs: 20 },
    })
  ).structuredContent as ToolResult;
  expect(waited.status).toBe("timeout");
});
test("rejects oversized bodies and closes connected browsers on shutdown", async () => {
  const response = await fetch(`${url}/mcp/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: " ".repeat(64_001),
  });
  expect(response.status).toBe(413);
  await browser(10);
  const socket = browsers.pop()!;
  const closed = new Promise<void>((done) =>
    socket.once("close", () => done()),
  );
  await app.close();
  await closed;
  expect(socket.readyState).toBe(WebSocket.CLOSED);
});
