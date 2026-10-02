import test from 'node:test'
import assert from 'node:assert/strict'
import { generationMs, metrics, sumTokens, tokenTotal } from '../src/metrics.ts'
import type { Message, Part, Snapshot } from '../src/types.ts'

const assistant = (id: string, tokens: Message['tokens'], time = { created: 1, completed: 1001 }): Message => ({ id, sessionID: 'ses_1', role: 'assistant', providerID: 'openai', modelID: 'gpt', time, tokens })
const tokens = { input: 10, output: 20, reasoning: 5, cache: { read: 3, write: 2 } }
test('token totals include cache and reasoning', () => {
  assert.equal(tokenTotal(tokens), 40)
  assert.deepEqual(sumTokens([assistant('msg_1', tokens), { ...assistant('msg_2', tokens), role: 'user' }]), { input: 10, output: 20, reasoning: 5, cache: { read: 3, write: 2 } })
})
test('generation intervals merge and exclude tool time', () => {
  const parts: Part[] = [
    { id: 'a', messageID: 'msg', type: 'text', time: { start: 0, end: 100 } },
    { id: 'b', messageID: 'msg', type: 'reasoning', time: { start: 50, end: 200 } },
    { id: 'c', messageID: 'msg', type: 'tool', state: { status: 'completed', time: { start: 80, end: 120 } } },
  ]
  assert.equal(generationMs(parts), 160)
})
test('context uses latest token-bearing assistant message', () => {
  const snapshot: Snapshot = { schema: 1, scope: 'local', directory: '/tmp/demo', sessionID: 'ses_1', status: 'idle', waiting: false, compacting: false, messages: [assistant('msg_1', undefined), assistant('msg_2', tokens)], parts: {}, models: [{ id: 'gpt', providerID: 'openai', limit: 100 }], totalTokens: tokens, historyComplete: true, locale: 'en' }
  const value = metrics(snapshot)
  assert.equal(value.context, 40)
  assert.equal(value.limit, 100)
  assert.equal(value.usage, 40)
  assert.equal(value.total.output, 20)
})
