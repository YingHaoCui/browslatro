import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGameMcpServer } from "./tools.ts";
import { failure, type ToolResult } from "../../src/mcp/protocol.ts";

const baseUrl = new URL(process.env.BROWSLATRO_URL ?? "http://127.0.0.1:3000");
if (
  !["http:", "https:"].includes(baseUrl.protocol) ||
  baseUrl.username ||
  baseUrl.password
)
  throw new Error(
    "BROWSLATRO_URL must be an HTTP(S) game server URL without embedded credentials.",
  );
const token = process.env.MCP_AUTH_TOKEN;
const server = createGameMcpServer(async (name, args, signal) => {
  try {
    const response = await fetch(new URL("/mcp/bridge", baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tool: name, args }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]),
    });
    return (await response.json()) as ToolResult;
  } catch {
    return failure(
      "bridge_unavailable",
      "Start the game server and enable MCP control in a browser. If an action was in flight, inspect state before retrying.",
    );
  }
});
await server.connect(new StdioServerTransport());
