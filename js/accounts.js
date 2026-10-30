/* Same-origin accounts. Browser storage is never the authority for credits or purchases. */
globalThis.DriftAccount=(()=>{
  let ready=false,user=null,profile=null,revision=-1,config=null,busy=false,starting=false,authMode='login',actionToken='',snapshot=null,records=new Map(),pending=new Map(),recordTimers=new Map(),epoch=0,operationChain=Promise.resolve();
  const el=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),uuid=()=>crypto.randomUUID();
  const pendingKey=()=>user?'drift:pending:'+user.id+':':null;
  const storage={
    get length(){return records.size;},key:i=>[...records.keys()][i]||null,
    getItem(key){return records.get(key)?.value??null;},
    setItem(key,value){if(!ready)return;if(key==='challenge:unlocked')return;const old=records.get(key)||{revision:0};let text=String(value);try{const v=JSON.parse(text);if(Array.isArray(v.samples)&&v.samples.length>1500){const stride=Math.ceil(v.samples.length/1500);v.samples=v.samples.filter((_,i)=>i%stride===0);v.hz=(v.hz||30)/stride;text=JSON.stringify(v);}}catch{}records.set(key,{...old,value:text});try{localStorage.setItem('drift:record:'+user.id+':'+key,text);}catch{}clearTimeout(recordTimers.get(key));recordTimers.set(key,setTimeout(()=>saveRecord(key),800));},
    removeItem(){throw Error('Los datos de la cuenta no se borran desde el navegador.');}
  };
  function status(text,error=false){const node=el('accountStatus');if(node){node.textContent=text;node.classList.toggle('error',error);}if(el('accountSync'))el('accountSync').textContent=text;}
  function persist(){if(!user)return;try{const prefix=pendingKey();for(const [id,result] of pending)localStorage.setItem(prefix+id,JSON.stringify(result));}catch{status('Guardado pendiente. Mantén esta ventana abierta.',true);}}
  function lock(){ready=false;epoch++;user=null;profile=null;revision=-1;snapshot=null;records.clear();pending.clear();for(const t of recordTimers.values())clearTimeout(t);recordTimers.clear();try{sessionStorage.removeItem('drift:online:session:v1');}catch{};document.body.classList.add('account-locked');document.body.classList.remove('account-ready');globalThis.dispatchEvent(new Event('drift:locked'));show('login');}
  async function request(path,data,{anonymous=false}={}){
    const response=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:{...(user&&!anonymous?{'X-Drift-User':user.id}:{}),...(data===undefined?{}:{'Content-Type':'application/json','X-Drift-Request':'1'})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
    let result;try{result=await response.json();}catch{throw Error('El servidor de cuentas no está disponible. Inténtalo de nuevo.');}
    if(!response.ok){if((response.status===401&&!anonymous)||result.code==='session_changed')lock();throw Object.assign(Error(result.error||'No pudimos completar la operación.'),{status:response.status});}return result;
  }
  function apply(result){
    if(result.user&&user&&result.user.id!==user.id)return;
    if(result.profile&&result.revision>=revision){profile=result.profile;revision=result.revision;snapshot=result;user=result.user||user;globalThis.dispatchEvent(new Event('drift:profile'));}
  }
  async function refresh(){const stamp=epoch,result=await request('profile');if(stamp===epoch){if(result.user?.id!==user?.id){lock();throw Error('Cambió la cuenta en otra pestaña. Inicia sesión nuevamente.');}apply(result);}return result;}
  function mutation(path,data){const stamp=epoch;const task=operationChain.catch(()=>{}).then(async()=>{if(stamp!==epoch||!ready)throw Error('Inicia sesión nuevamente.');const result=await request(path,{...data,operationId:uuid()});if(stamp===epoch)apply(result);return result;});operationChain=task;return task;}
  async function saveRecord(key){
    const stamp=epoch;
    const task=operationChain.catch(()=>{}).then(async()=>{
      if(stamp!==epoch||!ready)return;const old=records.get(key);if(!old)return;const sent=old.value;
      let value;try{value=JSON.parse(sent);}catch{value=sent;}
      try{const r=await request('records',{key,value,revision:old.revision});if(stamp!==epoch)return;const current=records.get(key);if(current){current.revision=r.revision;if(current.value===sent){recordTimers.delete(key);localStorage.removeItem('drift:record:'+user.id+':'+key);}else setTimeout(()=>saveRecord(key),0);}}
      catch(e){if(stamp!==epoch)return;if(e.status===409){const latest=await request('records');if(stamp!==epoch)return;const remote=latest.records.find(r=>r.key===key),current=records.get(key);if(remote&&current){let local;try{local=JSON.parse(current.value);}catch{local=current.value;}const preferRemote=key.startsWith('tt:')?Number(remote.value?.time)>0&&Number(remote.value.time)<=Number(local?.time):key.startsWith('downhill:')?Number(remote.value?.score)>=Number(local?.score):Number(remote.value)>=Number(local);current.revision=remote.revision;if(preferRemote)current.value=JSON.stringify(remote.value);setTimeout(()=>saveRecord(key),0);}}status('Un récord está pendiente de guardar. '+e.message,true);}
    });operationChain=task;return task;
  }
  async function hydrate(result){
    user=result.user;profile=result.profile;revision=result.revision;snapshot=result;const stamp=++epoch;
    const data=await request('records');if(stamp!==epoch)return;
    records=new Map(data.records.map(r=>[r.key,{value:JSON.stringify(r.value),revision:r.revision}]));
    try{pending=new Map();const prefix=pendingKey();for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix))pending.set(key.slice(prefix.length),JSON.parse(localStorage.getItem(key)));}}catch{pending=new Map();}
    const recordPrefix='drift:record:'+user.id+':';for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(recordPrefix)){const name=key.slice(recordPrefix.length),old=records.get(name)||{revision:0};records.set(name,{...old,value:localStorage.getItem(key)});recordTimers.set(name,setTimeout(()=>saveRecord(name),1000));}}
    ready=true;document.body.classList.remove('account-locked');document.body.classList.add('account-ready');modal(false);
    globalThis.dispatchEvent(new Event('drift:profile'));await retryPending();
  }
  async function finish(run,options){
    if(!run.accountTicket)throw Error('La carrera no está vinculada a tu cuenta.');
    const b={id:run.accountTicket,elapsed:run.elapsed,score:run.bestScore,longest:run.longest,clean:run.clean,valid:options.valid===true};pending.set(b.id,b);persist();return sendFinish(b);
  }
  async function sendFinish(b){
    const stamp=epoch;try{status('Guardando resultado…');const result=await request('runs/finish',b);if(stamp!==epoch)throw Error('La sesión cambió.');apply(result);pending.delete(b.id);try{localStorage.removeItem(pendingKey()+b.id);}catch{}persist();status(result.ok?'Progreso guardado':result.error||'La carrera no pudo confirmarse.',!result.ok);return result;}
    catch(e){if(stamp===epoch&&[400,404,410].includes(e.status)){pending.delete(b.id);try{localStorage.removeItem(pendingKey()+b.id);}catch{}status('No se pudo confirmar este resultado: '+e.message,true);return {ok:false,error:e.message,profile:clone(profile),reward:0};}status('Resultado pendiente. '+e.message+' Usa «Sincronizar» para reintentar.',true);throw e;}
  }
  async function retryPending(){for(const b of [...pending.values()]){try{await sendFinish(b);}catch{return false;}}return true;}
  async function prepare(mode,level,callback){
    if(!ready){show('login');return;}if(starting)return;starting=true;status('Preparando carrera…');
    try{if(!await retryPending())throw Error('Sincroniza el resultado pendiente antes de empezar otra carrera.');const result=await mutation('runs/start',{mode,level});status('Progreso sincronizado');if(ready)callback(result);}
    catch(e){status(e.message,true);show('profile');}finally{starting=false;}
  }
  function modal(open){const gate=el('accountGate');if(gate)gate.hidden=!open;for(const child of document.body.children||[]){if(child!==gate&&!['SCRIPT','STYLE','LINK'].includes(child.tagName))child.inert=open;}}
  function show(mode='login'){
    authMode=mode;const gate=el('accountGate');if(!gate)return;modal(true);el('accountAuth').hidden=mode==='profile';el('accountProfile').hidden=mode!=='profile';el('accountClose').hidden=!ready;
    globalThis.dispatchEvent(new Event('drift:account-open'));
    const register=mode==='register',reset=mode==='reset',verify=mode==='verify',mailOnly=['forgot','resend'].includes(mode);
    el('accountTitle').textContent={login:'VUELVE A LA PISTA',register:'CREA TU PERFIL',forgot:'RECUPERA EL ACCESO',resend:'VERIFICA TU CORREO',reset:'NUEVA CONTRASEÑA',verify:'CONFIRMA Y CREA TU CLAVE',profile:'TU PERFIL'}[mode]||'VUELVE A LA PISTA';
    el('accountTabs').hidden=!['login','register'].includes(mode);el('accountGoogle').hidden=!['login','register'].includes(mode);el('accountGoogle').disabled=!config?.google;
    el('accountNameRow').hidden=!register;el('accountName').required=register;
    el('accountEmailRow').hidden=reset||verify;el('accountEmail').required=!(reset||verify);
    el('accountPasswordRow').hidden=mailOnly;el('accountPassword').required=!mailOnly;el('accountPassword').autocomplete=register||reset||verify?'new-password':'current-password';
    el('accountPassword').value='';el('accountSubmit').textContent={login:'INICIAR SESIÓN ↗',register:'CREAR CUENTA ↗',forgot:'ENVIAR ENLACE',resend:'REENVIAR VERIFICACIÓN',reset:'GUARDAR CONTRASEÑA',verify:'VERIFICAR CORREO'}[mode]||'CONTINUAR';
    el('accountLoginTab').setAttribute('aria-pressed',String(mode==='login'));el('accountRegisterTab').setAttribute('aria-pressed',String(register));
    if(mode==='profile')renderProfile();setTimeout(()=>{(mode==='profile'?el('profileName'):register?el('accountName'):reset||verify?el('accountPassword'):verify?el('accountSubmit'):el('accountEmail')).focus();},0);
  }
  function renderProfile(){
    if(!user||!profile)return;el('profileName').value=user.name;el('profileEmail').textContent=user.email;el('profileIdentity').textContent='PILOTO · '+user.id.slice(0,8).toUpperCase();
    el('profileCredits').textContent=profile.cash.toLocaleString('es-CL')+' CR';el('profileProgress').textContent=`${DriftCareer.stars(profile)}/60 objetivos · ${profile.wins} victorias`;
    el('accountLinkGoogle').hidden=!!user.google;el('accountLinkGoogle').disabled=!config?.google;
    const achievements=el('profileAchievements');achievements.replaceChildren();for(const a of snapshot?.achievements||[]){const item=document.createElement('li');item.textContent=(a.unlocked?'✓ ':'○ ')+a.name;item.className=a.unlocked?'earned':'';achievements.append(item);}
    const ledger=el('profileLedger');ledger.replaceChildren();for(const entry of snapshot?.ledger||[]){const li=document.createElement('li');const reason=entry.kind==='purchase'?`Compra · ${DriftCareer.part(entry.detail.skin,entry.detail.part)?.name||'Pieza'} · nivel ${entry.detail.tier}`:entry.kind==='online'?'Victoria online':'Carrera · '+entry.detail.mode;li.textContent=reason+' · '+(entry.amount>=0?'+':'')+entry.amount.toLocaleString('es-CL')+' CR';ledger.append(li);}if(!ledger.children.length){const li=document.createElement('li');li.textContent='Tu historial comienza con tu primera carrera.';ledger.append(li);}
  }
  async function submit(event){
    event.preventDefault();if(busy)return;busy=true;el('accountSubmit').disabled=true;status('Conectando…');
    try{const path={login:'login',register:'register',forgot:'forgot',resend:'resend',verify:'verify',reset:'reset'}[authMode];const result=await request('auth/'+path,{email:el('accountEmail').value,name:el('accountName').value,password:el('accountPassword').value,token:actionToken},{anonymous:true});el('accountPassword').value='';
      if(result.authenticated){await hydrate(result);status('Progreso sincronizado');}
      else{const message=result.message;if(['reset','verify'].includes(authMode)){actionToken='';show('login');}status(message);}
    }catch(e){status(e.message,true);}finally{busy=false;el('accountSubmit').disabled=false;}
  }
  async function logout(all=false){try{if(!await retryPending())throw Error('Todavía hay un resultado pendiente. Sincronízalo antes de salir.');await request('logout',{all});lock();status('Sesión cerrada.');}catch(e){status(e.message,true);}}
  async function boot(){
    const params=new URLSearchParams(location.hash.slice(1)),action=params.get('account');if(action){actionToken=params.get('token')||'';history.replaceState(null,'',location.pathname+location.search);}
    try{config=await request('config',undefined,{anonymous:true});const result=await request('session',undefined,{anonymous:true});if(result.authenticated)await hydrate(result);
      if(action==='verify'||action==='reset')show(action);else if(!ready)show('login');
      if(action==='error')status(params.get('message')||'No se pudo iniciar sesión.',true);else if(!ready)status(config.email?'Inicia sesión para guardar tu progreso en cualquier equipo.':'El servicio de correo está pendiente de configuración.',!config.email);
    }catch(e){lock();status(e.message,true);}
  }
  function mount(){
    el('accountForm').addEventListener('submit',submit);el('accountLoginTab').onclick=()=>show('login');el('accountRegisterTab').onclick=()=>show('register');el('accountForgot').onclick=()=>show('forgot');el('accountResend').onclick=()=>show('resend');el('accountBackLogin').onclick=()=>show('login');
    el('accountGoogle').onclick=el('accountLinkGoogle').onclick=()=>location.assign('/api/auth/google');el('accountOpen').onclick=()=>show(ready?'profile':'login');el('accountClose').onclick=()=>{if(ready)modal(false);};
    el('accountLogout').onclick=()=>logout();el('accountLogoutAll').onclick=()=>logout(true);el('accountRetry').onclick=()=>boot();
    el('profileSave').onclick=async()=>{try{const r=await request('profile/name',{name:el('profileName').value});apply(r);status('Nombre guardado.');}catch(e){status(e.message,true);}};
    el('profileSync').onclick=async()=>{try{await retryPending();for(const key of recordTimers.keys())await saveRecord(key);await refresh();renderProfile();}catch(e){status(e.message,true);}};
    el('accountGate').addEventListener('keydown',e=>{if(e.key==='Escape'){if(ready)modal(false);e.stopPropagation();}if(e.key==='Tab'){const nodes=[...el('accountGate').querySelectorAll('button,input,a')].filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}e.stopPropagation();});
    window.addEventListener('drift:profile',()=>{el('accountOpen').textContent=user?'◉ '+user.name:'◉ PERFIL';if(authMode==='profile')renderProfile();});
    window.addEventListener('online',()=>{if(ready)retryPending();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)refresh().catch(e=>status(e.message,true));});
    setInterval(()=>{if(ready)request('session').then(r=>{if(!r.authenticated||r.user.id!==user?.id)lock();else apply(r);}).catch(()=>{});},60000);
    boot();
  }
  document.addEventListener('DOMContentLoaded',mount);
  return {enabled:true,get ready(){return ready;},get profile(){return profile&&clone(profile);},get user(){return user&&clone(user);},get visible(){return !el('accountGate')?.hidden;},get pending(){return pending.size>0;},storage,prepare,finish,mutation,refresh,show,status,request};
})();
globalThis.DriftStorage=DriftAccount.storage;
