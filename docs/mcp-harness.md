# 通过 MCP 用自己的 harness 玩 Browslatro

基座来自 [oreoshake-s-team/browslatro](https://github.com/oreoshake-s-team/browslatro)，保留原项目 MIT 许可证和游戏引擎。新增功能不调用模型、不保存模型密钥、不实现 agent-loop。harness 负责模型、思考、上下文、工具调用和测试记录。

```text
harness / MCP client
        │ 标准 MCP Streamable HTTP /mcp（或 stdio adapter）
独立 Node 生产服务 scripts/serve.ts
        │ WebSocket
浏览器 GameController → 原有游戏动作与动画
```

## 启动

需要 Node.js 24+。在项目目录执行：

```sh
corepack yarn install
corepack yarn start --host 127.0.0.1 --strictPort
```

也可以通过项目内固定版本运行：

```sh
node .yarn/releases/yarn-4.15.0.cjs start --host 127.0.0.1 --strictPort
```

打开 http://127.0.0.1:3000/，点击右上角 **Enable MCP control**。页面显示 Connected 后，harness 就可以发现这个会话。控制默认关闭，刷新页面后需要重新启用；Disconnect MCP 会立即撤销该浏览器会话。

生产构建也支持同一桥接：

```sh
corepack yarn build
corepack yarn preview --host 127.0.0.1 --strictPort
```

集群部署使用 `yarn build` 后运行 `yarn serve`，默认监听 0.0.0.0:8080，同时提供网页、WebSocket 和标准 Streamable HTTP MCP `/mcp`。不能仅把 build 文件放到静态 CDN。`/mcp/bridge` 仍是 stdio adapter 的内部桥接端点，不是标准 MCP endpoint。集群构建与 Kubernetes 配置见 [部署说明](cluster-deployment.md)。

## harness 配置

部署后推荐直接连接 HTTP MCP，harness 不需要下载游戏仓库：

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

默认内网模式不要求认证。如果服务设置了 MCP_AUTH_TOKEN，加入 `headers: {"Authorization": "Bearer <token>"}`。harness 的配置字段以其自身格式为准；传输协议为标准 Streamable HTTP。

在支持 MCP stdio 的 harness 中添加以下配置。将 command 替换为你的 Node 24+ 可执行文件路径；server.ts 使用绝对路径，避免依赖 harness 的工作目录。

```json
{
  "mcpServers": {
    "browslatro": {
      "command": "node",
      "args": ["D:/Code/Browslatro/scripts/mcp/server.ts"],
      "env": {
        "BROWSLATRO_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

harness 会启动 MCP 子进程，无需额外手动运行 yarn mcp。手动运行 `corepack yarn mcp` 适用于能与其 stdin/stdout 通信的 MCP 客户端；它不会自行启动网页服务器。

多个浏览器可以共享同一生产服务，每个网页运行独立游戏并生成独立 sessionId。先调用 list_games，再选择会话；重连或刷新后重新获取 sessionId。生产服务支持内网远程连接并检查浏览器 Origin，Vite 开发/预览桥接保持本机限制。独立游戏的自动存档仍使用浏览器 localStorage；同一浏览器的同源标签页会共享存档槽，运行中的状态不共用。

## 工具

| 工具                      | 用途                                                           |
| ------------------------- | -------------------------------------------------------------- |
| list_games                | 列出已启用控制的浏览器会话                                     |
| get_state                 | 读取局面、revision、phase、ready 和 availableTools             |
| get_rules                 | 按 topic/id 查询实际规则、牌型、道具与 Boss 目录               |
| start_run                 | 在新局菜单或终局后开始游戏；不能重置正在进行的局               |
| play_hand / discard_cards | 提供任意合法的 1–5 张当前手牌 ID                               |
| select_blind              | play、skip 或 reroll_boss                                      |
| shop_action               | buy、buy_voucher、sell_joker、sell_consumable、reroll 或 leave |
| use_consumable            | 以 index 使用消耗品；targetCardIds 指定目标                    |
| pack_action               | pick 或 skip；pick 使用 option index 和必要目标                |
| reorder_jokers            | 提供当前小丑牌索引的完整排列                                   |
| continue_round            | collect、acknowledge_jokers 或 endless                         |
| wait_for_state_change     | 等待版本变化，可选择只等待 ready 状态                          |

索引从 0 开始。所有修改动作都必须包含 sessionId 和 expectedRevision。get_rules 的 topic 支持 overview、hands、jokers、consumables、boss、decks、stakes、vouchers、tags。get_state 提供当前实际效果、动态小丑牌状态与目标、已拥有优惠券、商店价格和卡包内容；规则以此项目实现为准。

牌 ID 顺序会设置出牌顺序，消耗品目标顺序会设置左右关系（如 Death）。模型可以自由选择组合，游戏不预先用策略算法筛选候选动作。

## 调用示例

先读取：

```json
{ "name": "get_state", "arguments": { "sessionId": "<list_games 返回的 ID>" } }
```

再执行（使用当前真实的牌 ID 和 revision）：

```json
{
  "name": "play_hand",
  "arguments": {
    "sessionId": "<sessionId>",
    "expectedRevision": 42,
    "cardIds": [12, 27, 36]
  }
}
```

工具返回 text JSON 和 structuredContent，格式为：

```json
{
  "ok": true,
  "status": "accepted",
  "state": {
    "sessionId": "…",
    "revision": 51,
    "phase": "animating",
    "ready": false
  }
}
```

accepted 表示动作已经提交。计分、弃牌和发牌结束后才能继续；ready=false 时使用刚收到的 revision 等待：

```json
{
  "name": "wait_for_state_change",
  "arguments": {
    "sessionId": "<sessionId>",
    "afterRevision": 51,
    "readyOnly": true,
    "timeoutMs": 10000
  }
}
```

wait 最长 30 秒。status=timeout 时仍需检查 state.ready；不要把超时当作动作完成。同步动作返回 ready=true 时可直接考虑下一步，无需等待额外版本变化。游戏修订号是单调递增的状态版本，可能因一个动作增加多次。

失败返回 isError=true 和 `{"ok":false,"error":{"code":"…","message":"…"},"state":…}`：

- stale_revision：玩家或其他客户端改变了局面。重新读取并决策。
- busy：当前动画尚未完成。等待 ready。
- invalid_arguments / illegal_action / wrong_phase：参数、目标、资源或阶段不满足要求，按返回原因修正。
- session_not_found / disconnected：重新启用或发现游戏会话。
- browser_timeout / bridge_unavailable / cancelled：请求可能已经执行。先检查局面，避免直接重放。

## 给 agent 的建议提示词

项目包含可复用 Skill：`skills/play-browslatro/SKILL.md`。将整个 `play-browslatro` 文件夹放入你的 harness 的技能目录，或让它直接读取该 SKILL.md。Skill 包含阶段路由、局面版本、目标顺序、异步等待、断线恢复和终局停止规则。Codex 中可使用 `$play-browslatro`；其他 harness 按自身方式加载。

> 使用 Browslatro MCP 工具完成一局游戏。先 list_games 选择会话，读取 get_rules overview 和 get_state。根据当前局面查阅需要的道具规则，规划动作。所有动作使用最新的 sessionId 和 expectedRevision。只有 ready=true 时才能修改局面。动作 accepted 后若 ready=false，调用 wait_for_state_change；超时后继续检查 readiness。遇到 stale_revision 重新读取和思考。不要猜测隐藏牌，也不要因通信超时直接重放动作。目标是击败第 8 底注的 Boss；可以随时观察、查询和思考，无需每次模型响应都执行动作。

## 可见性与验证

观察不包含抽牌顺序、随机数状态、未打开卡包的内容或未来商店商品。面朝下的牌只暴露 ID，隐藏的小丑牌只暴露当前索引。整个牌组的组成提供聚合计数，不提供能与隐藏牌 ID 对照的牌表。观察和规则查询不消耗游戏随机数。

单元测试覆盖参数校验、旧版本、动画忙碌、非法选牌、资源限制、道具目标、隐藏信息、会话断开和等待。e2e/mcp.spec.ts 使用官方 MCP Client + stdio 子进程控制真实浏览器，验证完整操作链路，无需模型密钥。

```sh
corepack yarn test src/mcp/controller.test.ts scripts/mcp/broker.test.ts
corepack yarn build
corepack yarn e2e e2e/mcp.spec.ts --workers 1
```

需要使用已安装的 Chrome 时，先设置 PLAYWRIGHT_CHANNEL=chrome；否则使用 Playwright Chromium。
