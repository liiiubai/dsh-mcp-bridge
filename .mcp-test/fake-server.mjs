// 最小 MCP server 实现（2025-06-18 stdio 传输），用于 dsh-mcp-bridge 协议验证。
// 用法: node fake-server.mjs
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}
function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

rl.on('line', (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (msg.method === 'initialize') {
    respond(msg.id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'dsh-mcp-bridge-fake', version: '0.0.1' },
    })
  } else if (msg.method === 'notifications/initialized') {
    // 无响应
  } else if (msg.method === 'ping') {
    respond(msg.id, {})
  } else if (msg.method === 'tools/list') {
    respond(msg.id, {
      tools: [
        {
          name: 'echo',
          description: '回显输入文本',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string', description: '要回显的文本' } },
            required: ['text'],
          },
        },
        {
          name: 'add',
          description: '两个数字相加',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number', description: '第一个数' },
              b: { type: 'number', description: '第二个数' },
            },
            required: ['a', 'b'],
          },
        },
      ],
    })
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params
    if (name === 'echo') {
      respond(msg.id, { content: [{ type: 'text', text: `echo: ${args.text}` }] })
    } else if (name === 'add') {
      respond(msg.id, { content: [{ type: 'text', text: String(args.a + args.b) }] })
    } else {
      respondError(msg.id, -32602, `unknown tool: ${name}`)
    }
  } else {
    respondError(msg.id, -32601, `unknown method: ${msg.method}`)
  }
})
