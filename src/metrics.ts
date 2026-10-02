import { emptyTokens, type Tokens, type Snapshot, type Message, type Part } from './types.ts'

const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
export function tokenTotal(tokens?: Tokens) {
  return tokens ? valid(tokens.input) + valid(tokens.output) + valid(tokens.reasoning) + valid(tokens.cache?.read) + valid(tokens.cache?.write) : 0
}
export function sumTokens(messages: Message[]): Tokens {
  return messages.reduce((sum, m) => {
    if (!m.tokens || m.role !== 'assistant') return sum
    sum.input += valid(m.tokens.input)
    sum.output += valid(m.tokens.output)
    sum.reasoning += valid(m.tokens.reasoning)
    sum.cache.read += valid(m.tokens.cache?.read)
    sum.cache.write += valid(m.tokens.cache?.write)
    return sum
  }, emptyTokens())
}

// Parts may overlap (reasoning/text); count their union and subtract tool time.
export function generationMs(parts: Part[], now?: number) {
  const intervals = parts.filter(p => p.type === 'text' || p.type === 'reasoning')
    .flatMap(p => p.time && (p.time.end ?? now) !== undefined
      ? [[p.time.start, p.time.end ?? now!] as [number, number]] : [])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const interval of intervals) {
    const last = merged.at(-1)
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1])
    else merged.push([...interval])
  }
  const tools = parts.filter(p => p.type === 'tool' && p.state?.time)
    .map(p => [p.state!.time!.start, p.state!.time!.end ?? now ?? p.state!.time!.start] as [number, number])
  // Split at boundaries to avoid double subtraction for overlapping tools.
  return merged.reduce((sum, [start, end]) => {
    const boundaries = [...new Set([start, end, ...tools.flatMap(([a, b]) => [Math.max(start, Math.min(end, a)), Math.max(start, Math.min(end, b))])])].sort((a,b) => a-b)
    for (let i=1; i<boundaries.length; i++) {
      const a=boundaries[i-1], b=boundaries[i]
      if (!tools.some(([x,y]) => x < b && y > a)) sum += b-a
    }
    return sum
  }, 0)
}

// Intentionally approximate and model-independent. Never equate SSE chunks with tokens.
export function estimateTokens(text: string) {
  const cjk = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0
  return Math.ceil(cjk + (Array.from(text).length - cjk) / 4)
}

export function metrics(snapshot: Snapshot) {
  const assistants = snapshot.messages.filter(m => m.role === 'assistant').sort((a,b) => a.time.created-b.time.created || a.id.localeCompare(b.id))
  const latest = assistants.at(-1)
  const contextMessage = assistants.findLast(m => tokenTotal(m.tokens) > 0)
  const contextModel = contextMessage && snapshot.models.find(m => m.id === contextMessage.modelID && m.providerID === contextMessage.providerID)
  const active = snapshot.status !== 'idle' && latest && !latest.time.completed && !latest.error ? latest : undefined
  const executing = active && snapshot.models.find(m => m.id === active.modelID && m.providerID === active.providerID)
  const model = active ? executing ?? { id: active.modelID ?? '', providerID: active.providerID ?? '', variant: active.variant } : snapshot.selected
  const parts = latest ? snapshot.parts[latest.id] ?? [] : []
  const tool = parts.findLast(p => p.type === 'tool' && (p.state?.status === 'running' || p.state?.status === 'pending'))
  const state = snapshot.waiting ? 'waiting' : snapshot.compacting ? 'compacting' : snapshot.status === 'retry' ? 'retry' : snapshot.status !== 'idle' ? tool ? 'tool' : 'generating' : latest?.error ? latest.error.name === 'MessageAbortedError' ? 'cancelled' : 'error' : 'idle'
  const total = tokenTotal(contextMessage?.tokens)
  return {
    latest, contextMessage, contextModel, model, active, state,
    context: contextMessage ? total : undefined,
    limit: contextModel?.limit,
    usage: contextMessage && contextModel?.limit ? total / contextModel.limit * 100 : undefined,
    total: snapshot.totalTokens ?? sumTokens(assistants),
    partial: !snapshot.totalTokens && !snapshot.historyComplete,
    cost: snapshot.cost ?? assistants.reduce((n,m) => n+valid(m.cost),0),
    compactions: assistants.filter(m => m.summary).length,
  }
}
