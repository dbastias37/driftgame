const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const {harness}=require('./harness.cjs');
const snapshot=`({pos:player.pos,vel:player.vel,angle:player.angle,omega:player.omega,gear:player.gear,score:player.score,lives:player.lives,lap,raceTime,lapTime,state,progress,wrongTimer})`;
test('changing 2D / 3D is purely visual throughout the same replay',()=>{
  function replay(switchViews){const run=harness();run("startWithTrack(presetTrack(1),'tt');state='running';");for(let i=0;i<900;i++)run(`keys.clear();${i<620?"keys.add('w');":"keys.add('s');"}${i>100&&i<500?"keys.add('d');":""}${i>280&&i<360?"keys.add(' ');":""}${switchViews&&i%15===0?`setRenderView('${i%30===0?'2d':'3d'}');cycleCamera();`:''}simulate(SIM_DT);`);return run(snapshot);}
  assert.deepEqual(replay(false),replay(true));
});
test('view and camera switches preserve every part of the active race immediately',()=>{
  const run=harness();run("startWithTrack(presetTrack(2),'tt');state='running';keys.add('w');for(let i=0;i<120;i++)simulate(SIM_DT);");const before=run(snapshot);run("setRenderView('2d');setRenderView('3d');cycleCamera();cycleCamera();");assert.deepEqual(run(snapshot),before);
});
test('all four original vehicle tunings and manual / automatic transmissions remain',()=>{
  const run=harness();assert.equal(run('CAR_DATA.length'),6);assert.deepEqual(run('CAR_DATA.slice(0,4).map(c=>c.sprite)'),['blue','red','yellow','gray']);for(let i=0;i<4;i++){run(`carIdx=${i};chosen=CAR_DATA[carIdx];startWithTrack(presetTrack(1),'race');`);assert.equal(run('player.mass'),run('1200*chosen.tune.mass'));assert.equal(run('player.engineForce'),run('11800*chosen.tune.engine'));}
  run("player.auto=false;shiftManual(1)");assert.equal(run('player.gear'),2);run('shiftManual(-1)');assert.equal(run('player.gear'),1);
});
test('all 20 circuits retain valid closed geometry and complete lap gates',()=>{
  const run=harness();for(let i=1;i<=20;i++){run(`startWithTrack(presetTrack(${i}),'race');state='running';for(let j=0;j<track.points.length;j+=2)advanceLap(j,(j+2)%track.points.length);`);assert.equal(run('lap'),2);assert.ok(run('track.points.length')>20);assert.ok(run('track.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))'));}
  run("startWithTrack(presetTrack(1),'race');state='running';for(let j=0;j<300;j++){advanceLap(0,2);advanceLap(2,0);}");assert.equal(run('lap'),1);
});
test('countdown, pause and settings freeze simulation, resume restores it',()=>{
  const run=harness();run("startWithTrack(presetTrack(1),'race');for(let i=0;i<181;i++)simulate(SIM_DT);");assert.equal(run('state'),'running');run("keys.add('w');setPaused(true)");assert.equal(run('keys.size'),0);const before=run(snapshot);run('simulate(1);openSettings();simulate(1);closeSettings();');assert.deepEqual(run(snapshot),before);run('setPaused(false);simulate(SIM_DT)');assert.equal(run('state'),'running');assert.ok(run('raceTime')>before.raceTime);
});
test('finished, gameover and challengeWon remain terminal in both views',()=>{
  const run=harness();for(const ending of ['finished','gameover','challengeWon']){run(`startWithTrack(presetTrack(1),'race');state='${ending}';`);const before=run(snapshot);run("setRenderView('2d');simulate(1);setRenderView('3d');simulate(1);");assert.deepEqual(run(snapshot),before);}
});
test('life loss and restart are preserved; challenge progress persists',()=>{
  const run=harness();run("startWithTrack(presetTrack(1),'race');state='running';loseLifeAndRespawn();loseLifeAndRespawn();loseLifeAndRespawn();");assert.equal(run('player.lives'),0);assert.equal(run('state'),'gameover');run('restartRaceSameTrack()');assert.equal(run('player.lives'),3);assert.equal(run('state'),'countdown');run("mode='challenge';activeChallengeLevel=1;activeChallengeGoal=challengeRequiredPoints(1);state='running';player.score=activeChallengeGoal;checkChallengeProgress();");assert.equal(run('state'),'challengeWon');assert.equal(run("localStorage.getItem('challenge:unlocked')"),'2');
});
test('custom widths survive sharing and both TRK versions remain supported',()=>{
  const run=harness();assert.equal(run('decodeTrack(encodeSharedTrack(presetTrack(1))).roadHalf'),14);assert.equal(run('!!decodeTrack(encodeTrack(presetTrack(1).points))'),true);assert.equal(run("decodeTrack('TRK.'+b64u_enc(JSON.stringify(Array(8).fill([0,0]))))"),null);
});
test('ghost sampling and recording are unchanged across views',()=>{
  const run=harness();run("startWithTrack(presetTrack(1),'tt');lapTime=20;ghostSamples=Array.from({length:600},(_,i)=>({x:i,y:2*i,angle:.1*i}));onLap();startWithTrack(track,'tt');state='running';");assert.equal(run('ghost.data.time'),20);run("simulate(SIM_DT);setRenderView('2d');simulate(SIM_DT);setRenderView('3d');simulate(SIM_DT)");assert.ok(run('ghost.t')>0);assert.ok(run('ghostSamples.length')>0);
});
test('3D failure preserves the race and exposes 2D fallback',()=>{
  const run=harness();run("startWithTrack(presetTrack(1),'tt');state='running';keys.add('w');for(let i=0;i<90;i++)simulate(SIM_DT)");const before=run(snapshot);run("fail3D(new Error('test'))");assert.equal(run('renderPrefs.view'),'2d');assert.deepEqual(run(snapshot),before);
});
test('drivetrain, steering, integration and tire effects remain identical to the physics baseline',()=>{
  const baseline=fs.readFileSync(path.join(__dirname,'fixtures/car-v0.2.txt'),'utf8');
  const car=source.slice(source.indexOf('class Car{'),source.indexOf('class GhostCar{'));
  for(const [start,end] of [['  constructor(', '  _updateScoreAndTrail('],['  update(dt,input,track){','  hit(track,s){'],['  spawnTrails(',null]]){
    const section=text=>text.slice(text.indexOf(start),end?text.indexOf(end):undefined).replace(/  breakFlow\(\)\{[\s\S]*?\n  \}\n/,'').trim();
    assert.equal(section(car),section(baseline));
  }
  // Physical edge resistance is inside the scoring sampler; verify it separately.
  const contact=text=>text.slice(text.indexOf('    const ENTER='),text.indexOf('    const slip='));
  assert.equal(contact(car),contact(baseline));
});
