import {useEffect,useRef,useState} from 'react';
import {loadRuntimeDiagnostics} from '../services/runtime-client';
import {agentModelStatus,type AgentModelStatus} from '../services/agent-model-status';
import type {AgentId} from '../services/agent-client';

export function AgentModelPanel({agent,active}:{agent:AgentId;active:boolean}) {
  const [rows,setRows]=useState<AgentModelStatus[]>([]);
  const [checkedAt,setCheckedAt]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const refresh=async()=>{
    controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);
    try {
      const data=await loadRuntimeDiagnostics(request.signal);
      if(request.signal.aborted||controller.current!==request)return;
      setRows(agentModelStatus(data));setCheckedAt(new Date().toISOString());setError(null);
    } catch(cause) {
      if(!request.signal.aborted&&controller.current===request)setError(cause instanceof Error?cause.message:String(cause));
    } finally {
      if(controller.current===request){controller.current=null;setLoading(false);}
    }
  };
  useEffect(()=>{
    if(!active)return;
    void refresh();
    const interval=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
    return()=>{clearInterval(interval);controller.current?.abort();controller.current=null;};
  },[active]);
  const visible=(rows.length?rows:agentModelStatus(null)).filter(row=>agent==='TEAM'||row.agent===agent);
  return <section className="agent-model-panel" aria-label="Backend model configuration">
    <div><strong>Model configuration</strong><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh model configuration</button></div>
    <small role="status">{error?(checkedAt?'STALE':'UNAVAILABLE'):loading?'CHECKING':'BACKEND CONFIGURATION'}{checkedAt?` · Last checked ${checkedAt}`:''}</small>
    {visible.map(row=><div className="agent-model-evidence" key={row.agent}>
      <p><strong>{row.agent}</strong> · {row.provider??'PROVIDER NOT PROVIDED'} · {row.model??'MODEL NOT PROVIDED'} · {row.status}</p>
      <small>Skills · {row.skills?.length?row.skills.join(' · '):'NOT REPORTED'}</small>
      <p>Last execution · {row.lastExecution?`${row.lastExecution.executionStatus??'unverified'} · ${row.lastExecution.provider??'PROVIDER NOT PROVIDED'} · ${row.lastExecution.model??'MODEL NOT PROVIDED'} · ${row.lastExecution.completedAt??'TIME NOT PROVIDED'}${row.lastExecution.fallbackUsed?' · LOCAL FALLBACK':''}`:'UNVERIFIED · no execution receipt'}</p>
      {row.lastExecution?.receipt?<code>{row.lastExecution.receipt}</code>:null}
      {row.lastSuccessfulExecution?.receipt?<p>Last successful provider execution · {row.lastSuccessfulExecution.completedAt??'TIME NOT PROVIDED'} · {row.lastSuccessfulExecution.provider??'PROVIDER NOT PROVIDED'} · {row.lastSuccessfulExecution.model??'MODEL NOT PROVIDED'}<code>{row.lastSuccessfulExecution.receipt}</code></p>:null}
      {row.executionStatus?<small>Current execution state · {row.executionStatus}</small>:null}
      {row.retryAfterSeconds!=null?<small>Provider cooldown · retry after {row.retryAfterSeconds} seconds. No automatic retry.</small>:null}
      {Object.entries(row.rateLimit??{}).map(([name,value])=><small key={name}>{name}: {value}</small>)}
    </div>)}
    <small>Configuration does not verify an execution. Completed tasks show backend-reported model receipts and fallback status.</small>
    {error?<small>{error}</small>:null}
  </section>;
}
