/**
 * DSH 集成层：访问 agent scope 视图的工具注册表并转发工具调用。
 *
 * DSH 的工具注册在 agent scope 层（preset 挂载时按 agent 注册），
 * 插件自身的 ctx 只拥有 global view（本部署下为空）。因此通过
 * `agents.list()` 枚举活动 agent，用其 scoped ctx 上的 tools 服务
 * 枚举与执行——agent 对象本身就是 scope key。
 *
 * 动态沙箱没有 AbortController/AbortSignal 全局，这里提供最小
 * AbortSignal 兼容对象（永不中止），满足工具执行管线的 signal 契约。
 */

/**
 * 查找第一个携带 tools 服务的活动 agent。
 * @param {object} ctx - 插件 context。
 * @param {object} fallbackTools - 插件自身的 tools 服务（兜底）。
 * @returns {{ t: object, agent: object | undefined }} scoped tools 与对应 agent。
 */
export function findScopedTools(ctx, fallbackTools) {
  const agents = ctx.get('agents')
  if (agents !== undefined) {
    let list = []
    try {
      list = agents.list() ?? []
    } catch {
      list = []
    }
    for (const agent of list) {
      try {
        const t = agent.ctx ? agent.ctx.get('tools') : undefined
        if (t !== undefined && typeof t.schemas === 'function' && typeof t.execute === 'function') {
          return { t, agent }
        }
      } catch {
        // 该 agent 探测失败，继续下一个
      }
    }
  }
  return { t: fallbackTools, agent: undefined }
}

/** 构造最小 AbortSignal 兼容对象（永不中止）。 */
export function neverAbortSignal() {
  return {
    aborted: false,
    reason: undefined,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
    throwIfAborted() {},
  }
}

/**
 * 执行一个 DSH 工具并把结果映射为 MCP 格式。
 * @param {object} t - scoped tools 服务。
 * @param {object | undefined} agent - 执行归属的 agent（scope key）。
 * @param {string} rawName - DSH 原始工具名。
 * @param {object} args - 模型参数。
 * @param {number} seq - 调用序号（生成 callId）。
 * @returns {Promise<{ content: Array<{ type: string; text: string }>, isError: boolean }>}
 */
export async function callDshTool(t, agent, rawName, args, seq) {
  const result = await t.execute({
    callId: `mcp:${seq}`,
    name: rawName,
    arguments: args ?? {},
    agent,
    signal: neverAbortSignal(),
  })
  const text = (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  const images = (result.content ?? []).filter((block) => block.type === 'image').length
  let body = text
  if (images > 0) {
    body = (body ? body + '\n' : '') + `[${images} image block(s) omitted by dsh-mcp-bridge]`
  }
  return { content: [{ type: 'text', text: body }], isError: result.isError === true }
}
