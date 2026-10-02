import { access, copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const run = promisify(execFile)
const appPath = process.env.OPENCODE_APP ?? '/Applications/OpenCode.app'
const expected = '1.18.34'
const stateDir = join(homedir(), 'Library/Application Support/OpenCodeStatusbar')
const backupDir = join(stateDir, 'backups')
const asar = join(appPath, 'Contents/Resources/app.asar')
const info = join(appPath, 'Contents/Info.plist')
async function version() { const value = await run('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', info]); return value.stdout.trim() }
async function exists(path) { try { await access(path); return true } catch { return false } }
async function findApp(path) {
  const entries = await readdir(path, { withFileTypes: true })
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory() && entry.name.endsWith('.app')) return child
    if (entry.isDirectory()) {
      const found = await findApp(child)
      if (found) return found
    }
  }
}
async function sourceBuild() {
  const root = resolve(new URL('..', import.meta.url).pathname)
  await run(process.execPath, [join(root, 'scripts/build-desktop.mjs')], { cwd: root, maxBuffer: 10 * 1024 * 1024 })
  const dist = join(root, 'artifacts/upstream/packages/desktop/dist')
  return findApp(dist)
}
async function install() {
  const actual = await version()
  if (actual !== expected) throw new Error(`OpenCode ${actual} is installed; this release supports ${expected}. Set OPENCODE_APP to a compatible app.`)
  const built = process.env.OPENCODE_STATUSBAR_APP ?? await sourceBuild()
  if (!built || !(await exists(join(built, 'Contents/Resources/app.asar')))) throw new Error('No patched app was found. Set OPENCODE_STATUSBAR_APP to a built .app.')
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = join(backupDir, `app-${actual}-${stamp}.asar`)
  await copyFile(asar, backup)
  await copyFile(join(built, 'Contents/Resources/app.asar'), asar)
  await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], { maxBuffer: 2 * 1024 * 1024 })
  console.log(`Installed OpenCode Statusbar into ${appPath}`)
  console.log(`Backup: ${backup}`)
}
async function uninstall() {
  const files = (await readdir(backupDir).catch(() => [])).filter(x => x.endsWith('.asar')).sort()
  const latest = files.at(-1)
  if (!latest) throw new Error(`No backup found in ${backupDir}`)
  await copyFile(join(backupDir, latest), asar)
  await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], { maxBuffer: 2 * 1024 * 1024 })
  console.log(`Restored ${latest}`)
}
const command = process.argv[2] ?? 'check'
if (command === 'check') console.log(JSON.stringify({ app: appPath, version: await version(), supported: (await version()) === expected, backupDir }, null, 2))
else if (command === 'install') await install()
else if (command === 'uninstall') await uninstall()
else throw new Error(`Unknown command: ${command}`)
