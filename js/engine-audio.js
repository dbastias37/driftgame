/* Engine Audio V2. Sample playback only; driving state is strictly read-only.
 * No recordings ship yet. Missing/unverified banks stay silent (see getStatus).
 * Captures from Engine Simulator are simulated audio, not real-car recordings. */
globalThis.DriftEngineAudio = (() => {
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const profiles=Object.freeze(Object.fromEntries(Object.entries({
    fujiwara:{label:'4A-GE · AE86',idle:900,redline:7800},
    blue:{label:'RB26 · Skyline R34',idle:850,redline:8000},
    yellow:{label:'13B · RX-7',idle:1000,redline:8500},
    gray:{label:'V8 · Nova',idle:700,redline:6200},
    yugo:{label:'I4 · Yugo',idle:850,redline:6200}
  }).map(([key,p])=>[key,Object.freeze(p)])));
  // Audio-only RPM observer. Never writes gear, velocity, throttle or torque.
  class RPMModel {
    constructor(){this.reset();}
    reset(){this.rpm=0;this.gear=null;this.shift=0;this.skin=null;}
    update({car,skin,dt=1/60,active=true,paused=false}={}){
      const p=profiles[skin]||profiles.fujiwara;
      const seconds=clamp(finite(dt,1/60),0,.1);
      const gear=Math.max(1,Math.round(finite(car?.gear,1)));
      if(this.skin!==skin){this.reset();this.skin=skin;this.rpm=p.idle;}
      if(!active||paused||!car){this.rpm=p.idle;this.gear=null;this.shift=0;return this.rpm;}
      const throttle=clamp(finite(car.throttleSm),0,1);
      const speed=Math.abs(finite(car.worldSpeed?.()))*3.6;
      const maxSpeed=Math.max(1,finite(car.gearMax?.[gear-1],198));
      const coupled=p.idle+clamp(speed/maxSpeed,0,1)*(p.redline-p.idle);
      // Stationary clutch slip/free rev fades out by 12 km/h. In gear, speed
      // controls revs even on closed throttle or braking (engine braking).
      const slip=(1-clamp(speed/12,0,1))*(car.braking?0:1);
      const free=p.idle+throttle*(p.redline*.75-p.idle);
      let target=coupled+(Math.max(coupled,free)-coupled)*slip;
      if(this.gear!==null&&gear!==this.gear)this.shift=.16;
      this.gear=gear;this.shift=Math.max(0,this.shift-seconds);
      // New gearMax already supplies the RPM drop/blip; no second pitch dip.
      const response=this.shift>0?22:target>this.rpm?8:11;
      this.rpm=clamp(this.rpm+(target-this.rpm)*(1-Math.exp(-seconds*response)),p.idle,p.redline);
      return this.rpm;
    }
  }
  function weights(samples,rpm){
    if(rpm<=samples[0].rpm)return [[0,1]];
    const last=samples.length-1;
    if(rpm>=samples[last].rpm)return [[last,1]];
    const hi=samples.findIndex(s=>s.rpm>=rpm),lo=hi-1;
    const t=(rpm-samples[lo].rpm)/(samples[hi].rpm-samples[lo].rpm);
    return [[lo,Math.cos(t*Math.PI/2)],[hi,Math.sin(t*Math.PI/2)]];
  }
  function validateBank(bank,skin){
    const p=profiles[skin];
    if(!p||bank?.version!==2||bank.vehicle!==skin)throw Error('Invalid bank identity');
    if(bank.status!=='verified')throw Error('Recordings pending verification');
    const source=bank.provenance;
    if(source?.type!=='engine-simulator-capture'||!source.engineDefinition||!source.captureDate||!source.reviewedBy||!source.license||!/^[a-f0-9]{64}$/.test(source.engineDefinitionSha256||''))throw Error('Missing capture provenance');
    for(const layer of ['on','off']){
      const samples=bank.layers?.[layer];
      if(!Array.isArray(samples)||samples.length<3||samples.length>16)throw Error('Invalid RPM layer');
      let previous=0;
      for(const s of samples){
        if(!Number.isFinite(s.rpm)||s.rpm<=previous||!/^assets\/audio\/engines\/[a-z0-9_/-]+\.wav$/.test(s.url)||!Number.isFinite(s.loopStart)||!Number.isFinite(s.loopEnd)||s.loopStart<0||s.loopEnd-s.loopStart<1||!Number.isFinite(s.gain)||s.gain<=0||s.gain>2||!/^[a-f0-9]{64}$/.test(s.sha256||''))throw Error('Invalid sample metadata');
        if(previous&&s.rpm/previous>2)throw Error('RPM anchors too far apart');
        previous=s.rpm;
      }
      if(samples[0].rpm>p.idle||samples.at(-1).rpm<p.redline)throw Error('RPM coverage incomplete');
    }
    return bank;
  }
  class Player {
    constructor({contextFactory,fetcher}={}){
      this.contextFactory=contextFactory||(()=>{const AC=globalThis.AudioContext||globalThis.webkitAudioContext;return AC?new AC({latencyHint:'interactive'}):null;});
      this.fetcher=fetcher||((...args)=>fetch(...args));this.model=new RPMModel();
      this.ctx=null;this.master=null;this.voices=[];this.generation=0;this.skin=null;
      this.status='idle';this.error=null;this.volume=.6;this.load=0;this.on=false;
    }
    unlock(){
      try{
        if(!this.ctx){this.ctx=this.contextFactory();if(!this.ctx){this.status='unsupported';return;}
          this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);}
        if(this.ctx.state!=='running')Promise.resolve(this.ctx.resume()).catch(e=>{this.error=e.message;});
      }catch(e){this.status='error';this.error=e.message;}
    }
    clearVoices(){for(const v of this.voices){try{v.source.stop();v.source.disconnect();v.gain.disconnect();}catch{}}this.voices=[];}
    async loadBank(skin){
      const generation=++this.generation,ctx=this.ctx;
      this.clearVoices();this.skin=skin;this.status='loading';this.error=null;
      try{
        const response=await this.fetcher(`assets/audio/engines/${skin}/bank.json`);
        if(!response.ok)throw Error(`Bank HTTP ${response.status}`);
        const bank=await response.json();
        if(generation!==this.generation)return;
        if(bank.status==='pending'){this.status='pending';return;}
        validateBank(bank,skin);
        const decoded=[];
        // Sequential requests bound decode memory on mobile devices.
        for(const layer of ['on','off'])for(const sample of bank.layers[layer]){
          const res=await this.fetcher(sample.url);if(!res.ok)throw Error(`Sample HTTP ${res.status}`);
          const bytes=await res.arrayBuffer();
          const hash=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
          if(hash!==sample.sha256)throw Error('Sample checksum mismatch');
          const buffer=await ctx.decodeAudioData(bytes);
          if(generation!==this.generation)return;
          if(buffer.duration<sample.loopEnd||buffer.duration>30||buffer.numberOfChannels>2)throw Error('Invalid sample duration/channels');
          let peak=0,energy=0,count=0;
          for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c)){if(!Number.isFinite(value))throw Error('Invalid PCM');peak=Math.max(peak,Math.abs(value));energy+=value*value;count++;}
          if(peak>=.999||Math.sqrt(energy/count)<.0001)throw Error('Clipped or silent recording');
          decoded.push({layer,sample,buffer});
        }
        if(generation!==this.generation)return;
        const start=ctx.currentTime+.03;
        for(const entry of decoded){
          const source=ctx.createBufferSource(),gain=ctx.createGain();
          source.buffer=entry.buffer;source.loop=true;source.loopStart=entry.sample.loopStart;source.loopEnd=entry.sample.loopEnd;
          gain.gain.value=0;source.connect(gain);gain.connect(this.master);
          const voice={...entry,source,gain};this.voices.push(voice);source.start(start,entry.sample.loopStart);
        }
        this.bank=bank;this.status='ready';
      }catch(e){if(generation===this.generation){this.clearVoices();this.status='error';this.error=e.message;}}
    }
    update(input={}){
      const skin=profiles[input.skin]?input.skin:'fujiwara';
      const rpm=this.model.update({...input,skin});
      this.on=!!input.active&&!input.paused&&!globalThis.document?.hidden&&!!input.car;
      if(!this.ctx)return;
      if(this.on&&skin!==this.skin)void this.loadBank(skin);
      const t=this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.on&&this.status==='ready'?this.volume*.35:0,t,.03);
      if(this.status!=='ready')return;
      const target=clamp(finite(input.car?.throttleSm),0,1)*(this.model.shift>0?.35:1);
      this.load+=(target-this.load)*(1-Math.exp(-clamp(finite(input.dt,1/60),0,.1)*12));
      for(const layer of ['on','off']){
        const mix=new Map(weights(this.bank.layers[layer],rpm));
        const loadGain=layer==='on'?Math.sin(this.load*Math.PI/2):Math.cos(this.load*Math.PI/2);
        let i=0;
        for(const v of this.voices.filter(v=>v.layer===layer)){
          v.source.playbackRate.setTargetAtTime(clamp(rpm/v.sample.rpm,.5,2),t,.025);
          v.gain.gain.setTargetAtTime((mix.get(i++)||0)*loadGain*v.sample.gain,t,.025);
        }
      }
    }
    mute(){this.on=false;if(this.ctx&&this.master){this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.015);}}
    setVolume(v){this.volume=clamp(finite(v),0,1);if(!this.volume)this.mute();}
    dispose(){++this.generation;this.clearVoices();if(this.ctx)Promise.resolve(this.ctx.close()).catch(()=>{});this.ctx=null;this.master=null;this.skin=null;this.bank=null;this.status='idle';this.error=null;this.load=0;this.model.reset();}
    getStatus(){return {version:2,state:this.status,vehicle:this.skin,recordingsVerified:this.status==='ready',error:this.error};}
  }
  const player=new Player();
  try{const saved=globalThis.localStorage?.getItem('drift:engine-volume:v1');if(saved!==null&&saved!==undefined&&Number.isFinite(Number(saved)))player.setVolume(saved);}catch{}
  function setVolume(v){player.setVolume(v);try{globalThis.localStorage?.setItem('drift:engine-volume:v1',String(player.volume));}catch{}const output=globalThis.document?.getElementById('engineVolumeValue');if(output)output.textContent=Math.round(player.volume*100)+'%';}
  globalThis.document?.addEventListener('visibilitychange',()=>{if(document.hidden)player.mute();});
  globalThis.addEventListener?.('pagehide',()=>player.dispose());
  return Object.freeze({unlock:()=>player.unlock(),update:input=>player.update(input),setVolume,dispose:()=>player.dispose(),profiles,getVolume:()=>player.volume,getRPM:()=>player.model.rpm,getStatus:()=>player.getStatus(),RPMModel,Player,weights,validateBank});
})();
