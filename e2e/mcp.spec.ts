import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolResult, GameObservation } from "../src/mcp/protocol";

async function connect() {
  const client = new Client({
    name: "browslatro-harness-test",
    version: "1.0.0",
  });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["scripts/mcp/server.ts"],
      cwd: process.cwd(),
      env: { BROWSLATRO_URL: `http://127.0.0.1:${process.env.PORT ?? 3000}` },
    }),
  );
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const response = await client.callTool({ name, arguments: args });
  if (response.structuredContent)
    return response.structuredContent as ToolResult;
  const content = response.content as { type: string; text?: string }[];
  return JSON.parse(content[0].text ?? "{}") as ToolResult;
}

test("a harness controls a real browser run through standard MCP stdio", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("browslatro:deterministicShuffle", "1");
    localStorage.setItem("browslatro:muted", "true");
    localStorage.setItem("browslatro:animationSpeed", "fast");
    localStorage.setItem("browslatro:forceShopOfferKinds", "joker,planet");
    localStorage.setItem("browslatro:forcePackPool", "celestial");
  });
  const client = await connect();
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      "play_hand",
    );
    await page.goto("/");
    expect((await call(client, "list_games")).games).toEqual([]);
    await page.getByRole("button", { name: "Enable MCP control" }).click();
    await expect(
      page.getByText("Connected · harness can control this game"),
    ).toBeVisible();
    const games = (await call(client, "list_games")).games as {
      sessionId: string;
    }[];
    expect(games).toHaveLength(1);
    const sessionId = games[0].sessionId;
    let state = (await call(client, "get_state", { sessionId })).state!;
    const mutate = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await call(client, name, {
        sessionId,
        expectedRevision: state.revision,
        ...args,
      });
      expect(result.ok, JSON.stringify(result.error)).toBe(true);
      state = result.state!;
      return result;
    };
    expect(state.phase).toBe("new_run");
    expect(
      (await call(client, "get_rules", { sessionId, topic: "overview" })).ok,
    ).toBe(true);
    await mutate("start_run");
    expect(state.phase).toBe("blind_select");
    await mutate("select_blind", { action: "play" });
    expect(state.phase).toBe("hand");
    const hand = state.hand as { id: number }[];
    const oldRevision = state.revision;
    await mutate("play_hand", {
      cardIds: hand.slice(0, 5).map((card) => card.id),
    });
    expect(state.ready).toBe(false);
    const stale = await call(client, "play_hand", {
      sessionId,
      expectedRevision: oldRevision,
      cardIds: [hand[0].id],
    });
    expect(stale.error?.code).toBe("stale_revision");
    const waited = await call(client, "wait_for_state_change", {
      sessionId,
      afterRevision: state.revision,
      timeoutMs: 20_000,
    });
    expect(waited.status).toBe("ready");
    state = waited.state!;
    expect(state.phase).toBe("round_won");
    await mutate("continue_round", { action: "collect" });
    expect(state.phase).toBe("shop");
    await mutate("shop_action", { action: "buy", index: 0 });
    const shop = state.shop as {
      offers: { index: number; itemType: string; cost: number }[];
    };
    const pack = shop.offers.find(
      (offer) => offer.itemType === "pack" && offer.cost <= Number(state.money),
    );
    expect(pack).toBeDefined();
    await mutate("shop_action", { action: "buy", index: pack!.index });
    expect(state.phase).toBe("pack");
    await mutate("pack_action", { action: "pick", index: 0 });
    expect(state.phase).toBe("shop");
    await mutate("shop_action", { action: "leave" });
    expect(state.phase).toBe("blind_select");
    await mutate("select_blind", { action: "play" });
    const before = state.hand as { id: number }[];
    await mutate("discard_cards", { cardIds: [before[0].id] });
    expect(state.ready).toBe(false);
    state = (
      await call(client, "wait_for_state_change", {
        sessionId,
        afterRevision: state.revision,
        timeoutMs: 10_000,
      })
    ).state!;
    expect(state.phase).toBe("hand");
    expect(
      (state.hand as { id: number }[]).map((card) => card.id),
    ).not.toContain(before[0].id);
    await page.screenshot({
      path: "test-results/mcp-game.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Disconnect MCP" }).click();
    await expect
      .poll(async () => (await call(client, "list_games")).games)
      .toEqual([]);
    expect((await call(client, "get_state", { sessionId })).error?.code).toBe(
      "session_not_found",
    );
    expect(errors).toEqual([]);
  } finally {
    await client.close();
  }
});

test("MCP restarts consecutive lost runs without clicking the loss dialog", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem("browslatro:muted", "true");
    localStorage.setItem("browslatro:animationSpeed", "fast");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enable MCP control" }).click();
  await expect(
    page.getByText("Connected · harness can control this game"),
  ).toBeVisible();
  const sessionId = await page
    .getByTestId("mcp-controls")
    .locator("p[title]")
    .getAttribute("title");
  const client = await connect();
  try {
    let state = (await call(client, "get_state", { sessionId })).state!;
    const mutate = async (name: string, args: Record<string, unknown> = {}) => {
      const response = await call(client, name, {
        sessionId,
        expectedRevision: state.revision,
        ...args,
      });
      expect(response.ok, JSON.stringify(response.error)).toBe(true);
      state = response.state!;
    };
    await mutate("start_run");
    for (let run = 0; run < 2; run += 1) {
      await mutate("select_blind", { action: "play" });
      // Single-card high-card hands cannot clear the first blind without items.
      for (let hand = 0; hand < 4; hand += 1) {
        expect(state.phase).toBe("hand");
        await mutate("play_hand", {
          cardIds: [(state.hand as { id: number }[])[0].id],
        });
        while (!state.ready) {
          const response = await call(client, "wait_for_state_change", {
            sessionId,
            afterRevision: state.revision,
            readyOnly: true,
            timeoutMs: 10_000,
          });
          expect(response.ok, JSON.stringify(response.error)).toBe(true);
          state = response.state!;
        }
      }
      expect(state.phase).toBe("lost");
      await expect(page.getByTestId("round-lost-score")).toBeVisible();
      await mutate("start_run");
      expect(state.phase).toBe("blind_select");
      await expect(page.getByTestId("round-lost-score")).toHaveCount(0);
    }
    await mutate("select_blind", { action: "play" });
    expect(state.phase).toBe("hand");
  } finally {
    await client.close();
  }
});

test("session versions reject manual changes and waits report timeout accurately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enable MCP control" }).click();
  await expect(
    page.getByText("Connected · harness can control this game"),
  ).toBeVisible();
  const client = await connect();
  try {
    const games = (await call(client, "list_games")).games as {
      sessionId: string;
    }[];
    const sessionId = games[0].sessionId;
    const state = (await call(client, "get_state", { sessionId }))
      .state as GameObservation;
    await page.getByTestId("new-run-confirm").click();
    expect(
      (
        await call(client, "start_run", {
          sessionId,
          expectedRevision: state.revision,
        })
      ).error?.code,
    ).toBe("stale_revision");
    const current = (await call(client, "get_state", { sessionId })).state!;
    expect(
      (
        await call(client, "wait_for_state_change", {
          sessionId,
          afterRevision: current.revision,
          timeoutMs: 20,
        })
      ).status,
    ).toBe("timeout");
  } finally {
    await client.close();
  }
});
