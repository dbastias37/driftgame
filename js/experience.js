/* Presentation and navigation. Never advances or rewrites driving physics. */
const PREF_KEY='drift:preferences:v3';
let savedPrefs={};try{savedPrefs=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{}
const renderPrefs={
  view:['2d','3d'].includes(savedPrefs.view)?savedPrefs.view:'3d',
  camera:['chase','aerial','hood','drone'].includes(savedPrefs.camera)?savedPrefs.camera:'chase',
  impulse:savedPrefs.impulse==='off'?'off':'on',
  speedLines:['car','center','off'].includes(savedPrefs.speedLines)?savedPrefs.speedLines:'car',
  speedLinesIntensity:Number.isFinite(savedPrefs.speedLinesIntensity)?Math.max(0,Math.min(3,savedPrefs.speedLinesIntensity)):1.5,
  timeOfDay:Math.max(0,Math.min(1,Number(savedPrefs.timeOfDay)||0)),
  quality:['auto','high','low'].includes(savedPrefs.quality)?savedPrefs.quality:'auto',
  touch:['auto','on','off'].includes(savedPrefs.touch)?savedPrefs.touch:'auto',
  motion:['full','reduced'].includes(savedPrefs.motion)?savedPrefs.motion:(matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full')
};
let sceneView=null,sceneFailed=false,toastTimer=0,settingsReturn='mainMenu',helpPaused=false;
touchEnabled=renderPrefs.touch==='on'||(renderPrefs.touch==='auto'&&isTouchDevice);
const demoLevel=1+Math.floor(Math.random()*20),demoDay=Math.random()<.5?0:1;
const attractTrack=presetTrack(demoLevel),attractDemo=new DriftAttract.Demo(attractTrack,{day:demoDay});
let demoFrame=attractDemo.frame(0);
for(const id of ['titleDemoInfo','homeDemoInfo'])$('#'+id).textContent=attractTrack.layout.name+' / '+(demoDay?'NOCHE':'DÍA')+' / 3 PILOTOS';
$('#btnPlayNow').addEventListener('click',()=>{showMainMenu();$('#btnQuickRace').focus();});
$('#btnBackTitle').addEventListener('click',()=>{hidePanels();state='title';$('#titleScreen').classList.remove('hidden');$('#btnPlayNow').focus();});
$('#btnDemoPause').addEventListener('click',()=>{attractDemo.paused=!attractDemo.paused;$('#btnDemoPause').textContent=attractDemo.paused?'▶ DEMO':'Ⅱ DEMO';});
const CAMERA_NAMES={chase:'Seguimiento',aerial:'Aérea',hood:'Capó',drone:'Dron cinematográfico'};
if(Number.isInteger(savedPrefs.car)&&savedPrefs.car>=0&&savedPrefs.car<CAR_DATA.length){carIdx=savedPrefs.car;chosen=CAR_DATA[carIdx];}
if(savedPrefs.tx==='manual')document.querySelector('input[name="tx"][value="manual"]').checked=true;
function saveRenderPrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({...renderPrefs,car:carIdx,tx:selectedTx()}));}catch{}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function syncRenderUI(){
  document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===renderPrefs.view;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('#btnView').textContent=renderPrefs.view==='3d'?'Vista 3D':'Vista 2D';
  $('#btnView').setAttribute('aria-label',renderPrefs.view==='3d'?'Cambiar a vista 2D':'Cambiar a vista 3D');
  $('#btnCamera').disabled=renderPrefs.view!=='3d';
  $('#viewBadge').textContent=renderPrefs.view==='3d'?'3D / '+CAMERA_NAMES[renderPrefs.camera].toUpperCase():'2D / CLÁSICA';
  $('#speedLinesIntensity').value=Math.round(renderPrefs.speedLinesIntensity*100);$('#speedLinesIntensityLabel').textContent=Math.round(renderPrefs.speedLinesIntensity*100)+'%';
  $('#impulseSetting').value=renderPrefs.impulse;$('#speedLinesSetting').value=renderPrefs.speedLines;
  syncDaytimeUI();
  $('#touchSetting').value=renderPrefs.touch;$('#cameraSetting').value=renderPrefs.camera;$('#qualitySetting').value=renderPrefs.quality;$('#motionSetting').value=renderPrefs.motion;
}
function syncDaytimeUI(){
  const value=renderPrefs.timeOfDay,label=value<.25?'Día':value<.72?'Atardecer':'Noche';
  document.querySelectorAll('[data-daytime]').forEach(input=>{input.value=Math.round(value*100);input.setAttribute('aria-valuetext',label);});
  document.querySelectorAll('[data-daytime-label]').forEach(output=>output.textContent=label);
}
document.querySelectorAll('[data-daytime]').forEach(input=>input.addEventListener('input',e=>{
  renderPrefs.timeOfDay=Math.max(0,Math.min(1,Number(e.target.value)/100));syncDaytimeUI();saveRenderPrefs();
}));
function setRenderView(next){
  if(next==='3d'&&sceneFailed){toast('3D no disponible en este navegador. Puedes seguir jugando en 2D.');return;}
  renderPrefs.view=next;sceneView?.resetCamera();syncRenderUI();saveRenderPrefs();
  if(document.body.classList.contains('in-game'))toast(next==='3d'?'Vista 3D · C cambia la cámara':'Vista 2D clásica · V vuelve a 3D');
}
function cycleCamera(){if(renderPrefs.view!=='3d')return;const names=['chase','aerial','hood','drone'];renderPrefs.camera=names[(names.indexOf(renderPrefs.camera)+1)%names.length];sceneView?.resetCamera();syncRenderUI();saveRenderPrefs();toast('Cámara '+CAMERA_NAMES[renderPrefs.camera]);}
function fail3D(error){
  if(sceneFailed)return;sceneFailed=true;
  console.warn('3D unavailable; preserving the current race in 2D.',error);
  sceneView?.dispose();sceneView=null;renderPrefs.view='2d';$('#scene3d').style.visibility='hidden';syncRenderUI();
  toast('3D no disponible. La carrera continúa en 2D.');
}
function openSettings(){
  if(state==='running'||state==='countdown')setPaused(true);
  settingsReturn=state==='paused'?'pauseMenu':'mainMenu';
  $('#'+settingsReturn).classList.add('hidden');$('#settingsMenu').classList.remove('hidden');syncRenderUI();$('#cameraSetting').focus();
}
function closeSettings(){$('#settingsMenu').classList.add('hidden');$('#'+settingsReturn).classList.remove('hidden');$('#'+(settingsReturn==='pauseMenu'?'btnResume':'btnSettings')).focus();}
function toggleHelp(force){
  const show=force===undefined?!$('#help').classList.contains('show'):force;
  if(show){helpPaused=['running','countdown'].includes(state);if(helpPaused)setPaused(true);$('#help').classList.remove('hidden');$('#help').classList.add('show');$('#btnHelpClose').focus();}
  else{$('#help').classList.remove('show');if(helpPaused&&state==='paused')setPaused(false);helpPaused=false;}
}
function updateDriveHUD(){
  if(!player)return;if(mode==='downhill')updateDescentHUD();const speed=player.worldSpeed()*3.6;
  $('#driveSpeed').textContent=String(Math.round(speed)).padStart(3,'0');$('#driveGear').textContent=player.gear;
  $('#driveTx').textContent=player.auto?'AUTO':'MANUAL';
  $('#revFill').style.width=Math.min(100,speed/(player.gearMax[player.gear-1]||198)*100)+'%';
  $('#driveHud').classList.toggle('redline',player.redBlink);
}
function drawTrackThumbnails(root){
  root.querySelectorAll('.track-thumb').forEach(canvas=>{
    const t=canvas.dataset.downhill?DriftDownhill.layout(Number(canvas.dataset.downhill)):presetTrack(Number(canvas.dataset.track)),g=canvas.getContext('2d');canvas.width=240;canvas.height=120;
    const b=t.bounds,s=Math.min(210/b.w,90/b.h);g.translate(120-(b.minX+b.w/2)*s,60-(b.minY+b.h/2)*s);g.scale(s,s);
    g.lineWidth=5/s;g.strokeStyle=canvas.dataset.downhill||Number(canvas.dataset.track)<=unlockedLevel?'#e8e9e3':'#606b6c';g.lineJoin='round';g.beginPath();t.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));if(!t.open)g.closePath();g.stroke();
    const p=t.point(0);g.fillStyle='#ff7544';g.beginPath();g.arc(p.x,p.y,4/s,0,PI*2);g.fill();
  });
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setRenderView(b.dataset.view)));
$('#btnView').addEventListener('click',()=>setRenderView(renderPrefs.view==='3d'?'2d':'3d'));
$('#btnCamera').addEventListener('click',cycleCamera);
$('#btnModeDownhill').addEventListener('click',()=>{mode='downhill';showDownhillMenu();});
$('#btnQuickRace').addEventListener('click',()=>{mode='race';showCircuitMenu();});
$('#btnSettings').addEventListener('click',openSettings);$('#btnPauseSettings').addEventListener('click',openSettings);$('#btnSettingsBack').addEventListener('click',closeSettings);
$('#btnMenuHelp').addEventListener('click',()=>toggleHelp());$('#btnHelpClose').addEventListener('click',()=>toggleHelp(false));
$('#btnImport').addEventListener('click',()=>{hidePanels();$('#importMessage').textContent='';$('#importMenu').classList.remove('hidden');$('#importCode').focus();});
$('#btnImportBack').addEventListener('click',showMainMenu);$('#btnOvMenu').addEventListener('click',showMainMenu);
$('#btnNextChallenge').addEventListener('click',()=>{
  if(state!=='challengeWon'||activeChallengeLevel>=CHALLENGE_COUNT)return;
  const next=activeChallengeLevel+1;mode='challenge';showTrackSelection();previewCircuit(next,true);
});
$('#touchSetting').addEventListener('change',e=>{renderPrefs.touch=e.target.value;touchEnabled=renderPrefs.touch==='on'||(renderPrefs.touch==='auto'&&isTouchDevice);clearInputs();syncTouchHUD();saveRenderPrefs();});
$('#cameraSetting').addEventListener('change',e=>{renderPrefs.camera=e.target.value;sceneView?.resetCamera();saveRenderPrefs();syncRenderUI();});
$('#qualitySetting').addEventListener('change',e=>{renderPrefs.quality=e.target.value;sceneView?.setQuality(renderPrefs.quality);menuPreview?.setQuality(renderPrefs.quality);saveRenderPrefs();});
for(const [id,key] of [['impulseSetting','impulse'],['speedLinesSetting','speedLines']])$('#'+id).addEventListener('change',e=>{renderPrefs[key]=e.target.value;driftEffect.reset();saveRenderPrefs();});
$('#speedLinesIntensity').addEventListener('input',e=>{renderPrefs.speedLinesIntensity=Number(e.target.value)/100;$('#speedLinesIntensityLabel').textContent=e.target.value+'%';saveRenderPrefs();});
$('#motionSetting').addEventListener('change',e=>{renderPrefs.motion=e.target.value;driftEffect.reset();previewSpinning=e.target.value!=='reduced';saveRenderPrefs();});
// Keep tab navigation inside the active menu; gameplay keys remain unchanged.
addEventListener('keydown',e=>{
  if(state==='menu'&&!mainMenu.classList.contains('hidden')&&['ArrowUp','ArrowDown'].includes(e.key)){
    const items=[...mainMenu.querySelectorAll('.raw-mode-list button')],i=items.indexOf(document.activeElement),next=i<0?(e.key==='ArrowUp'?items.length-1:0):(i+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;
    e.preventDefault();items[next]?.focus();return;
  }
  if(e.key!=='Tab')return;
  const panel=replayUI?.active?$('#replayControls'):$('#help.show')||['settingsMenu','importMenu','titleScreen','onlineMenu','carPanel','circuitMenu','challengeMenu','startPanel','pauseMenu','overlay','mainMenu'].map(id=>$('#'+id)).find(el=>!el.classList.contains('hidden'));
  if(!panel)return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),input,textarea,select,summary')].filter(el=>el.getClientRects().length);
  const first=focusables[0],last=focusables.at(-1);if(!first)return;
  if(e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===first)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===last)){e.preventDefault();first.focus();}
});
syncRenderUI();
requestAnimationFrame(loop);
let MenuPreviewClass=null,menuPreview=null,previewSelection=null,previewSpinning=renderPrefs.motion!=='reduced',previewFailed=false,previewLastFrame=0;
function showCircuitMenu(){
  if(mode==='downhill'){showDownhillMenu();return;}
  hidePanels();garageOrigin='circuits';$('#circuitMenu').classList.remove('hidden');$('#circuitList').classList.remove('hidden');
  $('#circuitTitle').textContent=mode==='tt'?'Contrarreloj · Elige circuito':'Carrera · Elige circuito';
  $('#btnCircuitBack').textContent='← Menú principal';
  const root=$('#circuitList');root.innerHTML=Array.from({length:CircuitLayouts.count},(_,i)=>{
    const c=CircuitLayouts.info(i+1);
    return `<div class="challenge-item"><span class="circuit-num">${String(i+1).padStart(2,'0')}</span><canvas class="track-thumb" data-track="${i+1}" aria-label="${c.name}"></canvas><button data-circuit="${i+1}" aria-label="Ver circuito ${i+1}: ${c.name}">${c.name}</button></div>`;
  }).join('');
  drawTrackThumbnails(root);root.querySelectorAll('[data-circuit]').forEach(btn=>btn.addEventListener('click',()=>previewCircuit(Number(btn.dataset.circuit),false)));
  previewCircuit(preparedTrack?.layout?.level||1,false);
}
function previewCircuit(n,challenge=false){
  const circuit=presetTrack(n);previewSelection={track:circuit,level:n,origin:challenge?'challenge':'circuits',challenge};
  updateTrackPreviewDetails();syncPreparationPreview();
}
function showCustomTrackPreview(track,origin='import'){
  hidePanels();garageOrigin=origin;previewSelection={track,level:0,origin,challenge:false};
  $('#circuitMenu').classList.remove('hidden');$('#circuitList').classList.add('hidden');
  $('#circuitTitle').textContent=origin==='board'?'Tu circuito · Vista previa':'Circuito importado · Vista previa';
  $('#btnCircuitBack').textContent=origin==='board'?'← Volver al dibujo':'← Importar otro circuito';
  updateTrackPreviewDetails();syncPreparationPreview();
}
function updateTrackPreviewDetails(){
  if(!previewSelection)return;
  const {track:t,level,challenge}=previewSelection,prefix=challenge?'challenge':'circuit';
  const length=t.layout?.length||t.points.reduce((s,p,i)=>{const q=t.points[(i+1)%t.points.length];return s+Math.hypot(p.x-q.x,p.y-q.y);},0);
  $('#'+prefix+'PreviewName').textContent=t.layout?.name||'Circuito personalizado';
  $('#'+prefix+'PreviewDetails').textContent=`${(length/1000).toFixed(2)} km · ${Math.round(t.roadHalf*2)} m de ancho${t.layout?' · '+t.layout.stage:''}`;
  const locked=challenge&&level>unlockedLevel,button=$(challenge?'#btnChallengeContinue':'#btnCircuitContinue');
  button.disabled=locked;button.textContent=locked?'SUPERA EL DESAFÍO ANTERIOR':'ELEGIR AUTO ↗';
  $('#circuitPreviewGoal').textContent=t.downhill?`Objetivo: ${t.goal.toLocaleString('es-CL')} pts antes del 100% · 3 vidas · Mejor: ${downhillBest(t.routeLevel).score.toLocaleString('es-CL')} pts`:'';
  if(t.downhill)$('#circuitPreviewDetails').textContent=`${(t.finishS/1000).toFixed(2)} km · ↓ ${Math.round(t.drop)} m · Pendiente ${Math.round(t.drop/t.length*100)}% media`;
  if(challenge)$('#challengePreviewGoal').textContent=`Objetivo: ${challengeRequiredPoints(level).toLocaleString('es-CL')} pts · Mejor: ${getChallengeBest(level).toLocaleString('es-CL')} pts${locked?' · Bloqueado':''}`;
  document.querySelectorAll('[data-circuit],.btnPickChallenge,[data-downhill-pick]').forEach(b=>{
    const selected=Number(b.dataset.circuit||b.dataset.lvl||b.dataset.downhillPick)===level;
    b.setAttribute('aria-pressed',String(selected));b.closest?.('.challenge-item')?.classList.toggle('selected',selected);
  });
}
function confirmTrackPreview(){
  if(!previewSelection)return;
  const {track:selected,level,origin,challenge}=previewSelection;
  if(challenge&&level>unlockedLevel)return;
  if(selected.downhill)mode='downhill';
  garageOrigin=origin;preparedTrack=selected;pendingTrackFactory=()=>selected;
  if(challenge){mode='challenge';activeChallengeLevel=level;activeChallengeGoal=challengeRequiredPoints(level);challengeCompletedThisRun=false;$('#challengeGoal').textContent=activeChallengeGoal.toLocaleString('es-CL');$('#challengeLevel').textContent=level;}
  openCarPanel();
}
function returnToTrackPreview(){
  if(mode==='online'&&online?.inRoom){online.showLobby();return;}
  if(!preparedTrack){showTrackSelection();return;}
  if(preparedTrack.downhill){mode='downhill';showDownhillMenu(preparedTrack.routeLevel);return;}
  if(!preparedTrack.layout?.level){showCustomTrackPreview(preparedTrack,garageOrigin==='board'?'board':'import');return;}
  const n=preparedTrack.layout.level;showTrackSelection();previewCircuit(n,mode==='challenge');
}
function syncPreparationPreview(){
  const garage=!$('#carPanel').classList.contains('hidden'),challenge=!$('#challengeMenu').classList.contains('hidden'),circuit=!$('#circuitMenu').classList.contains('hidden');
  if(!garage&&!challenge&&!circuit)return null;
  const stage=$('#'+(garage?'garageStage':challenge?'challengeStage':'circuitStage')),canvas=$('#carPreview');
  if(canvas.parentElement!==stage)stage.appendChild(canvas);
  document.querySelectorAll('[data-preview-spin]').forEach(b=>b.textContent=previewSpinning?'Ⅱ Pausar giro':'▶ Activar giro');
  return {kind:garage?'garage':'track',track:garage?preparedTrack:previewSelection?.track,stage};
}
function renderPreparationPreview(dt,time){
  const preview=syncPreparationPreview();if(!preview)return false;
  const status=preview.stage.querySelector('.preview-status');
  if(previewFailed){if(status){status.textContent='Vista previa no disponible. Puedes continuar.';status.classList.remove('hidden');}return true;}
  if(!MenuPreviewClass)return true;
  try{
    if(!menuPreview)menuPreview=new MenuPreviewClass($('#carPreview'),{quality:renderPrefs.quality,onFailure:()=>{previewFailed=true;},onVehicleFailure:()=>toast('No se pudo cargar un modelo de auto. Recarga para volver a intentarlo.')});
    if(document.hidden)return true;
    // There is only one preview canvas. Software mode caps work to 12 fps;
    // invisible previews and the racing renderer do not render behind it.
    if(time-previewLastFrame<1/(menuPreview.software?12:30))return true;
    const elapsed=previewLastFrame?Math.min(.1,time-previewLastFrame):dt;previewLastFrame=time;
    menuPreview.renderPreview({...preview,skin:chosen.sprite,dt:elapsed,spinning:previewSpinning,timeOfDay:renderPrefs.timeOfDay});
    status?.classList.add('hidden');
  }catch(error){console.warn('Preview unavailable',error);previewFailed=true;}
  return true;
}
$('#btnGarageTrack').addEventListener('click',returnToTrackPreview);
$('#btnCircuitContinue').addEventListener('click',confirmTrackPreview);$('#btnChallengeContinue').addEventListener('click',confirmTrackPreview);
$('#btnCircuitBack').addEventListener('click',()=>{
  if(previewSelection?.origin==='board')showBoard();
  else if(previewSelection?.origin==='import'){hidePanels();$('#importMenu').classList.remove('hidden');}
  else showMainMenu();
});
document.querySelectorAll('[data-preview-spin]').forEach(b=>b.addEventListener('click',()=>{previewSpinning=!previewSpinning;syncPreparationPreview();}));
let previewPointer=null;
$('#carPreview').addEventListener('pointerdown',e=>{previewPointer={id:e.pointerId,x:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);});
$('#carPreview').addEventListener('pointermove',e=>{if(previewPointer?.id!==e.pointerId)return;menuPreview?.rotateBy((e.clientX-previewPointer.x)*.008);previewPointer.x=e.clientX;previewSpinning=false;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#carPreview').addEventListener(event,()=>{previewPointer=null;});
$('#carPreview').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();menuPreview?.rotateBy(e.key==='ArrowLeft'?-.18:.18);previewSpinning=false;}});

function downhillBest(level){try{return JSON.parse(localStorage.getItem('downhill:v2:'+level)||'null')||{score:0,time:0};}catch{return {score:0,time:0};}}
function showDownhillMenu(level=preparedTrack?.downhill?preparedTrack.routeLevel:1){
  hidePanels();garageOrigin='downhill';$('#circuitMenu').classList.remove('hidden');$('#circuitList').classList.remove('hidden');$('#circuitTitle').textContent='Cerro abajo · Elige descenso';$('#btnCircuitBack').textContent='← Menú principal';
  const root=$('#circuitList');root.innerHTML=Array.from({length:DriftDownhill.count},(_,i)=>{const t=DriftDownhill.info(i+1);return `<div class="challenge-item"><span class="circuit-num">${String(i+1).padStart(2,'0')} / ${DriftDownhill.count}</span><canvas class="track-thumb" data-downhill="${i+1}" aria-label="Descenso ${t.name}"></canvas><div><b>${t.name}</b></div><div class="tag">${t.stage}</div><button data-downhill-pick="${i+1}" aria-label="Ver descenso ${t.name}">Ver descenso</button></div>`;}).join('');
  drawTrackThumbnails(root);root.querySelectorAll('[data-downhill-pick]').forEach(b=>b.addEventListener('click',()=>previewDownhill(Number(b.dataset.downhillPick))));previewDownhill(level);
}
function previewDownhill(level){previewSelection={track:DriftDownhill.createTrack(Track,level),level,origin:'downhill',challenge:false};updateTrackPreviewDetails();syncPreparationPreview();}
function updateDescentHUD(){
  if(mode!=='downhill'||!player?.descent)return;
  const d=player.descent,percent=Math.min(100,d.s/track.finishS*100),complete=player.score>=track.goal;
  $('#downhillTarget').textContent='Meta '+track.goal.toLocaleString('es-CL');$('#downhillTarget').classList.toggle('complete',complete);
  $('#descentCompact').textContent=Math.floor(percent)+'%';$('#descentCompact').classList.toggle('complete',complete);
  $('#descentName').textContent=track.layout.name;$('#descentPercent').textContent=percent.toFixed(1)+'%';$('#descentFill').style.width=percent+'%';
  $('#descentPoints').textContent=`${Math.floor(player.score).toLocaleString('es-CL')} / ${track.goal.toLocaleString('es-CL')} pts`;
  $('#descentPoints').classList.toggle('complete',complete);$('#descentGrade').textContent=`↓ ${Math.round(track.sample(player.pos.x,player.pos.y).grade*100)}%`;
  $('#descentRemaining').textContent=Math.max(0,Math.ceil(track.finishS-d.s))+' m a meta';
  $('#descentHint').textContent=d.motion==='falling'?'¡Fuera de la carretera! R / Recuperar · cuesta 1 vida':complete?'Objetivo cumplido. Llega a la meta para ganar.':'Suma puntos avanzando en drift antes de llegar al 100%.';
}
function finishDownhill(){
  const won=player.score>=track.goal;player.descent.s=track.finishS;state=won?'downhillWon':'downhillFailed';
  if(won){const best=downhillBest(track.routeLevel);if(player.score>best.score)try{localStorage.setItem('downhill:v2:'+track.routeLevel,JSON.stringify({score:Math.floor(player.score),time:raceTime}));}catch{}}
  updateDescentHUD();showOverlay({title:won?'¡Cerro conquistado!':'Llegaste, pero faltaron puntos',msg:`${track.layout.name} · Sprint completado: <b>100%</b><br>Puntaje: <b>${Math.floor(player.score).toLocaleString('es-CL')} / ${track.goal.toLocaleString('es-CL')}</b> pts · Tiempo: <b>${formatTime(raceTime)}</b>${won?'':'<br>Vuelve a intentarlo: enlaza los derrapes antes de la meta.'}`});
}
$('#btnRecover').addEventListener('click',loseLifeAndRespawn);

// Soporte de arranque vía hash (? o #t=TRK.XXXX)
(function tryLoadFromHash(){
  const h = location.hash || location.search || '';
  const m = h.match(/[?#&]t=([A-Za-z0-9\-\._]+)/);
  if(!m) return;
  const code = /^TRK2?\./.test(m[1]) ? m[1] : ('TRK.'+m[1]);
  const tr = decodeTrack(code);
  if(!tr) return;
  mode='race';updateTrackIdUI(tr);showCustomTrackPreview(tr,'import');
})();



import('./view3d.js?v=0.9.0').then(({DriftView3D})=>{
  sceneView=new DriftView3D($('#scene3d'),{quality:renderPrefs.quality,onFailure:fail3D,onVehicleFailure:()=>toast('No se pudo cargar un modelo de auto. Recarga para volver a intentarlo.')});
  if(sceneView.software)toast('3D compatible activo · Calidad ligera');
}).catch(fail3D);
import('./menu-preview.js?v=0.9.0').then(module=>{MenuPreviewClass=module.MenuPreview3D;}).catch(error=>{console.warn('Preview unavailable',error);previewFailed=true;});
