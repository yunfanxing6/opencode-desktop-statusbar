import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
await mkdir(join(root, 'dist'), { recursive: true })
await build({ entryPoints: [join(root, 'src/index.ts')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: join(root, 'dist/statusbar.js'), minify: true })
await writeFile(join(root, 'dist/version.json'), JSON.stringify({ version: '0.1.0', opencode: '1.18.34', generatedAt: new Date().toISOString() }, null, 2))
console.log('Built dist/statusbar.js')
