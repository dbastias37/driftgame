const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
function harness({authenticated=true,local={}}={}){
 const nodes=new Map(),events=new Map(),timers=[],calls=[],data=new Map(Object.entries(local));let serverProfile={version:1,cash:3200,unlocked:2,missions:{1:[true,true,true]},cars:{},wins:1,receipts:[]};
 let account={id:'user-a',email:'a@example.com',name:'Driver A',google:false},revision=2,fail=null;
 function el(id){if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',children:[],classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this[type]=fn;},setAttribute(){},focus(){},getClientRects:()=>[{}],replaceChildren(){this.children=[];},append(x){this.children.push(x);},querySelectorAll:()=>[]});return nodes.get(id);}
 const document={getElementById:el,body:el('body'),addEventListener:(k,v)=>events.set(k,v),createElement:()=>el(randomUUID()),hidden:false};
 const storage={get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const snapshot=()=>({user:account,profile:serverProfile,revision,achievements:[],ledger:[]});
 const scope={document,crypto:{randomUUID},console,URLSearchParams,AbortSignal,Event,location:{hash:'',pathname:'/',search:'',assign(){}},history:{replaceState(){}},localStorage:storage,sessionStorage:storage,setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},setInterval(){},addEventListener:(k,v)=>events.set(k,v),dispatchEvent:event=>events.get(event.type)?.(event),fetch:async(path,options)=>{
   const b=options.body&&JSON.parse(options.body);calls.push({path,b,headers:options.headers});let status=200,result;
   if(fail){[status,result]=fail;fail=null;}
   else if(path==='/api/config')result={accounts:true,email:true,google:true};
   else if(path==='/api/session')result=authenticated?{authenticated:true,...snapshot()}:{authenticated:false};
   else if(path==='/api/records')result=b?{ok:true,revision:b.revision+1}:{records:[]};
   else if(path==='/api/runs/start')result={ok:true,id:'run-1',...snapshot()};
   else if(path==='/api/runs/finish'){serverProfile={...serverProfile,cash:4000};revision++;result={ok:true,reward:800,...snapshot()};}
   else result={ok:true,...snapshot()};
   return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(JSON.stringify(result))};
 }};scope.window=scope;const context=vm.createContext(scope);for(const name of ['accounts','career'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context);events.get('DOMContentLoaded')();
 return {scope,calls,data,el,events,api:scope.DriftAccount,fail:(status,result)=>fail=[status,result],remote:(p,rev)=>{serverProfile=p;revision=rev;},code:s=>vm.runInContext(s,context)};
}
test('client hydrates account before play and ignores previous browser currency and unlocks',async()=>{
 const h=harness({local:{'drift:career:v1':JSON.stringify({cash:999999,unlocked:20})}});assert.equal(h.api.ready,false);await flush();assert.equal(h.api.ready,true);assert.equal(h.code('DriftCareer.load().cash'),3200);assert.equal(h.code('DriftCareer.load().unlocked'),2);assert.equal(h.code('DriftCareer.save({cash:999999})'),false);assert.equal(h.data.get('drift:career:v1'),'{"cash":999999,"unlocked":20}');
});
test('client persists failed results per account and retry confirms once without client-owned credits',async()=>{
 const h=harness();await flush();h.fail(503,{error:'Sin conexión'});await assert.rejects(h.api.finish({accountTicket:'run-1',elapsed:20,bestScore:30000,longest:3000,clean:true},{valid:true}));assert.equal(h.api.pending,true);assert(h.data.has('drift:pending:user-a:run-1'));assert.equal(h.api.profile.cash,3200);
 let started=false;await h.api.prepare('race',1,()=>started=true);assert.equal(started,true);assert.equal(h.api.pending,false);assert.equal(h.api.profile.cash,4000);assert(!h.data.has('drift:pending:user-a:run-1'));
});
test('client detects a cookie/account switch before mutation and clears private in-memory state',async()=>{
 const h=harness();await flush();h.fail(409,{code:'session_changed',error:'Cambió la cuenta'});await assert.rejects(h.api.mutation('purchase',{skin:'blue',part:'engine',tier:1}));assert.equal(h.api.ready,false);assert.equal(h.api.profile,null);assert.equal(h.api.user,null);assert.equal(h.calls.at(-1).headers['X-Drift-User'],'user-a');
});
test('an older profile response cannot overwrite a newer revision',async()=>{
 const h=harness();await flush();h.remote({...h.api.profile,cash:10},1);await h.api.refresh();assert.equal(h.api.profile.cash,3200);
});
test('unauthenticated boot keeps the gate visible and the career empty',async()=>{
 const h=harness({authenticated:false});await flush();assert.equal(h.api.ready,false);assert.equal(h.el('accountGate').hidden,false);assert.equal(h.code('DriftCareer.load().cash'),0);
});
