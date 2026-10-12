# Harness connection

The skill requires the Browslatro MCP server. Tool names may be prefixed by the harness; use the discovered schemas.

Start the game from its repository with Node.js 24+ and Yarn:

```sh
corepack yarn start --host 127.0.0.1 --strictPort
```

Open http://127.0.0.1:3000/ and enable **MCP control**. Keep the browser open. Reloading or disconnecting revokes the old session. If no session is listed, ask the user to enable control rather than automating opt-in.

For a deployed intranet server, prefer standard Streamable HTTP. The harness does not need the repository:

```json
{
  "mcpServers": {
    "browslatro": {
      "type": "http",
      "url": "http://browslatro.internal/mcp"
    }
  }
}
```

Replace the example domain with the actual game server. If it uses MCP_AUTH_TOKEN, include `headers: {"Authorization": "Bearer <token>"}`. Multiple browsers have separate sessionIds, all discoverable through list_games. The standard HTTP MCP endpoint is `/mcp`; `/mcp/bridge` is an internal adapter endpoint.

For a harness that only supports stdio, or for the local Vite development server:

```json
{
  "mcpServers": {
    "browslatro": {
      "command": "node",
      "args": ["<absolute repository path>/scripts/mcp/server.ts"],
      "env": { "BROWSLATRO_URL": "http://127.0.0.1:3000" }
    }
  }
}
```

Replace the repository path with the actual location. On this project's current Windows checkout it is `D:/Code/Browslatro/scripts/mcp/server.ts`. Use an absolute Node executable if the harness cannot resolve Node 24+ from PATH. The harness starts the stdio process; the game server must already be running. No model API key belongs in the game configuration.

The stdio adapter can also target a remote intranet server by changing BROWSLATRO_URL and adding the optional MCP_AUTH_TOKEN environment variable. A static CDN copy cannot host the bridge. Production uses `yarn build` followed by `yarn serve` (default port 8080); local Vite preview supports the stdio adapter at port 3000.

Load this skill folder using the harness's normal SKILL.md mechanism. Codex can discover an installed copy in its user skills directory. Other harnesses can load SKILL.md directly; agents/openai.yaml is optional Codex UI metadata.
