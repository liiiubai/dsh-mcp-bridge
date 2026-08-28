/**
 * Client half：MCP Bridge 管理面板（参考实现）。
 *
 * 在设置区注册一个 "MCP Bridge" 页面：服务器状态、连通性自测、工具列表。
 * 数据来自 Host 端 Package-private RPC（`mcp.status` / `mcp.ping`）。
 *
 * 运行环境说明：
 * - 动态插件（cordis_define）：直接可用——Host 端用 `harness.handle`
 *   注册同名方法，Client 端 `host.call` 调用（本文件即动态验证版的固化）。
 * - 模块版 bundle：Host 端 RPC 需改用官方 `ctx.connection.rpc.handle('/rpc', ...)`
 *   通道（@deepseek-ai/dsh-client-connection），Client 端 `host.call` 不变。
 *
 * 依赖全局：React（createElement 风格）、slots、host（见 Builtin 查询）。
 */
export const name = 'dsh-mcp-bridge-client'

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'mcp-bridge', order: 100, label: 'MCP Bridge' },
    () => {
      const [status, setStatus] = React.useState(null)
      const [ping, setPing] = React.useState(null)
      const [error, setError] = React.useState(null)

      const load = () => {
        setError(null)
        host.call('mcp.status', {}).then(setStatus).catch((err) => setError(String(err && err.message ? err.message : err)))
      }
      React.useEffect(() => { load() }, [])

      const runPing = () => {
        setPing('testing…')
        host.call('mcp.ping', {}).then((r) => setPing(JSON.stringify(r))).catch((err) => setPing('failed: ' + String(err && err.message ? err.message : err)))
      }

      const card = (title, body) => React.createElement('div', { style: { border: '1px solid var(--dsh-color-border)', borderRadius: 8, padding: 12, marginBottom: 12 } },
        React.createElement('div', { style: { fontWeight: 600, marginBottom: 8 } }, title),
        body)

      const rows = [
        ['Endpoint', status ? status.path : '—'],
        ['Protocol', status ? status.protocolVersion : '—'],
        ['Exposed tools', status ? String(status.toolCount) : '—'],
      ]

      return React.createElement('div', null,
        card('Server',
          React.createElement('table', { style: { borderCollapse: 'collapse' } },
            React.createElement('tbody', null,
              rows.map(([k, v]) => React.createElement('tr', { key: k },
                React.createElement('td', { style: { padding: '4px 12px 4px 0', color: 'var(--dsh-color-text-secondary)' } }, k),
                React.createElement('td', { style: { padding: '4px 0', fontFamily: 'monospace' } }, v))))),
        card('Connectivity',
          React.createElement('div', null,
            React.createElement('button', { onClick: runPing, style: { padding: '4px 12px', cursor: 'pointer' } }, 'Run self-test (ping)'),
            ping !== null ? React.createElement('pre', { style: { marginTop: 8, fontSize: 12 } }, String(ping)) : null)),
        card('Tools',
          status && status.tools && status.tools.length > 0
            ? React.createElement('ul', { style: { margin: 0, paddingLeft: 18 } },
                status.tools.map((t) => React.createElement('li', { key: t.name },
                  React.createElement('code', null, t.name),
                  t.description ? React.createElement('span', { style: { color: 'var(--dsh-color-text-secondary)', marginLeft: 8 } }, t.description) : null)))
            : React.createElement('div', { style: { color: 'var(--dsh-color-text-secondary)' } }, status ? 'No tools exposed (allowlist empty?)' : 'Loading…')),
        error ? React.createElement('div', { style: { color: 'var(--dsh-color-danger, red)' } }, String(error)) : null,
        React.createElement('button', { onClick: load, style: { padding: '4px 12px', cursor: 'pointer' } }, 'Reload'))
    },
  ))
}
