const {test}=require('node:test'),assert=require('node:assert/strict');
function canvas(){const c={width:64,height:64};c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createRadialGradient:()=>({addColorStop(){}}),fillRect(){}});return c;}
test('snow has continuous, distinct acceleration, braking, drift and reverse responses',async()=>{
  const {snowResponse,SNOW_STATES,SnowMotion}=await import('../js/snow-motion.js');
  const inputs=[{}, {speed:5}, {speed:18}, {speed:40}, {speed:20,acceleration:5}, {speed:20,acceleration:-6}, {speed:20,lateral:6}, {speed:6,forward:-6}];
  assert.deepEqual(inputs.map(snowResponse).map(r=>r.state),SNOW_STATES);
  assert(snowResponse({speed:40}).exposure>snowResponse({speed:0}).exposure);
  assert(snowResponse({speed:20,acceleration:6}).exposure>snowResponse({speed:20,acceleration:-6}).exposure);
  for(let speed=0;speed<60;speed+=.1){const a=snowResponse({speed}),b=snowResponse({speed:speed+.1});assert(Math.abs(a.width-b.width)<.0001);assert(Math.abs(a.exposure-b.exposure)<.0001);}
  const motion=new SnowMotion();for(let i=0;i<180;i++)motion.update({vel:{x:i/10,y:0},angle:0},1/60);
  assert(motion.acceleration>4);const before=motion.acceleration;motion.update({vel:{x:18,y:0}},0);assert.equal(motion.acceleration,before);
  motion.update({vel:{x:40,y:0}},1/60,true);assert.equal(motion.acceleration,0);
});
test('snow stays in world space, stretches with motion, pauses, and resets safely at cuts',async()=>{
  global.document={createElement:canvas};const T=await import('../vendor/three.module.min.js'),{WeatherEffects}=await import('../js/weather.js');
  const scene=new T.Scene(),world=new T.Group(),camera=new T.PerspectiveCamera(60,1,.1,100),track={elevated:false},player={vel:{x:0,y:0},angle:0};
  camera.position.set(0,4,0);camera.lookAt(0,4,-20);camera.updateMatrixWorld();const fx=new WeatherEffects(scene);
  const update=(time,dt=1/60,reset=false)=>{camera.updateMatrixWorld();fx.update({camera,world,track,player,time,dt,reset,weather:'snow'});};
  const averageLength=()=>{let sum=0;for(let i=0;i<100;i++){const a=i*18;sum+=Math.hypot(fx.positions[a]-fx.positions[a+6],fx.positions[a+1]-fx.positions[a+7],fx.positions[a+2]-fx.positions[a+8]);}return sum/100;};
  try{
    update(0);const start={...fx.flakes[0]},stillLength=averageLength();camera.position.x+=.5;player.vel.x=30;update(1/60);
    assert(Math.abs(fx.flakes[0].x-start.x)<.05,'Snow moved with camera instead of drifting in world space');assert(averageLength()>stillLength*1.3);
    const positions=Array.from(fx.positions),flake={...fx.flakes[0]};update(1/60,0);assert.deepEqual(fx.flakes[0],flake);assert.deepEqual(Array.from(fx.positions),positions);
    // A pause must preserve shape as well as position.
    update(1/60,0);assert(fx.positions.every(Number.isFinite));
    camera.position.x=1000;update(2,1/60,true);assert(fx.positions.every(Number.isFinite));assert(averageLength()<.15);
    assert.equal(fx.geometry.drawRange.count,Math.round(360*DriftOptions.weathers.snow.snow)*6);fx.update({camera,world,track,player,time:2.1,weather:'clear'});assert.equal(fx.geometry.drawRange.count,0);
    assert.equal(DriftOptions.weathers.snow.grip,DriftOptions.weathers.clear.grip);
  }finally{fx.dispose();}
});
