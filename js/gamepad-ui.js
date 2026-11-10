/* Shared input polling and a non-driving diagnostic page. */
let padUIStamp=0,padUISignature='',padDeviceSignature='',padButtonNodes=[],padAxisNodes=[],padMappingNodes=[];
const padActionNames={accel:'Acelerar',brake:'Frenar',reverse:'Freno / marcha atrás',handbrake:'Drift',camera:'Cámara',recover:'Reaparecer',pause:'Pausa',up:'Subir marcha',down:'Bajar marcha',confirm:'Confirmar menú',cancel:'Volver en menú'};
function padSettingsVisible(){return !$('#settingsMenu').classList.contains('hidden')&&!$('[data-settings-pane="gamepad"]').classList.contains('hidden');}
function syncPadProfile(){const p=gamepad.profile;$('#padEnabled').checked=p.enabled;$('#padAxis').value=p.axis;$('#padInvert').checked=p.invert;$('#padDeadzone').value=Math.round(p.deadzone*100);$('#padSensitivity').value=Math.round(p.sensitivity*100);$('#padDeadzoneValue').textContent=Math.round(p.deadzone*100)+'%';$('#padSensitivityValue').textContent=p.sensitivity.toFixed(2)+'×';for(const {key,select} of padMappingNodes)select.value=p.bind[key];}
function buildPadDiagnostics(){
  const p=gamepad.pad,axes=p?.axes.length||0,buttons=p?.buttons.length||0;padButtonNodes=[];padAxisNodes=[];padMappingNodes=[];$('#padButtons').replaceChildren();$('#padAxes').replaceChildren();$('#padBindings').replaceChildren();$('#padAxis').replaceChildren();
  for(let i=0;i<Math.min(32,axes);i++){const option=document.createElement('option');option.value=i;option.textContent='Eje '+i;$('#padAxis').append(option);const row=document.createElement('div');row.className='pad-axis-row';const label=document.createElement('span');label.textContent='E'+i;const track=document.createElement('div');track.className='pad-axis-track';const dot=document.createElement('i');track.append(dot);const value=document.createElement('output');row.append(label,track,value);$('#padAxes').append(row);padAxisNodes.push({dot,value});}
  for(let i=0;i<Math.min(64,buttons);i++){const el=document.createElement('span');el.className='pad-button';el.textContent='B'+i;el.setAttribute('aria-label','Botón '+i);$('#padButtons').append(el);padButtonNodes.push(el);}
  for(const [key,name] of Object.entries(padActionNames)){const label=document.createElement('label');label.className='setting';label.append(document.createTextNode(name));const select=document.createElement('select');select.setAttribute('aria-label','Asignar '+name.toLowerCase());const add=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)};add('none','Sin asignar');for(let i=0;i<Math.min(64,buttons);i++)add('b'+i,'Botón '+i);for(let i=0;i<Math.min(32,axes);i++)for(const [suffix,title] of [['+','positivo'],['-','negativo'],['>','gatillo −1 a +1'],['<','gatillo +1 a −1']])add('a'+i+suffix,'Eje '+i+' · '+title);select.addEventListener('change',()=>{gamepad.configure({bind:{[key]:select.value}});$('#padMessage').textContent='Asignación guardada. Suelta los controles para activarla.';});label.append(select);$('#padBindings').append(label);padMappingNodes.push({key,select});}
  syncPadProfile();
}
function updatePadDiagnostics(now){
  if(!padSettingsVisible()||now-padUIStamp<.05)return;padUIStamp=now;const pad=gamepad.pad,signature=pad?[pad.id,pad.index,pad.axes.length,pad.buttons.length].join('|'):'none';
  const deviceSignature=gamepad.devices.map(p=>p.index+':'+p.id).join('|');if(deviceSignature!==padDeviceSignature){padDeviceSignature=deviceSignature;$('#padDevice').replaceChildren();for(const p of gamepad.devices){const o=document.createElement('option');o.value=p.index;o.textContent=p.id;$('#padDevice').append(o);}$('#padDevice').value=gamepad.index??'';}
  if(signature!==padUISignature){padUISignature=signature;buildPadDiagnostics();}
  $('#padStatus').textContent=gamepad.error||(!navigator.getGamepads?'Gamepad API no disponible en este navegador.':pad?(pad.mapping==='standard'?'Mando conectado · distribución estándar':'Mando conectado · ajusta las asignaciones si es necesario'):'Sin mando detectado. Conecta el USB y pulsa un botón.');
  $('#padName').textContent=pad?.id||'PS4 / USB genérico';$('#padCalibration').classList.toggle('hidden',!pad);$('#padDevice').disabled=!pad;
  if(!pad)return;padButtonNodes.forEach((el,i)=>{const value=pad.buttons[i]?.value||0;el.classList.toggle('pressed',value>.1);el.style.setProperty('--press',value);el.setAttribute('aria-label','Botón '+i+': '+Math.round(value*100)+'%');});padAxisNodes.forEach(({dot,value},i)=>{const n=pad.axes[i]||0;dot.style.left=(n+1)*50+'%';value.textContent=n.toFixed(2);});
  $('#padOutput').textContent='DIRECCIÓN '+Math.round(gamepad.state.steerAxis*100)+'% · GAS '+Math.round(gamepad.state.accel*100)+'% · FRENO '+Math.round(gamepad.state.brake*100)+'%';
}
$('#padDevice').addEventListener('change',e=>{gamepad.select(e.target.value);padUISignature='';});
for(const [id,key] of [['padEnabled','enabled'],['padInvert','invert']])$('#'+id).addEventListener('change',e=>{gamepad.configure({[key]:e.target.checked});syncPadProfile();});
for(const [id,key] of [['padDeadzone','deadzone'],['padSensitivity','sensitivity']])$('#'+id).addEventListener('input',e=>{gamepad.configure({[key]:Number(e.target.value)/100});syncPadProfile();});
$('#padAxis').addEventListener('change',e=>{gamepad.configure({axis:Number(e.target.value),center:0});syncPadProfile();});
$('#padCenter').addEventListener('click',()=>{$('#padMessage').textContent=gamepad.center()?'Centro guardado. Mueve el stick para comprobarlo.':'Suelta el stick de dirección y vuelve a centrar.';});
$('#padReset').addEventListener('click',()=>{gamepad.reset();syncPadProfile();$('#padMessage').textContent='Distribución estándar restaurada.';});
function gamepadMenu(edges){
  if(globalThis.DriftMenuUX){DriftMenuUX.gamepad(edges);return;}
  const panel=['rendererError','help.show','creditsMenu','settingsMenu','importMenu','titleScreen','onlineMenu','carPanel','circuitMenu','challengeMenu','startPanel','pauseMenu','overlay','mainMenu'].map(id=>$('#'+id)).find(el=>el&&!el.classList.contains('hidden'));if(!panel)return;
  const items=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),summary')].filter(el=>el.getClientRects().length),focused=document.activeElement;
  if((edges.navLeft||edges.navRight)&&focused?.tagName==='SELECT'){focused.selectedIndex=Math.max(0,Math.min(focused.options.length-1,focused.selectedIndex+(edges.navRight?1:-1)));focused.dispatchEvent(new Event('change',{bubbles:true}));return;}
  if(edges.navUp||edges.navDown||edges.navLeft||edges.navRight){const d=edges.navUp||edges.navLeft?-1:1,i=items.indexOf(focused);items[(i<0?0:(i+d+items.length)%items.length)]?.focus();}
  if(edges.confirm){if(items.includes(focused)&&['BUTTON','SUMMARY'].includes(focused.tagName))focused.click();else items[0]?.focus();}
  if(edges.cancel){if(!$('#settingsMenu').classList.contains('hidden'))closeSettings();else if(state==='paused')setPaused(false);else if(!$('#carPanel').classList.contains('hidden'))$('#btnCarBack').click();else if(!$('#circuitMenu').classList.contains('hidden'))$('#btnCircuitBack').click();else if(state==='menu')showMainMenu();}
}
function pollController(now){
  gamepad.poll({menu:!['running','countdown'].includes(state),now,active:!document.hidden&&(typeof document.hasFocus!=='function'||document.hasFocus())});updatePadDiagnostics(now);
  if(gamepad.disconnected&&['running','countdown'].includes(state)){setPaused(true);toast('Mando desconectado · carrera en pausa');}
  if(globalThis.DriftMenuUX?.busy||padSettingsVisible()&&$('#padTestMode').checked)return;const e=gamepad.edges;if(!Object.values(e).some(Boolean))return;
  if(['running','countdown'].includes(state)){if(e.pause){if(globalThis.DriftMenuUX)$('#btnPause').click();else setPaused(true);return;}if(e.camera)cycleCamera();if(state==='running'){if(e.recover){if(mode==='online')online?.recover();else loseLifeAndRespawn();}if(player&&!player.auto){if(e.up)shiftManual(1);if(e.down)shiftManual(-1);}}}
  else{if(e.pause&&state==='paused'&&$('#settingsMenu').classList.contains('hidden')){if(globalThis.DriftMenuUX)$('#btnResume').click();else setPaused(false);}else gamepadMenu(e);}
}
