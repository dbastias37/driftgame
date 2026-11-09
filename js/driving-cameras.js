import * as T from '../vendor/three.module.min.js';
export const onboardCameras=new Set(['hood','fender','fenderRight','bumper','rear']);
export function onboardShot(mode,model,dimensions={}){
  const length=dimensions.length||4.4,width=dimensions.width||1.8;
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
  if(time<.9)position.addScaledVector(f,6.5-time*2).addScaledVector(side,-5).add(new T.Vector3(0,.6,0));
  else if(time<1.8)position.addScaledVector(f,-5).addScaledVector(side,3).add(new T.Vector3(0,1.3,0));
  else{const rows=Math.ceil(cars.length/2);position.addScaledVector(f,-11-(rows-1)*7).addScaledVector(side,-2*(1-Math.min(1,(time-1.8)/2))).add(new T.Vector3(0,5.3+(rows-1)*2,0));target.addScaledVector(f,-(rows-1)*3);}
  return {position,target,fov:time<1.8?52:58};
}
