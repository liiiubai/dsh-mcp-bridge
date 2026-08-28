// 2026-07-28 无状态协议 e2e：裸 JSON-RPC 客户端（无 SDK），完整走一遍
// server/discover → 无握手 tools/list → tools/call → subscriptions/listen。
//
// 用法：
//   node .mcp-test/e2e-stateless.mjs            # 自带 mock server（无外部依赖）
//   node .mcp-test/e2e-stateless.mjs <url>      # 连接运行中的 DSH（如 http://127.0.0.1:3080/mcp）
import http from 'node:http'
import { createProtocol } from '../src/protocol.js'
import { createHttpHandler } from '../src/transport.js'
import { buildCatalog, DEFAULT_ALLOWLIST } from '../src/catalog.js'

const META_VERSION = 'io.modelcontextprotocol/protocolVersion'
const STATELESS = '2026-07-28'

// ---- mock DSH tools ----
const mockSchemas = [
  { name: 'read', description: 'read a file', parameters: { type: 'object' } },
  { name: 'glob', description: 'glob files', parameters: { type: 'object' } },
  { name: 'pwsh', description: 'run powershell', parameters: { type: 'object' } },
]
async function mockCall(rawName, args) {
  if (rawName === 'glob') return { content: [{ type: 'text', text: `glob(${args.pattern}) -> a.mjs` }] }
  if (rawName === 'read') return { content: [{ type: 'text', text: `read(${args.file_path})` }] }
  throw new Error(`not callable: ${rawName}`)
}

const handleMessage = createProtocol({
  serverInfo: { name: 'dsh-mcp-bridge', version: '0.1.0' },
  listTools() {
    return buildCatalog(mockSchemas, { allowlist: DEFAULT_ALLOWLIST }).map((e) => ({ name: e.mcpName, description: e.description, inputSchema: e.inputSchema }))
  },
  async callTool(mcpName, args) {
    const entry = buildCatalog(mockSchemas, { allowlist: DEFAULT_ALLOWLIST }).find((e) => e.mcpName === mcpName)
    if (entry === undefined) throw new Error(`unknown tool: ${mcpName}`)
    return mockCall(entry.rawName, args)
  },
})

/** 裸 2026-07-28 客户端：不发 initialize，每次请求带 _meta 版本。 */
function statelessClient(base) {
  async function post(msg) {
    const resp = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ ...msg, _meta: { ...(msg._meta ?? {}), [META_VERSION]: STATELESS } }),
    })
    return { status: resp.status, json: await resp.json().catch(() => null), raw: resp }
  }
  return { post }
}

async function main() {
  const target = process.argv[2]
  let server
  let base

  if (target !== undefined) {
    base = target
    console.log(`[e2e-stateless] connecting to ${base}`)
  } else {
    const { handler } = createHttpHandler(handleMessage)
    server = http.createServer(handler)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
    console.log(`[e2e-stateless] mock server on ${base}`)
  }

  const client = statelessClient(base)

  // 1. server/discover（无需握手）
  const discover = await client.post({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} })
  if (discover.status !== 200 || !discover.json?.result?.protocolVersions?.includes(STATELESS)) throw new Error('discover failed')
  console.log(`[ok] server/discover -> versions ${discover.json.result.protocolVersions.join(', ')}`)

  // 2. 无握手 tools/list
  const list = await client.post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const names = list.json.result.tools.map((t) => t.name)
  if (!names.includes('dsh_read') || names.includes('dsh_pwsh')) throw new Error('tools/list wrong')
  console.log(`[ok] tools/list (no handshake) -> ${names.join(', ')}`)

  // 3. 无握手 tools/call
  const call = await client.post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dsh_glob', arguments: { pattern: '**/*.mjs', path: 'D:/my-code/ds-harness/mcp-bridge' } } })
  const callText = call.json?.result?.content?.[0]?.text
  if (typeof callText !== 'string' || callText.length === 0) throw new Error('tools/call wrong')
  console.log('[ok] tools/call (no handshake) ->', callText.split('\n').slice(0, 3).join('\n                          '))

  // 4. subscriptions/listen 长连接流
  const sub = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'subscriptions/listen', params: { subscriptions: ['toolsListChanged'] }, _meta: { [META_VERSION]: STATELESS } }),
  })
  if (sub.status !== 200 || !String(sub.headers.get('content-type')).includes('text/event-stream')) throw new Error('subscriptions/listen failed')
  const reader = sub.body.getReader()
  const first = await reader.read()
  const frame = new TextDecoder().decode(first.value)
  if (!frame.includes('event: endpoint')) throw new Error('subscriptions/listen frame wrong')
  console.log('[ok] subscriptions/listen -> stream open')
  await reader.cancel()

  // 5. 不支持的版本显式拒绝
  const bad = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {}, _meta: { [META_VERSION]: '1999-01-01' } }),
  }).then((r) => r.json())
  if (!bad.error?.message?.includes('unsupported protocol version')) throw new Error('version rejection wrong')
  console.log('[ok] unsupported version rejected')

  console.log('\n[e2e-stateless] ALL 2026-07-28 CHECKS PASS')
  if (server) await new Promise((resolve) => server.close(resolve))
}

main().catch((err) => { console.error('FAIL', err); process.exit(1) })
