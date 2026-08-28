# 发布指引（Publishing Guide）

把 dsh-mcp-bridge 发布到 GitHub 并进入 DSH 生态目录的完整步骤。

## 1. 建仓并推送

```sh
cd mcp-bridge
git init
git add .
git commit -m "feat: expose DeepSeek Harness tools as an MCP server (streamable HTTP)

- zero-dependency JSON-RPC 2.0 protocol layer (2025-06-18 compatible)
- allowlist/denylist tool projection (read-only defaults, hard denylist)
- agent-scope tool enumeration and execution with sandbox pipeline
- 27 node:test cases + official MCP SDK e2e verification
- bidirectional usage with official dsh-mcp-client (examples/)"
git branch -M main
git remote add origin https://github.com/<you>/dsh-mcp-bridge.git
git push -u origin main
```

## 2. GitHub 仓库设置

- **Topics**（Settings → Topics，自动收录关键）：
  `dsh-plugin`、`deepseek-harness`、`mcp`、`model-context-protocol`、`agent`、`deepseek`
  > 官方 awesome 列表（wgd753/awesome-dsh-plugin）用 GitHub Actions 每日自动爬取
  > `topic:dsh-plugin` / `topic:deepseek-harness`，打对标签 = 免费曝光。
- **Description**：`Expose DeepSeek Harness tools as a standard MCP server (streamable HTTP) — drive dsh from Claude Code, Codex, or any MCP client.`
- 开启 Issues 与 Discussions。

## 3. 投稿 awesome 列表（提 PR）

按顺序提交，每个 PR 附一句话描述 + 链接：

| 列表 | 地址 |
|---|---|
| awesome-dsh-plugin (wgd753, 自动爬取+人工维护) | https://github.com/wgd753/awesome-dsh-plugin |
| awesome-dsh-plugin (Anil-matcha) | https://github.com/Anil-matcha/awesome-dsh-plugin |
| awesome-dsh-plugin (billLiao) | https://github.com/billLiao/awesome-dsh-plugin |
| awesome-dsh-plugin (beancookie) | https://github.com/beancookie/awesome-dsh-plugin |

## 4. 演示素材

- README 首屏放 30 秒录屏 GIF：`claude mcp add` → `tools/list` → 调用 `dsh_glob` 搜索真实文件。
- 备选脚本素材（仓库内已就绪）：
  - `npm run demo` → `.mcp-test/e2e-repo.mjs` 的完整输出（官方 SDK 连接+调用）
  - `.mcp-test/verify-v02.mjs` → 真实 DSH 环境下的工具调用输出
- 写一篇发布帖（知乎/即刻/小红书），核心卖点：
  - "让 Claude Code 用上 DSH 的沙箱工具"
  - "官方只做了 client，server 方向第一个完整实现"
  - "零依赖零构建，dsh plugin add 即装"

## 5. 发布节奏建议

1. v0.1.0：当前仓库状态（MVP 完整可用）
2. v0.2.0：GUI 管理面板（设置页：状态/工具树/连通性测试）——代码已在开发中
3. v0.3.0：`tools/list_changed` 通知 + 2026-07-28 无状态协议模式
4. 每版发布都同步更新 awesome 列表条目和演示 GIF

## 6. 质量门槛（合入前自查）

```sh
npm test          # 27 用例全绿
npm run demo      # e2e 全绿（官方 SDK 互操作）
```
