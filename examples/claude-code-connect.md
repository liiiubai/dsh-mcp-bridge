# 完整可用示例：Claude Code 连接本机 DSH

# 前提：dsh-mcp-bridge 已安装并挂载（默认路径 /mcp，端口随 GUI）。
# 1) 启动 dsh（GUI 或 headless）
# 2) 在另一个终端连接：

# Claude Code（官方 CLI 支持 --transport http）
claude mcp add --transport http dsh http://127.0.0.1:3080/mcp

# 或任何 MCP SDK（Node）
# import { Client } from '@modelcontextprotocol/sdk/client/index.js'
# import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
# const client = new Client({ name: 'dsh', version: '1.0.0' }, { capabilities: {} })
# await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3080/mcp')))
# const { tools } = await client.listTools()   // dsh_read, dsh_glob, dsh_grep, dsh_web_search, dsh_info

# 3) 调用示例
# client.callTool({ name: 'dsh_glob', arguments: { pattern: '**/*.md' } })
# client.callTool({ name: 'dsh_read', arguments: { file_path: 'README.md' } })

# 安全提示：仅本机回环使用；不要对外暴露端口。
