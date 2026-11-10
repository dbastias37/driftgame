// Release gate: rejects pending banks; never manufactures/approves recordings.
import fs from 'node:fs';
import crypto from 'node:crypto';
import '../js/engine-audio.js';
const requested=process.argv.slice(2);
const skins=requested.length?requested:Object.keys(DriftEngineAudio.profiles);
let failures=0;
for(const skin of skins){
 try{
  if(!Object.hasOwn(DriftEngineAudio.profiles,skin))throw Error('Unknown vehicle');
  const bank=JSON.parse(fs.readFileSync(`assets/audio/engines/${skin}/bank.json`));
  DriftEngineAudio.validateBank(bank,skin);
  for(const layer of ['on','off'])for(const sample of bank.layers[layer]){
   const data=fs.readFileSync(sample.url);
   if(crypto.createHash('sha256').update(data).digest('hex')!==sample.sha256)throw Error(`Checksum: ${sample.url}`);
   if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')throw Error('Expected WAV');
   let format,pcm;
   for(let pos=12;pos+8<=data.length;){
    const name=data.toString('ascii',pos,pos+4),size=data.readUInt32LE(pos+4),start=pos+8;
    if(start+size>data.length)throw Error('Truncated WAV');
    if(name==='fmt ')format=data.subarray(start,start+size);
    if(name==='data')pcm=data.subarray(start,start+size);
    pos=start+size+(size%2);
   }
   if(!format||format.length<16||!pcm||format.readUInt16LE(0)!==1||format.readUInt16LE(14)!==16)throw Error('Require PCM16 WAV');
   const channels=format.readUInt16LE(2),rate=format.readUInt32LE(4);
   if(![1,2].includes(channels)||![44100,48000].includes(rate))throw Error('Require mono/stereo 44.1 or 48 kHz');
   const frames=pcm.length/(channels*2),duration=frames/rate;
   if(duration>30||sample.loopEnd>duration)throw Error('Invalid loop duration');
   let peak=0,energy=0;
   for(let i=0;i<pcm.length;i+=2){const v=pcm.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v;}
   const rms=Math.sqrt(energy/(pcm.length/2));
   if(peak>=.999||rms<.0001)throw Error('Clipping or silence');
   const first=Math.floor(sample.loopStart*rate),last=Math.floor(sample.loopEnd*rate)-1;
   for(let c=0;c<channels;c++){
    const a=pcm.readInt16LE((first*channels+c)*2)/32768,b=pcm.readInt16LE((last*channels+c)*2)/32768;
    if(Math.abs(a-b)>.03)throw Error(`Loop seam needs review: ${sample.url}`);
   }
   console.log(`${skin} ${layer} ${sample.rpm}: ${duration.toFixed(2)}s peak=${peak.toFixed(3)} rms=${rms.toFixed(3)} OK`);
  }
  console.log(`${skin}: technical checks passed. Listening review must match provenance.`);
 }catch(e){failures++;console.error(`${skin}: BLOCKED — ${e.message}`);}
}
process.exitCode=failures?1:0;
