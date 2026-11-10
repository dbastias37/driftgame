/* Presentation and navigation. Never advances or rewrites driving physics. */
const PREF_KEY='drift:preferences:v3';
let savedPrefs={};try{savedPrefs=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{}
const renderPrefs={
  view:'3d',
  camera:Object.hasOwn(DriftOptions.cameras,savedPrefs.camera)?savedPrefs.camera:'chase',
  ...DriftOptions.conditions(savedPrefs),retro:DriftOptions.retro(savedPrefs.retro||DriftOptions.presets.psx),rivals:Math.round(clamp(Number(savedPrefs.rivals)||0,0,3)),collisions:savedPrefs.collisions===true,
  impulse:savedPrefs.impulse==='off'?'off':'on',
  speedLines:['car','center','off'].includes(savedPrefs.speedLines)?savedPrefs.speedLines:'car',
  speedLinesIntensity:Number.isFinite(savedPrefs.speedLinesIntensity)?Math.max(0,Math.min(3,savedPrefs.speedLinesIntensity)):1.5,
  vehicleVibration:Number.isFinite(savedPrefs.vehicleVibration)?clamp(savedPrefs.vehicleVibration,0,2):.65,
  cameraVibration:Number.isFinite(savedPrefs.cameraVibration)?clamp(savedPrefs.cameraVibration,0,2):.35,
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
$('#btnDemoPause').addEventListener('click',()=>{attractDemo.paused=!attractDemo.paused;$('#btnDemoPause').textContent=attractDemo.paused?'▶ EXHIBICIÓN':'Ⅱ EXHIBICIÓN';});
const CAMERA_NAMES=DriftOptions.cameras;
$('#cameraSetting').innerHTML=Object.entries(CAMERA_NAMES).map(([key,name])=>`<option value="${key}">${name}</option>`).join('');
const oldCarOrder=['blue','red','yellow','gray','yugo','fujiwara'];
const savedSkin=savedPrefs.carSkin||oldCarOrder[savedPrefs.car];
const savedIndex=CAR_DATA.findIndex(c=>c.sprite===(savedSkin==='red'?'gray':savedSkin));
if(savedIndex>=0){carIdx=savedIndex;chosen=CAR_DATA[carIdx];}
if(savedPrefs.tx==='manual')document.querySelector('input[name="tx"][value="manual"]').checked=true;
function saveRenderPrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({...renderPrefs,car:carIdx,carSkin:chosen.sprite,tx:selectedTx()}));}catch{}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function syncRenderUI(){
  syncOptionsUI();
  $('#btnCamera').disabled=renderPrefs.view!=='3d';
  $('#viewBadge').textContent='3D / '+CAMERA_NAMES[renderPrefs.camera].toUpperCase();
  $('#speedLinesIntensity').value=Math.round(renderPrefs.speedLinesIntensity*100);$('#speedLinesIntensityLabel').textContent=Math.round(renderPrefs.speedLinesIntensity*100)+'%';
  for(const key of ['vehicleVibration','cameraVibration']){$('#'+key).value=Math.round(renderPrefs[key]*100);$('#'+key+'Label').textContent=Math.round(renderPrefs[key]*100)+'%';}
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
function setRenderView(){renderPrefs.view='3d';syncRenderUI();saveRenderPrefs();}
function cycleCamera(){if(renderPrefs.view!=='3d')return;const names=Object.keys(CAMERA_NAMES);renderPrefs.camera=names[(names.indexOf(renderPrefs.camera)+1)%names.length];sceneView?.resetCamera();syncRenderUI();saveRenderPrefs();toast('Cámara '+CAMERA_NAMES[renderPrefs.camera]);}
function fail3D(error){
  if(sceneFailed)return;sceneFailed=true;console.warn('3D unavailable',error);
  if(state==='running'||state==='countdown')setPaused(true);
  sceneView?.dispose();sceneView=null;$('#scene3d').style.visibility='hidden';$('#rendererError').classList.remove('hidden');$('#btnRetryRenderer').focus();
}
$('#btnRetryRenderer').addEventListener('click',()=>location.reload());
function openSettings(){
  if(state==='running'||state==='countdown')setPaused(true);
  settingsReturn=state==='paused'?'pauseMenu':'mainMenu';
  $('#'+settingsReturn).classList.add('hidden');$('#settingsMenu').classList.remove('hidden');syncRenderUI();$('[data-settings-tab="drive"]').focus();
}
function closeSettings(){$('#settingsMenu').classList.add('hidden');$('#'+settingsReturn).classList.remove('hidden');$('#'+(settingsReturn==='pauseMenu'?'btnResume':'btnSettings')).focus();}
function toggleHelp(force){
  const show=force===undefined?!$('#help').classList.contains('show'):force;
  if(show){helpPaused=['running','countdown'].includes(state);if(helpPaused)setPaused(true);$('#help').classList.remove('hidden');$('#help').classList.add('show');$('#btnHelpClose').focus();}
  else{$('#help').classList.remove('show');if(helpPaused&&state==='paused')setPaused(false);helpPaused=false;}
}
const instrumentCluster=new DriftInstruments.Cluster($('#instrumentCanvas'));
document.fonts?.ready.then(()=>{instrumentCluster.face=null;});
function setDriveReadout(id,value){const node=$('#'+id),text=String(value);if(node.textContent!==text)node.textContent=text;}
function updateDriveHUD(dt=1/60){
  if(!player)return;if(mode==='downhill')updateDescentHUD();const t=instrumentCluster.draw(player,dt);
  setDriveReadout('driveSpeed',String(Math.round(t.speed)).padStart(3,'0'));setDriveReadout('driveGear',(player.vel.x*Math.cos(player.angle)+player.vel.y*Math.sin(player.angle)<-.15)?'R':player.gear);
  setDriveReadout('driveRpm',Math.round(t.rpm/10)*10);setDriveReadout('driveTx',player.auto?'AUTO':'MANUAL');
  $('#driveHud').classList.toggle('redline',t.rpm>t.redline*.94);
}
function drawTrackThumbnails(root){
  root.querySelectorAll('.track-thumb').forEach(canvas=>{
    const t=canvas.dataset.downhill?DriftDownhill.layout(Number(canvas.dataset.downhill)):presetTrack(Number(canvas.dataset.track)),g=canvas.getContext('2d');canvas.width=240;canvas.height=120;
    const b=t.bounds,s=Math.min(210/b.w,90/b.h);g.translate(120-(b.minX+b.w/2)*s,60-(b.minY+b.h/2)*s);g.scale(s,s);
    g.lineWidth=5/s;g.strokeStyle=canvas.dataset.downhill||Number(canvas.dataset.track)<=unlockedLevel?'#e8e9e3':'#606b6c';g.lineJoin='round';g.beginPath();t.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));if(!t.open)g.closePath();g.stroke();
    const p=t.point(0);g.fillStyle='#ff7544';g.beginPath();g.arc(p.x,p.y,4/s,0,PI*2);g.fill();
  });
}
function syncOptionsUI(){
  $('#difficultySetting').value=renderPrefs.difficulty;$('#weatherSetting').value=renderPrefs.weather;$('#rivalsSetting').value=renderPrefs.rivals;$('#collisionsSetting').checked=renderPrefs.collisions;$('#collisionsSetting').disabled=!renderPrefs.rivals;
  $('#difficultyHint').textContent=DriftOptions.difficulties[renderPrefs.difficulty].description;
  const r=renderPrefs.retro;$('#retroResolution').value=r.resolution;$('#retroBits').value=r.bits;$('#retroFlat').checked=r.flat;
  for(const [label,key] of [['Jitter','jitter'],['Affine','affine'],['Dither','dither'],['Crt','crt']]){$('#retro'+label).value=Math.round(r[key]*100);$('#retro'+label+'Value').textContent=Math.round(r[key]*100)+'%';}
  $('#retroPreset').value=Object.keys(DriftOptions.presets).find(key=>Object.entries(DriftOptions.presets[key]).every(([k,v])=>r[k]===v))||'custom';
  $('#crtOverlay').style.opacity=r.crt;document.body.classList.toggle('retro-active',r.bits!==24||!!r.resolution);document.body.dataset.colorBits=r.bits;
}
for(const [id,key] of [['difficultySetting','difficulty'],['weatherSetting','weather'],['rivalsSetting','rivals'],['collisionsSetting','collisions']])$('#'+id).addEventListener('change',e=>{renderPrefs[key]=key==='rivals'?Number(e.target.value):key==='collisions'?e.target.checked:e.target.value;syncOptionsUI();saveRenderPrefs();});
function setRetro(values){renderPrefs.retro=DriftOptions.retro(values);syncOptionsUI();saveRenderPrefs();}
$('#retroPreset').addEventListener('change',e=>{if(DriftOptions.presets[e.target.value])setRetro(DriftOptions.presets[e.target.value]);});
for(const [id,key,scale] of [['Resolution','resolution',1],['Bits','bits',1],['Jitter','jitter',100],['Affine','affine',100],['Dither','dither',100],['Crt','crt',100],['Flat','flat',0]])$('#retro'+id).addEventListener(scale===100?'input':'change',e=>setRetro({...renderPrefs.retro,[key]:scale?Number(e.target.value)/scale:e.target.checked}));
document.querySelectorAll('[data-settings-tab]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.settingsTab;document.querySelectorAll('[data-settings-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===button)));document.querySelectorAll('[data-settings-pane]').forEach(pane=>pane.classList.toggle('hidden',pane.dataset.settingsPane!==key));
}));
$('#btnCamera').addEventListener('click',cycleCamera);
$('#btnModeDownhill').addEventListener('click',()=>{mode='downhill';showDownhillMenu();});
$('#btnModeTraining').addEventListener('click',showTrainingMenu);
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
for(const key of ['vehicleVibration','cameraVibration'])$('#'+key).addEventListener('input',e=>{renderPrefs[key]=clamp(Number(e.target.value)/100,0,2);$('#'+key+'Label').textContent=Math.round(renderPrefs[key]*100)+'%';saveRenderPrefs();});
$('#motionSetting').addEventListener('change',e=>{renderPrefs.motion=e.target.value;driftEffect.reset();previewSpinning=e.target.value!=='reduced';saveRenderPrefs();});
// Keep tab navigation inside the active menu; gameplay keys remain unchanged.
addEventListener('keydown',e=>{
  if(state==='menu'&&!mainMenu.classList.contains('hidden')&&['ArrowUp','ArrowDown'].includes(e.key)){
    const items=[...mainMenu.querySelectorAll('.raw-mode-list button')],i=items.indexOf(document.activeElement),next=i<0?(e.key==='ArrowUp'?items.length-1:0):(i+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;
    e.preventDefault();items[next]?.focus();return;
  }
  if(e.key!=='Tab')return;
  const panel=replayUI?.active?$('#replayControls'):$('#help.show')||['rendererError','creditsMenu','settingsMenu','importMenu','titleScreen','onlineMenu','carPanel','circuitMenu','challengeMenu','startPanel','pauseMenu','overlay','mainMenu'].map(id=>$('#'+id)).find(el=>!el.classList.contains('hidden'));
  if(!panel)return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),input,textarea,select,summary')].filter(el=>el.getClientRects().length);
  const first=focusables[0],last=focusables.at(-1);if(!first)return;
  if(e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===first)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(!panel.contains(document.activeElement)||document.activeElement===last)){e.preventDefault();first.focus();}
});
syncRenderUI();
requestAnimationFrame(loop);
let MenuPreviewClass=null,menuPreview=null,previewSelection=null,previewSpinning=renderPrefs.motion!=='reduced',previewFailed=false,previewLastFrame=0;
function showTrainingMenu(){mode='training';showCustomTrackPreview(DriftTraining.create(Track),'training');}
function showCircuitMenu(){
  if(mode==='training'){showTrainingMenu();return;}
  if(mode==='downhill'){showDownhillMenu();return;}
  hidePanels();garageOrigin='circuits';$('#circuitMenu').classList.remove('hidden');$('#circuitList').classList.remove('hidden');
  $('#circuitTitle').textContent=mode==='tt'?'Contrarreloj · Elige circuito':'Carrera · Elige circuito';
  $('#btnCircuitBack').textContent='← Menú principal';
  const root=$('#circuitList');root.innerHTML=Array.from({length:DriftTouring.count},(_,i)=>{const c=DriftTouring.info(i+1);return `<div class="challenge-item touring-item"><span class="circuit-num">2.0</span><canvas class="track-thumb" data-touring-map="${i+1}" aria-label="${c.name}"></canvas><div><b>${c.name}</b><small>${(c.length/1000).toFixed(1)} km · ${{alpine:"sierra",coast:"costa",forest:"bosque",lake:"embalse",highland:"cumbre"}[c.biome]}</small></div><button data-touring="${i+1}" aria-label="Ver circuito 2.0 ${c.name}">${c.name}</button></div>`;}).join('')+Array.from({length:CircuitLayouts.count},(_,i)=>{
    const c=CircuitLayouts.info(i+1);
    return `<div class="challenge-item"><span class="circuit-num">${String(i+1).padStart(2,'0')}</span><canvas class="track-thumb" data-track="${i+1}" aria-label="${c.name}"></canvas><button data-circuit="${i+1}" aria-label="Ver circuito ${i+1}: ${c.name}">${c.name}</button></div>`;
  }).join('');
  drawTrackThumbnails(root);root.querySelectorAll('[data-circuit]').forEach(btn=>btn.addEventListener('click',()=>previewCircuit(Number(btn.dataset.circuit),false)));
  root.querySelectorAll('[data-touring]').forEach(btn=>btn.addEventListener('click',()=>previewTouring(Number(btn.dataset.touring))));
  root.querySelectorAll('[data-touring-map]').forEach(canvas=>{const t=DriftTouring.createTrack(Track,Number(canvas.dataset.touringMap)),ctx=canvas.getContext('2d'),b=t.bounds;canvas.width=128;canvas.height=108;const scale=Math.min(112/b.w,92/b.h);ctx.strokeStyle='#ffb16c';ctx.lineWidth=2;ctx.beginPath();t.points.forEach((p,i)=>{const x=64+(p.x-b.minX-b.w/2)*scale,y=54+(p.y-b.minY-b.h/2)*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();});
  if(preparedTrack?.elevated)previewTouring(preparedTrack.touringId,preparedTrack.raceLaps);else previewCircuit(preparedTrack?.layout?.level||1,false);
}
function previewTouring(n,laps=4){
  const circuit=DriftTouring.createTrack(Track,n);circuit.raceLaps=laps===5?5:4;previewSelection={track:circuit,level:0,origin:'circuits',challenge:false};updateTrackPreviewDetails();syncPreparationPreview();
}
safeAddListener('touringLaps','change',()=>{if(previewSelection?.track.elevated){previewSelection.track.raceLaps=Number($('#touringLaps').value)===5?5:4;updateTrackPreviewDetails();}});
function previewCircuit(n,challenge=false){
  const circuit=presetTrack(n);previewSelection={track:circuit,level:n,origin:challenge?'challenge':'circuits',challenge};
  updateTrackPreviewDetails();syncPreparationPreview();
}
function showCustomTrackPreview(track,origin='import'){
  hidePanels();garageOrigin=origin;previewSelection={track,level:0,origin,challenge:false};
  $('#circuitMenu').classList.remove('hidden');$('#circuitList').classList.add('hidden');
  $('#circuitTitle').textContent=origin==='training'?'Entrenamiento · Mercado Ocho':origin==='board'?'Tu circuito · Vista previa':'Circuito importado · Vista previa';
  $('#btnCircuitBack').textContent=origin==='training'?'← Menú principal':origin==='board'?'← Volver al dibujo':'← Importar otro circuito';
  updateTrackPreviewDetails();syncPreparationPreview();
}
function updateTrackPreviewDetails(){
  if(!previewSelection)return;
  const {track:t,level,challenge}=previewSelection,prefix=challenge?'challenge':'circuit';
  DriftTrackProps.prepare(t,{enabled:mode!=='online'});
  const length=t.layout?.length||t.points.reduce((s,p,i)=>{const q=t.points[(i+1)%t.points.length];return s+Math.hypot(p.x-q.x,p.y-q.y);},0);
  $('#'+prefix+'PreviewName').textContent=t.layout?.name||'Circuito personalizado';
  $('#'+prefix+'PreviewDetails').textContent=`${(length/1000).toFixed(2)} km · ${Math.round(t.roadHalf*2)} m de ancho${t.layout?' · '+t.layout.stage:''}`;
  const locked=challenge&&level>unlockedLevel,button=$(challenge?'#btnChallengeContinue':'#btnCircuitContinue');
  button.disabled=locked;button.textContent=locked?'SUPERA EL DESAFÍO ANTERIOR':'ELEGIR AUTO ↗';
  $('#circuitPreviewGoal').textContent=t.downhill?`Objetivo: ${t.goal.toLocaleString('es-CL')} pts antes del 100% · 3 vidas · Mejor: ${downhillBest(t.routeLevel).score.toLocaleString('es-CL')} pts`:'';
  $('#touringLapControl').classList.toggle('hidden',!t.elevated||mode==='tt');
  if(t.elevated){$('#touringLaps').value=String(t.raceLaps);$('#touringRaceDistance').textContent=(length*t.raceLaps/1000).toFixed(1)+' km de carrera';$('#circuitPreviewDetails').textContent=`${(length/1000).toFixed(2)} km · ${Math.round(t.roadHalf*2)} m de ancho · Desnivel ${Math.round(t.maxHeight-t.minHeight)} m`;$('#circuitPreviewGoal').textContent=t.layout.description;}
  if(t.training){$('#circuitPreviewDetails').textContent='Estacionamiento abierto · Recorrido en ocho · Zona libre';$('#circuitPreviewGoal').textContent='Derrapa para sumar. Evita conos y pilas: −100 por obstáculo. Sin límite de tiempo ni vidas.';}
  if(!t.training&&t.trackProps?.props.length)$('#circuitPreviewGoal').textContent+=($('#circuitPreviewGoal').textContent?' · ':'')+'Pilas de neumáticos en curvas: −100 por pila';
  if(t.downhill)$('#circuitPreviewDetails').textContent=`${(t.finishS/1000).toFixed(2)} km · ↓ ${Math.round(t.drop)} m · Pendiente ${Math.round(t.drop/t.length*100)}% media`;
  if(challenge){$('#challengePreviewMissions').innerHTML=campaignMissionHTML(level);}
  if(challenge)$('#challengePreviewGoal').textContent=`Una vuelta · ${DriftCareer.load().missions[level].filter(Boolean).length}/3 objetivos · Se conservan entre intentos${locked?' · Completa la etapa anterior para desbloquear':''}`;
  document.querySelectorAll('[data-circuit],.btnPickChallenge,[data-downhill-pick],[data-touring]').forEach(b=>{
    const selected=t.elevated?Number(b.dataset.touring)===t.touringId:!b.dataset.touring&&Number(b.dataset.circuit||b.dataset.lvl||b.dataset.downhillPick)===level;
    b.setAttribute('aria-pressed',String(selected));b.closest?.('.challenge-item')?.classList.toggle('selected',selected);
  });
}
function confirmTrackPreview(){
  if(!previewSelection)return;
  const {track:selected,level,origin,challenge}=previewSelection;
  if(challenge&&level>unlockedLevel)return;
  if(selected.training)mode='training';else if(selected.downhill)mode='downhill';
  garageOrigin=origin;preparedTrack=selected;pendingTrackFactory=()=>selected;
  if(challenge){mode='challenge';activeChallengeLevel=level;activeChallengeGoal=challengeRequiredPoints(level);challengeCompletedThisRun=false;$('#challengeGoal').textContent=activeChallengeGoal.toLocaleString('es-CL');$('#challengeLevel').textContent=level;}
  openCarPanel();
}
function returnToTrackPreview(){
  if(mode==='online'&&online?.inRoom){online.showLobby();return;}
  if(!preparedTrack){showTrackSelection();return;}
  if(preparedTrack.training){showTrainingMenu();return;}
  if(preparedTrack.elevated){showCircuitMenu();return;}
  if(preparedTrack.downhill){mode='downhill';showDownhillMenu(preparedTrack.routeLevel);return;}
  if(!preparedTrack.layout?.level){showCustomTrackPreview(preparedTrack,garageOrigin==='board'?'board':'import');return;}
  const n=preparedTrack.layout.level;showTrackSelection();previewCircuit(n,mode==='challenge');
}
function syncPreparationPreview(){
  const settings=!$('#settingsMenu').classList.contains('hidden'),garage=!$('#carPanel').classList.contains('hidden'),challenge=!$('#challengeMenu').classList.contains('hidden'),circuit=!$('#circuitMenu').classList.contains('hidden');
  if(!settings&&!garage&&!challenge&&!circuit)return null;
  const stage=$('#'+(settings?'settingsStage':garage?'garageStage':challenge?'challengeStage':'circuitStage')),canvas=$('#carPreview');
  if(canvas.parentElement!==stage)stage.appendChild(canvas);
  document.querySelectorAll('[data-preview-spin]').forEach(b=>b.textContent=previewSpinning?'Ⅱ Pausar giro':'▶ Activar giro');
  return {kind:settings?'settings':garage?'garage':'track',track:settings?attractTrack:garage?preparedTrack:previewSelection?.track,stage};
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
    if(time-previewLastFrame<1/(menuPreview.software?18:60))return true;
    const elapsed=previewLastFrame?Math.min(.1,time-previewLastFrame):dt;previewLastFrame=time;
    menuPreview.renderPreview({...preview,skin:chosen.sprite,dt:elapsed,spinning:previewSpinning,timeOfDay:renderPrefs.timeOfDay,cosmetics:garageCosmetics,retro:renderPrefs.retro,weather:renderPrefs.weather,player:demoFrame.player,time:demoFrame.time,camera:renderPrefs.camera,vibration:{vehicle:renderPrefs.vehicleVibration,camera:renderPrefs.cameraVibration},motion:renderPrefs.motion,speedLines:{mode:renderPrefs.speedLines,intensity:renderPrefs.speedLinesIntensity,amount:Math.max(0,(demoFrame.player.worldSpeed()*3.6-22)/100),time:demoFrame.time}});
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
const previewPointers=new Map();
$('#carPreview').addEventListener('contextmenu',e=>e.preventDefault());
$('#carPreview').addEventListener('pointerdown',e=>{previewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);});
$('#carPreview').addEventListener('pointermove',e=>{
  const old=previewPointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;
  if(previewPointers.size===2){const other=[...previewPointers].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(after>5)menuPreview?.zoomPreviewBy(before/after);menuPreview?.panBy(dx*.5,dy*.5);}
  else if(menuPreview?.previewMode==='garage')menuPreview.rotateBy(dx*.008);
  else if(e.shiftKey||e.buttons===2)menuPreview?.orbitBy(dx*.006,-dy*.006);
  else menuPreview?.panBy(dx,dy);
  previewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});previewSpinning=false;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#carPreview').addEventListener(event,e=>previewPointers.delete(e.pointerId));
$('#carPreview').addEventListener('wheel',e=>{e.preventDefault();if(menuPreview?.previewMode==='settings')menuPreview.zoomBy(Math.exp(e.deltaY*.001));else menuPreview?.zoomPreviewBy(Math.exp(e.deltaY*.001));previewSpinning=false;},{passive:false});
$('#carPreview').addEventListener('keydown',e=>{const arrows={ArrowLeft:[-30,0],ArrowRight:[30,0],ArrowUp:[0,-30],ArrowDown:[0,30]};if(arrows[e.key]){e.preventDefault();if(e.shiftKey||menuPreview?.previewMode==='garage')menuPreview?.rotateBy(arrows[e.key][0]*.006);else menuPreview?.panBy(...arrows[e.key]);}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')menuPreview?.resetPreview();else menuPreview?.zoomPreviewBy(e.key==='-'?1.15:.87);}else return;previewSpinning=false;});
document.querySelectorAll('[data-preview-reset]').forEach(b=>b.addEventListener('click',()=>{menuPreview?.resetPreview();previewSpinning=false;}));

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
  $('#descentHint').textContent=d.motion==='falling'?'¡Fuera de la carretera! R / Recuperar · cuesta 1 vida':complete?'Objetivo cumplido. Llega a la meta para ganar.':'Suma puntos derrapando antes de llegar al 100%.';
}
function finishDownhill(){
  const won=player.score>=track.goal;player.descent.s=track.finishS;state=won?'downhillWon':'downhillFailed';
  if(won){const best=downhillBest(track.routeLevel);if(player.score>best.score)try{localStorage.setItem('downhill:v2:'+track.routeLevel,JSON.stringify({score:Math.floor(player.score),time:raceTime}));}catch{}}
  updateDescentHUD();showOverlay({title:won?'¡Cerro conquistado!':'Llegaste, pero faltaron puntos',msg:`${track.layout.name} · Descenso completado: <b>100%</b><br>Puntaje: <b>${Math.floor(player.score).toLocaleString('es-CL')} / ${track.goal.toLocaleString('es-CL')}</b> pts · Tiempo: <b>${formatTime(raceTime)}</b>${won?careerReward(true):'<br>Vuelve a intentarlo: enlaza los derrapes antes de la meta.'}`});
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



import('./view3d.js?v=1.0.0-prealpha.16').then(async({DriftView3D})=>{
  await document.fonts?.load('32px DriftDisplay');
  sceneView=new DriftView3D($('#scene3d'),{quality:renderPrefs.quality,onFailure:fail3D,onVehicleFailure:()=>toast('No se pudo cargar un modelo de auto. Recarga para volver a intentarlo.')});
  if(sceneView.software)toast('3D compatible activo · Calidad ligera');
}).catch(fail3D);
import('./menu-preview.js?v=1.0.0-prealpha.16').then(async module=>{await document.fonts?.load('32px DriftDisplay');MenuPreviewClass=module.MenuPreview3D;}).catch(error=>{console.warn('Preview unavailable',error);previewFailed=true;});
