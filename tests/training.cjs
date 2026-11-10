const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

test('all starting grids leave every front bumper behind the finish line',()=>{
 const run=harness();run(`renderPrefs.rivals=3;startWithTrack(presetTrack(1),'race')`);
 assert(run(`(()=>{const p=track.point(0),a=track.tangentAt(0);return [player,...offlineRivals].every(c=>(c.pos.x-p.x)*Math.cos(a)+(c.pos.y-p.y)*Math.sin(a)+c.bodyDimensions.length/2<-.7)})()`));
 for(const mode of ['tt','challenge']){run(`startWithTrack(presetTrack(1),'${mode}')`);assert(run('player.pos.x+player.bodyDimensions.length/2<0'));}
 run("startWithTrack(DriftDownhill.createTrack(Track,1),'downhill')");assert(run('(()=>{const p=track.point(0),a=track.tangentAt(0);return (player.pos.x-p.x)*Math.cos(a)+(player.pos.y-p.y)*Math.sin(a)+player.bodyDimensions.length/2<0})()'));
});
test('six second positioning, throttle precharge, pause and GO preserve the grid until release',()=>{
 const r=harness();r(`renderPrefs.camera='fender';startWithTrack(presetTrack(1),'race');keys.add('w');var spawn={...player.pos};for(let i=0;i<360;i++)simulate(SIM_DT)`);
 assert.equal(r('countdown'),3);assert.deepEqual(r('player.pos'),r('spawn'));
 r('for(let i=0;i<90;i++)simulate(SIM_DT)');assert.equal(r('countdown'),2);assert.equal(r('renderPrefs.camera'),'chase');assert(r('DriftInstruments.telemetry(player).rpm>4000'));assert.equal(r('player.worldSpeed()'),0);assert.deepEqual(r('player.pos'),r('spawn'));
 r('setPaused(true)');const before=r('({pose:player.pos,time:startElapsed,rpm:DriftInstruments.telemetry(player).rpm})');r('for(let i=0;i<120;i++)simulate(SIM_DT)');assert.deepEqual(r('({pose:player.pos,time:startElapsed,rpm:DriftInstruments.telemetry(player).rpm})'),before);
 r("setPaused(false);keys.add('w');for(let i=0;i<91;i++)simulate(SIM_DT)");assert.equal(r('state'),'running');r('for(let i=0;i<15;i++)simulate(SIM_DT)');assert(r('player.worldSpeed()>0.5'));
});
test('training menu starts an open eight, keeps free apron drivable, and resets props on restart',()=>{
 const r=harness();r(`document.getElementById('btnModeTraining').click();confirmTrackPreview();document.getElementById('btnChooseStart').click();state='running';`);
 assert.equal(r('mode'),'training');assert(r('track.training'));assert(r('track.coneSpawns.length>100'));assert.equal(r('offlineRivals.length'),0);
 assert(r('track.coneSpawns.every(c=>Math.hypot(c.x,c.y)>=18)'));
 r(`player.pos={x:0,y:85};player.angle=0;player.vel={x:10,y:0};track.practice.last=null;for(let i=0;i<120;i++)simulate(SIM_DT)`);
 assert.equal(r('player.offTrack'),false);assert.equal(r('player.offTimer'),0);assert.equal(r('state'),'running');assert(r('player.pos.x>5'));
 r('track.practice.hits=5;restartRaceSameTrack()');assert.equal(r('track.practice.hits'),0);assert(r('track.practice.cones.every(c=>!c.down&&c.sleep)'));
});
test('cone impact transfers momentum, launches and tips a light solid, subtracts once and settles',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');state='running';var cone=track.practice.cones[0];var origin={x:cone.x,y:cone.y};player.angle=0;player.pos={x:cone.x-2.8,y:cone.y};player.vel={x:22,y:0};player.score=500;track.practice.last={...player.pos};`);
 const p=r('player.mass*player.vel.x');r('for(let i=0;i<10;i++){player.pos.x+=player.vel.x/60;track.practice.step(1/60,player)}');
 assert.equal(r('track.practice.hits'),1);assert.equal(r('player.score'),400);assert(r('cone.down&&cone.z>0'));assert(r('Math.hypot(cone.tiltX,cone.tiltY)>0.2'));assert(r('player.mass*player.vel.x')<p);
 r('player.pos={x:100,y:80};player.vel={x:0,y:0};track.practice.last={...player.pos};for(let i=0;i<2400;i++)track.practice.step(1/60,player)');
 assert.equal(r('cone.z'),0);assert(r('cone.sleep'));assert.equal(r('track.practice.hits'),1);assert.equal(r('player.score'),400);assert(r('Math.hypot(cone.x-origin.x,cone.y-origin.y)>8'));
 // A second collision with this already fallen cone is physical, not a second penalty.
 r('player.pos={x:cone.x-2,y:cone.y};player.angle=0;player.vel={x:10,y:0};track.practice.last={...player.pos};track.practice.step(1/60,player)');assert.equal(r('track.practice.hits'),1);
});
test('fast swept impact cannot skip a cone between ticks; a stationary car injects no energy',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');var c=track.practice.cones[0];player.angle=0;player.pos={x:c.x-6,y:c.y};player.vel={x:90,y:0};track.practice.last={...player.pos};player.pos.x+=9;track.practice.step(.1,player)`);assert(r('c.down'));assert.equal(r('track.practice.hits'),1);
 r(`track.practice.reset();c=track.practice.cones[0];player.pos={x:c.x-2,y:c.y};player.vel={x:0,y:0};player.omega=0;track.practice.last=null;for(let i=0;i<60;i++)track.practice.step(1/60,player)`);assert.equal(r('track.practice.hits'),0);assert.equal(r('player.worldSpeed()'),0);assert.equal(r('Math.hypot(c.vx,c.vy,c.vz)'),0);
});
test('eight laps require every ordered checkpoint, including both branches of the crossing',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');var run=track.practice;function visit(g){const i=Math.round(g*track.points.length/8),p=track.point(i),a=track.tangentAt(i);player.pos={...p};player.vel={x:10*Math.cos(a),y:10*Math.sin(a)};run.last={...p};run.step(1/60,player);}`);
 r('visit(8)');assert.equal(r('run.laps'),0);r('for(let g=1;g<=8;g++)visit(g)');assert.equal(r('run.laps'),1);r('visit(8)');assert.equal(r('run.laps'),1);
});
test('parking bounds deflect cars, arms open on approach, and training pause freezes props',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');state='running';player.pos={x:124,y:0};player.angle=0;player.vel={x:20,y:0};track.practice.last={...player.pos};track.practice.step(1/60,player)`);assert(r('player.vel.x<0'));assert(r('player.pos.x<123'));
 r('player.pos={x:-34,y:91};player.vel={x:0,y:0};track.practice.last={...player.pos};for(let i=0;i<150;i++)track.practice.step(1/60,player)');assert(r('track.practice.gateAngles[0]>1.4'));assert.equal(r('track.practice.gateAngles[1]'),0);
 r('setPaused(true)');const before=r('track.practice.time');r('for(let i=0;i<100;i++)simulate(SIM_DT)');assert.equal(r('track.practice.time'),before);
});
test('swept parking walls also close the exit-pocket corners at high speed',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');var run=track.practice;player.angle=0;player.pos={x:120,y:112};player.vel={x:90,y:0};run.last={...player.pos};player.pos.x+=9;run.step(.1,player)`);assert(r('player.pos.x<123'));assert(r('player.vel.x<0'));
});
test('cones transfer impact to other cones, charge each fallen prop once, and cannot overlap',()=>{
 const r=harness();r(`startWithTrack(DriftTraining.create(Track),'training');var run=track.practice,a=run.cones[0],b=run.cones[1];Object.assign(a,{x:0,y:0,vx:12,sleep:false,down:true,penalized:true});Object.assign(b,{x:.6,y:0});player.score=500;run.collideCones(player)`);
 assert(r('b.vx>0&&a.vx<12&&b.down'));assert(r('Math.hypot(a.x-b.x,a.y-b.y)>=.719'));assert.equal(r('player.score'),400);r('run.collideCones(player)');assert.equal(r('player.score'),400);
});
test('render loop rain clock advances before GO, freezes in pause and resumes without jumping',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'race');var frames=[];sceneView={render:p=>frames.push({time:p.weatherTime,dt:p.dt}),resetCamera(){}};sceneFailed=false;lastTS=0;for(let i=1;i<=60;i++)loop(i*1000/60)`);
 assert(r('frames.length>0'));assert.equal(r('raceTime'),0);assert(r('frames.at(-1).time>.95'));r('setPaused(true);for(let i=61;i<=120;i++)loop(i*1000/60)');const frozen=r('frames.at(-1).time');r('for(let i=121;i<=180;i++)loop(i*1000/60)');assert.equal(r('frames.at(-1).time'),frozen);r('performance.now=()=>3000;setPaused(false);for(let i=181;i<=210;i++)loop(i*1000/60)');assert(r('frames.at(-1).time')>frozen+.4);assert(r('frames.at(-1).time')<frozen+.6);
});
