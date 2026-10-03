import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(process.argv[2] ?? join(root, 'artifacts/upstream'))
const bun = process.env.BUN ?? join(root, 'node_modules/.bin/bun')
const env = { ...process.env, OPENCODE_CHANNEL: 'prod', OPENCODE_VERSION: '1.18.34' }
await run(process.execPath, [join(root, 'scripts/prepare-source.mjs'), source], { cwd: root, maxBuffer: 10 * 1024 * 1024 })
await run(bun, ['install', '--frozen-lockfile', '--ignore-scripts'], { cwd: source, maxBuffer: 10 * 1024 * 1024 })
await run(bun, ['run', '--cwd', 'packages/desktop', 'build'], { cwd: source, env, maxBuffer: 10 * 1024 * 1024 })
await run(bun, ['run', '--cwd', 'packages/desktop', 'package:mac'], { cwd: source, env, maxBuffer: 10 * 1024 * 1024 })
console.log('Desktop build completed. Find the generated DMG/app under artifacts/upstream/packages/desktop/dist.')
