import { useEffect, useState, type ReactNode } from 'react';
type Session = {enabled:boolean;user:{username:string;role:string}|null;csrf:string|null};
let csrf: string | null = null;
const originalFetch = globalThis.fetch.bind(globalThis);
// Only same-origin application writes receive the session's CSRF token.
globalThis.fetch = (input,init) => {
 const url=new URL(input instanceof Request ? input.url : String(input),location.href);
 const method=(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
 if(url.origin===location.origin && url.pathname.startsWith('/api/aethergrid/') && !['GET','HEAD'].includes(method) && csrf){
  const headers=new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('x-aethergrid-csrf',csrf);
  return originalFetch(input,{...init,headers});
 }
 return originalFetch(input,init);
};
function LocalRuntimeStatus() {
 const [reachable,setReachable]=useState(false);
 useEffect(()=>{
   const controller=new AbortController();
   // A file:// document has an opaque origin; only probe the explicit loopback
   // health endpoint, never forward credentials from this origin.
   originalFetch('http://127.0.0.1:8090/api/aethergrid/health',{signal:controller.signal})
     .then(async response=>response.ok?response.json():null)
     .then(health=>{
       if(controller.signal.aborted)return;
       if(health?.ok===true && health?.product==='ÆTHERGRID'){
         setReachable(true);
         // Prefer the fully connected workspace when the user's own local
         // service is already running. Do not open a dead localhost tab.
         location.replace('http://127.0.0.1:8090/');
       }
     }).catch(()=>{});
   return ()=>controller.abort();
 },[]);
 return <div className="local-file-status" role="status">
   Offline HTML · eight bundled 3D cities. Live AI and aircraft need the included local service.
   {' '}Open <strong>START-AETHERGRID.cmd</strong> from your extracted app folder to start it in one click.
   {reachable?<a href="http://127.0.0.1:8090/">Connected workspace ready</a>:null}
 </div>;
}
export function SessionGate({children}:{children:ReactNode}) {
 const [session,setSession]=useState<Session|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{if(location.protocol==='file:'){setSession({enabled:false,user:null,csrf:null});return;}void originalFetch('/api/aethergrid/auth/session').then(r=>r.json()).then((s:Session)=>{csrf=s.csrf;setSession(s);}).catch(()=>{setError('Runtime unavailable. Reload to reconnect.');});},[]);
 async function login(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=new FormData(event.currentTarget);
  try{
   const response=await originalFetch('/api/aethergrid/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:form.get('username'),password:form.get('password')})});
   const value=await response.json();if(!response.ok) throw new Error(value.error || 'Sign-in failed');
   csrf=value.csrf;setSession(value);
  }catch(e){setError(e instanceof Error ? e.message : 'Sign-in failed');}finally{setBusy(false);}
 }
 if(!session) return <main className="session-gate" aria-busy="true">ÆTHERGRID · {error || 'Connecting'}</main>;
 if(session.enabled && !session.user) return <main className="session-gate"><form onSubmit={login}><h1>ÆTHERGRID</h1><p>Operator sign-in</p><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><p role="alert">{error}</p><button disabled={busy}>{busy ? 'Connecting…' : 'Sign in'}</button></form></main>;
 return <>{children}{location.protocol==='file:' && <LocalRuntimeStatus />}{session.user && <div className="session-status"><span>{session.user.username} · {session.user.role}</span><button onClick={async()=>{const response=await fetch('/api/aethergrid/auth/logout',{method:'POST'});if(response.ok){csrf=null;setSession({enabled:true,user:null,csrf:null});}}}>Sign out</button></div>}</>;
}
