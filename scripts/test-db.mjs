// Roda os testes de integração com SQLite usando o Node embutido no Electron,
// porque o better-sqlite3 é compilado para o ABI do Electron, não do Node do sistema.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron') // caminho do binário
const vitest = join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(electron, [vitest, 'run'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', TEST_DB: '1' }
})
process.exit(result.status ?? 1)
