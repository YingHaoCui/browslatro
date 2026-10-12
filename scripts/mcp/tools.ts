import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import {
  toolSchemas,
  toolDescriptions,
  type ToolName,
  type ToolResult,
} from "../../src/mcp/protocol.ts";

export type GameToolCaller = (
  name: ToolName,
  args: unknown,
  signal: AbortSignal,
) => Promise<ToolResult>;

export function createGameMcpServer(call: GameToolCaller): McpServer {
  const server = new McpServer({ name: "browslatro", version: "0.2.0" });
  for (const name of Object.keys(toolSchemas) as ToolName[]) {
    const readOnly = [
      "list_games",
      "get_state",
      "get_rules",
      "wait_for_state_change",
    ].includes(name);
    server.registerTool(
      name,
      {
        description: toolDescriptions[name],
        inputSchema: toolSchemas[name].shape,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
      },
      async (
        args: unknown,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
      ) => {
        const result = await call(name, args, extra.signal);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          structuredContent: { ...result },
          isError: !result.ok,
        };
      },
    );
  }
  return server;
}
