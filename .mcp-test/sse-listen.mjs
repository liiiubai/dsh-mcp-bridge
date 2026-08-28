// SSE 监听器：连接 GET /mcp，打印每个收到的帧（后台验证 list_changed 广播用）
const base = process.argv[2] ?? 'http://127.0.0.1:3080/mcp'
const resp = await fetch(base, { headers: { Accept: 'text/event-stream' } })
console.log(`[sse-listen] connected: status=${resp.status} type=${resp.headers.get('content-type')}`)
const reader = resp.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  let idx
  while ((idx = buffer.indexOf('\n\n')) >= 0) {
    const frame = buffer.slice(0, idx)
    buffer = buffer.slice(idx + 2)
    console.log(`[sse-frame] ${frame.replaceAll('\n', ' | ')}`)
  }
}
console.log('[sse-listen] stream closed')
