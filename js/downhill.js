/* Cerro abajo: open mountain routes and fixed-step downhill dynamics.
 * Existing Car and closed circuits are deliberately left intact.
 * Distances are metres, time seconds and gravity 9.81 m/s². */
globalThis.DriftDownhill=(()=>{
  'use strict';
  const G=9.81,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
  const routes=[{name:'Mirador',turns:4,span:240,radius:33,grade:.065,goal:6500,half:7,stage:'Primer descenso'},
    {name:'Quebrada',turns:6,span:255,radius:30,grade:.083,goal:11000,half:6.5,stage:'Horquillas enlazadas'},
    {name:'Cumbre',turns:8,span:275,radius:28,grade:.10,goal:17000,half:6,stage:'Descenso experto'}];
  function info(n){n=clamp(Math.trunc(n)||1,1,routes.length);return {...routes[n-1],level:n};}
  function createTrack(Track,n=1){
    const meta=info(n),dense=[{x:-meta.span/2,y:0}];let direction=1;
    function straight(x,y,wave=0){const a=dense.at(-1),count=Math.ceil(Math.hypot(x-a.x,y-a.y));for(let j=1;j<=count;j++){const t=j/count;dense.push({x:mix(a.x,x,t),y:mix(a.y,y,smooth(t))+wave*Math.sin(t*Math.PI*2)*Math.sin(t*Math.PI)**2});}}
    for(let i=0;i<=meta.turns;i++){
      const a=dense.at(-1),end=direction*(meta.span/2+(i%3-1)*18);
      straight(end,a.y+30+(i%3)*9,i%2?9:-7);
      if(i===meta.turns)break;
      const p=dense.at(-1),r=meta.radius+(i%3)*5,steps=Math.ceil(Math.PI*r);
      for(let j=1;j<=steps;j++){const theta=j/steps*Math.PI;dense.push({x:p.x+direction*r*Math.sin(theta),y:p.y+r*(1-Math.cos(theta))});}
      direction*=-1;
    }
    const last=dense.at(-1);straight(last.x+direction*95,last.y+8);
    const lengths=[0];for(let i=1;i<dense.length;i++)lengths.push(lengths[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const total=lengths.at(-1),count=Math.ceil(total/3),points=[];let k=1,s=0,drop=0;
    for(let i=0;i<=count;i++){
      const target=i*total/count;while(k<lengths.length-1&&lengths[k]<target)k++;
      const t=(target-lengths[k-1])/(lengths[k]-lengths[k-1]),p={x:mix(dense[k-1].x,dense[k].x,t),y:mix(dense[k-1].y,dense[k].y,t)};
      const grade=meta.grade+.025*(.5+.5*Math.sin(target*.011));drop+=(target-s)*grade;s=target;points.push({...p,s,h:-drop});
    }
    for(const p of points)p.h+=drop+30;
    const tr=new Track(points);tr.downhill=true;tr.open=true;tr.roadHalf=meta.half;tr.routeLevel=meta.level;tr.goal=meta.goal;tr.length=total;tr.finishS=total-65;tr.drop=drop;tr.maxHeight=drop+30;
    tr.layout={name:meta.name,level:meta.level,length:tr.finishS,stage:meta.stage,downhill:true};
    tr.point=i=>points[clamp(Math.trunc(i),0,points.length-1)];
    tr.tangentAt=i=>{const a=tr.point(i),b=tr.point(Math.min(points.length-1,i+1));if(i>=points.length-1){const p=tr.point(i-1);return Math.atan2(a.y-p.y,a.x-p.x);}return Math.atan2(b.y-a.y,b.x-a.x);};
    tr.normalAt=i=>{const a=tr.point(i-1),b=tr.point(i+1),d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};};
    const segments=points.slice(0,-1).map((p,i)=>{const q=points[i+1],dx=q.x-p.x,dy=q.y-p.y;return {p,q,i,dx,dy,l2:dx*dx+dy*dy};}),grid=new Map(),cell=40;
    for(const seg of segments){const {p,q}=seg;for(let x=Math.floor((Math.min(p.x,q.x)-45)/cell);x<=Math.floor((Math.max(p.x,q.x)+45)/cell);x++)for(let y=Math.floor((Math.min(p.y,q.y)-45)/cell);y<=Math.floor((Math.max(p.y,q.y)+45)/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);}}
    tr.sample=(x,y)=>{
      const local=grid.get(Math.floor(x/cell)+','+Math.floor(y/cell))||segments;let best=Infinity,result;
      for(const a of local){const t=clamp(((x-a.p.x)*a.dx+(y-a.p.y)*a.dy)/a.l2,0,1),cx=a.p.x+t*a.dx,cy=a.p.y+t*a.dy,d2=(x-cx)**2+(y-cy)**2;if(d2<best){best=d2;const tang=Math.atan2(a.dy,a.dx);result={cx,cy,tang,dist:((a.i===0&&t===0)||(a.i===segments.length-1&&t===1))?Math.sign((x-cx)*Math.sin(tang)-(y-cy)*Math.cos(tang)||1)*Math.sqrt(d2):(x-cx)*Math.sin(tang)-(y-cy)*Math.cos(tang),distance:Math.sqrt(d2),i:a.i,s:mix(a.p.s,a.q.s,t),h:mix(a.p.h,a.q.h,t),grade:(a.p.h-a.q.h)/Math.sqrt(a.l2)};}}
      return result;
    };
    tr.nearestIndex=(x,y)=>tr.sample(x,y).i;
    tr.atDistance=distance=>{const i=clamp(Math.floor(distance/total*count),0,count-1),a=points[i],b=points[i+1],t=clamp((distance-a.s)/(b.s-a.s),0,1);return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),h:mix(a.h,b.h,t),i,s:mix(a.s,b.s,t)};};
    tr.baseHeight=(x,y)=>tr.maxHeight-drop*(y/points.at(-1).y)+9*Math.sin(x*.009)*Math.sin(y*.008)-12;
    tr.terrainHeight=(x,y)=>{
      const q=tr.sample(x,y),d=q.distance,road=q.h;
      // Cut a flat shoulder into the hillside, then blend back into the valley.
      const t=smooth(clamp((d-tr.roadHalf-1.3)/30,0,1));
      return mix(road,tr.baseHeight(x,y),t);
    };
    tr.surfaceHeight=(x,y)=>{const q=tr.sample(x,y);return tr.terrainHeight(x,y)+(q.distance<tr.roadHalf+1.1?DriftRoadContact.profile(q.distance-tr.roadHalf):0);};
    tr.barrierAt=(s,side)=>{const section=Math.floor(s/total*count/3+1e-6)*3*total/count;return section<65||section>tr.finishS+18||(Math.sin(section*.018)>.86&&side>0);};
    tr.draw=(g,cam)=>{
      g.save();g.translate(cam.tx,cam.ty);g.scale(cam.s,cam.s);g.lineJoin='round';g.lineCap='round';
      const path=()=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));};
      path();g.strokeStyle='#eddbbc';g.lineWidth=tr.roadHalf*2+.32;g.stroke();path();g.strokeStyle='#303b40';g.lineWidth=tr.roadHalf*2-.32;g.stroke();g.setLineDash([7,10]);path();g.strokeStyle='#d8cda785';g.lineWidth=.22;g.stroke();g.setLineDash([]);
      for(const distance of [0,tr.finishS]){const p=tr.atDistance(distance),n=tr.normalAt(p.i);g.beginPath();g.moveTo(p.x-n.x*tr.roadHalf,p.y-n.y*tr.roadHalf);g.lineTo(p.x+n.x*tr.roadHalf,p.y+n.y*tr.roadHalf);g.strokeStyle=distance?'#ff7544':'#e9ede5';g.lineWidth=1;g.stroke();}g.restore();
    };
    return tr;
  }
  function gravity(sample,mass=1200){const force=mass*G*sample.grade/(1+sample.grade**2);return{x:force/mass*Math.cos(sample.tang),y:force/mass*Math.sin(sample.tang),force};}
  function reset(track,car,skin,recover=false){
    const previous=car.descent,checkpoint=recover?(previous?.checkpoint||0):0,p=track.atDistance(checkpoint);
    if(recover){car.pos.x=p.x;car.pos.y=p.y;car.angle=track.tangentAt(p.i);car.vel.x=car.vel.y=car.omega=car.throttleSm=0;car.gear=1;car.steerAngle=0;car.driftTime=0;car.mult=1;car.comboState=0;car.trailOn=false;car.trailGrace=0;car.tireTrails=[];car.smoke=[];}
    car.descent={s:checkpoint,maxS:recover?previous.maxS:0,checkpoint,motion:'driving',y:p.h,vy:0,roll:0,pitch:0,rollV:0,pitchV:0,fallTime:0,loadFront:.5,loadRear:.5};
    DriftRoadContact.reset(track,car,skin);car.descent.pitch=car.ride.pitch;car.descent.roll=car.ride.roll;car.descent.y=car.ride.height;return car.descent;
  }
  function advance(track,car,before,dt){
    const d=car.descent,q=track.sample(car.pos.x,car.pos.y),delta=q.s-d.s,limit=Math.max(5,Math.min(12,(car.worldSpeed()+5)*dt*2.5));
    if(q.distance>track.roadHalf+1||Math.abs(delta)>limit||Math.hypot(car.pos.x-before.x,car.pos.y-before.y)>limit||d.motion!=='driving')return {valid:false,finished:false};
    const fresh=q.s>d.maxS+.01;d.s=q.s;d.maxS=Math.max(d.maxS,q.s);
    if(q.s>=d.checkpoint+60&&q.distance<track.roadHalf-1)d.checkpoint=Math.floor(q.s/60)*60;
    return {valid:fresh,finished:before.s<track.finishS&&q.s>=track.finishS&&d.maxS>=track.finishS};
  }
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  function rotate(v,yaw,roll,pitch,inverse=false){
    const ry=(v,a)=>({x:v.x*Math.cos(a)+v.z*Math.sin(a),y:v.y,z:-v.x*Math.sin(a)+v.z*Math.cos(a)});
    const rx=(v,a)=>({x:v.x,y:v.y*Math.cos(a)-v.z*Math.sin(a),z:v.y*Math.sin(a)+v.z*Math.cos(a)});
    const rz=(v,a)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a),z:v.z});
    return inverse?rz(rx(ry(v,yaw),-roll),-pitch):ry(rx(rz(v,pitch),roll),-yaw);
  }
  function fall(track,car,dt){
    const d=car.descent;d.fallTime+=dt;car.smoke=[];car.trailOn=false;car.mult=1;
    car.vel.x*=Math.exp(-.025*dt);car.vel.y*=Math.exp(-.025*dt);d.vy-=G*dt;
    car.pos.x+=car.vel.x*dt;car.pos.y+=car.vel.y*dt;d.y+=d.vy*dt;car.angle+=car.omega*dt;
    d.roll+=d.rollV*dt;d.pitch+=d.pitchV*dt;
    // Box inertia about the centre of mass; contact impulses change translation
    // and angular momentum. Eight support corners follow the actual hillside.
    const mass=car.mass,dimensions=car.bodyDimensions||{length:4.4,width:1.96,height:1.3},L=dimensions.length,W=dimensions.width,H=dimensions.height,I={x:mass*(H**2+W**2)/12,y:mass*(L**2+W**2)/12,z:mass*(L**2+H**2)/12};
    const world=v=>rotate(v,car.angle,d.roll,d.pitch),local=v=>rotate(v,car.angle,d.roll,d.pitch,true);
    let penetration=0,contact=null;
    for(const x of [-L/2,L/2])for(const y of [-(dimensions.cgHeight||H/2),H-(dimensions.cgHeight||H/2)])for(const z of [-W/2,W/2]){const r=world({x,y,z}),px=car.pos.x+r.x,pz=car.pos.y+r.z,depth=track.terrainHeight(px,pz)-(d.y+r.y);if(depth>penetration){penetration=depth;contact={r,px,pz};}}
    if(contact){
      d.y+=penetration;const {r,px,pz}=contact,e=.5,gx=(track.terrainHeight(px+e,pz)-track.terrainHeight(px-e,pz))/(2*e),gz=(track.terrainHeight(px,pz+e)-track.terrainHeight(px,pz-e))/(2*e),len=Math.hypot(gx,1,gz),n={x:-gx/len,y:1/len,z:-gz/len};
      const inverseI=v=>{const l=local(v);return world({x:l.x/I.x,y:l.y/I.y,z:l.z/I.z});};
      const velocity=()=>{const spin=cross(world({x:d.rollV,y:-car.omega,z:d.pitchV}),r);return {x:car.vel.x+spin.x,y:d.vy+spin.y,z:car.vel.y+spin.z};};
      const impulse=(direction,value)=>{const j={x:direction.x*value,y:direction.y*value,z:direction.z*value};car.vel.x+=j.x/mass;d.vy+=j.y/mass;car.vel.y+=j.z/mass;const torque=local(cross(r,j));d.rollV+=torque.x/I.x;car.omega-=torque.y/I.y;d.pitchV+=torque.z/I.z;};
      const effective=axis=>1/mass+dot(cross(inverseI(cross(r,axis)),r),axis);
      const vn=dot(velocity(),n);
      if(vn<0){
        const j=-(1.12*vn)/effective(n);impulse(n,j);
        const v=velocity(),normal=dot(v,n),t={x:v.x-normal*n.x,y:v.y-normal*n.y,z:v.z-normal*n.z},speed=Math.hypot(t.x,t.y,t.z);
        if(speed>.001){t.x/=speed;t.y/=speed;t.z/=speed;impulse(t,-Math.min(j*.45,speed/effective(t)));}
      }
      const damping=Math.exp(-.45*dt);d.rollV*=damping;d.pitchV*=damping;car.omega*=damping;
    }
    return {respawn:d.fallTime>4.5,finished:false};
  }
  function step(track,car,dt,input,skin){
    const d=car.descent||reset(track,car,skin);if(d.motion==='falling')return fall(track,car,dt);
    const q=track.sample(car.pos.x,car.pos.y),before={...car.pos,s:d.s},score=car.score,combo=car.comboPoints,g=gravity(q,car.mass),speedBefore=car.worldSpeed();
    if(q.distance>track.roadHalf+.7){const e=.5,gx=(track.terrainHeight(car.pos.x+e,car.pos.y)-track.terrainHeight(car.pos.x-e,car.pos.y))/(2*e),gy=(track.terrainHeight(car.pos.x,car.pos.y+e)-track.terrainHeight(car.pos.x,car.pos.y-e))/(2*e),denom=1+gx*gx+gy*gy;g.x=-G*gx/denom;g.y=-G*gy/denom;}
    const holding=(input.brake||input.handbrake)&&speedBefore<.8&&!input.accel;
    if(!holding){car.vel.x+=g.x*dt;car.vel.y+=g.y*dt;}
    const entrySpeed=car.worldSpeed(),lat=car.baseLatFriction;car.baseLatFriction=lat/Math.sqrt(1+q.grade*q.grade);
    car.update(dt,input,track);car.baseLatFriction=lat;
    // Remove the flat game's idle settling only here; a free car must roll.
    if(!holding&&car.throttleSm===0&&entrySpeed<.6){const idle=Math.max(.01,1-10*dt);car.vel.x/=idle;car.vel.y/=idle;}
    if(holding){car.pos.x=before.x;car.pos.y=before.y;car.vel.x=car.vel.y=0;car.omega=0;}
    const after=track.sample(car.pos.x,car.pos.y),side=after.dist<0?1:-1;
    if(after.distance>track.roadHalf+.45&&after.distance<track.roadHalf+5&&track.barrierAt(after.s,side)){
      const nx=-Math.sin(after.tang)*side,ny=Math.cos(after.tang)*side,v=car.vel.x*nx+car.vel.y*ny;
      car.pos.x=after.cx+nx*(track.roadHalf+.4);car.pos.y=after.cy+ny*(track.roadHalf+.4);if(v>0){car.vel.x-=v*1.25*nx;car.vel.y-=v*1.25*ny;}car.omega*=.5;
    }
    const support=track.terrainHeight(car.pos.x,car.pos.y),height=car.ride?.height??q.h;
    if(after.distance>track.roadHalf+1.4&&(support<height-.65||(after.distance>track.roadHalf+3&&support<after.h-.8))){
      d.motion='falling';d.y=height+(car.bodyDimensions?.cgHeight||.65);d.vy=-q.grade*(car.vel.x*Math.cos(q.tang)+car.vel.y*Math.sin(q.tang));d.roll=car.ride?.roll||0;d.pitch=car.ride?.pitch||0;d.rollV=(car.ride?.vr||0)+side*.35;d.pitchV=car.ride?.vp||0;d.fallTime=0;
      car.score=score;car.comboPoints=0;return {respawn:false,finished:false};
    }
    if(car.ride)car.ride.height+=track.terrainHeight(car.pos.x,car.pos.y)-track.terrainHeight(before.x,before.y);
    DriftRoadContact.update(track,car,dt,skin);
    const acceleration=(car.worldSpeed()-speedBefore)/dt,transfer=clamp(-acceleration*.65/(G*2.5),-.22,.22);d.loadFront=.5+transfer;d.loadRear=.5-transfer;
    d.pitch=car.ride.pitch+clamp(acceleration*.006,-.045,.045);d.roll=car.ride.roll;d.y=car.ride.height;
    const result=advance(track,car,before,dt);if(!result.valid){car.score=score;car.comboPoints=combo;}
    return {...result,respawn:car.offTimer>=8};
  }
  return Object.freeze({count:routes.length,info,createTrack,gravity,reset,step,advance});
})();
