/* Playback is a presentation layer. The live player, clocks, result and inputs
 * are never restored from a recording. Leaving returns to the same paused UI. */
replayUI=(()=>{
  const recorder=new DriftReplay.Recorder(),buttons=['btnReplayPause','btnReplayEnd','btnReplayOnline'];
  let clock=0,session=null,playing=true,speed=1,at=0,returnState='',returnLocked=false,revision=0,lastEffects=-Infinity;
  const names={cinematic:'Montaje',drone:'Dron',isometric:'Isométrica',trackside:'Curva'};
  function syncButtons(){for(const id of buttons){const b=$('#'+id);if(b)b.disabled=recorder.duration<2||!!online?.racing;}}
  function reset(){if(session)close();clock=0;recorder.reset({track,skin:chosen.sprite,timeOfDay:renderPrefs.timeOfDay});driftEffect.reset();syncButtons();}
  function capture(dt=1/60){if(player&&track&&!session){clock+=Math.min(dt,.25);recorder.capture(clock,player,mode==='online'?online?.rivals()||[]:[]);}syncButtons();}
  function open(){
    if(session||recorder.duration<2||online?.racing)return;
    returnState=state;returnLocked=controlsLocked;clearInputs();controlsLocked=true;state='replay';
    session={camera:'cinematic',wasInGame:document.body.classList.contains('in-game')};document.body.classList.add('in-game');at=recorder.start;speed=1;playing=true;revision++;lastEffects=-Infinity;
    document.body.classList.add('replaying');$('#replayControls').classList.remove('hidden');$('#replayCamera').value='cinematic';$('#replaySpeed').value='1';
    sceneView?.resetCamera();driftEffect.reset();syncTouchHUD();updateUI();$('#replayPlay').focus();
  }
  function close(){
    if(!session)return;document.body.classList.toggle('in-game',session.wasInGame);session=null;state=returnState;controlsLocked=returnLocked;clearInputs();simAccumulator=0;lastTS=performance.now()/1000;
    document.body.classList.remove('replaying');$('#replayControls').classList.add('hidden');sceneView?.resetCamera();driftEffect.reset();syncTouchHUD();
  }
  function toggle(){if(!session)return;if(at>=recorder.end)seek(0);playing=!playing;updateUI();}
  function seek(value){at=recorder.start+Math.max(0,Math.min(recorder.duration,value));revision++;lastEffects=-Infinity;sceneView?.resetCamera();driftEffect.reset();updateUI();}
  function updateUI(){
    $('#replayPlay').textContent=playing?'Ⅱ Pausar':'▶ Reproducir';$('#replayPlay').setAttribute('aria-label',playing?'Pausar repetición':'Reproducir repetición');
    $('#replaySeek').max=recorder.duration;$('#replaySeek').value=at-recorder.start;$('#replaySeek').setAttribute('aria-valuetext',formatTime(at-recorder.start)+' de '+formatTime(recorder.duration));
    $('#replayTime').textContent=formatTime(at-recorder.start)+' / '+formatTime(recorder.duration);
    $('#replayLabel').textContent=(recorder.start>1?'ÚLTIMOS 10 MIN · ':'REPETICIÓN · ')+(recorder.meta.track.layout?.name||recorder.meta.track.route?.name||'Circuito personalizado');
  }
  function frame(dt){
    if(!session)return null;
    if(playing){at=Math.min(recorder.end,at+Math.min(dt,.25)*speed);if(at>=recorder.end)playing=false;}
    const sample=recorder.sample(at);if(!sample?.player)return null;
    sample.player.sprite=CAR_IMG[sample.player.skin];sample.rivals.forEach(p=>p.sprite=CAR_IMG[p.skin]);
    const t=at-recorder.start,anchorTime=recorder.start+Math.floor(t/7)*7;
    sample.camera=session.camera;sample.anchor=recorder.sample(anchorTime)?.player||sample.player;
    sample.time=t;sample.dt=playing?dt*speed:0;sample.revision=revision;sample.skin=recorder.meta.skin;sample.timeOfDay=recorder.meta.timeOfDay;
    // Reconstruct a small visual trail from saved poses; do not integrate forces.
    if(Math.abs(at-lastEffects)>=.049){
      const trails=[],smoke=[];
      for(let age=2.4;age>=0;age-=.1){const old=recorder.sample(at-age);if(!old?.player?.trailOn||at-age<recorder.start)continue;const p=old.player,off=DriftRoadContact.wheelOffsets(p.skin)[0],c=Math.cos(p.angle),s=Math.sin(p.angle),x=p.pos.x+c*off.x,y=p.pos.y+s*off.x,w=Math.abs(off.z);
        trails.push({x1:x+s*w,y1:y-c*w,x2:x-s*w,y2:y+c*w,a:.3});
        if(age<.7)for(const sign of [-1,1])smoke.push({x:x+s*w*sign+Math.sin((at-age)*31)*age,y:y-c*w*sign,life:age,a:.25*(1-age),r:.4+age});
      }
      session.effects={trails,smoke};lastEffects=at;
    }
    sample.player.tireTrails=session.effects?.trails||[];sample.player.smoke=session.effects?.smoke||[];
    updateUI();return sample;
  }
  function decorate(g,w,h,label){
    g.save();g.fillStyle='#081116';g.fillRect(0,0,w,Math.min(32,h*.045));g.fillRect(0,h-Math.min(32,h*.045),w,Math.min(32,h*.045));
    g.fillStyle='#ecefe6';g.font='10px monospace';g.textAlign='right';g.fillText((label||names[session?.camera]||'MONTAJE').toUpperCase(),w-20,25);g.restore();
  }
  for(const id of buttons)$('#'+id).addEventListener('click',open);
  $('#replayExit').addEventListener('click',close);$('#replayPlay').addEventListener('click',toggle);
  $('#replaySeek').addEventListener('input',e=>seek(Number(e.target.value)));
  $('#replaySpeed').addEventListener('change',e=>speed=Number(e.target.value));
  $('#replayCamera').addEventListener('change',e=>{if(!session)return;session.camera=e.target.value;revision++;sceneView?.resetCamera();});
  addEventListener('blur',()=>{if(session){playing=false;updateUI();}});
  return {open,close,reset,capture,frame,decorate,syncButtons,toggle,seek,recorder,get active(){return !!session;},get playing(){return playing;}};
})();
