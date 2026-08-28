/**
 * JSON-RPC 2.0 消息处理层（MCP over streamable HTTP）。
 *
 * 纯函数式设计：不持有任何 DSH 依赖，所有外部能力通过构造参数注入，
 * 便于单元测试与协议演进（2025-06-18 / 2026-07-28）。
 */

/** 默认声明的协议版本（2025-06-18 握手模式）。 */
export const PROTOCOL_VERSION = '2025-06-18'

/** 支持的协议版本（2026-07-28 起无状态：无握手、请求 _meta 携带版本）。 */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2026-07-28']

/** 2026-07-28 无状态协议下请求 _meta 中携带协议版本的键。 */
export const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion'

/** 2026-07-28 无状态协议下响应 _meta 中标识服务器身份的键。 */
export const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'

/** JSON-RPC 2.0 错误码。 */
export const ErrorCode = Object.freeze({
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
})

/**
 * 创建 MCP 协议处理器。
 * @param {object} deps - 注入的外部能力。
 * @param {() => Array<{ name: string; description: string; inputSchema: object }>} deps.listTools
 *   返回当前 MCP 工具目录（MCP 命名空间下的工具列表）。
 * @param {(name: string, args: object) => Promise<{ content: unknown[]; isError?: boolean }>} deps.callTool
 *   执行一个 MCP 工具调用，返回 MCP 格式的结果。
 * @param {object} [deps.serverInfo] - initialize 时声明的服务器信息。
 * @param {string} [deps.protocolVersion] - 声明的协议版本。
 * @returns {(msg: object) => Promise<object | null>} 处理一条 JSON-RPC 消息；
 *   notification 返回 null（无响应体）。
 */
export function createProtocol(deps) {
  const serverInfo = deps.serverInfo ?? { name: 'dsh-mcp-bridge', version: '0.1.0' }
  const protocolVersion = deps.protocolVersion ?? PROTOCOL_VERSION

  return async function handleMessage(msg) {
    if (msg === null || typeof msg !== 'object') {
      return { jsonrpc: '2.0', id: null, error: { code: ErrorCode.INVALID_REQUEST, message: 'invalid request' } }
    }

    // 2026-07-28 无状态协议：请求在 _meta 中声明协议版本
    const declared = msg._meta?.[META_PROTOCOL_VERSION]
    if (typeof declared === 'string' && !SUPPORTED_PROTOCOL_VERSIONS.includes(declared)) {
      return { jsonrpc: '2.0', id: msg.id, error: { code: ErrorCode.INVALID_PARAMS, message: `unsupported protocol version: ${declared} (supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})` } }
    }
    // 只有声明了 2026-07-28 的请求才在响应中携带 _meta——2025-06-18
    // 客户端的 JSON-RPC schema 严格拒绝未知键（官方 SDK 实测）。
    const stateless = declared === '2026-07-28'
    const respond = (result) => stateless
      ? { jsonrpc: '2.0', id: msg.id, result, _meta: { [META_SERVER_INFO]: serverInfo } }
      : { jsonrpc: '2.0', id: msg.id, result }
    const respondError = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })

    switch (msg.method) {
      case 'initialize':
        // 2025-06-18 握手模式
        return respond({
          protocolVersion,
          capabilities: { tools: { listChanged: true } },
          serverInfo,
        })
      case 'server/discover':
        // 2026-07-28：通告支持的版本、能力与身份，供客户端版本选择
        return respond({
          protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: { tools: { listChanged: true } },
          serverInfo,
        })
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/tools/list_changed':
        // notification：无响应体
        return null
      case 'ping':
        // 2025-06-18 保留；2026-07-28 已移除 ping
        return respond({})
      case 'tools/list': {
        const tools = deps.listTools()
        return respond({ tools })
      }
      case 'tools/call': {
        const { name, arguments: args } = msg.params ?? {}
        if (typeof name !== 'string') {
          return respondError(ErrorCode.INVALID_PARAMS, 'tools/call requires a tool name')
        }
        try {
          const result = await deps.callTool(name, args ?? {})
          return respond(result)
        } catch (err) {
          const message = err && err.message ? err.message : String(err)
          return respondError(ErrorCode.INTERNAL_ERROR, message)
        }
      }
      default:
        return respondError(ErrorCode.METHOD_NOT_FOUND, `unknown method: ${msg.method}`)
    }
  }
}
