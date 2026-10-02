export type Tokens = { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
export type Message = {
  id: string
  sessionID: string
  role: string
  providerID?: string
  modelID?: string
  agent?: string
  variant?: string
  time: { created: number; completed?: number }
  tokens?: Tokens
  cost?: number
  summary?: boolean
  error?: { name: string }
}
export type Part = {
  id: string
  messageID: string
  type: string
  text?: string
  time?: { start: number; end?: number }
  state?: { status: string; time?: { start: number; end?: number } }
}
export type Model = { id: string; providerID: string; name?: string; providerName?: string; limit?: number; variant?: string }
export type Snapshot = {
  schema: 1
  scope: string
  directory: string
  sessionID?: string
  title?: string
  project?: string
  branch?: string
  selected?: Model
  agent?: string
  status: string
  waiting: boolean
  compacting: boolean
  messages: Message[]
  parts: Record<string, Part[]>
  models: Model[]
  totalTokens?: Tokens
  cost?: number
  historyComplete: boolean
  locale: string
}
export type StreamEvent = { type: string; properties?: Record<string, unknown>; data?: Record<string, unknown> }
export const emptyTokens = (): Tokens => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })
