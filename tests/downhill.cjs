const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const boot="startWithTrack(DriftDownhill.createTrack(Track,1),'downhill');state='running';";
test('twenty distinct open mountain routes descend continuously, with separated hairpins and no finish/start shortcut',()=>{
 const r=harness();const routes=r('Array.from({length:20},(_,i)=>{const t=DriftDownhill.createTrack(Track,i+1);return {points:t.points,half:t.roadHalf,finish:t.finishS,length:t.length,drop:t.drop,goal:t.goal,start:t.sample(t.points[0].x,t.points[0].y),end:t.sample(t.points.at(-1).x,t.points.at(-1).y)}})');
 assert.equal(routes.length,20);
 for(const t of routes){assert.ok(t.length>1500&&t.length<5500);assert.ok(t.finish<t.length);assert.ok(t.drop>100);assert.ok(t.start.s<.001);assert.ok(t.end.s>t.finish);
  for(let i=1;i<t.points.length;i++){const a=t.points[i-1],b=t.points[i];assert.ok(b.h<a.h);assert.ok(b.s>a.s);assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<3.01);for(let j=i+30;j<t.points.length;j+=5){const q=t.points[j];assert.ok(Math.hypot(q.x-b.x,q.y-b.y)>t.half*2+4,'Unrelated road sections intersect');}}
 }
});
test('gravity respects the slope and mass; coasting accelerates while brakes hold a stopped car',()=>{
 const r=harness();assert.deepEqual(r('(()=>{const a=DriftDownhill.gravity({grade:0,tang:0},1000),b=DriftDownhill.gravity({grade:.1,tang:0},1000),c=DriftDownhill.gravity({grade:.1,tang:0},2000);return {flat:a.x,independent:b.x===c.x,doubleForce:c.force===2*b.force}})()'),{flat:0,independent:true,doubleForce:true});
 r(boot+'for(let i=0;i<300;i++)simulate(SIM_DT)');assert.ok(r('player.worldSpeed()')>3);assert.ok(r('player.descent.s')>8);assert.equal(r('player.score'),0);
 r(boot+"keys.add('s');for(let i=0;i<300;i++)simulate(SIM_DT)");assert.equal(r('player.worldSpeed()'),0);assert.equal(r('player.descent.s'),0);
});
test('more mass preserves more momentum under the same braking force',()=>{
 const r=harness(),distances=[];for(const mass of [900,1600]){r(boot+`player.mass=${mass};player.vel.x=20;keys.add('s');for(let i=0;i<60;i++)simulate(SIM_DT);`);distances.push(r('player.descent.s'));}assert.ok(distances[1]>distances[0]+2);
});
test('off-road fall has vertical and angular momentum; R restores the last safe checkpoint, never the nearest lower road',()=>{
 const r=harness();r(boot+"var p=track.atDistance(140),n=track.normalAt(p.i);player.pos={x:p.x,y:p.y};player.angle=track.tangentAt(p.i)+Math.PI/2;player.vel={x:n.x*20,y:n.y*20};player.descent.s=player.descent.maxS=140;player.descent.checkpoint=120;DriftRoadContact.reset(track,player,chosen.sprite);player.score=1234;for(let i=0;i<180&&player.descent.motion!=='falling';i++)simulate(SIM_DT);");
 assert.equal(r('player.descent.motion'),'falling');const h=r('player.descent.y');r('for(let i=0;i<120;i++)simulate(SIM_DT)');assert.ok(r('player.descent.y')<h-1);assert.ok(r('Math.abs(player.descent.roll)')>.1);assert.equal(r('player.score'),1234);
 r('loseLifeAndRespawn()');assert.equal(r('player.lives'),2);assert.equal(r('player.descent.s'),120);assert.equal(r('player.descent.motion'),'driving');assert.equal(r('player.worldSpeed()'),0);assert.ok(Math.abs(r('player.ride.height')-r('track.surfaceHeight(player.pos.x,player.pos.y)'))<.02);
});
test('teleporting or falling onto a lower switchback cannot advance sprint progress or finish',()=>{
 const r=harness();r(boot+"var before={...player.pos,s:0},p=track.atDistance(track.finishS);player.pos={x:p.x,y:p.y};var outcome=DriftDownhill.advance(track,player,before,1/60);");assert.equal(r('outcome.finished'),false);assert.equal(r('player.descent.maxS'),0);
 r("player.descent.motion='falling';player.descent.s=track.finishS-1;outcome=DriftDownhill.advance(track,player,{...player.pos,s:track.finishS-1},1/60)");assert.equal(r('outcome.valid'),false);assert.equal(r('outcome.finished'),false);
});
test('score is judged only at the 100% finish; success/failure freeze time and persist separately',()=>{
 for(const win of [false,true]){const r=harness();r(boot+`player.score=${win?'track.goal+100':'0'};simulate(SIM_DT);`);assert.equal(r('state'),'running');
  r("for(const p of track.points){if(p.s>=track.finishS-.5)break;const before={...player.pos,s:player.descent.s};player.pos={x:p.x,y:p.y};DriftDownhill.advance(track,player,before,1/60);}var p=track.atDistance(track.finishS-.08),a=track.tangentAt(p.i);player.pos={x:p.x,y:p.y};player.angle=a;player.vel={x:Math.cos(a)*10,y:Math.sin(a)*10};player.descent.s=player.descent.maxS=track.finishS-.08;DriftRoadContact.reset(track,player,chosen.sprite);simulate(SIM_DT);");
  assert.equal(r('state'),win?'downhillWon':'downhillFailed');assert.equal(r('player.descent.s'),r('track.finishS'));const time=r('raceTime');r('simulate(1)');assert.equal(r('raceTime'),time);assert.equal(r("!!localStorage.getItem('downhill:v2:1')"),win);assert.equal(r("localStorage.getItem('challenge:unlocked')"),null);
 }
});
test('pause, 2D/3D switches and restart preserve downhill dynamics and reset the sprint coherently',()=>{
 function replay(switching){const r=harness();r(boot+'keys.add("w")');for(let i=0;i<180;i++)r(`${switching&&i%15===0?"setRenderView(renderPrefs.view==='2d'?'3d':'2d');":''}simulate(SIM_DT);`);return r('({pos:player.pos,vel:player.vel,ride:player.ride,descent:player.descent,score:player.score})');}assert.deepEqual(replay(false),replay(true));
 const r=harness();r(boot+'for(let i=0;i<60;i++)simulate(SIM_DT);setPaused(true);var before=JSON.stringify(player);simulate(1);');assert.equal(r('JSON.stringify(player)===before'),true);r('restartRaceSameTrack()');assert.equal(r('state'),'countdown');assert.equal(r('player.descent.s'),0);assert.equal(r('player.lives'),3);
});
test('Cerro abajo goes through reconnaissance and the final garage, retaining the chosen descent',()=>{
 const r=harness();r("$('#btnModeDownhill').click();previewDownhill(3);confirmTrackPreview();");assert.equal(r('mode'),'downhill');assert.equal(r('preparedTrack.routeLevel'),3);r('returnToTrackPreview()');assert.equal(r('previewSelection.track.routeLevel'),3);r("confirmTrackPreview();$('#btnChooseStart').click()");assert.equal(r('track.downhill'),true);assert.equal(r('player.descent.s'),0);
});

test('route identities, normalized shapes and grades vary; thumbnail layouts reuse no physics grid',()=>{
 const r=harness();assert.equal(r('DriftDownhill.count'),20);
 const data=r(`Array.from({length:20},(_,i)=>{const t=DriftDownhill.createTrack(Track,i+1),b=t.bounds;return {name:t.layout.name,grade:t.drop/t.length,half:t.roadHalf,shape:Array.from({length:41},(_,j)=>{const p=t.atDistance(j*t.length/40);return [(p.x-b.minX)/b.w,(p.y-b.minY)/b.h]}),local:t.points.slice(1).map((p,j)=>(t.points[j].h-p.h)/(p.s-t.points[j].s))}})`);
 assert.equal(new Set(data.map(t=>t.name)).size,20);assert.ok(Math.max(...data.map(t=>t.grade))-Math.min(...data.map(t=>t.grade))>.09);
 for(let i=0;i<data.length;i++){const t=data[i];assert.ok(Math.max(...t.local)-Math.min(...t.local)>.025);assert.ok(Math.min(...t.local)>.03);assert.ok(Math.max(...t.local)<.23);
  for(let j=i+1;j<data.length;j++){const d=t.shape.reduce((sum,p,k)=>sum+Math.hypot(p[0]-data[j].shape[k][0],p[1]-data[j].shape[k][1]),0)/t.shape.length;assert.ok(d>.065,`Routes ${i+1}/${j+1} have too similar silhouettes: ${d}`);}
 }
 assert.equal(r('DriftDownhill.layout(20)===DriftDownhill.layout(20)'),true);assert.equal(r('typeof DriftDownhill.layout(20).sample'),'undefined');
});
test('a sustained shoulder excursion and clean re-entry resume progress without R or a lost life',()=>{
 const r=harness();r(boot+`var p=track.atDistance(100);player.pos={x:p.x,y:p.y};player.descent.s=player.descent.maxS=100;player.vel={x:20,y:0};
 for(let s=100.3;s<125;s+=.3){const before={...player.pos,s:player.descent.s},p=track.atDistance(s),n=track.normalAt(p.i),offset=s<103?(s-100)/3*(track.roadHalf+1.2):s<120?track.roadHalf+1.2:Math.max(0,(125-s)/5)*(track.roadHalf+1.2);player.pos={x:p.x+n.x*offset,y:p.y+n.y*offset};var outcome=DriftDownhill.advance(track,player,before,1/60);if(outcome.respawn)throw Error('Ordinary re-entry forced a reset');}`);
 assert.ok(r('player.descent.s')>124);assert.equal(r('player.lives'),3);assert.equal(r('player.descent.routeLostTime'),0);
 r('var before={...player.pos,s:player.descent.s},p=track.atDistance(126);player.pos={x:p.x,y:p.y};var outcome=DriftDownhill.advance(track,player,before,1/60)');assert.equal(r('outcome.valid'),true);assert.ok(r('player.descent.maxS')>125.9);
});
test('invalid lower-road re-entry automatically recovers rather than freezing at zero progress',()=>{
 const r=harness();r(boot+`var p=track.atDistance(400);player.pos={x:p.x,y:p.y};player.vel={x:0,y:0};var before={...player.pos,s:0};for(let i=0;i<50;i++)var outcome=DriftDownhill.advance(track,player,before,1/60);`);assert.equal(r('outcome.respawn'),true);assert.equal(r('player.descent.maxS'),0);assert.equal(r('outcome.finished'),false);
});
