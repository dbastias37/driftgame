/* Presentation and navigation. Never advances or rewrites driving physics. */
const PREF_KEY='drift:preferences:v3';
let savedPrefs={};try{savedPrefs=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{}
const renderPrefs={
  view:['2d','3d'].includes(savedPrefs.view)?savedPrefs.view:'3d',
  camera:['chase','aerial','hood'].includes(savedPrefs.camera)?savedPrefs.camera:'chase',
  quality:['auto','high','low'].includes(savedPrefs.quality)?savedPrefs.quality:'auto',
  touch:['auto','on','off'].includes(savedPrefs.touch)?savedPrefs.touch:'auto',
  motion:['full','reduced'].includes(savedPrefs.motion)?savedPrefs.motion:(matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full')
};
let sceneView=null,sceneFailed=false,toastTimer=0,settingsReturn='mainMenu',helpPaused=false;
touchEnabled=renderPrefs.touch==='on'||(renderPrefs.touch==='auto'&&isTouchDevice);
const attractTrack=presetTrack(1),attractCar=new Car(attractTrack);
const CAMERA_NAMES={chase:'Seguimiento',aerial:'Aérea',hood:'Capó'};
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
  $('#touchSetting').value=renderPrefs.touch;$('#cameraSetting').value=renderPrefs.camera;$('#qualitySetting').value=renderPrefs.quality;$('#motionSetting').value=renderPrefs.motion;
}
function setRenderView(next){
  if(next==='3d'&&sceneFailed){toast('3D no disponible en este navegador. Puedes seguir jugando en 2D.');return;}
  renderPrefs.view=next;sceneView?.resetCamera();syncRenderUI();saveRenderPrefs();
  if(document.body.classList.contains('in-game'))toast(next==='3d'?'Vista 3D · C cambia la cámara':'Vista 2D clásica · V vuelve a 3D');
}
function cycleCamera(){if(renderPrefs.view!=='3d')return;const names=['chase','aerial','hood'];renderPrefs.camera=names[(names.indexOf(renderPrefs.camera)+1)%names.length];sceneView?.resetCamera();syncRenderUI();saveRenderPrefs();toast('Cámara '+CAMERA_NAMES[renderPrefs.camera]);}
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
  if(!player)return;const speed=player.worldSpeed()*3.6;
  $('#driveSpeed').textContent=String(Math.round(speed)).padStart(3,'0');$('#driveGear').textContent=player.gear;
  $('#driveTx').textContent=player.auto?'AUTO':'MANUAL';
  $('#revFill').style.width=Math.min(100,speed/(player.gearMax[player.gear-1]||198)*100)+'%';
  $('#driveHud').classList.toggle('redline',player.redBlink);
}
function drawTrackThumbnails(root){
  root.querySelectorAll('.track-thumb').forEach(canvas=>{
    const t=presetTrack(Number(canvas.dataset.track)),g=canvas.getContext('2d');canvas.width=240;canvas.height=120;
    const b=t.bounds,s=Math.min(210/b.w,90/b.h);g.translate(120-(b.minX+b.w/2)*s,60-(b.minY+b.h/2)*s);g.scale(s,s);
    g.lineWidth=5/s;g.strokeStyle=Number(canvas.dataset.track)<=unlockedLevel?'#e8e9e3':'#606b6c';g.lineJoin='round';g.beginPath();t.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.stroke();
    const p=t.point(0);g.fillStyle='#ff7544';g.beginPath();g.arc(p.x,p.y,4/s,0,PI*2);g.fill();
  });
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setRenderView(b.dataset.view)));
$('#btnView').addEventListener('click',()=>setRenderView(renderPrefs.view==='3d'?'2d':'3d'));
$('#btnCamera').addEventListener('click',cycleCamera);
$('#btnQuickRace').addEventListener('click',()=>{hidePanels();garageOrigin='main';mode='race';pendingTrackFactory=()=>presetTrack(1);openCarPanel();});
$('#btnSettings').addEventListener('click',openSettings);$('#btnPauseSettings').addEventListener('click',openSettings);$('#btnSettingsBack').addEventListener('click',closeSettings);
$('#btnMenuHelp').addEventListener('click',()=>toggleHelp());$('#btnHelpClose').addEventListener('click',()=>toggleHelp(false));
$('#btnImport').addEventListener('click',()=>{hidePanels();$('#importMessage').textContent='';$('#importMenu').classList.remove('hidden');$('#importCode').focus();});
$('#btnImportBack').addEventListener('click',showMainMenu);$('#btnOvMenu').addEventListener('click',showMainMenu);
$('#btnNextChallenge').addEventListener('click',()=>{
  if(state!=='challengeWon'||activeChallengeLevel>=CHALLENGE_COUNT)return;
  activeChallengeLevel++;activeChallengeGoal=challengeRequiredPoints(activeChallengeLevel);
  $('#challengeGoal').textContent=activeChallengeGoal.toLocaleString('es-CL');$('#challengeLevel').textContent=activeChallengeLevel;
  startWithTrack(presetTrack(activeChallengeLevel),'challenge');
});
$('#touchSetting').addEventListener('change',e=>{renderPrefs.touch=e.target.value;touchEnabled=renderPrefs.touch==='on'||(renderPrefs.touch==='auto'&&isTouchDevice);clearInputs();syncTouchHUD();saveRenderPrefs();});
$('#cameraSetting').addEventListener('change',e=>{renderPrefs.camera=e.target.value;sceneView?.resetCamera();saveRenderPrefs();syncRenderUI();});
$('#qualitySetting').addEventListener('change',e=>{renderPrefs.quality=e.target.value;sceneView?.setQuality(renderPrefs.quality);saveRenderPrefs();});
$('#motionSetting').addEventListener('change',e=>{renderPrefs.motion=e.target.value;saveRenderPrefs();});
// Keep tab navigation inside the active menu; gameplay keys remain unchanged.
addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const panel=$('#help.show')||['settingsMenu','importMenu','carPanel','circuitMenu','challengeMenu','startPanel','pauseMenu','overlay','mainMenu'].map(id=>$('#'+id)).find(el=>!el.classList.contains('hidden'));
  if(!panel)return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),input,textarea,select,summary')].filter(el=>el.getClientRects().length);
  const first=focusables[0],last=focusables.at(-1);if(!first)return;
  if(e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===first)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===last)){e.preventDefault();first.focus();}
});
syncRenderUI();
requestAnimationFrame(loop);
import('./view3d.js').then(({DriftView3D})=>{
  sceneView=new DriftView3D($('#scene3d'),{quality:renderPrefs.quality,onFailure:fail3D,onVehicleFailure:()=>toast('No se pudo cargar el RX-7. Recarga para volver a intentarlo.')});
  if(sceneView.software)toast('3D compatible activo · Calidad ligera');
}).catch(fail3D);

function showCircuitMenu(){
  hidePanels();garageOrigin='circuits';$('#circuitMenu').classList.remove('hidden');
  $('#circuitTitle').textContent=mode==='tt'?'Contrarreloj · Selecciona circuito':'Carrera · Selecciona circuito';
  const root=$('#circuitList');root.innerHTML=Array.from({length:CircuitLayouts.count},(_,i)=>{
    const c=CircuitLayouts.info(i+1);
    return `<div class="challenge-item"><span class="circuit-num">${String(i+1).padStart(2,'0')}</span><canvas class="track-thumb" data-track="${i+1}" aria-label="Circuito ${i+1}: ${c.name}"></canvas><div><b>${c.name}</b></div><div class="tag">${c.stage} · ${(c.length/1000).toFixed(2)} km</div><button data-circuit="${i+1}">Circuito ${i+1} ↗</button></div>`;
  }).join('');
  drawTrackThumbnails(root);root.querySelectorAll('[data-circuit]').forEach(btn=>btn.addEventListener('click',()=>{const n=Number(btn.dataset.circuit);pendingTrackFactory=()=>presetTrack(n);openCarPanel();}));
}
$('#btnGarageTrack').addEventListener('click',showTrackSelection);
$('#btnCircuitBack').addEventListener('click',showMainMenu);
