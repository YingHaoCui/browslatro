import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolResult } from "../src/mcp/protocol";

test("two remote browser games share one HTTP MCP service without crossing actions", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.BROWSLATRO_SERVER_MODE !== "production",
    "Requires the standalone HTTP MCP server",
  );
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  const client = new Client({ name: "cluster-harness-test", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseURL}/mcp`)),
    );
    for (const page of [a, b]) {
      await page.goto("/");
      await page.getByRole("button", { name: "Enable MCP control" }).click();
      await expect(
        page.getByText("Connected · harness can control this game"),
      ).toBeVisible();
    }
    const sessionA = await a
      .getByTestId("mcp-controls")
      .locator("p[title]")
      .getAttribute("title");
    const sessionB = await b
      .getByTestId("mcp-controls")
      .locator("p[title]")
      .getAttribute("title");
    expect(sessionA).not.toBe(sessionB);
    const list = (await client.callTool({ name: "list_games", arguments: {} }))
      .structuredContent as ToolResult;
    expect(
      (list.games as { sessionId: string }[]).map((game) => game.sessionId),
    ).toEqual(expect.arrayContaining([sessionA, sessionB]));
    const current = (
      await client.callTool({
        name: "get_state",
        arguments: { sessionId: sessionA },
      })
    ).structuredContent as ToolResult;
    const action = (
      await client.callTool({
        name: "start_run",
        arguments: {
          sessionId: sessionA,
          expectedRevision: current.state!.revision,
          deck: "blue-deck",
        },
      })
    ).structuredContent as ToolResult;
    expect(action.ok).toBe(true);
    expect(action.state?.phase).toBe("blind_select");
    const untouched = (
      await client.callTool({
        name: "get_state",
        arguments: { sessionId: sessionB },
      })
    ).structuredContent as ToolResult;
    expect(untouched.state?.phase).toBe("new_run");
    await a.getByRole("button", { name: "Disconnect MCP" }).click();
    await expect
      .poll(
        async () =>
          (
            (await client.callTool({ name: "list_games", arguments: {} }))
              .structuredContent as ToolResult
          ).games,
      )
      .toHaveLength(1);
    expect(
      (
        (
          await client.callTool({
            name: "get_state",
            arguments: { sessionId: sessionB },
          })
        ).structuredContent as ToolResult
      ).ok,
    ).toBe(true);
  } finally {
    await client.close();
    await first.close();
    await second.close();
  }
});
