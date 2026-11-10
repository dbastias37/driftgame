/* Frame-rate independent tyre smoke, shared by every car. Rendering is separate. */
globalThis.DriftTireSmoke=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function update(car,dt,f,r,slip,kmh,vlat){
    if(!(dt>=0))return;
    const particles=car.smoke,volume=car.cosmetics?.smokeVolume||1,limit=car.smokeLimit||800;
    const friction=Math.max(Math.abs(car.rearSlip||0),slip,car.driveSlip||0),active=!car.offTrack&&car.descent?.motion!=='falling'&&kmh>8&&(car.trailOn||friction>.19||car.handbrake);
    const intensity=active?clamp((friction-.09)/.48,.15,1)*clamp(kmh/75,.2,1):0;
    car.smokeAcc+=intensity*(16+28*Math.sqrt(volume))*dt;
    const old=car._smokeEmitter,now=car.pos;
    const continuous=old&&Math.hypot(now.x-old.x,now.y-old.y)<12;
    const count=Math.min(12,Math.floor(car.smokeAcc));car.smokeAcc-=count;
    const wheels=globalThis.DriftRoadContact.wheelOffsets(car.skin||car._wheelEffectSkin),track=car._effectTrack;
    const emitWheels=car.handling?.drive===1&&!car.handbrake&&car.driveSlip>.1?wheels.slice(2):wheels.slice(0,2);
    for(let i=0;i<count;i++)for(const wheel of emitWheels){
      const t=(i+.5)/Math.max(1,count),x=(continuous?old.x+(now.x-old.x)*t:now.x)+f.x*wheel.x+r.x*wheel.z,y=(continuous?old.y+(now.y-old.y)*t:now.y)+f.y*wheel.x+r.y*wheel.z;
      const surface=DriftRoadContact.surface(track,x,y,globalThis.DriftWheelParticles?.wetness(car.conditions?.weather)||0);
      if(surface.kind==='gravel'||surface.kind==='grass')continue;
      const rnd=()=>Math.random()-.5,ground=surface.height;
      particles.push({x:x+rnd()*.08,y:y+rnd()*.08,height:ground+.16,vx:car.vel.x*.08+r.x*(vlat*.10+rnd()*.5)-f.x*.2,vy:car.vel.y*.08+r.y*(vlat*.10+rnd()*.5)-f.y*.2,lift:.34+Math.random()*.26,r:.19+Math.random()*.13,grow:(.62+Math.random()*.35)*Math.cbrt(volume),density:(.3+intensity*.2)*(1-surface.wetness*.85),a:0,life:0,ttl:2.1+Math.random()*.9,rotation:Math.random()*6.28,spin:rnd()*.55,color:car.cosmetics?.smokeColor||'#dde8e8'});
    }
    car._smokeEmitter={x:now.x,y:now.y};
    const drag=Math.exp(-dt*1.25);let write=0;
    for(const p of particles){
      p.life+=dt;if(p.life>=p.ttl)continue;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=drag;p.vy*=drag;p.height+=p.lift*dt;p.r+=p.grow*dt;p.rotation+=p.spin*dt;
      p.a=p.density*Math.min(1,p.life/.09)*Math.pow(1-p.life/p.ttl,1.35);
      particles[write++]=p;
    }
    particles.length=write;if(write>limit)particles.splice(0,write-limit);
  }
  return {update};
})();
