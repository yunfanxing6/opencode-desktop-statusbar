import { access, copyFile, mkdir, readdir, rename, mkdtemp } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { archiveIntegrity, assertProductionArchive, composeRenderer, inspectArchive } from './archive.mjs'

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
  assertProductionArchive(asar, expected)
  const built = process.env.OPENCODE_STATUSBAR_APP ?? await sourceBuild()
  if (!built || !(await exists(join(built, 'Contents/Resources/app.asar')))) throw new Error('No patched app was found. Set OPENCODE_STATUSBAR_APP to a built .app.')
  assertProductionArchive(join(built, 'Contents/Resources/app.asar'), expected)
  await mkdir(stateDir, { recursive: true })
  const work = await mkdtemp(join(stateDir, 'install-'))
  const prepared = join(work, 'app.asar')
  await composeRenderer(asar, join(built, 'Contents/Resources/app.asar'), prepared)
  await apply(prepared)
}
async function apply(prepared) {
  assertProductionArchive(prepared, expected)
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = join(backupDir, `app-${expected}-${stamp}.asar`)
  await copyFile(asar, backup)
  await copyFile(info, `${backup}.Info.plist`)
  // Rename atomically after preparation; retain the native modules already installed.
  await copyFile(prepared, `${asar}.statusbar-next`)
  await rename(`${asar}.statusbar-next`, asar)
  await run('/usr/bin/plutil', ['-replace', 'ElectronAsarIntegrity.Resources/app\\.asar.hash', '-string', archiveIntegrity(asar), info])
  await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], { maxBuffer: 2 * 1024 * 1024 })
  console.log(`Installed OpenCode Statusbar into ${appPath}`)
  console.log(`Backup: ${backup}`)
}
async function repair() {
  if (await version() !== expected) throw new Error(`Repair requires OpenCode ${expected}`)
  const files = (await readdir(backupDir)).filter(file => file.endsWith('.asar')).sort()
  const original = files.map(file => join(backupDir, file)).find(path => {
    try { assertProductionArchive(path, expected); return true } catch { return false }
  })
  if (!original) throw new Error(`No original production archive found in ${backupDir}`)
  const work = await mkdtemp(join(stateDir, 'repair-'))
  const prepared = join(work, 'app.asar')
  await composeRenderer(original, asar, prepared, asar)
  await apply(prepared)
  console.log('Repaired production identity and server while retaining the statusbar renderer. Quit and reopen OpenCode to load your original projects, history and settings.')
}
async function uninstall() {
  const files = (await readdir(backupDir).catch(() => [])).filter(x => x.endsWith('.asar')).sort()
  const latest = files.find(file => {
    try { assertProductionArchive(join(backupDir, file), expected); return true } catch { return false }
  })
  if (!latest) throw new Error(`No backup found in ${backupDir}`)
  const original = join(backupDir, latest)
  const prepared = join(await mkdtemp(join(stateDir, 'restore-')), 'app.asar')
  await copyFile(original, prepared)
  await apply(prepared)
  await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], { maxBuffer: 2 * 1024 * 1024 })
  console.log(`Restored ${latest}`)
}
const command = process.argv[2] ?? 'check'
if (command === 'check') {
  const actual = await version()
  const identity = inspectArchive(asar)
  console.log(JSON.stringify({ app: appPath, version: actual, identity, supported: actual === expected && identity.desktopChannel === 'prod' && identity.serverChannel === 'prod' && identity.serverVersion === expected, backupDir }, null, 2))
}
else if (command === 'install') await install()
else if (command === 'repair') await repair()
else if (command === 'uninstall') await uninstall()
else throw new Error(`Unknown command: ${command}`)
