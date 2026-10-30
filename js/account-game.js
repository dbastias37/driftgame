/* Synchronize existing game menus without changing the driving simulation. */
window.addEventListener('drift:profile',()=>{
  if(!DriftAccount.ready)return;
  unlockedLevel=DriftCareer.load().unlocked;syncCareerWallet();
  garageCosmetics=DriftCareer.cosmetics(DriftCareer.load().cars[chosen.sprite]);
  const name=document.getElementById('onlineName');if(name){name.value=DriftAccount.user.name;name.readOnly=true;}
});
window.addEventListener('drift:account-open',()=>{
  clearInputs();if(['running','countdown'].includes(state)&&mode!=='online'){pausedState=state;state='paused';pauseMenu.classList.remove('hidden');}
});
window.addEventListener('drift:locked',()=>{
  online?.leave();replayUI?.close();clearInputs();state='title';careerRun=null;player=null;ghost=null;ghostSamples=[];unlockedLevel=1;
  document.body.classList.remove('in-game');hidePanels();document.getElementById('titleScreen').classList.remove('hidden');
  syncCareerWallet();
});
// Keep a route to pending saves visible on race results and pause screens.
for(const id of ['pauseMenu','overlay']){
  const parent=document.getElementById(id)?.querySelector('.btnrow')||document.getElementById(id);
  if(parent){const button=document.createElement('button');button.type='button';button.textContent='Perfil / sincronizar';button.className='gray';button.addEventListener('click',()=>DriftAccount.show('profile'));parent.appendChild(button);}
}
document.addEventListener('keydown',e=>{if(DriftAccount.visible&&!document.getElementById('accountGate').contains(e.target)){e.stopImmediatePropagation();e.preventDefault();}},true);
