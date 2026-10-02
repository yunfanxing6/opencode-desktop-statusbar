import { estimateTokens, generationMs } from './metrics.ts'
import type { Message, Part, StreamEvent } from './types.ts'

type Timing = { first: number; last: number; chars: string; segments: [number, number][]; open?: number; complete: boolean }
export class TimingTracker {
  private entries = new Map<string, Timing>()
  private partTypes = new Map<string, string>()
  private clock: () => number
  constructor(clock = () => Date.now()) { this.clock = clock }
  event(event: StreamEvent) {
    const p = event.properties ?? event.data ?? {}
    const part = p.part as Part | undefined
    if (event.type === 'message.part.updated' && part) {
      this.partTypes.set(part.id, part.type)
      if (part.type === 'step-finish' || part.type === 'tool') this.pause(part.messageID)
      return
    }
    const type = event.type.replace('session.next.', 'session.')
    if (type === 'message.part.delta') {
      if (p.field !== 'text') return
      const kind = this.partTypes.get(String(p.partID))
      if (kind !== 'text' && kind !== 'reasoning') return
      this.delta(String(p.messageID), String(p.delta ?? ''))
      return
    }
    if (type === 'session.text.delta' || type === 'session.reasoning.delta') {
      this.delta(String(p.assistantMessageID), String(p.delta ?? ''))
      return
    }
    if (type === 'session.step.finished' || type === 'session.step.failed' || type.startsWith('session.tool.')) {
      if (p.assistantMessageID) this.pause(String(p.assistantMessageID))
    }
    if (type === 'message.updated') {
      const m = p.info as Message | undefined
      if (m?.time.completed || m?.error) this.finish(m.id)
    }
  }
  private delta(id: string, text: string) {
    if (!text || !id || id === 'undefined') return
    const now = this.clock()
    let item = this.entries.get(id)
    if (!item) {
      item = { first: now, last: now, chars: '', segments: [], complete: false }
      this.entries.set(id, item)
      if (this.entries.size > 256) this.entries.delete(this.entries.keys().next().value!)
    }
    if (item.open === undefined) item.open = now
    item.last = now
    item.chars += text
    // Only retain enough text to count estimates. No conversation text persists to disk.
    if (item.chars.length > 1_000_000) item.chars = item.chars.slice(-1_000_000)
  }
  private pause(id: string) {
    const item = this.entries.get(id)
    if (!item || item.open === undefined) return
    item.segments.push([item.open, item.last])
    item.open = undefined
  }
  private finish(id: string) {
    this.pause(id)
    const item = this.entries.get(id)
    if (item) item.complete = true
  }
  read(message: Message | undefined, parts: Part[], live: boolean) {
    if (!message) return undefined
    const item = this.entries.get(message.id)
    const historical = generationMs(parts)
    const elapsed = item ? item.segments.reduce((n,[a,b]) => n+Math.max(0,b-a),0) + (item.open === undefined ? 0 : Math.max(0,item.last-item.open)) : 0
    const duration = historical || elapsed
    if (live) {
      const elapsedLive = item ? elapsed + (item.open === undefined ? 0 : Math.max(0,this.clock()-item.last)) : 0
      return { speed: item && elapsedLive >= 250 ? estimateTokens(item.chars) / (elapsedLive/1000) : undefined, estimated: true, duration: elapsedLive || undefined, ttft: item ? Math.max(0,item.first - message.time.created) : undefined, source: 'observed' }
    }
    // Text and reasoning time is a measured subset of the request. Output may also
    // include tool arguments, so this is labelled request throughput, not decode speed.
    const output = message.tokens?.output ?? 0
    const numerator = output + (message.tokens?.reasoning ?? 0)
    return { speed: duration > 0 && numerator > 0 ? numerator/(duration/1000) : undefined, estimated: false, duration: duration || undefined, ttft: item ? Math.max(0,item.first - message.time.created) : undefined, source: historical ? 'parts' : item ? 'observed' : 'unavailable' }
  }
  dispose() { this.entries.clear(); this.partTypes.clear() }
}
