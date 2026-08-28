// 用官方 MCP SDK 客户端连接 DSH MCP server，验证真实互操作性
import { Client } from 'file:///D:/my-code/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StreamableHTTPClientTransport } from 'file:///D:/my-code/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js'

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3080/mcp'))
  const client = new Client({ name: 'dsh-verify', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  console.log('[ok] connected via official MCP SDK (Streamable HTTP)')

  const tools = await client.listTools()
  console.log(`[ok] tools/list -> ${tools.tools.map((t) => t.name).join(', ')}`)

  const info = await client.callTool({ name: 'dsh_info', arguments: {} })
  console.log('[ok] callTool dsh_info ->', JSON.stringify(info.content[0].text.slice(0, 60)))

  const echo = await client.callTool({ name: 'dsh_echo', arguments: { text: 'SDK 互操作测试' } })
  console.log('[ok] callTool dsh_echo ->', JSON.stringify(echo.content[0].text))

  await client.close()
  console.log('[ok] closed; ALL INTEROP CHECKS PASS')
}

main().catch((err) => { console.error('FAIL', err); process.exit(1) })
