export const DEMO_TRACKS=[1,2,3].map(n=>({id:`demo-${n}`,title:`Pista de prueba ${String(n).padStart(2,'0')}`,artist:'DR1FT · Sin audio',file:null}));
export function normalizeTracks(data){
  const seen=new Set();
  return (Array.isArray(data?.tracks)?data.tracks:[]).filter(t=>t&&typeof t.file==='string'&&/^[a-zA-Z0-9_-]+\.mp3$/i.test(t.file)).filter(t=>{if(seen.has(t.file))return false;seen.add(t.file);return true;}).map(t=>({id:t.file,file:t.file,title:String(t.title||t.file.replace(/\.mp3$/i,'')).slice(0,140),artist:String(t.artist||'Artista por definir').slice(0,140)}));
}
export class MusicPlayer{
  constructor({tracks=[],audioFactory=()=>new Audio(),sourceURL=path=>path,onChange=()=>{},volume=.35,now=()=>performance.now(),schedule=(fn,ms)=>globalThis.setTimeout(fn,ms),cancel=id=>globalThis.clearTimeout(id)}={}){this.tracks=tracks;this.audioFactory=audioFactory;this.sourceURL=sourceURL;this.onChange=onChange;this.volume=Math.max(0,Math.min(1,volume));this.index=0;this.playing=false;this.demo=false;this.elapsed=0;this.audio=null;this.ticket=0;this.failed=new Set();this.message='';this.gain=1;this.now=now;this.schedule=schedule;this.cancel=cancel;this.fadeTimer=null;this.fadeResolve=null;}
  get list(){return this.demo?DEMO_TRACKS:this.tracks;}
  get current(){return this.list[this.index]||null;}
  snapshot(){return {track:this.current,index:this.index,count:this.list.length,playing:this.playing,demo:this.demo,volume:this.volume,message:this.message};}
  emit(reason='state'){this.onChange(this.snapshot(),reason);}
  stopAudio(){this.ticket++;if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}}
  setTracks(tracks){this.stopAudio();this.tracks=tracks;this.index=0;this.playing=false;this.emit();}
  setDemo(enabled){this.stopAudio();this.demo=!!enabled;this.index=0;this.elapsed=0;this.playing=false;this.message='';this.failed.clear();if(enabled)this.play();else this.emit('stop');}
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.audio)this.audio.volume=this.volume*this.gain;this.emit('volume');}
  pause(){this.cancelFade(true);this.ticket++;this.playing=false;this.audio?.pause();this.message='';this.emit('pause');}
  toggle(){this.playing?this.pause():this.play();}
  async play(){
    if(!this.current){this.message='Sin MP3 cargados · Usa la prueba sin audio';this.emit('empty');return;}
    this.failed.clear();await this.start();
  }
  async start(){
    this.message='';this.playing=true;
    if(this.demo){this.emit('play');return;}
    if(!this.audio){const a=this.audioFactory();this.audio=a;a.preload='none';a.volume=this.volume*this.gain;a.src=this.sourceURL('music/'+encodeURIComponent(this.current.file));
      a.addEventListener('ended',()=>{if(this.audio===a&&this.playing)this.next(1);});
      a.addEventListener('error',()=>{if(this.audio===a)this.fail(a);});
    }
    const a=this.audio,ticket=++this.ticket;this.emit('loading');
    try{await a.play();if(this.audio!==a||ticket!==this.ticket)return;this.emit('play');}
    catch(error){if(this.audio!==a||ticket!==this.ticket)return;if(error?.name==='NotAllowedError'){this.playing=false;this.message='Pulsa reproducir para activar la música';this.emit('blocked');}else this.fail(a);}
  }
  fail(a){if(a!==this.audio)return;const wanted=this.playing;this.failed.add(this.current.id);this.stopAudio();this.playing=false;
    if(wanted&&this.failed.size<this.list.length){this.index=(this.index+1)%this.list.length;this.elapsed=0;this.start();}
    else{this.message='No se pudo cargar la música · Revisa los archivos MP3';this.emit('error');}
  }
  next(direction=1){if(!this.list.length){this.play();return;}const wanted=this.playing;this.stopAudio();this.index=(this.index+direction+this.list.length)%this.list.length;this.elapsed=0;this.message='';this.failed.clear();if(wanted)this.start();else this.emit('track');}
  applyGain(){if(this.audio)this.audio.volume=this.volume*this.gain;}
  cancelFade(reset=false){if(this.fadeTimer!==null)this.cancel(this.fadeTimer);this.fadeTimer=null;this.fadeResolve?.(false);this.fadeResolve=null;if(reset){this.gain=1;this.applyGain();}}
  fadeTo(target,duration=220){
    this.cancelFade();target=Math.max(0,Math.min(1,Number(target)||0));const from=this.gain,start=this.now();
    if(duration<=0){this.gain=target;this.applyGain();return Promise.resolve(true);}
    return new Promise(resolve=>{this.fadeResolve=resolve;const step=()=>{const t=Math.min(1,Math.max(0,(this.now()-start)/duration));this.gain=from+(target-from)*t;this.applyGain();if(t<1)this.fadeTimer=this.schedule(step,16);else{this.fadeTimer=null;this.fadeResolve=null;resolve(true);}};step();});
  }
  tick(seconds){if(this.demo&&this.playing){this.elapsed+=Math.max(0,seconds);if(this.elapsed>=12)this.next();}}
  dispose(){this.cancelFade(true);this.stopAudio();this.playing=false;}
}

// Transition coordinator is independent of DOM and never overrides a manual pause.
export class MusicScenes{
  constructor(player){this.player=player;this.ready=false;this.scene=null;this.pending=null;this.first=false;this.userPaused=false;}
  manual(action){this.player.cancelFade(true);this.pending=null;if(action==='toggle')this.userPaused=this.player.playing;}
  out(stage){const p=this.player;if(!stage||(stage===this.scene&&stage!=='race')||p.demo)return;this.pending=stage;this.first=this.scene===null;if(this.ready&&this.first&&!this.userPaused){p.gain=0;p.play();}if(p.playing)p.fadeTo(0,200);}
  into(stage){const p=this.player;if(!stage||stage!==this.pending||p.demo||!this.ready)return;this.pending=null;this.scene=stage;if(!this.first)p.next();if(p.playing)p.fadeTo(1,260);else{p.gain=1;p.applyGain();}}
  loaded(){this.ready=true;if(this.pending){if(this.first&&!this.userPaused){this.player.gain=0;this.player.play();}this.into(this.pending);}}
}
