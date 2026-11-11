const {harness}=require('../tests/harness.cjs');
const ids=process.argv.slice(2).map(Number);if(!ids.length)ids.push(1,6,11,16);
for(const id of ids){
  if(!Number.isInteger(id)||id<1||id>20)throw new Error('ID de carretera: 1 a 20');
  const r=harness();
  r(`renderPrefs.rivals=4;renderPrefs.collisions=true;var trafficTrack=DriftTouring.createTrack(Track,${id});startWithTrack(trafficTrack,'race',{weather:trafficTrack.climate});offlineRace.laps=1;var roadTraffic={steps:0,off:0};`);
  const step=`(()=>{for(let i=0;i<3000&&!offlineRace.standings().every(e=>e.finished);i++){player.update(1/60,DriftRace.drive(player,track,undefined,[player,...offlineRivals]),track);DriftRoadContact.update(track,player,1/60,chosen.sprite);offlineRace.step(1/60);roadTraffic.off+=[player,...offlineRivals].filter(c=>c.offTrack).length;roadTraffic.steps++;}return {id:${id},climate:track.climate,steps:roadTraffic.steps,offFrames:roadTraffic.off,cars:offlineRace.standings().map(e=>({skin:e.car.skin,lap:e.lap,finished:e.finished,impacts:e.car.touringImpacts||0,speed:e.car.worldSpeed()}))}})()`;
  let result;do{result=r(step);}while(result.steps<36000&&result.cars.some(c=>!c.finished));
  console.log(JSON.stringify(result));if(result.offFrames||result.cars.some(c=>!c.finished))process.exitCode=1;
}
