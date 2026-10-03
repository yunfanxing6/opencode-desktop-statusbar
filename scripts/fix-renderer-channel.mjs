// Rebuild only the UI with the production channel. Preserve the installed
// production main process, server, native modules, updater and storage identity.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, cp, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { createPackage } from '@electron/asar'
import { assertProductionArchive, composeRenderer } from './archive.mjs'

const run = promisify(execFile)
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(process.argv[2] ?? join(root, 'artifacts/upstream'))
const app = process.env.OPENCODE_APP ?? '/Applications/OpenCode.app'
const originalArchive = join(app, 'Contents/Resources/app.asar')
const expected = '1.18.34'
assertProductionArchive(originalArchive, expected)
process.env.OPENCODE_CHANNEL = 'prod'
process.env.OPENCODE_VERSION = expected
await run(process.execPath, [join(root, 'scripts/prepare-source.mjs'), source])
const upstreamRequire = createRequire(join(source, 'packages/desktop/package.json'))
const { build } = await import(pathToFileURL(upstreamRequire.resolve('vite')).href)
const { default: plugins } = await import(pathToFileURL(join(source, 'packages/app/vite.js')).href)
const output = join(root, 'artifacts/production-renderer')
await build({
  configFile: false,
  root: join(source, 'packages/desktop/src/renderer'),
  base: './',
  plugins,
  publicDir: join(source, 'packages/app/public'),
  build: { outDir: output, emptyOutDir: true, sourcemap: false },
})
const state = join(homedir(), 'Library/Application Support/OpenCodeStatusbar')
await mkdir(state, { recursive: true })
const work = await mkdtemp(join(state, 'prod-ui-'))
await cp(output, join(work, 'renderer-source/out/renderer'), { recursive: true })
const rendererArchive = join(work, 'renderer.asar')
await createPackage(join(work, 'renderer-source'), rendererArchive)
// Use a tiny temporary app container for the existing installer.
// Main/server are still copied from the installed production archive.
const prepared = join(work, 'prepared.app/Contents/Resources/app.asar')
await mkdir(join(work, 'prepared.app/Contents/Resources'), { recursive: true })
await composeRenderer(originalArchive, rendererArchive, prepared)
assertProductionArchive(prepared, expected)
const mainHtml = await readFile(join(output, 'index.html'), 'utf8')
const mainAsset = mainHtml.match(/<script\s+type="module"[^>]*src="\.\/assets\/([^"/]+\.js)"/)?.[1]
if (!mainAsset) throw new Error('Cannot find production renderer entry')
const mainJs = await readFile(join(output, 'assets', mainAsset), 'utf8')
if (!mainJs.includes('opencode-desktop-statusbar')) throw new Error('Statusbar missing from production UI')
if (/const channel = "dev";/.test(mainJs)) throw new Error('Development channel still present in UI')
await run(process.execPath, [join(root, 'scripts/desktop.mjs'), 'install'], {
  env: { ...process.env, OPENCODE_APP: app, OPENCODE_STATUSBAR_APP: join(work, 'prepared.app') },
  maxBuffer: 4 * 1024 * 1024,
}).then(result => process.stdout.write(result.stdout))
console.log('Production UI installed. Quit and reopen OpenCode to remove the DEV badge.')
