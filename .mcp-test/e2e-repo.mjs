// 仓库代码 e2e 验证：src/ 模块 + 官方 MCP SDK 客户端
// 模拟最小 DSH 环境（http server 代替 webServer；mock tools 代替 agent scope tools）
import http from 'node:http'
import { createProtocol } from '../src/protocol.js'
import { createHttpHandler } from '../src/transport.js'
import { buildCatalog, DEFAULT_ALLOWLIST } from '../src/catalog.js'
import { Client } from 'file:///D:/my-code/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StreamableHTTPClientTransport } from 'file:///D:/my-code/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js'

// ---- mock DSH tools（模拟 agent scope 视图） ----
const mockSchemas = [
  { name: 'read', description: 'read a UTF-8 text file', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
  { name: 'glob', description: 'find files by glob', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'pwsh', description: 'run powershell', parameters: { type: 'object' } },
]
async function mockCall(rawName, args) {
  if (rawName === 'glob') {
    return { content: [{ type: 'text', text: `glob(${args.pattern}) -> a.mjs, b.mjs` }] }
  }
  if (rawName === 'read') {
    return { content: [{ type: 'text', text: `read(${args.file_path}) -> 1: hello` }] }
  }
  throw new Error(`mock: ${rawName} not callable`)
}

// ---- 组装与官方动态插件同构的处理器 ----
const handleMessage = createProtocol({
  serverInfo: { name: 'dsh-mcp-bridge', version: '0.1.0' },
  listTools() {
    return buildCatalog(mockSchemas, { allowlist: DEFAULT_ALLOWLIST })
      .map((e) => ({ name: e.mcpName, description: e.description, inputSchema: e.inputSchema }))
  },
  async callTool(mcpName, args) {
    const entry = buildCatalog(mockSchemas, { allowlist: DEFAULT_ALLOWLIST }).find((e) => e.mcpName === mcpName)
    if (entry === undefined) throw new Error(`unknown tool: ${mcpName}`)
    return mockCall(entry.rawName, args)
  },
})

const { handler } = createHttpHandler(handleMessage)
const server = http.createServer(handler)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
console.log(`[e2e] mock server on http://127.0.0.1:${port}/mcp`)

try {
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`))
  const client = new Client({ name: 'e2e', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  console.log('[e2e] connected via official MCP SDK')

  const { tools } = await client.listTools()
  console.log('[e2e] tools:', tools.map((t) => t.name).join(', '))
  if (tools.some((t) => t.name === 'dsh_pwsh')) throw new Error('denylist leaked pwsh!')

  const glob = await client.callTool({ name: 'dsh_glob', arguments: { pattern: '**/*.mjs' } })
  console.log('[e2e] dsh_glob ->', glob.content[0].text)

  const denied = await client.callTool({ name: 'dsh_pwsh', arguments: {} }).catch((e) => String(e.message).slice(0, 60))
  console.log('[e2e] dsh_pwsh ->', denied)

  await client.close()
  console.log('[e2e] ALL REPO E2E CHECKS PASS')
} finally {
  await new Promise((resolve) => server.close(resolve))
}
