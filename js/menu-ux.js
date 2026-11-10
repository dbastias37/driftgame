/* One navigation owner for keyboard, USB controllers and pointer selection. */
globalThis.DriftMenuUX=(()=>{
  const q=s=>document.querySelector(s),visible=el=>!!el?.getClientRects().length&&!el.closest('.hidden'),sound=new DriftMenuFeedback.Sound();
  try{const saved=localStorage.getItem('drift-menu-volume');if(saved!==null&&Number.isFinite(+saved))sound.volume=Math.max(0,Math.min(1,+saved));}catch{}
  const volume=q('#menuVolume'),volumeText=q('#menuVolumeValue');volume.value=Math.round(sound.volume*100);volumeText.textContent=volume.value+'%';
  volume.addEventListener('input',()=>{sound.volume=Number(volume.value)/100;volumeText.textContent=volume.value+'%';try{localStorage.setItem('drift-menu-volume',sound.volume);}catch{}});
  const cover=document.createElement('div');cover.id='screenFade';cover.setAttribute('aria-hidden','true');document.body.append(cover);
  const panels=['rendererError','help','creditsMenu','settingsMenu','importMenu','replayControls','titleScreen','onlineMenu','workshop','carPanel','circuitMenu','challengeMenu','startPanel','pauseMenu','overlay','mainMenu'];
  const activePanel=()=>panels.map(id=>q('#'+id)).find(el=>visible(el)&&(el.id!=='help'||el.classList.contains('show')));
  const items=panel=>[...(panel?.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href]')||[])].filter(visible);
  let busy=false,replay=false,lastMove=0,silentFocus=false;
  const memory=new Map();
  function focus(el){el?.focus({preventScroll:true});el?.scrollIntoView({block:'nearest',inline:'nearest'});}
  function repair(){const panel=activePanel(),list=items(panel);if(!panel)return;if(!list.includes(document.activeElement)){silentFocus=true;focus(list.includes(memory.get(panel))?memory.get(panel):list.find(el=>['btnPlayNow','btnQuickRace','btnResume','btnCircuitContinue','btnChooseStart'].includes(el.id))||list[0]);silentFocus=false;}}
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function transition(action,musicStage=null){if(busy)return;busy=true;globalThis.DriftMusic?.out(musicStage);clearInputs();cover.classList.add('active');try{cover.classList.add('black');await wait(240);action?.();globalThis.DriftMusic?.into(musicStage);await wait(100);repair();cover.classList.remove('black');await wait(260);}finally{cover.classList.remove('black','active');busy=false;clearInputs();gamepad.armed=false;repair();}}
  function musicScene(){if(['running','countdown'].includes(state))return 'race';const id=activePanel()?.id;return id==='carPanel'?'garage':['circuitMenu','challengeMenu','startPanel','onlineMenu'].includes(id)?'selection':['mainMenu','titleScreen'].includes(id)?'menu':null;}
  function routeStage(id){if(['btnPlayNow','btnBackTitle','btnQuit','btnOvMenu','btnBackMain','btnBoardBack','btnCircuitBack','onlineBack'].includes(id))return 'menu';if(['btnCircuitContinue','btnChallengeContinue','onlineGarage'].includes(id))return 'garage';if(['btnChooseStart','btnRestart','onlineStart','onlineRematch','btnNextChallenge'].includes(id))return mode==='online'&&id==='btnChooseStart'?'selection':'race';if(['btnQuickRace','btnModeDownhill','btnModeTraining','btnModeChallenge','btnModeTT','btnModeCreative','btnModeOnline','btnCarBack','btnGarageTrack','btnTrack','btnStart','btnLoadCode'].includes(id))return 'selection';return null;}
  const routes=new Set('btnPlayNow btnBackTitle btnQuickRace btnModeDownhill btnModeTraining btnModeChallenge btnModeTT btnModeCreative btnModeOnline btnBackMain btnBoardBack btnCarBack btnGarageTrack btnCircuitContinue btnChallengeContinue btnCircuitBack btnChooseStart btnQuit btnTrack btnRestart btnResume btnPause btnSettings btnPauseSettings btnSettingsBack btnCredits btnCreditsBack btnImport btnImportBack btnOvMenu btnNextChallenge btnStart btnLoadCode btnWorkshop btnWorkshopBack btnMenuHelp btnHelp btnHelpClose onlineBack onlineStart onlineRematch onlineGarage btnReplayPause btnReplayOnline replayExit'.split(' '));
  function cue(el){return el.dataset.menuSound||(/ChooseStart|Restart|onlineStart|^btnStart$/.test(el.id)?'start':/Back|Quit|OvMenu|HelpClose|replayExit/.test(el.id)?'back':'confirm');}
  document.addEventListener('click',event=>{
    if(replay)return;const el=event.target.closest('button,summary,a[href]');if(!el||el.disabled)return;
    if(busy){event.preventDefault();event.stopImmediatePropagation();return;}
    if(el.closest('#touchHUD')||['btnGas','btnBrake','btnHand','btnGearDown','btnGearUp'].includes(el.id))return;
    sound.play(cue(el));
    if(routes.has(el.id)){event.preventDefault();event.stopImmediatePropagation();transition(()=>{replay=true;try{el.click();}finally{replay=false;}},routeStage(el.id));}
  },true);
  document.addEventListener('focusin',event=>{const panel=activePanel();if(!panel?.contains(event.target))return;memory.set(panel,event.target);if(!silentFocus&&!busy&&performance.now()-lastMove>70){sound.play('move');lastMove=performance.now();}});
  document.addEventListener('pointermove',event=>{if(busy||event.pointerType==='touch')return;const el=event.target.closest('button,summary');if(el&&!el.disabled&&activePanel()?.contains(el)&&document.activeElement!==el)el.focus({preventScroll:true});});
  for(const name of ['pointerdown','keydown'])window.addEventListener(name,()=>sound.unlock(),{capture:true});
  function move(direction){const panel=activePanel(),list=items(panel),el=document.activeElement;if(!list.length)return;
    if(['left','right'].includes(direction)&&list.includes(el)){
      const delta=direction==='right'?1:-1;
      if(el.tagName==='SELECT'){const options=[...el.options].filter(o=>!o.disabled),i=options.indexOf(el.selectedOptions[0]);el.value=options[Math.max(0,Math.min(options.length-1,i+delta))]?.value??el.value;el.dispatchEvent(new Event('change',{bubbles:true}));sound.play('move');return;}
      if(el.type==='range'){const step=Number(el.step)||1;el.value=Math.max(Number(el.min)||0,Math.min(Number(el.max)||100,Number(el.value)+delta*step));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));sound.play('move');return;}
      if(['checkbox','radio'].includes(el.type)){el.click();sound.play('move');return;}
    }
    const index=list.indexOf(el),delta=['left','up'].includes(direction)?-1:1;focus(list[index<0?0:(index+delta+list.length)%list.length]);
  }
  function confirm(){const list=items(activePanel()),el=document.activeElement;if(!list.includes(el)){repair();return;}if(el.matches('button,summary,a,input[type=checkbox],input[type=radio]'))el.click();}
  function back(){const panel=activePanel();if(!panel){if(['running','countdown'].includes(state))q('#btnPause').click();return;}
    const map={help:'btnHelpClose',creditsMenu:'btnCreditsBack',settingsMenu:'btnSettingsBack',importMenu:'btnImportBack',mainMenu:'btnBackTitle',onlineMenu:'onlineBack',workshop:'btnWorkshopBack',carPanel:'btnCarBack',circuitMenu:'btnCircuitBack',challengeMenu:'btnBackMain',startPanel:'btnBoardBack',pauseMenu:'btnResume',overlay:'btnOvMenu'};
    const button=q('#'+map[panel.id]);if(visible(button))button.click();else if(panel.id==='replayControls'){sound.play('back');transition(()=>replayUI.close());}
  }
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(!busy&&event.target.closest?.('#musicDock,#musicReveal'))return;
    const text=event.target.matches?.('textarea,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]),[contenteditable=true]');
    if(text&&event.key!=='Escape')return;
    const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[event.key],go=event.key==='Enter'||event.key===' ',leave=event.key==='Escape'||event.key==='Backspace';
    if(!busy&&!activePanel()&&!leave)return;if(!direction&&!go&&!leave&&!(busy&&event.key==='Tab'))return;
    event.preventDefault();event.stopImmediatePropagation();if(busy)return;
    if(direction)move(direction);else if(!event.repeat){if(leave)back();else confirm();}
  },true);
  // Server-driven screens and automatic race results also cover the whole display.
  let previous=activePanel();const observer=new MutationObserver(()=>{const next=activePanel();if(next!==previous){previous=next;if(!busy){cover.classList.add('black');transition(undefined,musicScene());}}else if(!busy)repair();});
  for(const id of panels){const el=q('#'+id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class']});}
  repair();
  return {get busy(){return busy;},gamepad(edges){if(busy)return;for(const [key,dir] of [['navUp','up'],['navDown','down'],['navLeft','left'],['navRight','right']])if(edges[key]){move(dir);break;}if(edges.cancel)back();else if(edges.confirm)confirm();},transition};
})();
