/**
 * streamable HTTP 传输层：把 MCP 协议处理器挂到 DSH webServer 路由上。
 *
 * - POST /mcp：JSON-RPC 请求-响应；notification 回 202 空体。
 * - GET /mcp：SSE 通道（服务器通知用）。每个活跃 GET 连接注册到
 *   广播集合，`broadcast(message)` 向所有已连接客户端推送
 *   `event: message` 帧（如 `notifications/tools/list_changed`）。
 * - 其他方法：405。
 */

/**
 * 创建 HTTP 路由 handler 与 SSE 广播器。
 * @param {(msg: object) => Promise<object | null>} handleMessage - 协议处理器。
 * @returns {{ handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>, broadcast: (message: object) => void }}
 */
export function createHttpHandler(handleMessage) {
  /** 活跃 SSE 连接的响应对象集合（GET /mcp 保持打开）。 */
  const sseClients = new Set()

  async function handler(req, res) {
    if (req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write('event: endpoint\ndata: /mcp\n\n')
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'method not allowed' },
      }))
      return
    }

    let body = ''
    try {
      for await (const chunk of req) body += chunk
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'parse error' },
      }))
      return
    }

    let msg
    try {
      msg = JSON.parse(body)
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'parse error' },
      }))
      return
    }

    // 2026-07-28 无状态协议：subscriptions/listen 是长连接 POST 流，
    // 用于服务器向已订阅客户端推送变更通知（取代旧 GET SSE 端点）。
    if (msg.method === 'subscriptions/listen') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write('event: endpoint\ndata: /mcp\n\n')
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

    const result = await handleMessage(msg)
    if (result === null) {
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end('')
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  }

  /**
   * 向所有活跃 SSE 客户端广播一条 JSON-RPC 消息。
   * @param {object} message - 例如 `{ jsonrpc: '2.0', method: 'notifications/tools/list_changed' }`。
   */
  function broadcast(message) {
    const frame = `event: message\ndata: ${JSON.stringify(message)}\n\n`
    for (const res of sseClients) {
      try {
        res.write(frame)
      } catch {
        sseClients.delete(res)
      }
    }
  }

  return { handler, broadcast }
}
