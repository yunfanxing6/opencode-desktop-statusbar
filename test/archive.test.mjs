import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPackageWithOptions, extractFile, statFile } from '@electron/asar'
import { assertProductionArchive, composeRenderer } from '../scripts/archive.mjs'

test('renderer installation preserves production runtime, native modules and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'opencode-statusbar-'))
  try {
    for (const kind of ['prod', 'dev']) {
      const src = join(root, kind)
      await mkdir(join(src, 'out/main/chunks'), { recursive: true })
      await mkdir(join(src, 'out/renderer'), { recursive: true })
      await mkdir(join(src, 'native'), { recursive: true })
      await writeFile(join(src, 'package.json'), JSON.stringify({ version: '1.18.34' }))
      await writeFile(join(src, 'out/main/index.js'), `const raw = "${kind}";`)
      await writeFile(join(src, 'out/main/chunks/node-test.js'), `var InstallationVersion = "${kind === 'prod' ? '1.18.34' : '0.0.0-dev'}", InstallationChannel = "${kind}";`)
      await writeFile(join(src, 'out/renderer/index.html'), kind === 'dev' ? 'statusbar' : 'original')
      await writeFile(join(src, 'native/pty.node'), `native-${kind}`)
      await chmod(join(src, 'native/pty.node'), 0o755)
      await symlink('pty.node', join(src, 'native/link.node'))
      await createPackageWithOptions(src, join(root, `${kind}.asar`), { unpackDir: 'native' })
    }
    const prod = join(root, 'prod.asar'), dev = join(root, 'dev.asar'), output = join(root, 'result.asar')
    assert.throws(() => assertProductionArchive(dev, '1.18.34'), /Incompatible/)
    await composeRenderer(prod, dev, output)
    assertProductionArchive(output, '1.18.34')
    assert.equal(extractFile(output, 'out/renderer/index.html').toString(), 'statusbar')
    assert.equal(extractFile(output, 'native/pty.node').toString(), 'native-prod')
    assert.equal(extractFile(output, 'native/link.node').toString(), 'native-prod')
    assert.equal(statFile(output, 'native/pty.node').unpacked, true)
    assert.equal(statFile(output, 'out/main/index.js').unpacked, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
