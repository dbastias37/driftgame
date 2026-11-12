/* DriftGame engine audio v1 — original Web Audio synthesis, not copied Engine Simulator assets.
 * Read-only consumer of driving state; does not mutate physics or transmission. */
globalThis.DriftEngineAudio = (() => {
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const profiles=Object.freeze({
    blue:    {label:'RB26 · I6 turbo',cyl:6,idle:850,redline:8000,base:0.61,body:1.0,rasp:.50,turbo:.8},
    yellow:  {label:'13B · rotary',cyl:6,idle:1000,redline:8500,base:1.10,body:.60,rasp:.95,turbo:.9,rotary:true},
    barracuda:{label:'HEMI · V8',cyl:8,idle:750,redline:6200,base:.49,body:1.25,rasp:.55,turbo:0},
    gray:    {label:'V8 · Nova',cyl:8,idle:700,redline:6200,base:.50,body:1.38,rasp:.30,turbo:0},
    yugo:    {label:'I4 · Yugo',cyl:4,idle:850,redline:6200,base:.84,body:.72,rasp:.65,turbo:0},
    fujiwara:{label:'4A-GE · AE86',cyl:4,idle:900,redline:7800,base:1.02,body:.78,rasp:.86,turbo:0}
  });
  let ctx=null, master=null, bass=null, main=null, harmonics=null, rasp=null, intake=null, turboNode=null;
  let noise=null, noiseGain=null, turboGain=null, rpm=0, lastGear=null, shiftDip=0, volume=0.60, initialized=false;
  let lastTime=0, startAttempts=0;
  try { const v=Number(localStorage.getItem('drift:engine-volume:v1')); if(Number.isFinite(v)&&v>=0&&v<=1)volume=v; } catch {}
  function tone(type){
    const osc=ctx.createOscillator();osc.type=type;
    const gain=ctx.createGain();gain.gain.value=0;
    osc.connect(gain);gain.connect(master);osc.start();
    return {osc,gain};
  }
  function initialize(){
    if(initialized)return true;
    const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AC)return false;
    try{
      ctx=new AC({latencyHint:'interactive'});
      master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
      bass=tone('sawtooth');main=tone('sawtooth');harmonics=tone('triangle');rasp=tone('square');
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2),ctx.sampleRate);
      const pcm=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)pcm[i]=Math.random()*2-1;
      noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=700;filter.Q.value=.6;
      noiseGain=ctx.createGain();noiseGain.gain.value=0;noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(master);noise.start();
      intake=filter;
      turboNode=ctx.createBiquadFilter();turboNode.type='highpass';turboNode.frequency.value=2200;
      turboGain=ctx.createGain();turboGain.gain.value=0;
      noise.connect(turboNode);turboNode.connect(turboGain);turboGain.connect(master);
      initialized=true;
      return true;
    }catch(err){console.warn('Engine audio unavailable',err);try{ctx?.close()}catch{};ctx=null;return false;}
  }
  function unlock(){
    if(!initialize())return;
    if(ctx.state!=='running'&&startAttempts++<30)ctx.resume().catch(()=>{});
  }
  function setVolume(v){
    volume=clamp(Number(v)||0,0,1);
    try{localStorage.setItem('drift:engine-volume:v1',String(volume))}catch{}
    const output=document.getElementById('engineVolumeValue');
    if(output)output.textContent=Math.round(volume*100)+'%';
  }
  function update({car,skin,active,paused,dt}={}){
    if(!ctx||!initialized)return;
    const t=ctx.currentTime;
    const on=!!active&&!paused&&!document.hidden&&!!car&&volume>0;
    const p=profiles[skin]||profiles.blue;
    const sm=clamp(Number(car?.throttleSm)||0,0,1);
    const speed=clamp(Number(car?.worldSpeed?.())*3.6||0,0,360);
    const gear=Math.max(1,Math.round(Number(car?.gear)||1));
    const maxSpeed=Math.max(15,Number(car?.gearMax?.[gear-1])||180);
    const brake=clamp(Number(car?.braking)||0,0,1);
    const rpmFromSpeed=p.idle+clamp(speed/maxSpeed,0,1)*(p.redline-p.idle);
    // The arcade physics has no crankshaft RPM. Approximate its free-rev response
    // from throttle, vehicle gear and speed, without touching the vehicle dynamics.
    const freeRev=p.idle+sm*(p.redline*.72-p.idle);
    const target=on?clamp(Math.max(rpmFromSpeed,freeRev),p.idle,p.redline):p.idle;
    const seconds=clamp(Number(dt)||1/60,0,.15),response=1-Math.exp(-seconds*(target>rpm?8:12));
    rpm+=(target-rpm)*response;
    if(lastGear!==null&&lastGear!==gear)shiftDip=1;
    lastGear=gear;shiftDip=Math.max(0,shiftDip-seconds*3.8);
    const soundRpm=Math.max(p.idle,rpm*(1-.28*shiftDip));
    // Four-stroke cylinders produce cyl/2 combustion events per crank revolution.
    // Rotary is approximated acoustically by equivalent combustion pulse density.
    const fireHz=clamp(soundRpm/60*(p.cyl/2),25,700);
    const move=(node,value,ramp=.035)=>node.setTargetAtTime(value,t,ramp);
    move(bass.osc.frequency,fireHz*.5);move(main.osc.frequency,fireHz);
    move(harmonics.osc.frequency,fireHz*2);move(rasp.osc.frequency,fireHz*3);
    const load=clamp(.17+sm*.83,0,1);
    const norm=clamp((soundRpm-p.idle)/(p.redline-p.idle),0,1);
    const running=on?1:0;
    move(bass.gain.gain,running*(.025+p.body*.055)*(1-norm*.28)*(.45+load*.55));
    move(main.gain.gain,running*(.025+.095*p.body)*(.42+load*.58));
    move(harmonics.gain.gain,running*(.014+.042*p.rasp)*(.20+norm*.8)*(.35+load*.65));
    move(rasp.gain.gain,running*(.006+.025*p.rasp)*norm*norm*load);
    move(intake.frequency,250+norm*2400+sm*750,.07);
    move(noiseGain.gain,running*(.004+sm*.026+brake*.002));
    move(turboNode.frequency,1800+norm*2400,.10);
    move(turboGain.gain,running*p.turbo*sm*norm*.022);
    // Headroom protects against clipping; zero when paused/menus/hidden.
    move(master.gain,volume*running*.67,.075);
    lastTime=t;
  }
  function dispose(){
    if(!ctx)return;
    try{ctx.close()}catch{}
    ctx=null;initialized=false;lastGear=null;rpm=0;startAttempts=0;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&master&&ctx)master.gain.setTargetAtTime(0,ctx.currentTime,.02)});
  addEventListener('pagehide',dispose);
  return Object.freeze({unlock,update,setVolume,dispose,profiles,getVolume:()=>volume,getRPM:()=>rpm});
})();