/**
 * dsh-mcp-bridge 插件入口。
 *
 * 把 DeepSeek Harness 的工具能力暴露为标准 MCP Server
 * （streamable HTTP，默认挂在 /mcp 路由），任何 MCP 兼容客户端
 * （Claude Code / Codex / OpenClaw 等）都可以连接并调用 DSH 工具。
 *
 * 安装为 DSH bundle 后通过 cordis.patch.yml 挂载：
 *
 * ```yaml
 * - id: mcp-bridge
 *   name: 'dsh-mcp-bridge'
 *   config:
 *     path: /mcp
 *     allowlist: [read, glob, grep, web_search]
 * ```
 */
import { createProtocol, PROTOCOL_VERSION } from './protocol.js'
import { createHttpHandler } from './transport.js'
import { buildCatalog, DEFAULT_ALLOWLIST, DEFAULT_DENYLIST } from './catalog.js'
import { findScopedTools, callDshTool } from './dsh.js'

export const name = 'dsh-mcp-bridge'

export function apply(ctx, config = {}) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return
  const tools = ctx.get('tools')
  if (tools === undefined) return

  const path = config.path ?? '/mcp'
  const allowlist = config.allowlist ?? DEFAULT_ALLOWLIST
  const denylist = config.denylist ?? DEFAULT_DENYLIST
  const serverInfo = config.serverInfo ?? { name: 'dsh-mcp-bridge', version: '0.1.0' }

  let callSeq = 0
  const scoped = () => findScopedTools(ctx, tools)

  const handleMessage = createProtocol({
    serverInfo,
    listTools() {
      const { t, agent } = scoped()
      let schemas = []
      try {
        schemas = t.schemas(agent) ?? []
      } catch {
        schemas = []
      }
      return buildCatalog(schemas, { allowlist, denylist })
        .map((entry) => ({
          name: entry.mcpName,
          description: entry.description,
          inputSchema: entry.inputSchema,
        }))
    },
    async callTool(mcpName, args) {
      const { t, agent } = scoped()
      const schemas = t.schemas(agent) ?? []
      const entry = buildCatalog(schemas, { allowlist, denylist })
        .find((candidate) => candidate.mcpName === mcpName)
      if (entry === undefined) {
        const err = new Error(`unknown tool: ${mcpName}`)
        err.code = 'UNKNOWN_TOOL'
        throw err
      }
      return callDshTool(t, agent, entry.rawName, args, ++callSeq)
    },
  })

  const { handler, broadcast } = createHttpHandler(handleMessage)
  const disposeRoute = webServer.register({
    kind: 'exact',
    path,
    handler,
  })

  // 工具集变化（注册/注销/限制变更）→ 向所有已连接 MCP 客户端广播
  // notifications/tools/list_changed，客户端随后重新 tools/list。
  const disposeChange = ctx.on('tools/change', () => {
    broadcast({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
  })

  // Package-private RPC：供 Client 管理面板（src/client.js）调用。
  // 动态沙箱环境使用 harness.handle；模块版可替换为官方
  // ctx.connection.rpc.handle('/rpc', ...) 通道。
  const rpc = typeof harness !== 'undefined' && typeof harness.handle === 'function' ? harness : undefined
  if (rpc !== undefined) {
    rpc.handle('mcp.status', async () => {
      const { t, agent } = scoped()
      let schemas = []
      try {
        schemas = t.schemas(agent) ?? []
      } catch {
        schemas = []
      }
      const entries = buildCatalog(schemas, { allowlist, denylist })
      return {
        path,
        protocolVersion: PROTOCOL_VERSION,
        serverInfo,
        toolCount: entries.length,
        tools: entries.map((entry) => ({ name: entry.mcpName, description: entry.description })),
      }
    })
    rpc.handle('mcp.ping', async () => ({ ok: true, endpoint: path }))
  }

  return () => disposeRoute()
}
