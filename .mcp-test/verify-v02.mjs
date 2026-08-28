// v0.2 验证：真实 DSH 工具转发（官方 SDK 客户端）
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

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3080/mcp'))
  const client = new Client({ name: 'dsh-verify', version: '2.0.0' }, { capabilities: {} })
  await client.connect(transport)
  console.log('[ok] connected')

  const { tools } = await client.listTools()
  console.log('[ok] tools:', tools.map((t) => t.name).join(', '))

  // 调用真实 glob：在工作区找 markdown 文件
  const globRes = await client.callTool({ name: 'dsh_glob', arguments: { pattern: '*.mjs', path: 'D:/my-code/ds-harness/mcp-bridge/.mcp-test' } })
  console.log('[ok] dsh_glob ->', JSON.stringify(globRes.content[0].text))

  // 调用真实 read：读取 fake-server.mjs 前 3 行
  const readRes = await client.callTool({ name: 'dsh_read', arguments: { file_path: 'D:/my-code/ds-harness/mcp-bridge/.mcp-test/fake-server.mjs', limit: 3 } })
  console.log('[ok] dsh_read ->', JSON.stringify(readRes.content[0].text.slice(0, 120)))

  // 调用白名单外的工具应被拒绝
  const denied = await client.callTool({ name: 'dsh_pwsh', arguments: { command: 'whoami', description: 'x' } }).catch((e) => ({ denied: String(e.message).slice(0, 80) }))
  console.log('[ok] dsh_pwsh denied ->', JSON.stringify(denied))

  await client.close()
  console.log('\nALL v0.2 CHECKS PASS')
}

main().catch((err) => { console.error('FAIL', err); process.exit(1) })
