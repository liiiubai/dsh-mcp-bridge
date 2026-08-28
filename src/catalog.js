/**
 * 工具目录构建层：从 DSH 工具注册表（agent scope 视图）按白名单
 * 投影为 MCP 工具列表。
 *
 * 安全模型：
 * - allowlist：默认只暴露只读/低风险工具，可配置扩充。
 * - denylist：高危工具（pwsh/write/edit/子代理编排等）永不可暴露，
 *   即使出现在 allowlist 中也拒绝。
 * - 工具调用在执行端还要经过 DSH 自身的 sandbox/approval 管线。
 */

/** 默认白名单：只读文件与搜索类工具。 */
export const DEFAULT_ALLOWLIST = ['read', 'glob', 'grep', 'web_search']

/** 永拒名单：即使配置错误也不暴露。 */
export const DEFAULT_DENYLIST = [
  'pwsh',
  'write',
  'edit',
  'cordis_define',
  'cordis_run',
  'cordis_stop',
  'cordis_undefine',
  'subagent',
  'subagent_fork',
  'workflow',
  'ralph',
]

/** MCP 命名空间前缀：`dsh_<rawName>`。 */
export const PREFIX = 'dsh_'

/**
 * 从 DSH 工具 schema 列表构建 MCP 工具目录。
 * @param {Array<{ name: string; description?: string; parameters?: object }>} schemas
 *   DSH 工具 schema 列表（来自 tools.schemas(agent)）。
 * @param {object} [options]
 * @param {string[]} [options.allowlist] - 白名单；默认 {@link DEFAULT_ALLOWLIST}。
 * @param {string[]} [options.denylist] - 永拒名单；默认 {@link DEFAULT_DENYLIST}。
 * @param {(rawName: string) => string} [options.prefix] - MCP 名称前缀函数。
 * @returns {Array<{ mcpName: string; rawName: string; description: string; inputSchema: object }>}
 */
export function buildCatalog(schemas, options = {}) {
  const allowlist = options.allowlist ?? DEFAULT_ALLOWLIST
  const denylist = options.denylist ?? DEFAULT_DENYLIST
  const prefix = options.prefix ?? ((raw) => PREFIX + raw)

  const out = []
  for (const schema of schemas ?? []) {
    const { name } = schema
    if (typeof name !== 'string') continue
    if (!allowlist.includes(name)) continue
    if (denylist.includes(name)) continue
    out.push({
      mcpName: prefix(name),
      rawName: name,
      description: schema.description || `DSH tool ${name}`,
      inputSchema: schema.parameters ?? { type: 'object', properties: {} },
    })
  }
  return out
}
