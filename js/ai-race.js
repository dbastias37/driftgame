/* Offline opponents use the same fixed-step vehicle forces as the player. */
globalThis.DriftRace=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function grid(car,track,slot){const p=track.point(0),a=track.tangentAt(0),back=4+Math.floor(slot/2)*9;car.pos.x=p.x-Math.cos(a)*back-Math.sin(a)*(slot%2?3:-3);car.pos.y=p.y-Math.sin(a)*back+Math.cos(a)*(slot%2?3:-3);car.angle=a;}
  const plans=new WeakMap();
  // Curvature and braking envelopes are built once per circuit, not per frame.
  function speedPlan(track,car){
    const weather=DriftOptions.weathers[car.conditions?.weather]||DriftOptions.weathers.clear;
    const key=[car.skin,car.conditions?.difficulty,weather.grip,car.pace||1].join(':');let cache=plans.get(track);if(!cache)plans.set(track,cache=new Map());if(cache.has(key))return cache.get(key);
    const n=track.points.length,spacing=track.totalLength/n||4,span=Math.max(2,Math.round(8/spacing)),speeds=new Float32Array(n),distances=new Float32Array(n),grip=weather.grip*(DriftOptions.difficulties[car.conditions?.difficulty]?.grip||1);
    for(let i=0;i<n;i++){const a=track.point(i-span),b=track.point(i),c=track.point(i+span),ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),ac=Math.hypot(c.x-a.x,c.y-a.y),curvature=2*Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/Math.max(.01,ab*bc*ac);speeds[i]=clamp(Math.sqrt((track.nfs?3.2:track.elevated?5.2:7.8)*({blue:.91,gray:.86,yugo:.82,fujiwara:.95}[car.skin]||1)*grip/Math.max(.0001,curvature)),track.nfs?7:12,track.nfs?42:46)*(car.pace||1);const next=track.point(i+1);distances[i]=Math.hypot(next.x-b.x,next.y-b.y);}
    const decel=5.2*grip;
    for(let pass=0;pass<3;pass++)for(let i=n-1;i>=0;i--)speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[(i+1)%n]**2+2*(track.elevated?Math.max(2,decel+9.81*track.sample(track.points[i].x,track.points[i].y,track.points[i].h).grade):decel)*distances[i]));
    const plan={speeds,spacing};cache.set(key,plan);return plan;
  }
  function drive(car,track,index=track.nearestIndex(car.pos.x,car.pos.y,car.ride?.groundHeight),traffic=[],dt=1/60){
    const speed=car.worldSpeed(),plan=speedPlan(track,car),look=Math.max(3,Math.round((8+speed*(track.elevated?.55:.72))/plan.spacing)),center=track.point(index),tangent=track.tangentAt(index),f={x:Math.cos(tangent),y:Math.sin(tangent)},right={x:-f.y,y:f.x},lateral=(car.pos.x-center.x)*right.x+(car.pos.y-center.y)*right.y;
    // A spun AI car can face a barrier while still inside the valid corridor.
    // Use the existing reverse gear to recover; never teleport or change forces.
    if(track.roadVersion===3){
      const headingError=wrap(tangent-car.angle);
      car._aiStuckTime=speed<1.2&&Math.abs(headingError)>1&&Math.abs(lateral)>track.roadHalf-4?(car._aiStuckTime||0)+dt:0;
      if(car._aiStuckTime>.8){car._aiReverseTime=1.6;car._aiStuckTime=0;}
      if((car._aiReverseTime||0)>0){car._aiReverseTime-=dt;return {steerAxis:-Math.sign(headingError)*.8,accel:false,reverse:true,brake:false,handbrake:false};}
    }
    let offset=0,trafficLimit=Infinity,nearest=Infinity;
    const localHalf=track.widthAt?track.widthAt(track.points[index].s):track.roadHalf;
    const laneLimit=track.nfs?Math.max(1,localHalf-1.8):track.roadVersion===3?track.roadHalf-5:track.roadHalf-3;
    for(const other of traffic){if(other===car)continue;const dx=other.pos.x-car.pos.x,dy=other.pos.y-car.pos.y,gap=dx*f.x+dy*f.y,side=dx*right.x+dy*right.y,width=((car.bodyDimensions?.width||1.8)+(other.bodyDimensions?.width||1.8))/2;
      if(gap>-5&&gap<Math.max(18,speed*.95)&&Math.abs(side)<width+1&&gap<nearest){nearest=gap;const otherLane=lateral+side,pass=car._aiPassSide||(otherLane<=0?1:-1);car._aiPassSide=pass;offset=clamp(otherLane+pass*(width+1.4),-laneLimit,laneLimit);if(gap>0&&gap<(track.roadVersion===3?Math.max(12,speed*.7):12))trafficLimit=Math.max(2,other.worldSpeed()+Math.max(0,gap-5)*(track.roadVersion===3?.8:1.5));}}
    if(nearest===Infinity)car._aiPassSide=0;
    if(track.roadVersion===3&&traffic.length>1){
      // Keep a stable lane while cars are side by side. The old controller
      // aimed both starting columns at the centre and could scrape barriers
      // after contact, especially on wet, banked bends.
      const lane=track.nfs?Math.min(2.7,laneLimit):3.2;
      car._aiCruiseLane??=lateral<0?-lane:lane;
      if(track.nfs)car._aiCruiseLane=clamp(car._aiCruiseLane,-lane,lane);
      const neighbours=traffic.filter(other=>other!==car).map(other=>{
        const dx=other.pos.x-car.pos.x,dy=other.pos.y-car.pos.y;
        return {other,gap:dx*f.x+dy*f.y,lane:lateral+dx*right.x+dy*right.y};
      });
      let ahead=neighbours.filter(o=>o.gap>0&&o.gap<Math.max(30,speed*2)&&Math.abs(o.lane-car._aiCruiseLane)<3).sort((a,b)=>a.gap-b.gap)[0];
      if(ahead){
        const alternative=-Math.sign(car._aiCruiseLane)*lane;
        const clear=!neighbours.some(o=>Math.abs(o.lane-alternative)<3.2&&o.gap>-Math.max(12,speed*.6)&&o.gap<Math.max(24,speed*1.25));
        if(clear&&speed>ahead.other.worldSpeed()-.5){car._aiCruiseLane=alternative;ahead=null;}
      }
      car._aiLaneOffset??=clamp(lateral,-lane,lane);
      car._aiLaneOffset+=clamp(car._aiCruiseLane-car._aiLaneOffset,-dt*2.4,dt*2.4);
      offset=car._aiLaneOffset;nearest=ahead?.gap??Infinity;
      trafficLimit=plan.speeds[index]*.92;
      // During a lane change, also respect a slower car still in our physical
      // lane until lateral clearance is actually available.
      for(const o of neighbours)if(o.gap>0&&o.gap<Math.max(35,speed*1.5)&&Math.abs(o.lane-lateral)<2.8)
        trafficLimit=Math.min(trafficLimit,Math.max(2,o.other.worldSpeed()+(o.gap-Math.max(8,speed*.6))*.65));
    }
    const path=track.point(index+look),ta=track.tangentAt(index+look),target={x:path.x-Math.sin(ta)*offset,y:path.y+Math.cos(ta)*offset};
    if(nearest<12&&speed<7){const forward=clamp(nearest-3,2,5);target.x=car.pos.x+f.x*forward+right.x*(offset-lateral);target.y=car.pos.y+f.y*forward+right.y*(offset-lateral);}
    const distance=Math.hypot(target.x-car.pos.x,target.y-car.pos.y),error=wrap(Math.atan2(target.y-car.pos.y,target.x-car.pos.x)-car.angle),outside=Math.max(0,Math.abs(lateral)-track.roadHalf*.65);
    const desired=Math.min(trafficLimit,plan.speeds[index]*clamp(1-Math.max(0,Math.abs(error)-.45)*.34-outside*.035,.4,1)),excess=speed-desired;
    const steering=Math.atan2(2*Math.sin(error)*car.length,Math.max(2,distance))*(track.elevated?1.8:1.22);
    const factor=clamp(1/(1+speed*.065),.18,1),axis=clamp(steering/(car.maxSteer*factor),-1,1);
    // A coast band and separate brake/release thresholds prevent pedal chatter.
    car._aiBraking=excess>(car._aiBraking?.35:1.6);
    const brake=car._aiBraking?clamp(excess*.16,0,.9):0,accel=brake?0:clamp((desired-speed)*.42+.22,0,1);
    return {steerAxis:axis,accel,brake,handbrake:false};
  }
  const cross=(a,b)=>a.x*b.y-a.y*b.x,dot=(a,b)=>a.x*b.x+a.y*b.y;
  function rectangle(car){const c=Math.cos(car.angle),s=Math.sin(car.angle),d=car.bodyDimensions||{length:4.4,width:1.8};return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:car.pos.x+c*x*d.length/2-s*y*d.width/2,y:car.pos.y+s*x*d.length/2+c*y*d.width/2}));}
  function overlapCenter(a,b){
    let poly=a;for(let i=0;i<4&&poly.length;i++){const p=b[i],q=b[(i+1)%4],edge={x:q.x-p.x,y:q.y-p.y},side=v=>cross(edge,{x:v.x-p.x,y:v.y-p.y}),out=[];for(let j=0;j<poly.length;j++){const x=poly[j],y=poly[(j+1)%poly.length],sx=side(x),sy=side(y);if(sx>=-1e-8)out.push(x);if((sx>=0)!==(sy>=0)){const t=sx/(sx-sy);out.push({x:x.x+(y.x-x.x)*t,y:x.y+(y.y-x.y)*t});}}poly=out;}
    return poly.length?{x:poly.reduce((s,v)=>s+v.x,0)/poly.length,y:poly.reduce((s,v)=>s+v.y,0)/poly.length}:null;
  }
  function inertia(car){const d=car.bodyDimensions||{length:4.4,width:1.8};return car.mass*(d.length*d.length+d.width*d.width)/12*(car.handling?.yaw||1);}
  function collide(a,b){
    if(a.ride&&b.ride&&Math.abs(a.ride.height-b.ride.height)>Math.max(a.bodyDimensions?.height||1.4,b.bodyDimensions?.height||1.4))return false;
    const axes=car=>[{x:Math.cos(car.angle),y:Math.sin(car.angle)},{x:-Math.sin(car.angle),y:Math.cos(car.angle)}],aa=axes(a),bb=axes(b),ad=a.bodyDimensions||{length:4.4,width:1.8},bd=b.bodyDimensions||{length:4.4,width:1.8};
    const delta={x:b.pos.x-a.pos.x,y:b.pos.y-a.pos.y};if(Math.hypot(delta.x,delta.y)>(ad.length+bd.length)*.6)return false;
    let depth=Infinity,normal;
    for(const n of [...aa,...bb]){const ra=Math.abs(dot(n,aa[0]))*ad.length*.5+Math.abs(dot(n,aa[1]))*ad.width*.5,rb=Math.abs(dot(n,bb[0]))*bd.length*.5+Math.abs(dot(n,bb[1]))*bd.width*.5,d=dot(delta,n),overlap=ra+rb-Math.abs(d);if(overlap<=0)return false;if(overlap<depth){depth=overlap;normal={x:n.x*Math.sign(d||1),y:n.y*Math.sign(d||1)};}}
    const contact=overlapCenter(rectangle(a),rectangle(b))||{x:(a.pos.x+b.pos.x)/2,y:(a.pos.y+b.pos.y)/2},ra={x:contact.x-a.pos.x,y:contact.y-a.pos.y},rb={x:contact.x-b.pos.x,y:contact.y-b.pos.y},ia=1/a.mass,ib=1/b.mass,iaa=1/inertia(a),ibb=1/inertia(b);
    const velocity=()=>({x:b.vel.x-(b.omega||0)*rb.y-a.vel.x+(a.omega||0)*ra.y,y:b.vel.y+(b.omega||0)*rb.x-a.vel.y-(a.omega||0)*ra.x});
    const effective=n=>ia+ib+cross(ra,n)**2*iaa+cross(rb,n)**2*ibb;
    const apply=(n,j)=>{const impulse={x:n.x*j,y:n.y*j};a.vel.x-=impulse.x*ia;a.vel.y-=impulse.y*ia;b.vel.x+=impulse.x*ib;b.vel.y+=impulse.y*ib;a.omega=(a.omega||0)-cross(ra,impulse)*iaa;b.omega=(b.omega||0)+cross(rb,impulse)*ibb;a.yawRate=a.omega;b.yawRate=b.omega;};
    const closing=dot(velocity(),normal);
    if(closing<0){const j=-(1+(closing<-2?.18:0))*closing/effective(normal);apply(normal,j);const tangent={x:-normal.y,y:normal.x},friction=clamp(-dot(velocity(),tangent)/effective(tangent),-j*.32,j*.32);apply(tangent,friction);for(const c of [a,b]){c.hitTimer=.5;if(closing<-1.5)c.breakFlow?.();}}
    // Position correction carries no extra impulse or engine-like energy.
    const correction=Math.max(0,depth-.012)*.8/(ia+ib);a.pos.x-=normal.x*correction*ia;a.pos.y-=normal.y*correction*ia;b.pos.x+=normal.x*correction*ib;b.pos.y+=normal.y*correction*ib;
    return true;
  }
  const INTRO=Object.freeze({roll:4,settle:2,count:3});
  function rev(car,pressure,dt){car.launchHold=true;car.launchThrottle=(car.launchThrottle||0)+clamp((Number(pressure)||0)-(car.launchThrottle||0),-dt*2.5,dt*1.8);}
  function presentation(cars,elapsed){const progress=clamp(elapsed/INTRO.roll,0,1),remaining=8*(1-progress)**2;return cars.map(car=>({...car,pos:{x:car.pos.x-Math.cos(car.angle)*remaining,y:car.pos.y-Math.sin(car.angle)*remaining},ride:null,wheelTravel:8-remaining,worldSpeed(){return 0;}}));}
  class Race{
    constructor(track,player,cars,{collisions=false,laps=5}={}){this.track=track;this.player=player;this.cars=cars;this.collisions=collisions;this.laps=laps;this.clock=0;this.total=track.points.length;this.entries=new Map();[player,...cars].forEach((car,slot)=>{grid(car,track,slot);this.entries.set(car,{index:track.nearestIndex(car.pos.x,car.pos.y,car.ride?.groundHeight),distance:-Math.floor(slot/2)*1.5,gate:1,lap:0,finished:0});});}
    step(dt){
      this.clock+=dt;const traffic=this.collisions?[this.player,...this.cars]:[];
      for(const car of this.cars){const info=this.entries.get(car);car.update(dt,drive(car,this.track,undefined,traffic,dt),this.track);
        if(car.offTimer>4||car.wrongWay&&(car.wrongTime=(car.wrongTime||0)+dt)>3){const i=info.index,p=this.track.point(i);car.pos={x:p.x,y:p.y};car.angle=this.track.tangentAt(i);car.vel={x:0,y:0};car.omega=0;car.offTimer=car.wrongTime=0;DriftDynamics.reset(car);DriftRoadContact.reset(this.track,car,car.skin,p.h);}
        if(!car.wrongWay)car.wrongTime=0;
      }
      if(this.collisions){const cars=[this.player,...this.cars];for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)collide(cars[a],cars[b]);}
      if(this.collisions&&this.track.roadVersion===3)for(const car of [this.player,...this.cars])DriftTouring.afterStep(this.track,car);
      for(const car of this.cars)DriftRoadContact.update(this.track,car,dt,car.skin);
      for(const [car,info] of this.entries){if(info.finished)continue;const index=this.track.nearestIndex(car.pos.x,car.pos.y,car.ride?.groundHeight);let di=index-info.index;if(di>this.total/2)di-=this.total;if(di<-this.total/2)di+=this.total;
        if(!car.offTrack&&Math.abs(di)<Math.max(8,this.total*.04)){info.distance+=di;if(di>0){if(info.index>this.total*.75&&index<this.total*.25){if(info.gate===4){info.lap++;if(info.lap>=this.laps)info.finished=this.clock;}info.gate=1;}else if(info.gate<4&&info.index<this.total*info.gate/4&&index>=this.total*info.gate/4)info.gate++;}}
        info.index=index;
      }
    }
    standings(){return [...this.entries].sort((a,b)=>{const x=a[1],y=b[1];return x.finished||y.finished?(x.finished||Infinity)-(y.finished||Infinity):y.distance-x.distance;}).map(([car,info])=>({car,...info}));}
    place(){return this.standings().findIndex(e=>e.car===this.player)+1;}
    presentation(elapsed){return presentation([this.player,...this.cars],elapsed);}
  }
  return {Race,grid,drive,collide,inertia,presentation,INTRO,rev};
})();
