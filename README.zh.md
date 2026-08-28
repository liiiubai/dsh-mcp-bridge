# dsh-mcp-bridge

> 把 DeepSeek Harness 的工具能力暴露为标准 **MCP Server** —— 让 Claude Code、Codex、OpenClaw 等任意 MCP 客户端来驱动 `dsh`。

`dsh-mcp-bridge` 把正在运行的 DeepSeek Harness 变成 Model Context Protocol 服务器（**streamable HTTP**）。任何 MCP 客户端都能通过**安全白名单**发现并调用 DSH 的真实工具（文件读取、glob、grep、联网搜索等）——而每一次调用仍然走 DSH 自己的沙箱与审批管线。

零依赖、零构建、装完即用。

## 为什么需要它

| | 官方 `dsh-mcp-client` | **dsh-mcp-bridge（本项目）** |
|---|---|---|
| 方向 | DSH → 外部 MCP **Server**（把工具接进来） | 外部 MCP **客户端** → DSH（把能力放出去） |
| 传输 | stdio / streamable-http 客户端 | streamable HTTP **服务端**，挂在 `/mcp` |
| 客户端 UI | 无（纯 YAML 配置） | —（规划中：可视化管理面板） |

官方 client 回答的是"dsh 里怎么用 MCP 服务器"；本项目回答反向问题："别的 agent 怎么把 dsh 当工具供应商用"。

## 快速开始

### 1. 安装 bundle

```sh
# 本地 checkout
dsh plugin --profile <name> add ./mcp-bridge

# 从 GitHub 安装（纯 JS，零构建）
dsh plugin --profile <name> add github:you/dsh-mcp-bridge
```

### 2. 配置（可选）

bundle 自带的 `cordis.patch.yml` 已经把服务器挂到 `/mcp`，并使用安全的默认白名单。可以在 profile 的 `cordis.patch.yml` 里调整：

```yaml
- id: mcp-bridge
  config:
    path: /mcp                        # 端点路径
    allowlist:                        # 暴露给 MCP 客户端的 DSH 工具
      - read
      - glob
      - grep
      - web_search
```

### 3. 连接任意 MCP 客户端

```sh
# Claude Code
claude mcp add --transport http dsh http://127.0.0.1:3080/mcp

# 任意 MCP 客户端 / SDK
# URL: http://127.0.0.1:3080/mcp
```

工具以 `dsh_<名字>` 出现（如 `dsh_read`、`dsh_glob`、`dsh_grep`、`dsh_web_search`）。

## 安全模型

- **默认白名单**只暴露只读、低风险工具（`read`、`glob`、`grep`、`web_search`）。
- **硬性黑名单**（`pwsh`、`write`、`edit`、子代理编排、cordis 控制类等）**永远无法暴露**——即使被误配进白名单也会被拒绝。
- 每次调用仍然经过 DSH 自己的**沙箱 + 审批管线**。
- 只应在回环地址（`127.0.0.1`）上提供服务；除非网络环境可信，不要绑定 `0.0.0.0`。

## 双向使用：也把工具接进来

`dsh-mcp-bridge` 覆盖**输出**方向（DSH → MCP 客户端）。**输入**方向（把第三方 MCP Server 挂进 DSH）用官方 `@deepseek-ai/dsh-mcp-client`，每个服务器一行配置：

```yaml
- id: mcp-github
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
```

之后模型会看到 `mcp__github__*` 工具，与本桥接器暴露的 `dsh_*` 工具并存。二者组合让 DSH 成为 MCP 生态的完整公民：

```
Claude Code ──HTTP──▶ dsh-mcp-bridge ──▶ DSH 工具（read/glob/grep/web_search）
DSH 模型    ──stdio─▶ dsh-mcp-client ──▶ 任意 MCP Server（GitHub/filesystem/…）
```

完整示例：[`examples/bidirectional.cordis.patch.yml`](examples/bidirectional.cordis.patch.yml) · Claude Code 快速连接：[`examples/claude-code-connect.md`](examples/claude-code-connect.md)

## 工作原理

```
MCP 客户端 ──streamable HTTP──▶ /mcp（webServer 路由）
                                  │ JSON-RPC 2.0（initialize / tools/list / tools/call）
                                  ▼
                    dsh-mcp-bridge 协议层（零依赖纯 JS）
                                  │ 白名单 + 黑名单
                                  ▼
                 agent scope 视图的 ctx.tools（真实沙箱内执行）
```

桥接器通过 `ctx.tools` 的 **agent scope 视图**枚举工具（在 dsh 中 agent 对象本身就是 scope key），因此暴露的工具集与你 agent 实际拥有的完全一致——没有硬编码 schema。

## 开发

```sh
npm test          # node:test，零依赖（27 个用例）
npm run demo      # e2e：仓库代码 + 官方 MCP SDK 客户端
```

目录结构：

- `src/protocol.js` — JSON-RPC 2.0 消息处理（纯函数、可测试）
- `src/catalog.js` — 白名单/黑名单工具投影
- `src/transport.js` — streamable HTTP 处理器（POST JSON、GET SSE）
- `src/dsh.js` — agent scope 工具访问与结果映射
- `src/index.js` — Cordis 插件入口（`apply(ctx, config)`）

## 路线图

- [x] DSH 工具集变化时发送 `notifications/tools/list_changed`（SSE 广播）
- [x] 客户端可视化管理面板（服务器状态、工具树、连通性自测）——见 `src/client.js`
- [x] MCP **2026-07-28 无状态模式**：无握手、`server/discover`、请求 `_meta` 版本协商、`subscriptions/listen` 通知流
- [ ] 可配置 `serverInfo`、分页支持
- [ ] 可选暴露 Resources / Prompts

### 协议兼容性

| 客户端协议 | 行为 |
|---|---|
| 2025-06-18 | `initialize` 握手 + GET SSE 通知（官方 MCP SDK 实测通过） |
| 2026-07-28 | 无状态：无握手、请求 `_meta` 携带版本、`server/discover`、POST `subscriptions/listen` 流 |

## License

MIT
