# awesome 列表投稿条目草稿（复制到各列表的 README）

## 条目文本（英文）

```markdown
- [dsh-mcp-bridge](https://github.com/<you>/dsh-mcp-bridge) — Expose DeepSeek Harness tools as a standard MCP server (streamable HTTP). Drive dsh from Claude Code / Codex / any MCP client; safe allowlist, zero dependencies, dual protocol (2025-06-18 + 2026-07-28 stateless).
```

## 条目文本（中文，适用于双语列表）

```markdown
- [dsh-mcp-bridge](https://github.com/<you>/dsh-mcp-bridge) — 把 DSH 工具集暴露为标准 MCP Server（streamable HTTP）。让 Claude Code/Codex 等任意 MCP 客户端驱动 dsh；安全白名单、零依赖、双协议兼容（2025-06-18 + 2026-07-28 无状态）。
```

## PR 标题与正文模板

**标题**：`add dsh-mcp-bridge to the plugin list`

**正文**：

```markdown
## What

[dsh-mcp-bridge](https://github.com/<you>/dsh-mcp-bridge) exposes a running
DeepSeek Harness as a standard MCP server over streamable HTTP — any MCP
client (Claude Code, Codex, OpenClaw, …) can discover and call the real DSH
tools (`dsh_read`, `dsh_glob`, `dsh_grep`, `dsh_web_search`) through a safe
allowlist with a hard denylist for dangerous tools.

## Why it fits

- Covers the **out** direction the official `@deepseek-ai/dsh-mcp-client`
  does not: external clients → DSH.
- Zero dependencies, zero build (`dsh plugin add` from git works directly).
- Dual protocol: 2025-06-18 handshake (verified with official MCP SDK) and
  2026-07-28 stateless (`server/discover`, `_meta` versioning,
  `subscriptions/listen`).
- 38 node:test cases + official SDK e2e.
```

## 投稿列表（按顺序）

1. https://github.com/wgd753/awesome-dsh-plugin
2. https://github.com/Anil-matcha/awesome-dsh-plugin
3. https://github.com/billLiao/awesome-dsh-plugin
4. https://github.com/beancookie/awesome-dsh-plugin
