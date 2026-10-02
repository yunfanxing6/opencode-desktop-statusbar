import test from 'node:test'
import assert from 'node:assert/strict'
import { TimingTracker } from '../src/timing.ts'
import type { Message } from '../src/types.ts'

test('live throughput is estimated from observed text, never chunk count', () => {
  let now = 1000
  const tracker = new TimingTracker(() => now)
  tracker.event({ type: 'session.text.delta', data: { assistantMessageID: 'msg_1', delta: 'abcdefgh' } })
  now = 2000
  tracker.event({ type: 'session.text.delta', data: { assistantMessageID: 'msg_1', delta: 'ijklmnop' } })
  const message: Message = { id: 'msg_1', sessionID: 'ses', role: 'assistant', time: { created: 900 } }
  const value = tracker.read(message, [], true)
  assert.equal(value?.estimated, true)
  assert.equal(value?.speed, 4)
})
