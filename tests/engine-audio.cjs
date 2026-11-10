const {test}=require('node:test'),assert=require('node:assert/strict');
const ready=import('../js/engine-audio.js');
const car=(speed=0,throttle=0,gear=1,braking=false)=>Object.freeze({worldSpeed:()=>speed/3.6,throttleSm:throttle,gear,braking,gearMax:Object.freeze([39,78,132,198])});
const run=(m,c,n=120)=>{for(let i=0;i<n;i++)m.update({car:c,skin:'fujiwara',dt:1/60});return m.rpm;};
test('AE86 RPM follows throttle, speed, upshift, downshift and braking without mutation',async()=>{
 await ready;const m=new DriftEngineAudio.RPMModel();
 assert.equal(run(m,car()),900);assert(run(m,car(0,1))>5000);
 const high=run(m,car(35,1,1));const up=run(m,car(35,1,2));assert(up<high-2000);
 const down=run(m,car(35,0,1,true));assert(down>up+2000);
 assert(run(m,car(10,0,1,true))<down);assert(run(m,car(0,1,1,true))<901);
});
test('RPM observer handles all profiles, pauses, invalid values and vehicle switches',async()=>{
 await ready;const m=new DriftEngineAudio.RPMModel();
 for(const [skin,p] of Object.entries(DriftEngineAudio.profiles)){
  for(let i=0;i<300;i++)m.update({skin,car:car(500,1),dt:.016});assert(m.rpm<=p.redline&&m.rpm>=p.idle);
  m.update({skin,car:car(),paused:true});assert.equal(m.rpm,p.idle);
  m.update({skin,car:{worldSpeed:()=>NaN,gear:Infinity,throttleSm:NaN},dt:NaN});assert(Number.isFinite(m.rpm));
 }
});
test('RPM crossfade has continuous endpoints and constant power',async()=>{
 await ready;const samples=[{rpm:1000},{rpm:2000},{rpm:4000}];
 for(let rpm=500;rpm<5000;rpm+=7){const w=DriftEngineAudio.weights(samples,rpm);assert(Math.abs(w.reduce((s,[,v])=>s+v*v,0)-1)<1e-12);assert(w.length<=2);}
 assert.deepEqual(DriftEngineAudio.weights(samples,2000),[[0,Math.cos(Math.PI/2)],[1,1]]);
});
function context(){
 const voices=[];const param=()=>({value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const ctx={state:'suspended',currentTime:1,destination:{},voices,closed:false,resume(){this.state='running';return Promise.resolve();},close(){this.closed=true;return Promise.resolve();},createGain(){return {gain:param(),connect(){},disconnect(){}};},createBufferSource(){const s={playbackRate:param(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};voices.push(s);return s;},async decodeAudioData(){return {duration:3,numberOfChannels:1,getChannelData:()=>new Float32Array([.1,-.1,.2,-.2])};}};return ctx;
}
async function fixture(){
 const bytes=new Uint8Array([1,2,3,4]).buffer;
 const sha=require('node:crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex');
 const samples=[900,1800,3600,6000,7800].map(rpm=>({rpm,url:`assets/audio/engines/fujiwara/on_${rpm}.wav`,loopStart:0,loopEnd:2,gain:.7,sha256:sha}));
 // Mock bytes and PCM validate scheduling only; these are NEVER engine captures.
 return {bytes,bank:{version:2,vehicle:'fujiwara',status:'verified',provenance:{type:'engine-simulator-capture',engineDefinition:'TEST ONLY',engineDefinitionSha256:'a'.repeat(64),captureDate:'2026-11-10',reviewedBy:'TEST FIXTURE',license:'TEST ONLY'},layers:{on:samples,off:samples}}};
}
test('sample loading, pitch, mute, disposal and restart; no oscillators',async()=>{
 await ready;const {bytes,bank}=await fixture(),ctx=context();
 const p=new DriftEngineAudio.Player({contextFactory:()=>ctx,fetcher:async url=>({ok:true,json:async()=>bank,arrayBuffer:async()=>bytes})});
 p.unlock();assert.equal(ctx.state,'running');await p.loadBank('fujiwara');assert.equal(p.status,'ready');assert.equal(ctx.voices.length,10);
 p.update({car:car(30,.8),skin:'fujiwara',active:true,dt:.1});assert(p.master.gain.value>0);assert(p.voices.filter(v=>v.gain.gain.value>0).length<=4);
 assert(ctx.voices.every(v=>v.playbackRate.value>=.5&&v.playbackRate.value<=2));
 p.update({car:car(),skin:'fujiwara',active:true,paused:true});assert.equal(p.master.gain.value,0);
 p.setVolume(0);assert.equal(p.master.gain.value,0);p.dispose();assert(ctx.voices.every(v=>v.stopped));assert(ctx.closed);assert.equal(p.status,'idle');p.unlock();assert(p.ctx);
});
test('pending banks and failed samples stay silent without procedural fallback',async()=>{
 await ready;const ctx=context();
 const p=new DriftEngineAudio.Player({contextFactory:()=>ctx,fetcher:async()=>({ok:true,json:async()=>({status:'pending'})})});p.unlock();await p.loadBank('fujiwara');assert.equal(p.status,'pending');assert.equal(ctx.voices.length,0);
 const {bank}=await fixture();p.fetcher=async url=>url.endsWith('.json')?{ok:true,json:async()=>bank}:{ok:false,status:404};await p.loadBank('fujiwara');assert.equal(p.status,'error');assert.equal(ctx.voices.length,0);
});
test('stale async loads cannot overwrite a vehicle change or resurrect disposed audio',async()=>{
 await ready;let resolve;const p=new DriftEngineAudio.Player({contextFactory:context,fetcher:()=>new Promise(r=>resolve=r)});p.unlock();
 const loading=p.loadBank('fujiwara');p.dispose();resolve({ok:true,json:async()=>({status:'pending'})});await loading;assert.equal(p.status,'idle');assert.equal(p.voices.length,0);
});
test('bank validation rejects absent provenance, missing RPM coverage and invalid loop',async()=>{
 await ready;const {bank}=await fixture();assert.doesNotThrow(()=>DriftEngineAudio.validateBank(bank,'fujiwara'));
 for(const mutate of [b=>b.status='pending',b=>b.provenance=null,b=>b.layers.on[0].rpm=1200,b=>b.layers.off[2].loopEnd=.2]){const b=structuredClone(bank);mutate(b);assert.throws(()=>DriftEngineAudio.validateBank(b,'fujiwara'));}
});
test('five distinct vehicle banks either explicitly pending or fully validated',async()=>{
 await ready;const fs=require('node:fs');for(const skin of Object.keys(DriftEngineAudio.profiles)){const bank=JSON.parse(fs.readFileSync(`assets/audio/engines/${skin}/bank.json`));assert.equal(bank.vehicle,skin);if(bank.status==='pending'){assert.equal(bank.layers.on.length,0);assert.equal(bank.layers.off.length,0);}else DriftEngineAudio.validateBank(bank,skin);}
});
test('checksum mismatch and clipped PCM cannot become audible',async()=>{
 await ready;const {bank,bytes}=await fixture();
 for(const clipped of [false,true]){
  const ctx=context();if(clipped)ctx.decodeAudioData=async()=>({duration:3,numberOfChannels:1,getChannelData:()=>new Float32Array([1,-1])});
  const p=new DriftEngineAudio.Player({contextFactory:()=>ctx,fetcher:async()=>({ok:true,json:async()=>bank,arrayBuffer:async()=>clipped?bytes:new Uint8Array([9]).buffer})});p.unlock();await p.loadBank('fujiwara');assert.equal(p.status,'error');assert.equal(ctx.voices.length,0);
 }
});
test('old vehicle responses cannot replace the latest bank state',async()=>{
 await ready;const resolvers=[];const p=new DriftEngineAudio.Player({contextFactory:context,fetcher:()=>new Promise(r=>resolvers.push(r))});p.unlock();
 const old=p.loadBank('fujiwara'),current=p.loadBank('blue');
 resolvers[1]({ok:true,json:async()=>({status:'pending'})});await current;
 resolvers[0]({ok:false,status:500});await old;assert.equal(p.skin,'blue');assert.equal(p.status,'pending');assert.equal(p.error,null);
});
