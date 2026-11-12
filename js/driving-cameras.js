import * as T from '../vendor/three.module.min.js';
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
// Follow the path through world space, not the yaw of the sliding body. Keep
// the last reliable direction near rest so tire jitter cannot orbit the camera.
export class ChaseHeading{
  constructor(){this.reset();}
  reset(){this.yaw=null;this.reversing=false;}
  update(player,dt){
    const body=Number.isFinite(player.angle)?player.angle:0;
    const vx=Number.isFinite(player.vel?.x)?player.vel.x:0,vz=Number.isFinite(player.vel?.y)?player.vel.y:0;
    const speed=Math.hypot(vx,vz),longitudinal=vx*Math.cos(body)+vz*Math.sin(body);
    if(this.yaw===null){
      // A camera cut into an already reversing car must use the same side as
      // a continuous stop/reverse. High-speed spins never select reverse.
      this.reversing=speed<8&&longitudinal<-.6;
      this.yaw=speed>=1.2?Math.atan2(vz,vx)+(this.reversing?Math.PI:0):body;
      return this.yaw;
    }
    const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(dt,.25)):0;
    if(!elapsed||speed<.7)return this.yaw;
    // Change driving direction only near a stop, with a dead zone. Once moving,
    // countersteer/body rotation cannot reinterpret a drift as reverse driving.
    if(speed<2.5){
      if(longitudinal<-.6)this.reversing=true;
      else if(longitudinal>.6)this.reversing=false;
    }
    const direction=Math.atan2(vz,vx)+(this.reversing?Math.PI:0);
    const confidence=Math.min(1,(speed-.7)/2.3);
    const blend=1-Math.exp(-elapsed*3.5*confidence*confidence);
    this.yaw+=angleDifference(direction,this.yaw)*blend;
    return this.yaw;
  }
}
// Keep the original distance, height, look-ahead and speed-based FOV for every
// model. The independent path heading above leaves the rear free during drift.
export function chaseShot(position,target,point,forward,speed,reduced=false){
  const distance=12.5+Math.min(speed,45)*.075;
  position.set(point.x-forward.x*distance,6.5,point.y-forward.z*distance);
  target.set(point.x+forward.x*7,.6,point.y+forward.z*7);
  return 58+(reduced?0:Math.min(speed*.12,7));
}
export const onboardCameras=new Set(['hood','fender','fenderRight','bumper','rear']);
export function onboardShot(mode,model,dimensions={}){
  const length=dimensions?.length||4.4,width=dimensions?.width||1.8;
  let eye,look;
  if(mode==='fender'||mode==='fenderRight'){const side=mode==='fender'?-1:1;eye=[length*.12,.72,side*(width*.5+.30)];look=[length*5,.68,side*(width*.5+.75)];}
  else if(mode==='bumper'){eye=[length*.5+.16,.38,0];look=[length*7,.5,0];}
  else if(mode==='rear'){eye=[-length*.39,1.05,0];look=[-length*7,.65,0];}
  else{eye=[length*.17,1.23,0];look=[length*7,1.05,0];}
  model.body.updateWorldMatrix(true,false);
  return {position:model.body.localToWorld(new T.Vector3(...eye)),target:model.body.localToWorld(new T.Vector3(...look)),fov:mode==='bumper'?82:mode==='rear'?70:76};
}
export function startShot(cars,time){
  const car=cars[0],p=car.pos,a=car.angle,f=new T.Vector3(Math.cos(a),0,Math.sin(a)),side=new T.Vector3(-f.z,0,f.x),center=new T.Vector3(p.x,(car.ride?.height||0)+.7,p.y);
  let position=center.clone(),target=center.clone();
  if(time<2.2)position.addScaledVector(f,8-time*.65).addScaledVector(side,-5.5).add(new T.Vector3(0,.8,0));
  else if(time<4.2)position.addScaledVector(f,-6).addScaledVector(side,4.5).add(new T.Vector3(0,1.8,0));
  else{
    const rows=Math.ceil(cars.length/2),u=Math.min(1,Math.max(0,(time-4.2)/1.8)),ease=u*u*(3-2*u);
    position.addScaledVector(f,-(13+(rows-1)*6)*(1-ease)-12.5*ease).addScaledVector(side,-3*(1-ease));position.y+=(6.5+(rows-1)*2)*(1-ease)+5.8*ease;
    target.addScaledVector(f,-(rows-1)*3*(1-ease)+7*ease);target.y-=.1*ease;
  }
  return {position,target,fov:time<4.2?52:58};
}
