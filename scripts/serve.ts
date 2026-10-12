import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { createGameService } from "./mcp/service.ts";

const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");
const buildDir = resolve(process.env.BUILD_DIR ?? "build");
await access(resolve(buildDir, "index.html"));
const origins = (process.env.PUBLIC_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
for (const origin of origins)
  if (new URL(origin).origin !== origin)
    throw new Error(
      "PUBLIC_ORIGINS must contain comma-separated HTTP(S) origins without paths.",
    );
const app = createGameService({
  buildDir,
  origins,
  token: process.env.MCP_AUTH_TOKEN,
});
app.server.listen(port, process.env.HOST ?? "0.0.0.0", () => {
  console.log(
    `Browslatro listening on port ${port}; MCP endpoint /mcp; token ${process.env.MCP_AUTH_TOKEN ? "enabled" : "disabled (trusted intranet)"}.`,
  );
});
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  void app.close().then(
    () => process.exit(0),
    () => process.exit(1),
  );
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
