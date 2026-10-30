/* Shared road height and vertical suspension. Planar Car physics is untouched.
 * Loaded before the simulation and reused by the 3D mesh as a side-effect import.
 */
globalThis.DriftRoadContact ||= (()=>{
  'use strict';
  const curb=Object.freeze({start:.16,width:.70,height:.14,bands:6});
  const terrainCache=new WeakMap(),CELL=32;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function profile(offset){
    const t=(offset-curb.start)/curb.width;
    return t>0&&t<1?curb.height*Math.sin(Math.PI*t)**2:0;
  }
  function terrain(track){
    if(track.downhill)return {height:track.surfaceHeight};
    const previous=terrainCache.get(track);if(previous?.half===track.roadHalf)return previous;
    const grid=new Map(),longSegments=[],pad=track.roadHalf+curb.start+curb.width;
    track.points.forEach((p,i)=>{
      const q=track.points[(i+1)%track.points.length],dx=q.x-p.x,dy=q.y-p.y,len2=dx*dx+dy*dy;
      if(len2<1e-12)return;
      const segment={x:p.x,y:p.y,dx,dy,len2};
      const cellsX=Math.ceil((Math.abs(dx)+2*pad)/CELL)+1,cellsY=Math.ceil((Math.abs(dy)+2*pad)/CELL)+1;
      // Imported coordinates can be huge: do not fill a huge diagonal's bbox.
      if(cellsX*cellsY>256){longSegments.push(segment);return;}
      for(let x=Math.floor((Math.min(p.x,q.x)-pad)/CELL);x<=Math.floor((Math.max(p.x,q.x)+pad)/CELL);x++){
        for(let y=Math.floor((Math.min(p.y,q.y)-pad)/CELL);y<=Math.floor((Math.max(p.y,q.y)+pad)/CELL);y++){
          const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(segment);
        }
      }
    });
    const result={half:track.roadHalf,height(x,y){
      const local=grid.get(Math.floor(x/CELL)+','+Math.floor(y/CELL))||[];
      const segments=longSegments.length?local.concat(longSegments):local;if(!segments.length)return 0;
      let best=pad*pad;
      for(const p of segments){
        const t=clamp(((x-p.x)*p.dx+(y-p.y)*p.dy)/p.len2,0,1);
        best=Math.min(best,(x-p.x-t*p.dx)**2+(y-p.y-t*p.dy)**2);
      }
      return profile(Math.sqrt(best)-track.roadHalf);
    }};
    terrainCache.set(track,result);return result;
  }
  function wheelOffsets(skin){
    const front=skin==='yugo'?1.06:skin==='yellow'?1.343514:1.27,rear=skin==='yugo'?-1.09:skin==='yellow'?-1.137491:-1.3,side=skin==='yugo'?.654:skin==='yellow'?.768966:.98;
    return [{x:rear,z:-side},{x:rear,z:side},{x:front,z:-side},{x:front,z:side}];
  }
  function contacts(track,pose,skin){
    const ground=terrain(track),c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    const wheels=wheelOffsets(skin).map(p=>({...p,height:ground.height(pose.pos.x+c*p.x-s*p.z,pose.pos.y+s*p.x+c*p.z)}));
    const rear=(wheels[0].height+wheels[1].height)/2,front=(wheels[2].height+wheels[3].height)/2;
    const left=(wheels[0].height+wheels[2].height)/2,right=(wheels[1].height+wheels[3].height)/2;
    const length=wheels[2].x-wheels[0].x,width=wheels[1].z-wheels[0].z;
    return {wheels,height:rear+(front-rear)*(-wheels[0].x/length),roll:Math.atan2(left-right,width),pitch:Math.atan2(front-rear,length)};
  }
  function reset(track,car,skin){
    const pose=contacts(track,car,skin);
    car.ride={...pose,vy:0,vr:0,vp:0,lastX:car.pos.x,lastY:car.pos.y,lastAngle:car.angle,skin};
    return car.ride;
  }
  function update(track,car,dt,skin){
    if(!(dt>0))return;
    let r=car.ride;
    const moved=r?Math.hypot(car.pos.x-r.lastX,car.pos.y-r.lastY):Infinity;
    if(!r||r.skin!==skin||moved>20)return reset(track,car,skin);
    const da=Math.atan2(Math.sin(car.angle-r.lastAngle),Math.cos(car.angle-r.lastAngle));
    // Sweep the tire path so even a fast transverse crossing cannot skip a
    // narrow curb between 60 Hz simulation ticks. Springs run at <= 1/120 s.
    const count=Math.min(64,Math.max(1,Math.ceil(dt*120),Math.ceil((moved+Math.abs(da)*1.7)/.10))),h=dt/count;
    let target;
    for(let i=1;i<=count;i++){
      const t=i/count;
      target=contacts(track,{pos:{x:r.lastX+(car.pos.x-r.lastX)*t,y:r.lastY+(car.pos.y-r.lastY)*t},angle:r.lastAngle+da*t},skin);
      for(const [axis,velocity,k,damping] of [['height','vy',180,22],['roll','vr',140,20],['pitch','vp',140,20]]){
        r[velocity]+=(k*(target[axis]-r[axis])-damping*r[velocity])*h;
        r[axis]+=r[velocity]*h;
      }
      if(r.height<0){r.height=0;r.vy=Math.max(0,r.vy);}
    }
    r.wheels=target.wheels;r.lastX=car.pos.x;r.lastY=car.pos.y;r.lastAngle=car.angle;
  }
  return Object.freeze({curb,profile,terrain,wheelOffsets,contacts,reset,update});
})();
