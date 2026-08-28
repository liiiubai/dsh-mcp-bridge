import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHttpHandler } from '../src/transport.js'
import { createProtocol } from '../src/protocol.js'

function makeHandler() {
  return createHttpHandler(createProtocol({
    serverInfo: { name: 't', version: '1' },
    listTools: () => [{ name: 'dsh_info', description: 'info', inputSchema: { type: 'object' } }],
    callTool: async (name) => ({ content: [{ type: 'text', text: `ok:${name}` }] }),
  }))
}

/** 用真实 HTTP server 驱动 handler，验证协议在线上行为。 */
async function withServer(entry, fn) {
  const server = http.createServer(entry.handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  try {
    await fn(`http://127.0.0.1:${port}`, entry)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('POST initialize 返回 200 + JSON', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    assert.equal(resp.status, 200)
    const json = await resp.json()
    assert.equal(json.result.serverInfo.name, 't')
  })
})

test('POST notification 返回 202 空体', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
    assert.equal(resp.status, 202)
    assert.equal(await resp.text(), '')
  })
})

test('POST tools/call 全链路', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'dsh_info', arguments: {} } }),
    })
    const json = await resp.json()
    assert.equal(json.result.content[0].text, 'ok:dsh_info')
  })
})

test('非法 JSON 返回 400 parse error', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    assert.equal(resp.status, 400)
    const json = await resp.json()
    assert.equal(json.error.code, -32700)
  })
})

test('非 POST/GET 方法返回 405', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, { method: 'DELETE' })
    assert.equal(resp.status, 405)
  })
})

test('GET 返回 SSE 端点事件（连接保持打开供 server 通知）', async () => {
  await withServer(makeHandler(), async (base) => {
    const resp = await fetch(`${base}/mcp`, {
      headers: { Accept: 'text/event-stream' },
    })
    assert.equal(resp.status, 200)
    assert.match(resp.headers.get('content-type'), /text\/event-stream/)
    // SSE 连接不会自行关闭：读取首个 chunk 后取消即可
    const reader = resp.body.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    assert.match(text, /event: endpoint/)
    assert.match(text, /data: \/mcp/)
    await reader.cancel()
  })
})

test('broadcast 向活跃 SSE 客户端推送 message 帧', async () => {
  await withServer(makeHandler(), async (base, entry) => {
    const resp = await fetch(`${base}/mcp`, { headers: { Accept: 'text/event-stream' } })
    const reader = resp.body.getReader()
    await reader.read() // 消费 endpoint 事件

    entry.broadcast({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    assert.match(text, /event: message/)
    assert.match(text, /notifications\/tools\/list_changed/)

    await reader.cancel()
  })
})

test('broadcast 在无 SSE 客户端时是安全 no-op', () => {
  const entry = makeHandler()
  assert.doesNotThrow(() => entry.broadcast({ jsonrpc: '2.0', method: 'x' }))
})

test('2026-07-28：POST subscriptions/listen 建立长连接通知流', async () => {
  await withServer(makeHandler(), async (base, entry) => {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'subscriptions/listen', params: { subscriptions: ['toolsListChanged'] } }),
    })
    assert.equal(resp.status, 200)
    assert.match(resp.headers.get('content-type'), /text\/event-stream/)
    const reader = resp.body.getReader()
    const first = await reader.read()
    assert.match(new TextDecoder().decode(first.value), /event: endpoint/)

    // 工具变化广播应到达订阅流
    entry.broadcast({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
    const second = await reader.read()
    assert.match(new TextDecoder().decode(second.value), /notifications\/tools\/list_changed/)

    await reader.cancel()
  })
})
