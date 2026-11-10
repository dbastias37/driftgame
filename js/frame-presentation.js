/* Interpolate fixed-step poses for display only. Never feeds a pose back to physics. */
globalThis.DriftPresentation=(()=>{
  const mix=(a,b,t)=>a+(b-a)*t;
  const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  class Poses{
    constructor(){this.reset();}
    reset(){this.frames=new WeakMap();}
    before(car){
      if(!car)return;
      let f=this.frames.get(car);
      if(!f){f={view:Object.create(car),ride:{wheels:[]},wheels:[],descent:{}};f.view.pos={};f.view.vel={};this.frames.set(car,f);}
      f.x=car.pos.x;f.y=car.pos.y;f.vx=car.vel.x;f.vy=car.vel.y;f.angle=car.angle;f.steer=car.steerAngle;f.invuln=car.invuln;
      const r=car.ride;f.hasRide=!!r;
      if(r){f.height=r.height;f.roll=r.roll;f.pitch=r.pitch;r.wheels.forEach((w,i)=>{f.wheels[i]=w.height;f.ride.wheels[i]??={};});}
      const d=car.descent;f.motion=d?.motion;
      if(d){f.dy=d.y;f.droll=d.roll;f.dpitch=d.pitch;}
    }
    sample(car,t){
      const f=car&&this.frames.get(car);if(!f)return car;
      const dx=car.pos.x-f.x,dy=car.pos.y-f.y;
      // Recovery/teleports and transitions are cuts, never a sweep through the map.
      if(dx*dx+dy*dy>36||car.invuln>f.invuln||car.descent?.motion!==f.motion)return car;
      t=Math.max(0,Math.min(1,t));const v=f.view;
      v.pos.x=mix(f.x,car.pos.x,t);v.pos.y=mix(f.y,car.pos.y,t);
      v.vel.x=mix(f.vx,car.vel.x,t);v.vel.y=mix(f.vy,car.vel.y,t);
      v.angle=angle(f.angle,car.angle,t);v.steerAngle=mix(f.steer,car.steerAngle,t);
      if(f.hasRide&&car.ride){const r=car.ride,out=f.ride;Object.assign(out,r);out.wheels=f.renderWheels??=f.wheels.map(()=>({}));
        out.height=mix(f.height,r.height,t);out.roll=angle(f.roll,r.roll,t);out.pitch=angle(f.pitch,r.pitch,t);
        r.wheels.forEach((w,i)=>{Object.assign(out.wheels[i],w);out.wheels[i].height=mix(f.wheels[i],w.height,t);});v.ride=out;
      }else v.ride=car.ride;
      if(car.descent){Object.assign(f.descent,car.descent);f.descent.y=mix(f.dy,car.descent.y,t);f.descent.roll=angle(f.droll,car.descent.roll,t);f.descent.pitch=angle(f.dpitch,car.descent.pitch,t);v.descent=f.descent;}else v.descent=undefined;
      return v;
    }
  }
  return {Poses};
})();
