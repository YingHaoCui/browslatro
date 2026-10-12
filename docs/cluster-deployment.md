# 内网集群部署

生产服务同时提供网页、浏览器 WebSocket `/mcp/game` 和标准 MCP Streamable HTTP `/mcp`。harness 连接 `/mcp`，多个前端浏览器访问网页后启用 MCP 控制，按 sessionId 区分各自游戏。游戏和模型仍然分离，服务不调用模型网关。

## Kaniko 在线构建

`Dockerfile.git` 参考 ModelDepot 的 Git Clone 构建模式。整份文件可提交给 Kaniko 在线构建平台，不需要外部构建上下文；所有 COPY 均来自构建阶段。

| 构建参数                            | 用途                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| GIT_REPO_URL                        | 必填，包含本次改动的 Git 仓库地址；不能使用未包含改动的原始上游                       |
| GIT_REF                             | 分支、标签或 commit SHA，默认 main                                                    |
| GIT_TOKEN                           | 可选 Git HTTPS token，平台关联 git_repo_id 后注入；公开仓库留空                       |
| CACHEBUST                           | 代码更新而分支名未变时传新值，强制重新拉代码                                          |
| HTTP_PROXY / HTTPS_PROXY / NO_PROXY | 平台代理配置透传，仅用于构建阶段                                                      |
| BUILD_STRICT_SSL                    | 默认 true；内网代理重签证书且构建器缺少 CA 时可设 false，放松 Git/Yarn 构建期证书检查 |
| SITE_URL                            | 网页 canonical、robots、sitemap 的构建地址，默认 http://browslatro.internal           |

Token 通过临时 Git Authorization header 使用，未写入仓库 URL，Git 元数据和构建代理不进入运行镜像。最终镜像使用 Node.js 24，生产依赖和静态资源，非 root 用户执行 `node scripts/serve.ts`。服务端口为 **8080**。

使用常规仓库构建上下文时选择 `Dockerfile`：

```sh
docker build --build-arg SITE_URL=http://browslatro.internal -t registry.internal/browslatro:latest .
docker push registry.internal/browslatro:latest
```

本地容器验证可运行 `docker compose up --build`，然后访问 http://localhost:8080/。

## 平台部署配置

| 字段               | 值                                                            |
| ------------------ | ------------------------------------------------------------- |
| 启动命令           | 镜像默认 CMD，无需覆盖                                        |
| 容器监听           | 0.0.0.0:8080                                                  |
| Service targetPort | 8080                                                          |
| 网页入口           | /                                                             |
| harness MCP URL    | http://你的内网域名/mcp                                       |
| liveness           | GET /healthz                                                  |
| readiness          | GET /readyz                                                   |
| 副本数             | 1                                                             |
| 更新方式           | Recreate                                                      |
| 优雅终止时间       | 15 秒                                                         |
| 初始资源           | request 100m CPU / 128Mi；limit 1 CPU / 512Mi，按会话负载调整 |

`deploy/kubernetes.yaml` 包含 ConfigMap、Deployment、ClusterIP Service 和 nginx Ingress。替换镜像地址、域名、命名空间和 ingressClassName，然后：

```sh
kubectl apply -f deploy/kubernetes.yaml
```

如果平台已经管理 Ingress/Service，可以只参考 Deployment 的端口、环境变量与探针配置。Ingress 必须转发 WebSocket Upgrade，保留外部 Host，不改写路径；模板设置了 3600 秒读写超时并关闭代理缓冲。仅支持挂在域名根路径，暂不支持 `/browslatro/` 之类的子路径部署。

## 运行环境变量

| 变量           | 默认值 / 说明                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| HOST           | 0.0.0.0                                                                                                                    |
| PORT           | 8080                                                                                                                       |
| BUILD_DIR      | build，相对进程工作目录                                                                                                    |
| PUBLIC_ORIGINS | 允许的外部浏览器 Origin，逗号分隔，例如 http://browslatro.internal,https://browslatro.internal；同 Host 的 Origin 自动允许 |
| MCP_AUTH_TOKEN | 空值允许可信内网客户端访问全部已启用的会话；可选设置 Bearer Token                                                          |

这些是运行环境变量；`yarn serve` 不自动加载 `.env` 文件，可由平台注入，或使用 `node --env-file=.env scripts/serve.ts`。浏览器不需要 Token，仍需主动启用 MCP 控制。Token（如配置）用于保护 harness 的 `/mcp` 和 stdio adapter 的 `/mcp/bridge` 请求。当前是可信内网共用服务，没有用户账号或每用户会话权限。

服务处理 SIGTERM/SIGINT：停止接受新动作、关闭 MCP 与浏览器连接，最多等待 5 秒后结束剩余连接。WebSocket 心跳清理失联会话。重启后浏览器会自动重连并取得新 sessionId；harness 应重新 list_games，不重放结果未知的动作。

## harness 接入

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

如启用 Token，为上面的配置增加：

```json
"headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
```

如果 harness 仅支持 stdio，运行项目的 `scripts/mcp/server.ts`，将 BROWSLATRO_URL 设为内网服务地址，MCP_AUTH_TOKEN 设为相同的可选密钥。工具流程和配套 Skill 不变。

## 会话和扩容边界

当前每个网页维护自己的游戏规则、动画和局面，Node 服务维护所有浏览器的连接与路由。可以有多个浏览器和多个 harness 同时连接，但两个 harness 操作同一局会受到 revision 冲突校验。多个浏览器共同观看或操作同一局并未实现。

会话索引在单个进程内存中，因此 Deployment 固定 **replicas: 1 + Recreate**。不要直接添加 HPA 或增加副本；仅设置 sticky session 也无法保证不同客户端的 browser 和 harness 被路由到同一个 Pod。需要多个活跃副本时，应先增加共享会话注册和跨 Pod 消息路由（例如 Redis）。

不用挂载持久卷，游戏存档仍保存在浏览器 localStorage；不同浏览器/设备分别存储，同一浏览器同源标签页共享存档槽。服务重启会更换 MCP 会话 ID，不会主动重置仍打开的网页游戏。当前没有服务端账号存档、断线后无人运行或无头批量游戏功能。

## 验证

`scripts/mcp/service.test.ts` 覆盖标准 HTTP MCP 握手与工具调用、多会话路由、可选认证、Origin、静态资源、探针、等待和关闭。真实浏览器测试：

```sh
corepack yarn build
BROWSLATRO_SERVER_MODE=production corepack yarn e2e e2e/mcp.spec.ts e2e/mcp-http.spec.ts --workers 1
```

Windows PowerShell 设置 `$env:BROWSLATRO_SERVER_MODE='production'`；使用本机 Chrome 可同时设置 `$env:PLAYWRIGHT_CHANNEL='chrome'`。
