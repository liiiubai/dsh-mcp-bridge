import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createProtocol, PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS,
  META_PROTOCOL_VERSION, META_SERVER_INFO,
} from '../src/protocol.js'

function makeProtocol(tools = [], overrides = {}) {
  const calls = []
  return {
    calls,
    handle: createProtocol({
      serverInfo: { name: 'test-server', version: '0.0.1' },
      listTools: () => tools,
      callTool: async (name, args) => {
        calls.push({ name, args })
        return { content: [{ type: 'text', text: `called:${name}` }] }
      },
      ...overrides,
    }),
  }
}

test('initialize 返回协议版本、能力与服务器信息', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'c', version: '1' } },
  })
  assert.equal(resp.jsonrpc, '2.0')
  assert.equal(resp.id, 1)
  assert.equal(resp.result.protocolVersion, PROTOCOL_VERSION)
  assert.deepEqual(resp.result.capabilities, { tools: { listChanged: true } })
  assert.equal(resp.result.serverInfo.name, 'test-server')
})

test('notification 返回 null（无响应体）', async () => {
  const { handle } = makeProtocol()
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/cancelled', params: {} }), null)
})

test('ping 返回空 result', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({ jsonrpc: '2.0', id: 2, method: 'ping' })
  assert.deepEqual(resp.result, {})
})

test('tools/list 返回目录中的工具', async () => {
  const { handle } = makeProtocol([
    { name: 'dsh_read', description: 'read a file', inputSchema: { type: 'object' } },
  ])
  const resp = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })
  assert.equal(resp.result.tools.length, 1)
  assert.equal(resp.result.tools[0].name, 'dsh_read')
})

test('tools/call 转发参数并返回 MCP 结果', async () => {
  const { handle, calls } = makeProtocol()
  const resp = await handle({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'dsh_glob', arguments: { pattern: '**/*.js' } },
  })
  assert.equal(resp.result.content[0].text, 'called:dsh_glob')
  assert.deepEqual(calls, [{ name: 'dsh_glob', args: { pattern: '**/*.js' } }])
})

test('tools/call 缺参数名返回 INVALID_PARAMS', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} })
  assert.equal(resp.error.code, -32602)
})

test('tools/call 执行抛错时返回 INTERNAL_ERROR 且携带消息', async () => {
  const { handle } = makeProtocol([], {
    callTool: async () => {
      throw new Error('boom')
    },
  })
  const resp = await handle({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: { name: 'x', arguments: {} },
  })
  assert.equal(resp.error.code, -32603)
  assert.equal(resp.error.message, 'boom')
})

test('未知方法返回 METHOD_NOT_FOUND', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({ jsonrpc: '2.0', id: 7, method: 'bogus/method', params: {} })
  assert.equal(resp.error.code, -32601)
})

test('非对象输入返回 INVALID_REQUEST', async () => {
  const { handle } = makeProtocol()
  const resp = await handle(null)
  assert.equal(resp.error.code, -32600)
})

test('server/discover 通告双协议版本、能力与身份（2026-07-28）', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({
    jsonrpc: '2.0',
    id: 8,
    method: 'server/discover',
    params: {},
    _meta: { [META_PROTOCOL_VERSION]: '2026-07-28' },
  })
  assert.deepEqual(resp.result.protocolVersions, SUPPORTED_PROTOCOL_VERSIONS)
  assert.deepEqual(resp.result.capabilities, { tools: { listChanged: true } })
  assert.equal(resp.result.serverInfo.name, 'test-server')
  assert.ok(resp._meta[META_SERVER_INFO])
})

test('2026-07-28：无握手直接 tools/list（_meta 声明版本）', async () => {
  const { handle } = makeProtocol([{ name: 'dsh_read', description: 'r', inputSchema: {} }])
  const resp = await handle({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/list',
    params: {},
    _meta: { [META_PROTOCOL_VERSION]: '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} },
  })
  assert.equal(resp.result.tools.length, 1)
  assert.equal(resp.result.tools[0].name, 'dsh_read')
  assert.ok(resp._meta[META_SERVER_INFO])
})

test('2026-07-28：声明不支持的协议版本返回错误', async () => {
  const { handle } = makeProtocol()
  const resp = await handle({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/list',
    params: {},
    _meta: { [META_PROTOCOL_VERSION]: '1999-01-01' },
  })
  assert.equal(resp.error.code, -32602)
  assert.match(resp.error.message, /unsupported protocol version/)
})

test('2026-07-28：tools/call 无需握手直接执行', async () => {
  const { handle, calls } = makeProtocol()
  const resp = await handle({
    jsonrpc: '2.0',
    id: 11,
    method: 'tools/call',
    params: { name: 'dsh_glob', arguments: {} },
    _meta: { [META_PROTOCOL_VERSION]: '2026-07-28' },
  })
  assert.equal(resp.result.content[0].text, 'called:dsh_glob')
  assert.equal(calls.length, 1)
  assert.ok(resp._meta[META_SERVER_INFO])
})

test('PROTOCOL_VERSION 与支持列表一致', () => {
  assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes(PROTOCOL_VERSION))
})
