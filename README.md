# dsh-mcp-bridge

> Expose DeepSeek Harness tools as a standard **MCP Server** — drive `dsh` from Claude Code, Codex, OpenClaw, or any MCP-compatible client.

`dsh-mcp-bridge` turns your running DeepSeek Harness into a Model Context Protocol server over **streamable HTTP**. Any MCP client can discover and call the real DSH tools (file read, glob, grep, web search…) through a **safe allowlist** — while your workspace keeps DSH's own sandbox and approval pipeline on every call.

Zero dependencies. Zero build step. Install and go.

## Why

| | Official `dsh-mcp-client` | **dsh-mcp-bridge (this)** |
|---|---|---|
| Direction | DSH → external MCP **servers** (bring tools *in*) | External MCP **clients** → DSH (expose tools *out*) |
| Transport | stdio / streamable-http client | streamable HTTP **server** at `/mcp` |
| Client UI | none (YAML config) | — (roadmap: management panel) |

The official client answers "how do I use MCP servers in dsh?". This project answers the reverse: "how do other agents use **dsh** as a tool provider?".

## Quick start

### 1. Install the bundle

```sh
# from a checkout
dsh plugin --profile <name> add ./mcp-bridge

# or from GitHub (zero build — plain JS)
dsh plugin --profile <name> add github:you/dsh-mcp-bridge
```

### 2. Configure (optional)

The bundle's `cordis.patch.yml` already mounts the server on `/mcp` with the safe default allowlist. Tune it in your profile's `cordis.patch.yml`:

```yaml
- id: mcp-bridge
  config:
    path: /mcp                        # endpoint path
    allowlist:                        # DSH tools exposed to MCP clients
      - read
      - glob
      - grep
      - web_search
```

### 3. Connect any MCP client

```sh
# Claude Code
claude mcp add --transport http dsh http://127.0.0.1:3080/mcp

# Any MCP client / SDK
# URL: http://127.0.0.1:3080/mcp
```

Tools appear as `dsh_<name>` (e.g. `dsh_read`, `dsh_glob`, `dsh_grep`, `dsh_web_search`).

## Security model

- **Default allowlist** exposes only read-only, low-risk tools (`read`, `glob`, `grep`, `web_search`).
- **Hard denylist** (`pwsh`, `write`, `edit`, subagent orchestration, cordis control…) can never be exposed — even if misconfigured into the allowlist.
- Every call still runs through DSH's own **sandbox + approval** pipeline.
- Serve on loopback (`127.0.0.1`) only; do not bind `0.0.0.0` unless you know the network is trusted.

## Bidirectional: bring tools in too

`dsh-mcp-bridge` covers the **out** direction (DSH → MCP clients). For the **in** direction (attach third-party MCP servers to DSH), use the official `@deepseek-ai/dsh-mcp-client` — one line per server in your `cordis.patch.yml`:

```yaml
- id: mcp-github
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
```

Your model then sees `mcp__github__*` tools alongside the `dsh_*` tools this bridge exposes. Together they make DSH a full citizen of the MCP ecosystem:

```
Claude Code ──HTTP──▶ dsh-mcp-bridge ──▶ DSH tools (read/glob/grep/web_search)
DSH model   ──stdio─▶ dsh-mcp-client ──▶ any MCP server (GitHub/filesystem/…)
```

Full example: [`examples/bidirectional.cordis.patch.yml`](examples/bidirectional.cordis.patch.yml) · Claude Code quickstart: [`examples/claude-code-connect.md`](examples/claude-code-connect.md)

## How it works

```
MCP client ──streamable HTTP──▶ /mcp (webServer route)
                                  │ JSON-RPC 2.0 (initialize / tools/list / tools/call)
                                  ▼
                        dsh-mcp-bridge protocol layer (zero-dep, pure JS)
                                  │ allowlist + denylist
                                  ▼
                  agent-scoped ctx.tools (execute with real sandbox)
```

The bridge enumerates tools through the agent-scope view of `ctx.tools` (agents are scope keys in dsh), so the tool set you expose matches what your agents actually have — no hardcoded schemas.

## Development

```sh
npm test          # node:test, zero dependencies (38 tests)
npm run demo      # live demo against a running DSH at http://127.0.0.1:3080/mcp
npm run demo:mock # e2e: repo code + official MCP SDK client (no DSH needed)
node .mcp-test/e2e-stateless.mjs [url]   # 2026-07-28 stateless-protocol e2e
```

Layout:

- `src/protocol.js` — JSON-RPC 2.0 message handling (pure, testable)
- `src/catalog.js` — allowlist/denylist tool projection
- `src/transport.js` — streamable HTTP handler (POST JSON, GET SSE)
- `src/dsh.js` — agent-scoped tools access + result mapping
- `src/index.js` — Cordis plugin entry (`apply(ctx, config)`)

## Roadmap

- [x] `notifications/tools/list_changed` when the DSH tool set changes (SSE broadcast)
- [x] Client-side management panel (server status, tool tree, connectivity self-test) — see `src/client.js`
- [x] MCP **2026-07-28 stateless mode**: no handshake, `server/discover`, request `_meta` versioning, `subscriptions/listen` stream
- [ ] Configurable `serverInfo`, pagination support
- [ ] Optional exposure of Resources/Prompts

### Protocol compatibility

| Client protocol | Behavior |
|---|---|
| 2025-06-18 | `initialize` handshake + GET SSE notifications (official MCP SDK verified) |
| 2026-07-28 | stateless: no handshake, version in request `_meta`, `server/discover`, POST `subscriptions/listen` stream |

## License

MIT
