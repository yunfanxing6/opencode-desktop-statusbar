import { createPackageFromStreams, extractFile, getRawHeader, listPackage, statFile } from '@electron/asar'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { dirname, join, relative } from 'node:path'

export function inspectArchive(path) {
  const pkg = JSON.parse(extractFile(path, 'package.json').toString())
  const main = extractFile(path, 'out/main/index.js').toString()
  const backendPath = listPackage(path).find(file => /^\/out\/main\/chunks\/node-.*\.js$/.test(file))
  if (!backendPath) throw new Error(`Cannot find the embedded OpenCode server in ${path}`)
  const backend = extractFile(path, backendPath.slice(1)).toString()
  return {
    version: pkg.version,
    desktopChannel: main.match(/const raw = "(dev|beta|prod)";/)?.[1],
    serverVersion: backend.match(/var InstallationVersion = "([^"]*)"/)?.[1],
    serverChannel: backend.match(/InstallationChannel = "([^"]*)"/)?.[1],
  }
}

export function assertProductionArchive(path, expected) {
  const identity = inspectArchive(path)
  if (identity.version !== expected || identity.desktopChannel !== 'prod' || identity.serverChannel !== 'prod' || identity.serverVersion !== expected) {
    throw new Error(`Incompatible OpenCode archive: ${JSON.stringify(identity)}. Expected desktop and server ${expected} on the prod channel.`)
  }
  return identity
}

// The adapter only changes the renderer. Retain the installed runtime, server,
// dependencies and release identity so UI builds cannot select another database.
export async function composeRenderer(base, renderer, destination, unpackedSource = base) {
  const files = [
    ...listPackage(base).filter(file => file !== '/out/renderer' && !file.startsWith('/out/renderer/')).map(file => ({ archive: base, file })),
    ...listPackage(renderer).filter(file => file === '/out/renderer' || file.startsWith('/out/renderer/')).map(file => ({ archive: renderer, file })),
  ]
  const streams = files.map(({ archive, file }) => {
    const info = statFile(archive, file.slice(1), false)
    const common = { path: file.slice(1), unpacked: !!info.unpacked }
    if (info.files) return { ...common, type: 'directory' }
    if (info.link) return { ...common, type: 'link', symlink: relative(dirname(file.slice(1)), info.link), stat: { mode: 0o777, size: 0 } }
    return {
      ...common,
      type: 'file',
      stat: { mode: info.executable ? 0o755 : 0o644, size: info.size },
      streamGenerator: () => info.unpacked
        ? Readable.from((async function* () { yield await readFile(join(`${unpackedSource}.unpacked`, file.slice(1))) })())
        : Readable.from([extractFile(archive, file.slice(1))]),
    }
  })
  await createPackageFromStreams(destination, streams)
}

export function archiveIntegrity(path) {
  return createHash('sha256').update(getRawHeader(path).headerString).digest('hex')
}
