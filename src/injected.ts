import { mountStatusbar } from './index.ts'
import { createEffect, onCleanup } from 'solid-js'
import { useLocal } from '@/context/local'
import { useSync } from '@/context/sync'
import { useSDK } from '@/context/sdk'
import { useServerSDK } from '@/context/server-sdk'
import { useLanguage } from '@/context/language'
import { usePlatform } from '@/context/platform'
import { useProviders } from '@/hooks/use-providers'
import { useSessionLayout } from '@/pages/session/session-layout'
import type { Model, Snapshot } from './types.ts'

// Called once inside OpenCode's SessionPage. The adapter keeps the public
// plugin-like UI separate from the host application's component tree.
export function useOpenCodeStatusbar() {
  if (usePlatform().platform !== 'desktop') return
  const sync=useSync(),sdk=useSDK(),server=useServerSDK(),local=useLocal(),language=useLanguage()
  const {params}=useSessionLayout(); const providers=useProviders(()=>sdk().directory); const bar=mountStatusbar()
  let pending:Snapshot|undefined; let timer:ReturnType<typeof setTimeout>|undefined
  const flush=()=>{timer=undefined;if(pending)bar.update(pending)}
  createEffect(()=>{
    const data=sync().data,id=params.id,session=id?sync().session.get(id):undefined,selected=local.model.current(),source=id?data.message[id]??[]:[]
    const messages=source.map(m=>m.role==='assistant'?{id:m.id,sessionID:m.sessionID,role:m.role,providerID:m.providerID,modelID:m.modelID,agent:m.agent,variant:m.variant,time:{...m.time},tokens:{...m.tokens,cache:{...m.tokens.cache}},cost:m.cost,summary:m.summary,error:m.error?{name:m.error.name}:undefined}:{id:m.id,sessionID:m.sessionID,role:m.role,time:{...m.time}})
    const parts=Object.fromEntries(source.map(m=>[m.id,(data.part[m.id]??[]).map(p=>({id:p.id,messageID:p.messageID,type:p.type,time:'time' in p&&p.time&&typeof p.time==='object'&&'start' in p.time?{start:p.time.start,end:'end' in p.time?p.time.end:undefined}:undefined,state:p.type==='tool'?{status:p.state.status,time:'time' in p.state?{...p.state.time}:undefined}:undefined}))]))
    const models:Model[]=Array.from(providers.all().values()).flatMap(p=>Object.values(p.models).map(m=>({id:m.id,providerID:p.id,providerName:p.name,name:m.name,limit:m.limit.context})))
    pending={schema:1,scope:String(server().scope),directory:sdk().directory,sessionID:id,title:session?.title,project:data.projectMeta?.name,branch:data.vcs?.branch,selected:selected?{id:selected.id,providerID:selected.provider.id,providerName:selected.provider.name,name:selected.name,limit:selected.limit.context,variant:local.model.variant.current()}:undefined,agent:local.agent.current()?.name,status:id?data.session_status[id]?.type??'idle':'idle',waiting:!!id&&((data.permission[id]?.length??0)>0||(data.question[id]?.length??0)>0),compacting:!!session?.time.compacting,messages,parts,models,totalTokens:session?.tokens,cost:session?.cost,historyComplete:!!session?.tokens,locale:language.intl()}
    if(timer===undefined)timer=setTimeout(flush,100)
  })
  createEffect(()=>{const unsub=sdk().event.listen(evt=>{const event=evt.details; if(event.type==='message.part.delta'||event.type==='message.part.updated'||event.type==='message.updated')bar.event(event);const current=event.current;if(current&&!event.type.startsWith('message.'))bar.event({type:current.type,data:current.data})});onCleanup(unsub)})
  onCleanup(()=>{if(timer!==undefined)clearTimeout(timer);bar.dispose()})
}
