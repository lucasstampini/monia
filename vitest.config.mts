import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) }
  },
  test: {
    // Testes `.db.test.ts` usam o SQLite nativo compilado para o Electron: rodam via `npm run test:db`.
    include: process.env['TEST_DB'] ? ['src/**/*.db.test.ts'] : ['src/**/*.test.ts'],
    exclude: process.env['TEST_DB'] ? [] : ['src/**/*.db.test.ts'],
    environment: 'node'
  }
})
