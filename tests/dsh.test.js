import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findScopedTools, neverAbortSignal, callDshTool } from '../src/dsh.js'

test('neverAbortSignal 永不中止且具备 AbortSignal 表面', () => {
  const signal = neverAbortSignal()
  assert.equal(signal.aborted, false)
  assert.doesNotThrow(() => signal.addEventListener('abort', () => {}))
  assert.doesNotThrow(() => signal.removeEventListener('abort', () => {}))
  assert.doesNotThrow(() => signal.throwIfAborted())
  assert.equal(signal.dispatchEvent({ type: 'abort' }), false)
})

test('findScopedTools 取第一个带 tools 的 agent', () => {
  const fakeTools = { schemas: () => [], execute: async () => ({}) }
  const ctx = {
    get(name) {
      if (name === 'agents') {
        return {
          list: () => [
            { ctx: null, id: 'a1' },
            { ctx: { get: () => undefined }, id: 'a2' },
            { ctx: { get: () => fakeTools }, id: 'a3' },
          ],
        }
      }
      return undefined
    },
  }
  const { t, agent } = findScopedTools(ctx, {})
  assert.equal(t, fakeTools)
  assert.equal(agent.id, 'a3')
})

test('无 agent 时回退到插件自身 tools', () => {
  const fallback = { schemas: () => [], execute: async () => ({}) }
  const ctx = { get: () => undefined }
  const { t, agent } = findScopedTools(ctx, fallback)
  assert.equal(t, fallback)
  assert.equal(agent, undefined)
})

test('agents.list 抛错时安全回退', () => {
  const fallback = { schemas: () => [], execute: async () => ({}) }
  const ctx = { get: () => ({ list: () => { throw new Error('nope') } }) }
  const { t } = findScopedTools(ctx, fallback)
  assert.equal(t, fallback)
})

test('callDshTool 把 text 内容块拼接为 MCP 文本结果', async () => {
  const t = {
    execute: async (input) => {
      assert.equal(input.name, 'read')
      assert.equal(input.signal.aborted, false)
      return {
        isError: false,
        content: [
          { type: 'text', text: 'line one' },
          { type: 'text', text: 'line two' },
        ],
      }
    },
  }
  const result = await callDshTool(t, undefined, 'read', { file_path: '/x' }, 7)
  assert.equal(result.isError, false)
  assert.equal(result.content[0].text, 'line one\nline two')
})

test('callDshTool 报告 isError 与图片省略', async () => {
  const t = {
    execute: async () => ({
      isError: true,
      content: [
        { type: 'text', text: 'failed' },
        { type: 'image', data: 'abc' },
      ],
    }),
  }
  const result = await callDshTool(t, undefined, 'read_image', {}, 8)
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /failed/)
  assert.match(result.content[0].text, /1 image block/)
})
