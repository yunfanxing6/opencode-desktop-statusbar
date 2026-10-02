const en = {
  project: 'Project', model: 'Model', context: 'Context', speed: 'Throughput', tokens: 'Tokens', settings: 'Settings',
  idle: 'Idle', generating: 'Generating', tool: 'Running tool', waiting: 'Waiting for you', compacting: 'Compacting', retry: 'Retrying', error: 'Error', cancelled: 'Cancelled',
  selected: 'Selected model', actual: 'Executing model', previous: 'Last measured request', provider: 'Provider', agent: 'Agent', variant: 'Variant',
  directory: 'Directory', branch: 'Branch', session: 'Session', title: 'Title', limit: 'Context limit', usage: 'Context usage',
  input: 'Input', output: 'Output', reasoning: 'Reasoning', cacheRead: 'Cache read', cacheWrite: 'Cache write', cost: 'Session cost',
  cumulative: 'Session total', partial: 'Loaded messages only', complete: 'Session aggregate', noData: 'No data yet', noTiming: 'No timing data',
  ttft: 'First observed output', duration: 'Generation duration', estimated: 'Estimated live speed', measured: 'Completed request throughput',
  speedHelp: 'Live speed uses a character-based token estimate. Completed throughput uses reported output + reasoning tokens divided by text/reasoning intervals, excluding tools. Tool arguments can be included in reported output; this is not model decode speed.',
  contextHelp: 'Matches OpenCode’s context indicator: input + output + reasoning + cache read/write from the most recent request with usage. It is a measured snapshot, not a live token count. The denominator belongs to that request’s model.',
  timingHelp: 'First observed output is measured from the assistant message creation to the first text/reasoning delta. It includes dispatch delays and is not provider-level TTFT. Historical requests may have generation intervals but no first-output timing.',
  compactions: 'Loaded compaction summaries', close: 'Close details', copied: 'Copied', copy: 'Copy directory', fields: 'Visible fields', reset: 'Reset settings',
  latestTokens: 'Last request tokens', theme: 'Follows OpenCode theme', language: 'Language', auto: 'Automatic', openDetails: 'Open status details',
  unavailableLimit: 'Model limit unavailable', mismatch: 'The selected model differs from the last measured request.',
} as const
const zh: Record<keyof typeof en, string> = {
  project: '项目', model: '模型', context: '上下文', speed: '吞吐', tokens: 'Token', settings: '设置',
  idle: '空闲', generating: '生成中', tool: '工具执行中', waiting: '等待确认', compacting: '压缩中', retry: '重试中', error: '错误', cancelled: '已取消',
  selected: '所选模型', actual: '执行模型', previous: '最近已计量请求', provider: '提供商', agent: 'Agent', variant: '推理档位',
  directory: '工作目录', branch: '分支', session: '会话', title: '标题', limit: '上下文上限', usage: '上下文占用',
  input: '输入', output: '输出', reasoning: '推理', cacheRead: '缓存读取', cacheWrite: '缓存写入', cost: '会话费用',
  cumulative: '会话累计', partial: '仅已加载消息', complete: '会话汇总数据', noData: '暂无数据', noTiming: '无计时数据',
  ttft: '首段输出等待', duration: '生成耗时', estimated: '实时估算速度', measured: '已完成请求吞吐',
  speedHelp: '生成中使用字符数估算 token。完成后使用上报的输出与推理 token，除以文本／推理生成区间，扣除工具耗时。上报的输出可能包含工具参数，因此这不是模型的纯解码速度。',
  contextHelp: '沿用 OpenCode 上下文指示器口径：最近有用量的请求的输入、输出、推理、缓存读写之和。这是已计量的快照，不是实时 token 数；上限取该请求对应的模型。',
  timingHelp: '首段输出等待从助手消息创建到首次观察到文本／推理增量计算，包含调度延迟，并非提供商内部 TTFT。历史请求可能有生成区间，但没有首段输出计时。',
  compactions: '已加载的压缩摘要', close: '关闭详情', copied: '已复制', copy: '复制目录', fields: '显示字段', reset: '重置设置',
  latestTokens: '最近请求 Token', theme: '跟随 OpenCode 主题', language: '语言', auto: '自动', openDetails: '打开状态详情',
  unavailableLimit: '模型上限未知', mismatch: '所选模型与最近已计量请求的模型不同。',
}
export type TextKey = keyof typeof en
export function translator(locale: string) { return (key: TextKey): string => /^zh/i.test(locale) ? zh[key] : en[key] }
