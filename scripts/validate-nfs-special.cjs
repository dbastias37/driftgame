/* End-to-end fixed-step races with all five cars, contact, traffic and gates. */
const {harness}=require('../tests/harness.cjs'),fs=require('node:fs');
const report=[];
for(const id of [201,202,203]){
 const r=harness();r(`renderPrefs.rivals=4;renderPrefs.collisions=true;startWithTrack(DriftTouring.createTrack(Track,${id}),'race');offlineRace.laps=1;var v={steps:0,offFrames:0,maxAir:0,airFrames:0,maxGroundError:0,invalidStationJumps:0};for(const c of [player,...offlineRivals]){c.updateSmoke=()=>{};c._validationS=track.sample(c.pos.x,c.pos.y,c.ride.groundHeight).s;}`);
 let result;
 do{
  result=r(`(()=>{for(let i=0;i<3000&&!offlineRace.standings().every(e=>e.finished);i++){
   player.update(1/60,DriftRace.drive(player,track,undefined,[player,...offlineRivals],1/60),track);offlineRace.step(1/60);DriftRoadContact.update(track,player,1/60,player.skin);v.steps++;
   for(const c of [player,...offlineRivals]){const q=track.sample(c.pos.x,c.pos.y,c.ride.groundHeight);let ds=q.s-c._validationS;if(ds>track.length/2)ds-=track.length;if(ds<-track.length/2)ds+=track.length;if(Math.abs(ds)>10)v.invalidStationJumps++;c._validationS=q.s;v.offFrames+=Number(c.offTrack);if(c.ride.airborne){v.airFrames++;v.maxAir=Math.max(v.maxAir,c.ride.height-c.ride.groundHeight);}else v.maxGroundError=Math.max(v.maxGroundError,Math.abs(c.ride.height-DriftRoadContact.contacts(track,c,c.skin).height));}
  }return {id:track.touringId,name:track.layout.name,...v,length:track.length,cars:offlineRace.standings().map(e=>({skin:e.car.skin,finished:e.finished,lap:e.lap,impacts:e.car.touringImpacts||0}))}})()`);
  console.log(JSON.stringify(result));
 }while(result.steps<66000&&result.cars.some(c=>!c.finished));
 result.passed=result.cars.every(c=>c.finished)&&result.offFrames===0&&result.invalidStationJumps===0&&result.maxGroundError<.05&&Number.isFinite(result.maxAir);
 if(!result.passed)process.exitCode=1;report.push(result);
}
fs.writeFileSync(new URL('../docs/nfs-special-validation.json','file://'+__filename),JSON.stringify(report,null,2)+'\n');
