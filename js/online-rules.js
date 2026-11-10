/* Shared fixed-step protocol. Inputs only cross the trust boundary; positions never do. */
globalThis.DriftNet = (() => {
  const VERSION=4, DT=1/60, SKINS=['blue','yellow','gray','yugo','fujiwara'];
  const FIELDS=['angle','steerAngle','steerTarget','steerVel','throttleSm','handbrake','handbrakeMix','gear','shiftTimer','omega','yawRate','redBlink','offTrack','offTimer','edgeShake','wrongWay','score','best','mult','driftTime','comboState','comboFlashTime','comboPoints','comboBreak','trailOn','trailGrace','driftBreakTimer','_lastTrailOn','invuln','braking','accelLong','accelLat','frontSlip','rearSlip','driveSlip'];
  function capture(car){return [car.pos.x,car.pos.y,car.vel.x,car.vel.y,...FIELDS.map(k=>car[k])];}
  function restore(car,s){car.pos.x=s[0];car.pos.y=s[1];car.vel.x=s[2];car.vel.y=s[3];FIELDS.forEach((k,i)=>car[k]=s[i+4]);}
  const pressure=v=>Math.round(Math.max(0,Math.min(1,Number(v)||0))*1000)/1000;
  function encode(input,seq,gear=0){return [seq,(input.accel?1:0)|(input.brake?2:0)|(input.handbrake?4:0),Math.round(Math.max(-1,Math.min(1,input.steerAxis||0))*1000)/1000,gear,pressure(input.accel),pressure(input.brake)];}
  function validCommand(c){return Array.isArray(c)&&(c.length===4||c.length===6)&&Number.isSafeInteger(c[0])&&c[0]>0&&c[0]<1e8&&Number.isInteger(c[1])&&c[1]>=0&&c[1]<=7&&Number.isFinite(c[2])&&Math.abs(c[2])<=1&&[-1,0,1].includes(c[3])&&(c.length===4||c.slice(4).every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
  function step(car,c,track,effects=true){
    if(!car.auto&&c[3]){car.gear=Math.max(1,Math.min(car.gearCount,car.gear+c[3]));car.shiftTimer=car.shiftDur;}
    const trail=car.spawnTrails,smoke=car.updateSmoke;
    if(!effects){car.spawnTrails=car.updateSmoke=()=>{};}
    const result=car.update(DT,{accel:c[4]??!!(c[1]&1),brake:c[5]??!!(c[1]&2),handbrake:!!(c[1]&4),steerAxis:c[2]},track);
    if(!effects){car.spawnTrails=trail;car.updateSmoke=smoke;}
    return result;
  }
  function configure(car,data,auto,conditions={}){
    globalThis.DriftOptions?.apply(car,conditions);
    car.skin=data.sprite;car.color=data.color;car.engineForce*=data.tune.engine;car.baseLatFriction*=data.tune.lat;car.handLatFriction*=data.tune.hand;car.dragLinear*=data.tune.drag;car.mass*=data.tune.mass;
    if(data.sprite==='yugo')globalThis.DriftYugo.configure(car);
    const fit=globalThis.DriftVehicleFit?.[data.sprite];
    if(fit){car.bodyDimensions={length:fit.length,width:fit.width,height:fit.height,cgHeight:fit.height*.46};globalThis.DriftRoadContact.alignWheelEffects(car,data.sprite);}
    globalThis.DriftRoadContact.alignWheelEffects(car,data.sprite);globalThis.DriftDynamics.configure(car,data.sprite);car.auto=auto;
  }
  function grid(car,track,slot){const n=track.normalAt(0),p=track.point(0);car.pos.x=p.x+n.x*(slot-1)*3.2;car.pos.y=p.y+n.y*(slot-1)*3.2;}
  function pose(car){return [car.pos.x,car.pos.y,car.angle,car.vel.x,car.vel.y,car.steerAngle,(car.handbrake?1:0)|(car.braking?2:0),car.accelLong||0,car.accelLat||0,car.frontSlip||0,car.rearSlip||0,car.driveSlip||0];}
  function interpolate(frames,at){
    if(!frames.length)return null;
    let a=frames[0],b=a;
    for(const f of frames){if(f.t<=at)a=f;else{b=f;break;}b=a;}
    if(a===b){const d=Math.max(0,Math.min(.1,(at-a.t)/1000));return [a.p[0]+a.p[3]*d,a.p[1]+a.p[4]*d,...a.p.slice(2)];}
    const u=Math.max(0,Math.min(1,(at-a.t)/(b.t-a.t))),p=a.p.map((v,i)=>v+(b.p[i]-v)*u);
    // Teleports (recovery) must never interpolate through the scenery.
    if(Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1])>18)return (u<1?a.p:b.p).slice();
    if(a.p.length>6)p[6]=(u<.5?a.p[6]:b.p[6])||0;
    p[2]=a.p[2]+Math.atan2(Math.sin(b.p[2]-a.p[2]),Math.cos(b.p[2]-a.p[2]))*u;return p;
  }
  const paint=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():null;
  return {VERSION,DT,SKINS,paint,capture,restore,encode,validCommand,step,configure,grid,pose,interpolate};
})();
