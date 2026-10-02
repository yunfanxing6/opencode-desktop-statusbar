import { cp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(process.argv[2] ?? join(root, 'artifacts/upstream'))
const target = join(source, 'packages/app/src/components/opencode-statusbar')
await mkdir(target, { recursive: true })
for (const file of ['types.ts', 'metrics.ts', 'timing.ts', 'i18n.ts', 'style.ts', 'index.ts', 'injected.ts']) {
  const sourceText = await readFile(join(root, 'src', file), 'utf8')
  await writeFile(join(target, file), sourceText.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1$2'))
}
const session = join(source, 'packages/app/src/pages/session.tsx')
let content = await readFile(session, 'utf8')
const importLine = 'import { useOpenCodeStatusbar } from "@/components/opencode-statusbar/injected"\n'
if (!content.includes(importLine)) {
  const marker = 'import { createSessionOwnership } from "./session/session-ownership"\n'
  if (!content.includes(marker)) throw new Error(`Cannot locate import marker in ${session}`)
  content = content.replace(marker, `${marker}${importLine}`)
}
const hookMarker = '  const platform = usePlatform()\n'
if (!content.includes('  useOpenCodeStatusbar()')) {
  if (!content.includes(hookMarker)) throw new Error(`Cannot locate Page hook marker in ${session}`)
  content = content.replace(hookMarker, `${hookMarker}  useOpenCodeStatusbar()\n`)
}
await writeFile(session, content)
console.log(`Prepared OpenCode source at ${source}`)
