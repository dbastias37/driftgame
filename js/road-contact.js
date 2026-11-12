/* Shared road height and spring/damper suspension driven by tyre forces.
 * Loaded before the simulation and reused by the 3D mesh as a side-effect import.
 */
globalThis.DriftRoadContact ||= (()=>{
  'use strict';
  const curb=Object.freeze({start:.16,width:.70,height:.14,bands:6});
  const terrainCache=new WeakMap(),surfaceCache=new WeakMap(),CELL=32;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function profile(offset){
    const t=(offset-curb.start)/curb.width;
    return t>0&&t<1?curb.height*Math.sin(Math.PI*t)**2:0;
  }
  function terrain(track){
    if(track.training)return {height:()=>0};
    if(track.downhill||track.elevated)return {height:track.surfaceHeight};
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
    const fit=globalThis.DriftVehicleFit?.[skin];
    if(fit)return [...fit.wheels].sort((a,b)=>Number(a.x>0)-Number(b.x>0)||a.z-b.z).map(({x,z})=>({x,z}));
    const front=skin==='fujiwara'?1.275775:skin==='yugo'?1.06:skin==='yellow'?1.343514:1.27,rear=skin==='fujiwara'?-1.122379:skin==='yugo'?-1.09:skin==='yellow'?-1.137491:-1.3,side=skin==='fujiwara'?.729235:skin==='yugo'?.654:skin==='yellow'?.768966:.98;
    return [{x:rear,z:-side},{x:rear,z:side},{x:front,z:-side},{x:front,z:side}];
  }
  // Exact segment distance, not the nearest vertex: one wheel may be on the
  // shoulder while the other three are still on asphalt. Cache only nearby
  // segments; imported kilometre-long edges must not allocate giant grids.
  function flatSurface(track,x,y){
    let cache=surfaceCache.get(track);
    if(!cache||cache.half!==track.roadHalf||cache.points!==track.points){
      const grid=new Map(),long=[],pad=track.roadHalf+4;
      track.points.forEach((p,i)=>{
        const q=track.points[(i+1)%track.points.length],dx=q.x-p.x,dy=q.y-p.y,l2=dx*dx+dy*dy;
        if(l2<1e-12)return;const segment={x:p.x,y:p.y,dx,dy,l2};
        const x0=Math.floor((Math.min(p.x,q.x)-pad)/CELL),x1=Math.floor((Math.max(p.x,q.x)+pad)/CELL),y0=Math.floor((Math.min(p.y,q.y)-pad)/CELL),y1=Math.floor((Math.max(p.y,q.y)+pad)/CELL);
        if((x1-x0+1)*(y1-y0+1)>256){long.push(segment);return;}
        for(let a=x0;a<=x1;a++)for(let b=y0;b<=y1;b++){const key=a+','+b;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(segment);}
      });
      cache={grid,long,half:track.roadHalf,points:track.points};surfaceCache.set(track,cache);
    }
    let best=Infinity;
    for(const list of [cache.grid.get(Math.floor(x/CELL)+','+Math.floor(y/CELL))||[],cache.long])for(const p of list){
      const t=clamp(((x-p.x)*p.dx+(y-p.y)*p.dy)/p.l2,0,1);
      best=Math.min(best,(x-p.x-t*p.dx)**2+(y-p.y-t*p.dy)**2);
    }
    return Math.sqrt(best);
  }
  function surface(track,x,y,wetness=0,referenceHeight){
    if(!track?.points?.length)return {kind:'asphalt',height:0,wetness,gx:0,gy:0};
    if(track.training)return {kind:'asphalt',height:0,wetness,gx:0,gy:0};
    const q=(track.downhill||track.elevated)?track.sampleNearby(x,y,referenceHeight):null;
    const distance=q?.distance??((track.downhill||track.elevated)?Infinity:flatSurface(track,x,y));
    const edge=distance-(q&&track.widthAt?track.widthAt(q.s):track.roadHalf),outer=track.downhill?1.3:track.elevated?track.cutHalf-track.roadHalf:4;
    const feature=q&&track.featureAt?.(q.s),sheltered=feature?.kind==='tunnel';
    const kind=edge<=curb.start?'asphalt':track.curbs!==false&&edge<=curb.start+curb.width?'curb':edge<=outer?(feature?'concrete':'gravel'):'grass';
    const grade=q?(track.downhill?-q.grade:q.grade):0,bank=q?.bank?Math.tan(q.bank):0,c=Math.cos(q?.tang||0),s=Math.sin(q?.tang||0);
    return {kind,distance,height:q?track.surfaceHeight(x,y,referenceHeight):(track.downhill||track.elevated)?track.terrainHeight(x,y):profile(edge),wetness:sheltered?0:clamp(wetness,0,1),gx:grade*c-bank*s,gy:grade*s+bank*c};
  }
  function curbWheels(track,pose,skin){
    if(track.curbs===false||!track?.points?.length||pose.descent?.motion==='falling')return 0;
    const c=Math.cos(pose.angle),s=Math.sin(pose.angle),ground=terrain(track);let count=0;
    for(const p of wheelOffsets(skin)){
      const x=pose.pos.x+c*p.x-s*p.z,y=pose.pos.y+s*p.x+c*p.z;
      const q=(track.downhill||track.elevated)?track.sampleNearby(x,y,pose.ride?.groundHeight):null;
      const raised=(track.downhill||track.elevated)?(q?profile(q.distance-track.roadHalf):0):ground.height(x,y);
      if(raised>.005)count++;
    }
    return count;
  }
  function contacts(track,pose,skin){
    const ground=terrain(track),c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    const wheels=wheelOffsets(skin).map(p=>({...p,height:ground.height(pose.pos.x+c*p.x-s*p.z,pose.pos.y+s*p.x+c*p.z,pose.referenceHeight??pose.ride?.groundHeight)}));
    const rear=(wheels[0].height+wheels[1].height)/2,front=(wheels[2].height+wheels[3].height)/2;
    const left=(wheels[0].height+wheels[2].height)/2,right=(wheels[1].height+wheels[3].height)/2;
    const length=wheels[2].x-wheels[0].x,width=wheels[1].z-wheels[0].z;
    return {wheels,height:rear+(front-rear)*(-wheels[0].x/length),roll:Math.atan2(left-right,width),pitch:Math.atan2(front-rear,length)};
  }
  function reset(track,car,skin,referenceHeight){
    const pose=contacts(track,{pos:car.pos,angle:car.angle,referenceHeight},skin);
    globalThis.DriftWheelParticles?.reset(car);
    globalThis.DriftDynamics?.reset(car);
    car.ride={...pose,groundHeight:pose.height,groundVy:Math.tan(pose.pitch)*((car.vel?.x||0)*Math.cos(car.angle)+(car.vel?.y||0)*Math.sin(car.angle))-Math.tan(pose.roll)*(-(car.vel?.x||0)*Math.sin(car.angle)+(car.vel?.y||0)*Math.cos(car.angle)),flightVy:0,airborne:false,airTime:0,landing:0,cooldown:0,vy:0,vr:0,vp:0,lastX:car.pos.x,lastY:car.pos.y,lastAngle:car.angle,skin};
    return car.ride;
  }
  // Contact is unilateral: the road can push a tyre upwards, never pull it
  // down across a crest. Height and vertical momentum survive loss of support.
  function mountainUpdate(track,car,dt,skin,r){
    const dx=car.pos.x-r.lastX,dy=car.pos.y-r.lastY,da=Math.atan2(Math.sin(car.angle-r.lastAngle),Math.cos(car.angle-r.lastAngle));
    const speed=Math.hypot(car.vel?.x||0,car.vel?.y||0),ux=speed>.1?car.vel.x/speed:Math.cos(car.angle),uy=speed>.1?car.vel.y/speed:Math.sin(car.angle);
    const count=Math.max(1,Math.ceil(dt*120)),h=dt/count,handling=car.handling||{},stiffness=car.suspensionTune?.stiffness||1;
    let target;
    for(let i=1;i<=count;i++){
      const pose={pos:{x:r.lastX+dx*i/count,y:r.lastY+dy*i/count},angle:r.lastAngle+da*i/count,referenceHeight:r.groundHeight};
      target=contacts(track,pose,skin);
      const span=2,a=contacts(track,{pos:{x:pose.pos.x-ux*span,y:pose.pos.y-uy*span},angle:pose.angle,referenceHeight:r.groundHeight},skin).height,b=contacts(track,{pos:{x:pose.pos.x+ux*span,y:pose.pos.y+uy*span},angle:pose.angle,referenceHeight:r.groundHeight},skin).height;
      const tangentVy=(b-a)/(2*span)*speed,normalAcceleration=(a+b-2*target.height)/(span*span)*speed*speed;
      r.cooldown=Math.max(0,r.cooldown-h);r.landing=Math.max(0,r.landing-h*3);
      if(!r.airborne&&speed>5&&Math.hypot(dx,dy)>.001&&!r.cooldown&&normalAcceleration<-10.2){
        r.airborne=true;r.airTime=0;r.flightVy=r.groundVy;r.height=r.groundHeight;
      }
      if(r.airborne){
        r.height+=r.flightVy*h-.5*9.81*h*h;r.flightVy-=9.81*h;r.airTime+=h;
        // Free attitude retains the launch pitch, with gentle aerodynamic damping.
        r.vp*=Math.exp(-h*3);r.vr*=Math.exp(-h*3);r.pitch+=r.vp*h;r.roll+=r.vr*h;
        const floor=Math.max(...target.wheels.map(w=>w.height-w.x*Math.tan(r.pitch)+w.z*Math.tan(r.roll)));
        const feature=track.featureAt?.(track.sample(pose.pos.x,pose.pos.y,r.groundHeight).s,'tunnel');
        if(feature?.clearance){const roof=target.height+feature.clearance-(car.bodyDimensions?.height||1.4);if(r.height>roof){r.height=roof;r.flightVy=Math.min(0,r.flightVy);}}
        if(r.height<=floor+.005&&r.flightVy<=tangentVy){
          r.landing=clamp((tangentVy-r.flightVy)/9,0,1);r.airborne=false;r.cooldown=.14;r.flightVy=0;r.airTime=0;r.height=target.height;
        }else if(r.height<floor)r.height=floor;
      }
      if(!r.airborne){
        r.height=target.height;r.groundVy=tangentVy;
        const roll=target.roll-clamp((car.accelLat||0)/9.81*(handling.roll||.075)*1.24/stiffness,-.19,.19),pitch=target.pitch+clamp((car.accelLong||0)/9.81*(handling.pitch||.055)*1.24/stiffness,-.14,.14);
        for(const [axis,velocity,value,k,damping] of [['roll','vr',roll,(handling.spring||62)*.88,(handling.damp||10)*.94],['pitch','vp',pitch,(handling.spring||62)*1.02,(handling.damp||10)*1.03]]){
          r[velocity]+=(k*stiffness*(value-r[axis])-damping*(car.suspensionTune?.damping||1)*r[velocity])*h;r[axis]+=r[velocity]*h;
        }
      }
      r.groundHeight=target.height;
    }
    // All four wheels travel with the chassis in flight; none remain glued to
    // the surface. Existing pose interpolation and replay store these heights.
    r.wheels=r.airborne?wheelOffsets(skin).map(w=>({...w,height:r.height+w.x*Math.tan(r.pitch)-w.z*Math.tan(r.roll)})):target.wheels;
    r.lastX=car.pos.x;r.lastY=car.pos.y;r.lastAngle=car.angle;
  }
  function update(track,car,dt,skin){
    if(!(dt>0))return;
    let r=car.ride;
    const moved=r?Math.hypot(car.pos.x-r.lastX,car.pos.y-r.lastY):Infinity;
    if(!r||r.skin!==skin||moved>20)return reset(track,car,skin);
    if(track.elevated)return mountainUpdate(track,car,Math.min(dt,.1),skin,r);
    const da=Math.atan2(Math.sin(car.angle-r.lastAngle),Math.cos(car.angle-r.lastAngle));
    // Sweep the tire path so even a fast transverse crossing cannot skip a
    // narrow curb between 60 Hz simulation ticks. Springs run at <= 1/120 s.
    // Smooth touring asphalt needs only the suspension integration rate. Keep
    // the fine tyre sweep whenever any wheel can reach a kerb this tick.
    const clearRibbon=track.elevated&&track.sample(car.pos.x,car.pos.y).distance+2.6+moved<track.roadHalf;
    const count=Math.min(64,Math.max(1,Math.ceil(dt*120),clearRibbon?1:Math.ceil((moved+Math.abs(da)*1.7)/.10))),h=dt/count;
    let target;
    for(let i=1;i<=count;i++){
      const t=i/count;
      target=contacts(track,{pos:{x:r.lastX+(car.pos.x-r.lastX)*t,y:r.lastY+(car.pos.y-r.lastY)*t},angle:r.lastAngle+da*t},skin);
      const handling=car.handling||{},stiffness=car.suspensionTune?.stiffness||1;
      target.roll-=clamp((car.accelLat||0)/9.81*(handling.roll||.075)*1.24/stiffness,-.19,.19);
      target.pitch+=clamp((car.accelLong||0)/9.81*(handling.pitch||.055)*1.24/stiffness,-.14,.14);
      for(const [axis,velocity,k,damping] of [['height','vy',145,19],['roll','vr',(handling.spring||62)*.88,(handling.damp||10)*.94],['pitch','vp',(handling.spring||62)*1.02,(handling.damp||10)*1.03]]){
        r[velocity]+=(k*(car.suspensionTune?.stiffness||1)*(target[axis]-r[axis])-damping*(car.suspensionTune?.damping||1)*r[velocity])*h;
        r[axis]+=r[velocity]*h;
      }
      // Zero is the floor only on flat circuits. Mountain assets use signed
      // world elevations; clamping them separates the body from its wheels.
      if(!track.elevated&&!track.downhill&&r.height<0){r.height=0;r.vy=Math.max(0,r.vy);}
    }
    r.wheels=target.wheels;r.lastX=car.pos.x;r.lastY=car.pos.y;r.lastAngle=car.angle;
  }
  function alignWheelEffects(car,skin){
    car._wheelEffectSkin=skin;
    if(car._wheelEffectsAligned)return;
    car._wheelEffectsAligned=true;
    const spawn=car.spawnTrails,update=car.update;
    car.update=function(dt,input,track){this.braking=!!input.brake;return update.call(this,dt,input,track);};
    const align=(f,r,side)=>{
      const rear=wheelOffsets(car._wheelEffectSkin).find(p=>p.x<0&&(p.z>0)===(side>0));
      return {x:f.x*(rear.x+car.length*.5)+r.x*(rear.z-side*.9),y:f.y*(rear.x+car.length*.5)+r.y*(rear.z-side*.9)};
    };
    car.spawnTrails=function(f,r,dt,int){const previous=this.tireTrails.at(-1);spawn.call(this,f,r,dt,int);const t=this.tireTrails.at(-1);if(t&&t!==previous)for(const [side,n]of[[-1,1],[1,2]]){const d=align(f,r,side);t['x'+n]+=d.x;t['y'+n]+=d.y;}};
  }
  return Object.freeze({curb,profile,terrain,surface,wheelOffsets,curbWheels,contacts,reset,update,alignWheelEffects});
})();
