/* Local wheel effects. No forces, network fields, map objects or shared RNG.
 * A bounded pool belongs to each car; the renderer batches all visible cars.
 */
globalThis.DriftWheelParticles=(()=>{
  'use strict';
  const states=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const colors=['#bda582','#978063','#d2bd94','#796953'];
  const wetness=weather=>weather==='storm'?1:weather==='rain'?.75:0;
  function seedFor(car){let seed=7919;for(const c of String(car.id||car.skin||'car'))seed=(seed*31+c.charCodeAt(0))>>>0;return seed;}
  function reset(car){
    const state=states.get(car);
    if(state){for(const p of state.active)state.free.push(p);state.active.length=0;state.acc.fill(0);state.last=null;state.seed=seedFor(car);}
    else if(car.wheelParticles)car.wheelParticles.length=0;
  }
  function stateFor(car,track){
    let state=states.get(car);
    if(!state){state={active:[],free:[],created:0,limit:car.wheelParticleLimit||(car.smokeLimit<=480?192:384),acc:new Float64Array(16),seed:seedFor(car),last:null};states.set(car,state);car.wheelParticles=state.active;}
    if(state.track!==track){reset(car);state.track=track;}
    const skin=car.skin||car._wheelEffectSkin;
    if(state.skin!==skin||!state.wheels){state.skin=skin;state.wheels=DriftRoadContact.wheelOffsets(skin);state.acc.fill(0);}
    return state;
  }
  function random(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
  function acquire(state){
    if(state.free.length)return state.free.pop();
    if(state.created>=state.limit)return null;
    state.created++;return {};
  }
  function emit(state,type,x,y,surface,vx,vy,fx,fy,side,kick,speed,wheel){
    const p=acquire(state);if(!p)return;
    const rnd=()=>random(state),spread=(rnd()-.5)*(1.1+kick*2.8),back=1.2+Math.min(speed,55)*(.09+rnd()*.1);
    const cloud=type==='dust'||type==='mist',stone=type==='gravel';
    const lateral=side*(.7+rnd()*1.7)+spread;
    Object.assign(p,{type,wheel,x,y,height:surface.height+.08,originX:x,originY:y,floor:surface.height,gx:surface.gx,gy:surface.gy,
      vx:vx*(cloud?.10:.20)-fx*back-fy*lateral,vy:vy*(cloud?.10:.20)-fy*back+fx*lateral,
      vz:cloud?.25+rnd()*.45:.7+rnd()*(1.3+kick*1.6),r:stone?.025+rnd()*.035:type==='drop'?.012+rnd()*.018:(type==='mist'?.23:.15)+rnd()*.11,
      grow:type==='dust'?.65+rnd()*.38:type==='mist'?.42+rnd()*.32:0,
      ttl:stone?.9+rnd()*.65:type==='drop'?.40+rnd()*.32:type==='dust'?1.05+rnd()*.55:.8+rnd()*.4,
      life:0,a:0,density:stone?1:type==='drop'?.62:type==='dust'?.22+kick*.10:.20+kick*.06,
      color:stone?colors[Math.floor(rnd()*colors.length)]:type==='dust'?'#b9a17c':type==='drop'?'#c7e2e8':'#cfdee1',
      rotation:rnd()*Math.PI*2,spin:(rnd()-.5)*(stone?18:1),bounces:0,settled:false});
    state.active.push(p);
  }
  function advance(state,track,dt){
    const ground=DriftRoadContact.terrain(track),steps=Math.ceil(dt*60),h=dt/steps;
    for(let n=0;n<steps;n++){
      let write=0;
      for(const p of state.active){
        p.life+=h;if(p.life>=p.ttl){state.free.push(p);continue;}
        const cloud=p.type==='dust'||p.type==='mist';
        if(!p.settled){
          const drag=Math.exp(-(cloud?1.9:.9)*h);p.vx*=drag;p.vy*=drag;
          p.x+=p.vx*h;p.y+=p.vy*h;if(!cloud)p.vz-=9.81*h;p.height+=p.vz*h;
          const floor=p.floor+p.gx*(p.x-p.originX)+p.gy*(p.y-p.originY);
          // Most airborne particles need no surface query. The last few cm
          // use the actual ribbon/kerb, including the bank and vertical grade.
          if(p.height<floor+.3){const real=ground.height(p.x,p.y,p.height)+.025;
            if(p.height<real){
              if(p.type==='drop'){state.free.push(p);continue;}
              p.height=real;
              if(p.type==='gravel'){
                if(!p.bounces&&p.vz<-.75){p.vz=-p.vz*.24;p.vx*=.38;p.vy*=.38;p.bounces++;}
                else{p.settled=true;p.vx=p.vy=p.vz=p.spin=0;p.ttl=Math.min(p.ttl,p.life+.3);}
              }
            }
          }
        }
        p.r+=p.grow*h;p.rotation+=p.spin*h;
        p.a=p.density*(cloud?Math.min(1,p.life/.065):1)*Math.pow(Math.max(0,1-p.life/p.ttl),cloud?1.15:.45);
        state.active[write++]=p;
      }
      state.active.length=write;
    }
  }
  function update(car,dt,track=car._effectTrack,weather=car.conditions?.weather||'clear'){
    if(!(dt>0)||!track?.points?.length)return;
    dt=Math.min(dt,.1);
    if(car.descent?.motion==='falling'){reset(car);return;}
    const state=stateFor(car,track),speed=Math.hypot(car.vel.x,car.vel.y),old=state.last;
    if(old&&Math.hypot(car.pos.x-old.x,car.pos.y-old.y)>Math.max(12,speed*dt*2+3))reset(car);
    advance(state,track,dt);
    if(car.ride?.airborne){state.last=null;state.acc.fill(0);return;}
    const c=Math.cos(car.angle),s=Math.sin(car.angle),forward=car.vel.x*c+car.vel.y*s,lateral=-car.vel.x*s+car.vel.y*c;
    const slip=Math.max(Math.abs(lateral)/Math.max(4,speed),Math.abs(car.rearSlip||0),car.driveSlip||0);
    const impact=old?clamp((old.speed-speed)/Math.max(.001,dt)/35,0,1):0;
    const kick=clamp(slip*1.6+(car.braking?.3:0)+(car.handbrake?.35:0)+impact*.5,0,1.5);
    const speedGain=clamp((speed-1.5)/22,0,1.5),wet=wetness(weather),direction=forward<-.5?-1:1;
    const last=state.last;
    for(let w=0;w<4;w++){
      const wheel=state.wheels[w],x=car.pos.x+c*wheel.x-s*wheel.z,y=car.pos.y+s*wheel.x+c*wheel.z;
      const surface=DriftRoadContact.surface(track,x,y,wet,car.ride?.groundHeight),gravel=surface.kind==='gravel',water=surface.kind!=='grass'?surface.wetness:0;
      // Sideways velocity and yaw fling material across the shoulder. Braking
      // and impacts add energy, but a parked car never creates an endless plume.
      const side=clamp((lateral+(car.omega||0)*wheel.x)*.22,-3,3)+(wheel.z>0?.4:-.4);
      const rates=[gravel?speedGain*(12+30*kick):0,gravel?speedGain*(5+10*kick)*(1-water*.9):0,water*speedGain*(28+20*kick),water*speedGain*(12+8*kick)];
      for(let k=0;k<4;k++){
        const i=w*4+k,type=['gravel','dust','drop','mist'][k];
        if(!rates[k]){state.acc[i]=0;continue;}
        state.acc[i]+=rates[k]*dt;const count=Math.min(8,Math.floor(state.acc[i]));state.acc[i]-=Math.floor(state.acc[i]);
        for(let j=0;j<count;j++){
          const t=(j+.5)/count,px=last?last.x+(car.pos.x-last.x)*t+c*wheel.x-s*wheel.z:x,py=last?last.y+(car.pos.y-last.y)*t+s*wheel.x+c*wheel.z:y;
          const contact=DriftRoadContact.surface(track,px,py,wet,car.ride?.groundHeight);
          if((k<2&&contact.kind!=='gravel')||(k>=2&&(!contact.wetness||contact.kind==='grass')))continue;
          emit(state,type,px,py,contact,car.vel.x,car.vel.y,c*direction,s*direction,side,kick,speed,w);
        }
      }
    }
    state.last={x:car.pos.x,y:car.pos.y,speed};
  }
  // Recreate short-lived effects from poses only. Fixed ticks make seeking,
  // pausing and playback speed independent; no live car is ever stepped.
  class Playback{
    constructor(){this.cars=new Map();this.tick=-1;this.source=null;}
    reset(){this.cars.clear();this.tick=-1;this.source=null;}
    apply(recorder,time,sample){
      const hz=30,tick=Math.floor((time-recorder.start)*hz+1e-7);
      if(this.source!==recorder||this.start!==recorder.start||tick<this.tick||tick-this.tick>hz*.3){
        this.cars.clear();this.tick=Math.max(-1,tick-60);this.source=recorder;this.start=recorder.start;
      }
      for(let t=this.tick+1;t<=tick;t++){
        const frame=recorder.sample(recorder.start+t/hz);if(!frame?.player)continue;
        for(const [id,pose] of [['player',frame.player],...frame.rivals.map(p=>[p.id,p])]){
          let car=this.cars.get(id);if(!car){car={id,skin:pose.skin,wheelParticleLimit:192};this.cars.set(id,car);}
          Object.assign(car,{pos:pose.pos,vel:pose.vel,angle:pose.angle,omega:pose.omega,braking:pose.braking,handbrake:pose.handbrake,descent:pose.descent});
          update(car,1/hz,recorder.meta.track,recorder.meta.weather||'clear');
        }
        for(const id of this.cars.keys())if(id!=='player'&&!frame.rivals.some(p=>p.id===id))this.cars.delete(id);
      }
      this.tick=tick;
      for(const [id,pose] of [['player',sample.player],...sample.rivals.map(p=>[p.id,p])])pose.wheelParticles=this.cars.get(id)?.wheelParticles||[];
    }
  }
  return Object.freeze({update,reset,wetness,Playback});
})();
