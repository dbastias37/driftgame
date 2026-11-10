import {MusicPlayer,normalizeTracks} from './music-player.js?v=1.0.0-prealpha.11';
const $=id=>document.getElementById(id),notice=$('musicNotice');let hideTimer,ready=false;
let volume=.35;try{const raw=localStorage.getItem('dr1ft:music-volume');if(raw!==null&&Number.isFinite(Number(raw)))volume=Number(raw);}catch{}
function showNotice(s){
  $('musicNoticeTitle').textContent=s.track?.title||'Banda sonora';$('musicNoticeArtist').textContent=s.message||s.track?.artist||'Sin canciones cargadas';
  $('musicNoticeState').textContent=s.demo?(s.playing?'PRUEBA SIN AUDIO':'PRUEBA EN PAUSA'):(s.playing?'SONANDO AHORA':'MÚSICA EN PAUSA');
  $('musicNoticeNumber').textContent=s.count?String(s.index+1).padStart(2,'0'):'—';
  notice.classList.add('visible');notice.setAttribute('aria-hidden','false');clearTimeout(hideTimer);hideTimer=setTimeout(()=>{notice.classList.remove('visible');notice.setAttribute('aria-hidden','true');},5000);
}
const player=new MusicPlayer({volume,onChange(s,reason){
  document.querySelectorAll('[data-music-action="toggle"]').forEach(b=>{b.textContent=s.playing?'Ⅱ':'▶';b.setAttribute('aria-label',s.playing?'Pausar música (M)':'Reproducir música (M)');b.setAttribute('aria-pressed',String(s.playing));});
  $('musicDockTitle').textContent=s.track?.title||'SIN MP3';$('musicCurrent').textContent=s.track?`${s.track.title} — ${s.track.artist}`:'Todavía no hay canciones cargadas.';
  $('musicStatus').textContent=s.message||(s.demo?(s.playing?'Prueba silenciosa · Cambio automático cada 12 s':'Prueba silenciosa en pausa'):s.playing?'Reproduciendo':s.count?`${s.count} canciones · En pausa`:'Usa la prueba sin audio para ver el reproductor.');
  $('musicDemo').textContent=s.demo?'Salir de prueba':'Probar sin audio';$('musicDockDemo').hidden=!s.demo&&s.count>0;$('musicDockDemo').textContent=s.demo?'SALIR':'PROBAR';
  $('musicVolume').value=String(Math.round(s.volume*100));$('musicVolumeValue').textContent=Math.round(s.volume*100)+'%';
  if(!['state','volume','loading'].includes(reason))showNotice(s);
}});
function action(name){if(!ready)return;if(name==='toggle')player.toggle();else if(name==='next')player.next();else if(name==='prev')player.next(-1);else if(name==='demo')player.setDemo(!player.demo);else if(name==='info')showNotice(player.snapshot());}
document.querySelectorAll('[data-music-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.musicAction)));
$('musicVolume').addEventListener('input',e=>{player.setVolume(Number(e.target.value)/100);try{localStorage.setItem('dr1ft:music-volume',String(player.volume));}catch{}});
window.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.isComposing||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
  const key=e.key.toLowerCase();if(key!=='m'&&key!=='n')return;e.preventDefault();e.stopImmediatePropagation();action(key==='m'?'toggle':'next');
},true);
let last=performance.now();const clock=setInterval(()=>{const now=performance.now();player.tick(Math.min(1,(now-last)/1000));last=now;},250);
window.addEventListener('pagehide',()=>{player.pause();});
async function load(){
  try{const response=await fetch('music/playlist.json',{cache:'no-store'});if(!response.ok)throw Error('playlist');player.setTracks(normalizeTracks(await response.json()));}
  catch{player.message='No se pudo leer la lista de música. La prueba sin audio sigue disponible.';player.emit();}
  ready=true;document.querySelectorAll('[data-music-action]').forEach(b=>b.disabled=false);
}
player.emit();load();
