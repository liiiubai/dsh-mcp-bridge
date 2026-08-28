// 单进程测试入口：避免 node --test 的 per-file 子进程 spawn
// （Windows 沙箱限制 child_process spawn 捕获）。用法：node tests/run-all.js
import './protocol.test.js'
import './catalog.test.js'
import './dsh.test.js'
import './transport.test.js'
