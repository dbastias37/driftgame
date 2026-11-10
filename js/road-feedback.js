/* Presentation only: deterministic road vibration, measured in metres/radians.
 * Sampling never changes contacts, steering, grip, velocity or the race clock. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
export function roadFeedback(pose,time=0,{vehicle=.65,camera=.35,reduced=false}={}){
  const speed=Math.hypot(pose.vel?.x||0,pose.vel?.y||0),falling=pose.descent?.motion==='falling';
  const gain=reduced||falling?0:clamp((speed-1)/54,0,1),energy=gain*(.35+.65*gain);
  const x=pose.pos.x,y=pose.pos.y,phase=x*.72+y*.39+time*37.7;
  const wave=(offset=0)=>Math.sin(phase+offset)*.65+Math.sin(x*1.39-y*.53+time*53.3+offset*1.7)*.35;
  const body=energy*clamp(vehicle,0,2),view=energy*clamp(camera,0,2);
  return {heave:wave()*.011*body,roll:wave(2.3)*.0025*body,pitch:wave(4.8)*.002*body,
    wheels:[0,1,2,3].map(i=>(.5+.5*wave(i*1.9))*.007*body),
    cameraPitch:wave(1.7)*.002*view,cameraYaw:wave(3.1)*.0013*view,cameraRoll:wave(5.2)*.0008*view};
}
export function applyRoadFeedback(model,pose,time,settings){
  const v=roadFeedback(pose,time,settings);model.body.position.y+=v.heave;model.body.rotation.x+=v.roll;model.body.rotation.z+=v.pitch;
  model.wheels.forEach((w,i)=>w.steer.position.y+=v.wheels[i]);return v;
}
