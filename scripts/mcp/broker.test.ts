import { createServer, IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, beforeEach, expect, test } from "vitest";
import { GameBroker, socketText } from "./broker";
import type { GameObservation } from "../../src/mcp/protocol";
import { localRequest } from "./bridgePlugin";

let broker: GameBroker;
let server: ReturnType<typeof createServer>;
let sockets: WebSocketServer;
let browser: WebSocket;
let sessionId: string;
const state = (revision: number, ready = true): GameObservation => ({
  sessionId,
  revision,
  ready,
  phase: ready ? "hand" : "animating",
});
const publish = async (revision: number, ready = true) => {
  browser.send(
    JSON.stringify({ type: "state", state: state(revision, ready) }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
};

beforeEach(async () => {
  broker = new GameBroker();
  server = createServer();
  sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket) => broker.connect(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  browser = new WebSocket(`ws://127.0.0.1:${address.port}`);
  sessionId = await new Promise<string>((resolve) =>
    browser.once("message", (data) =>
      resolve(
        (JSON.parse(socketText(data)) as { sessionId: string }).sessionId,
      ),
    ),
  );
  await publish(1);
});
afterEach(async () => {
  browser.terminate();
  broker.close();
  await new Promise<void>((resolve) => sockets.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("lists opted-in sessions and forwards a tool result", async () => {
  const listed = await broker.call("list_games", {});
  expect(listed.games).toEqual([
    { sessionId, revision: 1, phase: "hand", ready: true },
  ]);
  browser.once("message", (data) => {
    const call = JSON.parse(socketText(data)) as {
      requestId: string;
      tool: string;
    };
    expect(call.tool).toBe("get_state");
    browser.send(
      JSON.stringify({
        type: "result",
        requestId: call.requestId,
        result: { ok: true, state: state(1) },
      }),
    );
  });
  expect((await broker.call("get_state", { sessionId })).state?.revision).toBe(
    1,
  );
});
test("waits until a newer state is ready", async () => {
  const wait = broker.call("wait_for_state_change", {
    sessionId,
    afterRevision: 1,
    timeoutMs: 1000,
  });
  await publish(2, false);
  await publish(3, true);
  expect(await wait).toMatchObject({
    ok: true,
    status: "ready",
    state: { revision: 3, ready: true },
  });
});
test("wait timeout returns current busy state without implying readiness", async () => {
  await publish(2, false);
  expect(
    await broker.call("wait_for_state_change", {
      sessionId,
      afterRevision: 1,
      timeoutMs: 20,
    }),
  ).toMatchObject({ status: "timeout", state: { ready: false } });
});
test("disconnect fails pending actions and removes the session", async () => {
  const call = broker.call("play_hand", {
    sessionId,
    expectedRevision: 1,
    cardIds: [1],
  });
  browser.close();
  expect((await call).error?.code).toBe("disconnected");
  expect((await broker.call("list_games", {})).games).toEqual([]);
});
test("cancellation releases a pending wait", async () => {
  const controller = new AbortController();
  const wait = broker.call(
    "wait_for_state_change",
    { sessionId, afterRevision: 1 },
    controller.signal,
  );
  controller.abort();
  expect((await wait).error?.code).toBe("cancelled");
});
test("validates schemas before sending commands", async () => {
  expect(
    (
      await broker.call("play_hand", {
        sessionId,
        expectedRevision: 1,
        cardIds: [],
      })
    ).error?.code,
  ).toBe("invalid_arguments");
});
test("rejects unknown sessions", async () => {
  expect(
    (await broker.call("get_state", { sessionId: "missing" })).error?.code,
  ).toBe("session_not_found");
});
test("accepts local requests and rejects cross-origin and nonlocal hosts", () => {
  const request = new IncomingMessage(new Socket());
  Object.defineProperty(request.socket, "remoteAddress", {
    value: "127.0.0.1",
    configurable: true,
  });
  request.headers = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
  expect(localRequest(request)).toBe(true);
  request.headers.origin = "https://evil.example";
  expect(localRequest(request)).toBe(false);
  request.headers.origin = "http://127.0.0.1:3000";
  Object.defineProperty(request.socket, "remoteAddress", {
    value: "192.168.1.2",
  });
  expect(localRequest(request)).toBe(false);
});
