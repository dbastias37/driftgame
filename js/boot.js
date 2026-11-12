/* First-paint loading screen. Completion comes only from downloads + preparation. */
(function(){
  const $=id=>document.getElementById(id),screen=$('bootScreen'),bar=$('bootProgress'),fill=$('bootFill'),percent=$('bootPercent'),status=$('bootStatus'),play=$('bootPlay'),retry=$('bootRetry');
  const tasks=new Map(),completed=new Set(),inertBefore=new Map();let phase='loading',fatal=null,running=false,maximum=0;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms));
  const domReady=new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const boot=globalThis.DriftBoot={started:false,get active(){return phase!=='entered';},get phase(){return phase;},
    register(name,prepare){tasks.set(name,prepare);},onEnter:null,coreReady:false};
  function paint(value,label){
    maximum=Math.max(maximum,Math.min(100,Math.floor(value)));fill.style.transform='scaleX('+(maximum/100)+')';
    percent.textContent=maximum+'%';bar.setAttribute('aria-valuenow',String(maximum));if(label)status.textContent=label;
  }
  function lock(){for(const el of document.body.children)if(el!==screen&&!['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)){inertBefore.set(el,el.inert);el.inert=true;}}
  function fail(error){
    if(phase==='entered')return;phase='error';screen.dataset.phase=phase;screen.setAttribute('aria-busy','false');play.disabled=true;retry.hidden=false;
    status.textContent='No se pudo completar la carga. Reintenta para continuar.';$('bootError').textContent=error.message||String(error);
  }
  // Classic script/style failures cannot be mistaken for a successful preload.
  window.addEventListener('error',event=>{
    if(!boot.active)return;
    if(event.target?.tagName==='SCRIPT'||event.target?.tagName==='LINK'||event.error){fatal=Error('No se pudo iniciar el juego. Recarga para reintentar.');fail(fatal);}
  },true);
  window.addEventListener('keydown',event=>{
    if(!boot.active||event.ctrlKey||event.altKey||event.metaKey)return;
    event.stopImmediatePropagation();
    if(['Enter',' ','Tab'].includes(event.key)){event.preventDefault();if(event.repeat)return;if(phase==='ready'){if(event.key==='Tab')play.focus();else enter();}else if(phase==='error'){if(event.key==='Tab')retry.focus();else retry.click();}}
  },true);
  document.addEventListener('click',event=>{if(boot.active&&!screen.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
  const assets=globalThis.DriftAssets=new DriftAssetStore({onProgress:({ratio,loaded,total})=>paint(ratio*90,'CARGANDO RECURSOS · '+Math.floor(loaded/1048576)+' / '+Math.ceil(total/1048576)+' MB')});
  async function run(){
    if(running)return;running=true;phase='loading';screen.dataset.phase=phase;screen.setAttribute('aria-busy','true');retry.hidden=true;$('bootError').textContent='';
    try{
      if(!assets.entries.size){const response=await fetch('assets/preload-manifest.json?v=boot1',{cache:'no-cache',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('No se pudo leer el catálogo de recursos');assets.configure((await response.json()).assets);}
      await assets.preload();await domReady;if(fatal)throw fatal;
      if(!boot.coreReady||!tasks.has('renderer')||!tasks.has('music')){
        fatal=Error('La página cargó archivos de distintas versiones. Reintenta para actualizarla.');throw fatal;
      }
      paint(90,'PREPARANDO MODELOS Y PISTAS');
      const {prepareResources}=await import('./boot-resources.js?v=boot1');
      await prepareResources((done,total)=>paint(90+8*done/total,'PREPARANDO MODELOS Y PISTAS'));
      let count=0;
      for(const [name,prepare] of tasks){if(!completed.has(name)){await prepare();completed.add(name);}paint(98+(++count/tasks.size),'PREPARANDO MENÚ');}
      if(fatal)throw fatal;
      paint(100,'CARGA COMPLETA');screen.setAttribute('aria-busy','false');
      await wait(260);phase='complete';screen.dataset.phase=phase;
      await wait(360);phase='ready';screen.dataset.phase=phase;$('bootLoading').setAttribute('aria-hidden','true');screen.setAttribute('aria-label','DR1FT listo para jugar');play.disabled=false;play.focus({preventScroll:true});
    }catch(error){fail(error);}finally{running=false;}
  }
  async function enter(){
    if(phase!=='ready')return;phase='leaving';screen.dataset.phase=phase;play.disabled=true;
    // play() is invoked synchronously inside the actual click/Enter activation.
    try{
      globalThis.DriftMusic?.out('menu');globalThis.DriftEngineAudio?.unlock();
      await wait(300);boot.onEnter();boot.started=true;
      document.body.classList.remove('booting');screen.dataset.phase='revealing';globalThis.DriftMusic?.into('menu');
      await wait(360);phase='entered';screen.hidden=true;
      for(const [el,inert] of inertBefore)el.inert=inert;
      $('btnQuickRace')?.focus({preventScroll:true});
    }catch(error){fatal=error;fail(error);}
  }
  play.addEventListener('click',enter);retry.addEventListener('click',()=>fatal?location.reload():run());
  domReady.then(lock);run();
})();
