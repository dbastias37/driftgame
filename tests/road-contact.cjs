const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const track={points:[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],roadHalf:14};
const ready=import('../js/road-contact.js').then(()=>globalThis.DriftRoadContact);
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('continuous rounded kerbs exist on both boundaries; asphalt and runoff remain flat',async()=>{
  const R=await ready,ground=R.terrain(track);
  for(const side of [-1,1]){
    close(ground.height(0,side*14.16),0);close(ground.height(0,side*14.51),.14);close(ground.height(0,side*14.86),0);
    for(const y of [0,1,10,13,15,18,35])close(ground.height(0,side*y),0);
  }
  const overlapping={points:[{x:-20,y:0},{x:20,y:0},{x:20,y:20},{x:-20,y:20}],roadHalf:14};
  close(R.terrain(overlapping).height(0,14.51),0);
  // A large imported diagonal must not allocate millions of spatial cells.
  const huge={points:[{x:-1e6,y:-1e6},{x:1e6,y:1e6},{x:-1e6,y:1e6}],roadHalf:14};
  close(R.terrain(huge).height(0,0),0);
});

test('each RX-7 wheel climbs the terrain, body rolls/pitches, and suspension settles',async()=>{
  const R=await ready,car={pos:{x:0,y:14.51-.768966},angle:0};R.reset(track,car,'yellow');
  const r=car.ride;close(r.wheels[0].height,0);close(r.wheels[1].height,.14);close(r.wheels[3].height,.14);
  close(r.height,.07);assert.ok(r.roll<-.08);close(r.pitch,0);
  car.pos.y=0;R.reset(track,car,'yellow');car.pos.y=14.51-.768966;
  for(let i=0;i<180;i++)R.update(track,car,1/60,'yellow');
  close(car.ride.height,.07,.0001);close(car.ride.roll,r.roll,.0001);
  const nose={pos:{x:0,y:14.51-1.343514},angle:Math.PI/2};R.reset(track,nose,'yellow');
  assert.ok(nose.ride.pitch>.04);close(nose.ride.roll,0);
  car.pos.y=0;for(let i=0;i<180;i++)R.update(track,car,1/60,'yellow');
  assert.ok(car.ride.height<.0001);assert.ok(Math.abs(car.ride.roll)<.0001);
});

test('fast and reverse transverse crossings excite suspension without changing planar movement',async()=>{
  const R=await ready;
  for(const sign of [-1,1]){
    const car={pos:{x:0,y:sign===1?13:17},angle:0,vel:{x:0,y:sign*60},omega:.2,gear:3,score:123,lives:3};
    R.reset(track,car,'yellow');let peak=0;
    for(let i=0;i<8;i++){
      car.pos.y+=sign;const original=JSON.stringify({...car,ride:null});
      R.update(track,car,1/60,'yellow');peak=Math.max(peak,car.ride.height);
      assert.equal(JSON.stringify({...car,ride:null}),original);
    }
    assert.ok(peak>.001,'A narrow curb cannot be skipped at 60 m/s');
  }
});

test('height physics runs identically in 2D/3D, freezes on pause and resets on respawn',()=>{
  function replay(toggle){
    const r=harness();r("startWithTrack(presetTrack(1),'tt');state='running';player.pos.y=-14.51+.768966;player.vel.y=-10;DriftRoadContact.reset(track,player,chosen.sprite);");
    for(let i=0;i<45;i++)r(`${toggle&&i%3===0?`setRenderView('${i%2?'2d':'3d'}');`:''}simulate(SIM_DT);`);
    return {r,state:r('({ride:player.ride,pos:player.pos,vel:player.vel,score:player.score})')};
  }
  const a=replay(false),b=replay(true);assert.deepEqual(a.state,b.state);
  a.r('setPaused(true);');const frozen=a.r('player.ride');a.r('simulate(1);');assert.deepEqual(a.r('player.ride'),frozen);
  a.r('respawnAtNearestCenter();');close(a.r('player.ride.height'),0);close(a.r('player.ride.vy'),0);
});

test('raised kerb vertices use the exact same height field and keep the original stripe colors',async()=>{
  const R=await ready,{raisedCurbGeometry}=await import('../js/track-surface.js');
  const geometry=raisedCurbGeometry(track),p=geometry.attributes.position,ground=R.terrain(track);
  let max=0;for(let i=0;i<p.count;i++){const height=p.getY(i)-.015;max=Math.max(max,height);close(height,ground.height(p.getX(i),p.getZ(i)),1e-6);}
  assert.ok(max>.139&&max<=.140001);geometry.dispose();
  const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'../js/view3d.js'),'utf8');
  assert.ok(source.includes("ctx.fillStyle='#c85837'"));assert.ok(source.includes("ctx.fillStyle='#d7cec0'"));
});
