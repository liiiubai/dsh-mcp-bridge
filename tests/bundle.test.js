import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { name, apply } from '../src/index.js'

/** 最小 mock：模拟 DSH 环境的 webServer/tools/agents 服务。 */
function makeMockCtx() {
  const routes = []
  const schemas = [
    { name: 'read', description: 'read a file', parameters: { type: 'object', properties: { file_path: { type: 'string' } } } },
    { name: 'pwsh', description: 'run powershell', parameters: { type: 'object' } },
  ]
  const tools = {
    schemas: () => schemas,
    execute: async (input) => {
      if (input.name === 'read') {
        return { isError: false, content: [{ type: 'text', text: `read:${input.arguments.file_path}` }] }
      }
      return { isError: true, content: [{ type: 'text', text: `denied:${input.name}` }] }
    },
  }
  const agents = { list: () => [] }
  return {
    routes,
    tools,
    ctx: {
      // inject 声明后 apply 直接读属性；其余服务走 ctx.get
      webServer: { register: (route) => { routes.push(route); return () => {} } },
      tools,
      get(name) {
        if (name === 'agents') return agents
        return undefined
      },
      on() { return () => {} },
    },
  }
}

test('bundle 导出 name 与 apply', () => {
  assert.equal(name, 'dsh-mcp-bridge')
  assert.equal(typeof apply, 'function')
})

test('apply 注册 /mcp 路由并返回 disposer', () => {
  const mock = makeMockCtx()
  const dispose = apply(mock.ctx, {})
  assert.equal(mock.routes.length, 1)
  assert.equal(mock.routes[0].kind, 'exact')
  assert.equal(mock.routes[0].path, '/mcp')
  assert.equal(typeof mock.routes[0].handler, 'function')
  assert.equal(typeof dispose, 'function')
})

test('bundle 路由可服务 MCP 请求（初始化 + 工具列表 + 白名单）', async () => {
  const mock = makeMockCtx()
  const dispose = apply(mock.ctx, {})
  const server = http.createServer(mock.routes[0].handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/mcp`

  try {
    const init = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    }).then((r) => r.json())
    assert.equal(init.result.serverInfo.name, 'dsh-mcp-bridge')

    const list = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    }).then((r) => r.json())
    const names = list.result.tools.map((t) => t.name)
    assert.deepEqual(names, ['dsh_read']) // pwsh 被硬黑名单拒绝
    assert.ok(!names.includes('dsh_pwsh'))

    const call = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dsh_read', arguments: { file_path: '/x' } } }),
    }).then((r) => r.json())
    assert.equal(call.result.content[0].text, 'read:/x')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    dispose()
  }
})
