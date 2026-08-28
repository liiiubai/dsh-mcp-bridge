# 发布帖草稿（知乎 / 即刻 / 掘金）

## 标题候选

1. 让 Claude Code 用上 DeepSeek Harness 的沙箱工具：dsh-mcp-bridge 开源
2. 官方只做了 client，我们补上了 server：DSH ↔ MCP 双向桥接
3. 零依赖把 DSH 变成 MCP Server，Claude Code 直接调用它的工具

## 正文草稿

DeepSeek Harness 开源后，"一切皆插件"的生态正在爆发。但有一个空白：
**官方只提供了 MCP client**（把外部 MCP server 接进 DSH），反方向——
让 Claude Code / Codex / OpenClaw 等任意 MCP 客户端**调用 DSH 的工具能力**——
一直没有完整方案。

我做了 [dsh-mcp-bridge](https://github.com/<you>/dsh-mcp-bridge)（已开源）：

### 它做什么

一条命令安装后，你的 DSH 就变成一个标准 MCP Server：

```
claude mcp add --transport http dsh http://127.0.0.1:3080/mcp
```

然后 Claude Code 就能用 `dsh_read`、`dsh_glob`、`dsh_grep`、`dsh_web_search`
——每个调用仍然走 DSH 自己的沙箱和审批管线。

### 关键设计

- **安全第一**：默认只暴露只读工具；pwsh/write/edit 等进了硬黑名单，配置错也暴露不了
- **双协议兼容**：2025-06-18 握手模式（官方 SDK 实测）+ 2026-07-28 无状态模式（server/discover、_meta 版本协商、subscriptions/listen）
- **零依赖零构建**：纯 JS，`dsh plugin add` 从 git 直接装，没有 TS 的 prepare 构建坑
- **工具集自动同步**：DSH 工具变化时通过 SSE 广播 `tools/list_changed`
- **38 个测试** + 官方 MCP SDK e2e 验证

### 双向闭环

配合官方 `dsh-mcp-client`，DSH 同时是 MCP 的 provider 和 consumer：

```
Claude Code ──HTTP──▶ dsh-mcp-bridge ──▶ DSH 工具（沙箱内执行）
DSH 模型    ──stdio─▶ dsh-mcp-client ──▶ 任意第三方 MCP Server
```

### 快速开始

```sh
dsh plugin --profile <name> add github:you/dsh-mcp-bridge
```

欢迎 star / PR / issue。下一步路线：管理面板完善、分页、Resources/Prompts 暴露。

---

（配图建议：demo 录屏 GIF，`node .mcp-test/demo.mjs` 的输出就是现成脚本）
