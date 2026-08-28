# Changelog

All notable changes to dsh-mcp-bridge are documented here.

## [0.3.0] - 2026

### Added
- MCP **2026-07-28 stateless protocol mode**:
  - `server/discover` RPC advertising supported versions and capabilities
  - request `_meta` protocol-version negotiation with explicit rejection of unsupported versions
  - `subscriptions/listen` long-lived POST stream for change notifications
- `notifications/tools/list_changed` broadcast (SSE) when the DSH tool set changes
- Client-side management panel (settings section): server status, tool tree, connectivity self-test
- Live demo script (`.mcp-test/demo.mjs`), stateless-protocol e2e (`.mcp-test/e2e-stateless.mjs`)

### Changed
- Protocol layer is stateless-friendly: each POST request is handled independently
- `_meta` server identity only attached for 2026-07-28 requests (2025-06-18 clients reject unknown keys)

## [0.2.0] - 2026

### Added
- Agent-scope tool enumeration (`agents.list()` → `tools.schemas(agent)`) — agent objects are scope keys
- Real tool forwarding through `ctx.tools.execute` with the DSH sandbox/approval pipeline
- AbortSignal-compatible object for the sandbox (no `AbortController` global)

## [0.1.0] - 2026

### Added
- Zero-dependency JSON-RPC 2.0 protocol layer (2025-06-18 compatible)
- Streamable HTTP transport: POST JSON-RPC, GET SSE, 405 handling
- Allowlist/denylist tool projection with hard denylist for dangerous tools
- Cordis bundle packaging (`dsh.bundle` + `cordis.patch.yml`)
- 35+ node:test cases and official MCP SDK e2e verification
