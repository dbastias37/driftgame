export const DEMO_TRACKS=[1,2,3].map(n=>({id:`demo-${n}`,title:`Pista de prueba ${String(n).padStart(2,'0')}`,artist:'DR1FT · Sin audio',file:null}));
export function normalizeTracks(data){
  const seen=new Set();
  return (Array.isArray(data?.tracks)?data.tracks:[]).filter(t=>t&&typeof t.file==='string'&&/^[a-zA-Z0-9_-]+\.mp3$/i.test(t.file)).filter(t=>{if(seen.has(t.file))return false;seen.add(t.file);return true;}).map(t=>({id:t.file,file:t.file,title:String(t.title||t.file.replace(/\.mp3$/i,'')).slice(0,140),artist:String(t.artist||'Artista por definir').slice(0,140)}));
}
export class MusicPlayer{
  constructor({tracks=[],audioFactory=()=>new Audio(),onChange=()=>{},volume=.35}={}){this.tracks=tracks;this.audioFactory=audioFactory;this.onChange=onChange;this.volume=Math.max(0,Math.min(1,volume));this.index=0;this.playing=false;this.demo=false;this.elapsed=0;this.audio=null;this.ticket=0;this.failed=new Set();this.message='';}
  get list(){return this.demo?DEMO_TRACKS:this.tracks;}
  get current(){return this.list[this.index]||null;}
  snapshot(){return {track:this.current,index:this.index,count:this.list.length,playing:this.playing,demo:this.demo,volume:this.volume,message:this.message};}
  emit(reason='state'){this.onChange(this.snapshot(),reason);}
  stopAudio(){this.ticket++;if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}}
  setTracks(tracks){this.stopAudio();this.tracks=tracks;this.index=0;this.playing=false;this.emit();}
  setDemo(enabled){this.stopAudio();this.demo=!!enabled;this.index=0;this.elapsed=0;this.playing=false;this.message='';this.failed.clear();if(enabled)this.play();else this.emit('stop');}
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.audio)this.audio.volume=this.volume;this.emit('volume');}
  pause(){this.ticket++;this.playing=false;this.audio?.pause();this.message='';this.emit('pause');}
  toggle(){this.playing?this.pause():this.play();}
  async play(){
    if(!this.current){this.message='Sin MP3 cargados · Usa la prueba sin audio';this.emit('empty');return;}
    this.failed.clear();await this.start();
  }
  async start(){
    this.message='';this.playing=true;
    if(this.demo){this.emit('play');return;}
    if(!this.audio){const a=this.audioFactory();this.audio=a;a.preload='none';a.volume=this.volume;a.src='music/'+encodeURIComponent(this.current.file);
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
  tick(seconds){if(this.demo&&this.playing){this.elapsed+=Math.max(0,seconds);if(this.elapsed>=12)this.next();}}
  dispose(){this.stopAudio();this.playing=false;}
}
