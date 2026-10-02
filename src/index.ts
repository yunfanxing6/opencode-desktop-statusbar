import { metrics, tokenTotal } from './metrics.ts'
import { TimingTracker } from './timing.ts'
import { translator, type TextKey } from './i18n.ts'
import { style } from './style.ts'
import type { Snapshot, StreamEvent, Tokens } from './types.ts'

type Section = 'project' | 'model' | 'context' | 'speed' | 'tokens' | 'settings'
type Settings = { fields: Record<Exclude<Section,'settings'>,boolean>; language: 'auto'|'zh'|'en' }
const defaults = (): Settings => ({ fields: { project: true, model: true, context: true, speed: true, tokens: true }, language: 'auto' })
const settingsKey = 'opencode-desktop-statusbar.v1'
export function mountStatusbar() {
  document.getElementById('opencode-desktop-statusbar')?.remove()
  const host = document.createElement('div')
  host.id = 'opencode-desktop-statusbar'
  host.dataset.preventAutofocus = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const sheet = document.createElement('style'); sheet.textContent = style; shadow.append(sheet)
  const bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('role','region'); shadow.append(bar)
  const panel = document.createElement('section'); panel.className = 'panel'; panel.hidden = true; panel.id = 'details'; shadow.append(panel)
  document.body.append(host)
  const root = document.getElementById('root')
  const originalHeight = root?.style.height ?? ''
  if (root) root.style.height = 'calc(100dvh - 32px)'
  const tracker = new TimingTracker()
  let snapshot: Snapshot | undefined
  let section: Section | undefined
  let settings = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? 'null') as Partial<Settings> | null
    if (saved) {
      for (const k of Object.keys(settings.fields) as (keyof Settings['fields'])[]) if (typeof saved.fields?.[k] === 'boolean') settings.fields[k] = saved.fields[k]
      if (['auto','zh','en'].includes(saved.language ?? '')) settings.language = saved.language!
    }
  } catch { /* A corrupt preference must not prevent rendering. */ }
  const save = () => { try { localStorage.setItem(settingsKey, JSON.stringify(settings)) } catch {} }
  const t = (key: TextKey) => translator(settings.language === 'auto' ? snapshot?.locale ?? navigator.language : settings.language)(key)
  const n = (value?: number) => value === undefined ? '—' : Intl.NumberFormat(snapshot?.locale ?? 'en', { maximumFractionDigits: 1 }).format(value)
  const compact = (value?: number) => value === undefined ? '—' : value >= 1e6 ? `${n(value/1e6)}M` : value >= 1e3 ? `${n(value/1e3)}k` : n(value)
  const seconds = (value?: number) => value === undefined ? '—' : `${n(value/1000)} s`
  const text = (tag: string, value: string, className?: string) => { const e=document.createElement(tag); e.textContent=value; if(className)e.className=className; return e }
  const row = (key: TextKey, value?: string, mono=false) => {
    const r=text('div','','row'); r.append(text('span',t(key),'label'),text(mono?'code':'span',value||'—','value')); panel.append(r)
  }
  const tokenRows = (tokens?: Tokens) => { row('input',n(tokens?.input)); row('output',n(tokens?.output)); row('reasoning',n(tokens?.reasoning)); row('cacheRead',n(tokens?.cache?.read)); row('cacheWrite',n(tokens?.cache?.write)) }
  const close = () => { section=undefined; panel.hidden=true; render() }
  const buttons = new Map<Section,HTMLButtonElement>()
  const open = (value: Section) => { section=section===value?undefined:value; render(); if(section)panel.querySelector<HTMLButtonElement>('header button')?.focus() }
  const addButton = (key: Section) => {
    const b=document.createElement('button'); b.type='button'; b.className=key==='settings'?'settings':`item ${key}`; b.setAttribute('aria-controls','details'); b.onclick=()=>open(key); buttons.set(key,b); return b
  }
  for(const key of ['project','model','context','speed','tokens'] as const)bar.append(addButton(key))
  bar.append(text('div','','spacer'))
  const state=text('div','','state'); state.append(text('i','','dot'),text('span','')); bar.append(state,addButton('settings'))
  const renderPanel = () => {
    panel.hidden=!section
    if(!section || !snapshot)return
    panel.replaceChildren()
    const header=text('header',t(section)); const x=text('button','×') as HTMLButtonElement; x.type='button'; x.setAttribute('aria-label',t('close')); x.onclick=close; header.append(x); panel.append(header)
    const m=metrics(snapshot)
    const timing=tracker.read(m.latest,snapshot.parts[m.latest?.id??'']??[],!!m.active)
    if(section==='project') {
      row('project',snapshot.project); row('directory',snapshot.directory,true); row('branch',snapshot.branch); row('title',snapshot.title); row('session',snapshot.sessionID,true)
      const copy=text('button',t('copy'),'action') as HTMLButtonElement; copy.onclick=()=> { void navigator.clipboard.writeText(snapshot!.directory).then(()=>{copy.textContent=t('copied')}).catch(()=>{copy.textContent=t('directory')}) }; panel.append(copy)
    }
    if(section==='model') {
      row(m.active?'actual':'selected',m.model?.name??m.model?.id); row('provider',m.model?.providerName??m.model?.providerID); row('model',m.model?`${m.model.providerID}/${m.model.id}`:undefined,true); row('agent',m.active?.agent??snapshot.agent); row('variant',m.active?.variant??snapshot.selected?.variant)
      panel.append(text('h3',t('previous'))); row('model',m.contextMessage?`${m.contextMessage.providerID}/${m.contextMessage.modelID}`:undefined,true)
    }
    if(section==='context') {
      row('usage',m.context===undefined?t('noData'):`${n(m.context)} / ${n(m.limit)}${m.usage===undefined?'':` (${n(m.usage)}%)`}`)
      const meter=text('div','','meter'); const fill=text('div','','fill'); fill.style.width=`${Math.max(0,Math.min(100,m.usage??0))}%`; meter.append(fill); panel.append(meter)
      row('model',m.contextMessage?`${m.contextMessage.providerID}/${m.contextMessage.modelID}`:undefined,true)
      if(m.limit===undefined)panel.append(text('p',t('unavailableLimit')))
      if(m.contextMessage && snapshot.selected && (m.contextMessage.modelID!==snapshot.selected.id || m.contextMessage.providerID!==snapshot.selected.providerID))panel.append(text('p',t('mismatch')))
      tokenRows(m.contextMessage?.tokens); row('compactions',String(m.compactions)); panel.append(text('p',t('contextHelp')))
    }
    if(section==='speed') {
      row(timing?.estimated?'estimated':'measured',timing?.speed===undefined?t('noTiming'):`${n(timing.speed)} tok/s`); row('duration',seconds(timing?.duration)); row('ttft',seconds(timing?.ttft)); panel.append(text('p',t('speedHelp')),text('p',t('timingHelp')))
    }
    if(section==='tokens') {
      panel.append(text('h3',t('cumulative'))); tokenRows(m.total); row('cost',`$${m.cost.toFixed(4)}`); panel.append(text('p',t(m.partial?'partial':'complete')))
      panel.append(text('h3',t('latestTokens'))); tokenRows(m.contextMessage?.tokens)
    }
    if(section==='settings') {
      panel.append(text('h3',t('fields')))
      for(const key of Object.keys(settings.fields) as (keyof Settings['fields'])[]) {
        const label=text('label','','check'); const input=document.createElement('input'); input.type='checkbox'; input.checked=settings.fields[key]; input.onchange=()=>{settings.fields[key]=input.checked;save();renderBar()}; label.append(input,text('span',t(key)));panel.append(label)
      }
      const label=text('label',t('language'),'row'); const select=document.createElement('select');select.className='lang'
      for(const [value,name] of [['auto',t('auto')],['zh','简体中文'],['en','English']]) { const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option) }
      select.value=settings.language;select.onchange=()=>{settings.language=select.value as Settings['language'];save();render()};label.append(select);panel.append(label)
      const reset=text('button',t('reset'),'action') as HTMLButtonElement;reset.onclick=()=>{settings=defaults();save();render()};panel.append(reset,text('p',t('theme')))
    }
  }
  const renderBar = () => {
    if(!snapshot)return
    const m=metrics(snapshot); const timing=tracker.read(m.latest,snapshot.parts[m.latest?.id??'']??[],!!m.active)
    const values:Record<Section,string>={
      project:`${snapshot.project??snapshot.directory.split('/').filter(Boolean).at(-1)??'/'}${snapshot.branch?` · ${snapshot.branch}`:''}`,
      model:`${m.model?.name??m.model?.id??t('noData')}${(m.active?.variant??snapshot.selected?.variant)?` · ${m.active?.variant??snapshot.selected?.variant}`:''}`,
      context:`${t('context')} ${compact(m.context)} / ${compact(m.limit)}${m.usage===undefined?'':` · ${n(m.usage)}%`}`,
      speed:timing?.speed===undefined?`— tok/s`:`${timing.estimated?'≈ ':''}${n(timing.speed)} tok/s`,
      tokens:`${compact(tokenTotal(m.total))} tok${m.partial?'*':''} · $${m.cost.toFixed(2)}`,
      settings:'⚙',
    }
    for(const [key,b] of buttons) {
      b.textContent=values[key];b.title=key==='settings'?t('settings'):`${t(key)}: ${values[key]}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded',String(section===key));b.hidden=key!=='settings'&&!settings.fields[key]
      if(key==='context')b.className=`item context ${m.usage!==undefined&&m.usage>=90?'danger':m.usage!==undefined&&m.usage>=75?'warn':''}`
    }
    bar.setAttribute('aria-label','OpenCode Statusbar');state.className=`state ${m.state==='error'?'error':m.state==='waiting'?'waiting':m.state!=='idle'&&m.state!=='cancelled'?'busy':''}`;state.lastElementChild!.textContent=t(m.state as TextKey);state.title=t(m.state as TextKey)
  }
  const render = () => { renderBar();renderPanel() }
  const escape = (event: KeyboardEvent) => { if(event.key==='Escape'&&section){ event.stopPropagation(); const previous=section;close();buttons.get(previous)?.focus() } }
  shadow.addEventListener('keydown',escape as EventListener)
  const outside = (event: PointerEvent) => { if(section&&!event.composedPath().includes(host))close() }
  document.addEventListener('pointerdown',outside)
  const timer=setInterval(()=>{renderBar();if(section==='speed')renderPanel()},500)
  return {
    update(value: Snapshot) {
      const changed=snapshot && (snapshot.scope!==value.scope || snapshot.directory!==value.directory)
      if(changed)tracker.dispose()
      if(snapshot?.sessionID!==value.sessionID)section=undefined
      snapshot=value;renderBar()
      if(section!=='settings')renderPanel()
    },
    event(event:StreamEvent){tracker.event(event)},
    dispose(){clearInterval(timer);document.removeEventListener('pointerdown',outside);tracker.dispose();host.remove();if(root)root.style.height=originalHeight},
  }
}
