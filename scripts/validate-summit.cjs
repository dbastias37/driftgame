const {harness}=require('../tests/harness.cjs');
const fs=require('node:fs');
const r=harness();
r(`renderPrefs.rivals=4;renderPrefs.collisions=true;var validationTrack=DriftTouring.createTrack(Track,201);startWithTrack(validationTrack,'race',{weather:'snow'});offlineRace.laps=1;var validation={steps:0,offFrames:0,maxBodyError:0};`);
let result;
do{
  result=r(`(()=>{for(let i=0;i<3000&&!offlineRace.standings().every(e=>e.finished);i++){player.update(1/60,DriftRace.drive(player,track,undefined,[player,...offlineRivals],1/60),track);DriftRoadContact.update(track,player,1/60,chosen.sprite);offlineRace.step(1/60);validation.steps++;validation.offFrames+=[player,...offlineRivals].filter(c=>c.offTrack).length;if(validation.steps%30===0)for(const c of [player,...offlineRivals])validation.maxBodyError=Math.max(validation.maxBodyError,Math.abs(c.ride.height-DriftRoadContact.contacts(track,c,c.skin).height));}return {...validation,length:track.length,cars:offlineRace.standings().map(e=>({skin:e.car.skin,finished:e.finished,lap:e.lap,impacts:e.car.touringImpacts||0,distance:track.sample(e.car.pos.x,e.car.pos.y).s}))};})()`);
  console.log(JSON.stringify(result));
}while(result.steps<60000&&result.cars.some(c=>!c.finished));
if(result.cars.some(c=>!c.finished)||!Number.isFinite(result.maxBodyError)||result.maxBodyError>.15)process.exitCode=1;
fs.writeFileSync(new URL('../docs/summit-drive-validation.json','file://'+__filename),JSON.stringify(result,null,2)+'\n');
