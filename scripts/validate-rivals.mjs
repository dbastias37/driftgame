import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');for(const n of ['game-options','vehicle-fit','road-contact','vehicle-dynamics','ai-race'])await import(root+'/js/'+n+'.js');const {createTrack,createCar}=await import(root+'/server/engine.js');
const results=[];
for(const weather of ['clear','rain'])for(let level=1;level<=20;level++){const t=createTrack(level),p=createCar(t,'gray',true,0,{weather}),cars=['blue','yellow','yugo'].map((s,i)=>createCar(t,s,true,i+1,{weather})),race=new DriftRace.Race(t,p,cars,{laps:1,collisions:true});for(const c of [p,...cars])c.spawnTrails=c.updateSmoke=()=>{};let off=0,frames=0;for(let f=0;f<240*60&&!cars.every(c=>race.entries.get(c).finished);f++){p.update(1/60,{brake:true},t);race.step(1/60);off+=cars.filter(c=>c.offTrack).length;frames+=3;}results.push({weather,level,finished:cars.map(c=>+race.entries.get(c).finished.toFixed(1)),off:Math.round(off/frames*100)});}
console.log(JSON.stringify({races:results.length,finished:results.filter(r=>r.finished.every(Boolean)).length,failures:results.filter(r=>r.finished.some(t=>!t)),worstOff:results.sort((a,b)=>b.off-a.off).slice(0,3)},null,2));

if(results.some(r=>r.finished.some(t=>!t)))process.exitCode=1;
