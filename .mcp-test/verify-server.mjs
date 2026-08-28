// MCP server 端点验证脚本（UTF-8 权威测试）
const base = 'http://127.0.0.1:3080/mcp'

async function post(msg) {
  const resp = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(msg),
  })
  const text = await resp.text()
  return { status: resp.status, text }
}

async function main() {
  const steps = [
    ['initialize', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify', version: '1.0' } } }],
    ['tools/list', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }],
    ['tools/call dsh_info', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dsh_info', arguments: {} } }],
    ['tools/call dsh_echo', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'dsh_echo', arguments: { text: '你好，MCP 世界' } } }],
    ['unknown method', { jsonrpc: '2.0', id: 5, method: 'bogus', params: {} }],
  ]
  let ok = true
  for (const [label, msg] of steps) {
    const { status, text } = await post(msg)
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = null }
    const pass = status === 200 && parsed && parsed.jsonrpc === '2.0'
    if (!pass) ok = false
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label} (status ${status})`)
    console.log('  ' + text.slice(0, 300))
  }
  console.log(ok ? '\nALL PASS' : '\nSOME FAILED')
}

main().catch((err) => { console.error('FATAL', err); process.exit(1) })
