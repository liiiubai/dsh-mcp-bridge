// 自动演示脚本：连接本机 DSH 的 MCP 端点，演示完整能力。
// 用法：node .mcp-test/demo.mjs [url]   （默认 http://127.0.0.1:3080/mcp）
// 输出可直接用于录屏 / 发布素材。
const LOCAL_SDK_ESM = 'file:///D:/my-code/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm'
async function loadSdkModule(pkgSpecifier, localSuffix) {
  try {
    return await import(pkgSpecifier)
  } catch {
    return await import(`${LOCAL_SDK_ESM}/${localSuffix}`)
  }
}
const { Client } = await loadSdkModule('@modelcontextprotocol/sdk/client/index.js', 'client/index.js')
const { StreamableHTTPClientTransport } = await loadSdkModule('@modelcontextprotocol/sdk/client/streamableHttp.js', 'client/streamableHttp.js')

const url = process.argv[2] ?? 'http://127.0.0.1:3080/mcp'

async function main() {
  console.log('=== dsh-mcp-bridge demo ===')
  console.log(`target: ${url}\n`)

  const transport = new StreamableHTTPClientTransport(new URL(url))
  const client = new Client({ name: 'dsh-mcp-bridge-demo', version: '1.0.0' }, { capabilities: {} })

  console.log('▶ 1/4 connect (2025-06-18 handshake via official MCP SDK)')
  await client.connect(transport)
  console.log('  ✔ connected\n')

  console.log('▶ 2/4 tools/list — DSH tools exposed through the allowlist')
  const { tools } = await client.listTools()
  for (const t of tools) console.log(`  - ${t.name}: ${t.description.slice(0, 60)}`)
  console.log(`  (${tools.length} tools)\n`)

  console.log('▶ 3/4 tools/call — real work through the DSH sandbox')
  const glob = await client.callTool({
    name: 'dsh_glob',
    arguments: { pattern: '**/*.{mjs,md}', path: 'D:/my-code/ds-harness/mcp-bridge' },
  })
  console.log(`  dsh_glob -> ${glob.content[0].text.split('\n').slice(0, 4).join('\n             ')}`)
  console.log('  ✔ glob succeeded\n')

  console.log('▶ 4/4 safety — tools outside the allowlist are rejected')
  const denied = await client.callTool({ name: 'dsh_pwsh', arguments: { command: 'whoami' } })
    .then(() => 'UNEXPECTED: pwsh callable!')
    .catch((e) => `  rejected: ${String(e.message).slice(0, 60)}`)
  console.log(denied)

  await client.close()
  console.log('\n=== demo complete: DSH is now an MCP server ===')
}

main().catch((err) => { console.error('demo failed:', err); process.exit(1) })
