import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog, DEFAULT_ALLOWLIST, DEFAULT_DENYLIST, PREFIX } from '../src/catalog.js'

const schemas = [
  { name: 'read', description: 'read a file', parameters: { type: 'object', properties: {} } },
  { name: 'glob', description: 'glob files', parameters: { type: 'object' } },
  { name: 'grep', description: 'grep files', parameters: { type: 'object' } },
  { name: 'web_search', description: 'search web', parameters: { type: 'object' } },
  { name: 'pwsh', description: 'run powershell', parameters: { type: 'object' } },
  { name: 'write', description: 'write a file', parameters: { type: 'object' } },
  { name: 'random_tool', description: 'not in allowlist', parameters: { type: 'object' } },
]

test('默认白名单只投影只读工具，且带 dsh_ 前缀', () => {
  const catalog = buildCatalog(schemas)
  const names = catalog.map((entry) => entry.mcpName)
  assert.deepEqual(names, ['dsh_read', 'dsh_glob', 'dsh_grep', 'dsh_web_search'])
})

test('rawName 保留原始工具名，inputSchema 取 parameters', () => {
  const catalog = buildCatalog(schemas)
  const read = catalog.find((entry) => entry.mcpName === 'dsh_read')
  assert.equal(read.rawName, 'read')
  assert.deepEqual(read.inputSchema, { type: 'object', properties: {} })
})

test('denylist 中的工具即使加入 allowlist 也不暴露', () => {
  const catalog = buildCatalog(schemas, { allowlist: [...DEFAULT_ALLOWLIST, 'pwsh', 'write'] })
  const names = catalog.map((entry) => entry.mcpName)
  assert.ok(!names.includes('dsh_pwsh'))
  assert.ok(!names.includes('dsh_write'))
})

test('自定义 prefix 函数生效', () => {
  const catalog = buildCatalog(schemas, { prefix: (raw) => `mcp__dsh__${raw}` })
  assert.ok(catalog.some((entry) => entry.mcpName === 'mcp__dsh__read'))
})

test('空/非法 schema 输入安全返回空目录', () => {
  assert.deepEqual(buildCatalog(null), [])
  assert.deepEqual(buildCatalog([{ description: 'no name' }]), [])
  assert.deepEqual(buildCatalog([]), [])
})

test('PREFIX 常量为 dsh_', () => {
  assert.equal(PREFIX, 'dsh_')
})
