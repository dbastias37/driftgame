/* Cerro abajo: open mountain routes and fixed-step downhill dynamics.
 * Vehicle integration and closed-circuit layouts keep their existing physics.
 * Distances are metres, time seconds and gravity 9.81 m/s². */
globalThis.DriftDownhill=(()=>{
  'use strict';
  const G=9.81,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
  // Authored alignments: segment length (m), absolute bearing (degrees).
  // Eased curvature joins straights without kinks. Each road has its own rhythm,
  // rather than repeating a switchback with a different random seed.
  const routes=[
    ['Mirador',.070,7,'Curvas abiertas',[[180,0],[240,70],[190,70],[180,145],[160,145],[220,45],[190,45],[200,105],[160,105]]],
    ['Quebrada',.086,6.7,'Dos vertientes',[[200,0],[155,180],[210,180],[185,30],[260,30],[210,135],[190,135],[165,0],[240,0],[240,110],[160,110]]],
    ['Cumbre',.105,6.4,'Ritmo de altura',[[220,0],[150,180],[160,180],[150,0],[280,0],[260,120],[150,120],[230,20],[160,20],[155,180],[200,180],[180,40],[180,40]]],
    ['Las Lajas',.057,7,'Apoyos largos',[[200,35],[380,95],[260,95],[320,25],[170,25],[340,120],[260,120],[300,65],[180,65]]],
    ['Alto Rehue',.120,6.5,'Horquillas desiguales',[[180,15],[180,175],[130,175],[220,10],[320,10],[150,180],[170,180],[190,45],[240,45],[200,150],[160,150]]],
    ['Santa Elvira',.078,6.8,'Contracurvas fluidas',[[220,55],[160,120],[180,50],[180,130],[280,130],[210,35],[160,95],[200,20],[260,20],[260,105],[180,105]]],
    ['Ramal del Litre',.095,6.6,'Frenadas y enlaces',[[300,0],[155,180],[170,180],[190,80],[160,80],[160,145],[260,145],[210,20],[130,20],[150,175],[180,175],[200,65],[180,65]]],
    ['La Viñuela',.064,6.8,'Arco de valle',[[220,20],[420,160],[240,160],[340,40],[260,40],[380,125],[200,125],[240,65],[200,65]]],
    ['Paso Cardenal',.138,6.3,'Escalones de pendiente',[[180,0],[160,180],[150,180],[180,0],[160,0],[240,95],[310,95],[170,160],[150,160],[200,25],[300,25],[200,110],[180,110]]],
    ['Los Maitenes',.081,6.7,'Enlaces de bosque',[[200,80],[180,25],[220,145],[160,145],[230,50],[140,50],[220,120],[310,120],[210,15],[250,15],[240,100],[200,100]]],
    ['Cuesta Bellavista',.114,6.4,'Laderas alternadas',[[280,0],[190,165],[340,165],[170,15],[170,15],[180,175],[300,175],[260,70],[220,70],[210,135],[180,135],[210,40],[180,40]]],
    ['Filo del Arrayán',.149,6.1,'Doble sector técnico',[[180,0],[145,180],[150,180],[155,0],[230,0],[320,75],[260,75],[200,160],[150,160],[170,0],[170,0],[170,180],[180,180],[220,80],[160,80]]],
    ['Las Vertientes',.072,6.6,'Curvas de radio variable',[[220,45],[270,135],[130,135],[190,65],[300,65],[320,155],[220,155],[230,30],[260,30],[280,115],[160,115],[190,50],[180,50]]],
    ['Portal del Coihue',.125,6.2,'Tres cambios de ritmo',[[210,0],[160,180],[180,180],[170,0],[360,0],[320,100],[170,100],[200,30],[230,30],[180,175],[160,175],[170,15],[240,15],[280,100],[180,100]]],
    ['El Resguardo',.091,6.5,'Rectas entrelazadas',[[240,10],[200,160],[330,160],[220,20],[400,20],[260,140],[180,140],[180,60],[300,60],[230,155],[200,155],[240,40],[200,40]]],
    ['Abra Lucero',.158,6,'Descenso sostenido',[[220,20],[200,150],[160,150],[200,35],[160,35],[230,165],[220,165],[200,15],[320,15],[260,110],[170,110],[200,35],[180,35],[180,175],[170,175],[240,80],[180,80]]],
    ['La Herradura Vieja',.102,6.2,'Arcos y retornos',[[200,0],[330,175],[190,175],[190,25],[300,25],[300,155],[140,155],[160,0],[160,0],[180,180],[220,180],[300,65],[240,65],[220,130],[180,130]]],
    ['Camino de Antul',.083,6.4,'Secuencia de eses',[[220,70],[220,15],[250,145],[240,40],[260,125],[170,125],[230,20],[300,20],[220,100],[210,35],[250,155],[200,155],[240,65],[180,65]]],
    ['Portezuelo Seco',.142,6,'Pendiente cambiante',[[210,0],[150,180],[220,180],[190,20],[280,20],[260,135],[160,135],[190,50],[310,50],[200,175],[180,175],[170,0],[200,0],[180,180],[170,180],[300,75],[180,75]]],
    ['Travesía del Cóndor',.132,5.9,'Gran travesía',[[240,0],[210,150],[240,150],[190,30],[320,30],[190,175],[200,175],[160,0],[260,0],[350,90],[200,90],[200,25],[260,25],[220,160],[190,160],[180,0],[180,0],[170,180],[230,180],[300,65],[220,65]]]
  ].map(([name,grade,half,stage,alignment],i)=>({name,grade,half,stage,alignment,level:i+1}));
  const layouts=new Map();
  function info(n){n=clamp(Math.trunc(n)||1,1,routes.length);const {alignment,...meta}=routes[n-1];return meta;}
  function layout(n=1){
    const meta=info(n);if(layouts.has(meta.level))return layouts.get(meta.level);
    const dense=[{x:0,y:0}];let heading=routes[meta.level-1].alignment[0][1]*Math.PI/180;
    for(const [length,degrees] of routes[meta.level-1].alignment){
      const target=degrees*Math.PI/180,count=Math.ceil(length/2),ds=length/count;
      for(let j=0;j<count;j++){const angle=mix(heading,target,smooth((j+.5)/count)),p=dense.at(-1);dense.push({x:p.x+Math.cos(angle)*ds,y:p.y+Math.sin(angle)*ds});}heading=target;
    }
    const lengths=[0];for(let i=1;i<dense.length;i++)lengths.push(lengths[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const total=lengths.at(-1),count=Math.ceil(total/3),points=[];let k=1,s=0,drop=0;
    for(let i=0;i<=count;i++){
      const target=i*total/count;while(k<lengths.length-1&&lengths[k]<target)k++;
      const t=(target-lengths[k-1])/(lengths[k]-lengths[k-1]);
      const grade=meta.grade*(1+.24*Math.sin(target*.006+meta.level*1.7)+.10*Math.sin(target*.017+meta.level));
      drop+=(target-s)*grade;s=target;points.push({x:mix(dense[k-1].x,dense[k].x,t),y:mix(dense[k-1].y,dense[k].y,t),s,h:-drop});
    }
    const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
    for(const p of points){p.h+=drop+30;bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);}
    bounds.w=bounds.maxX-bounds.minX;bounds.h=bounds.maxY-bounds.minY;
    // Least-squares hillside follows the actual alignment, including diagonal
    // roads. No assumption that world Y equals race progress.
    const mean=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length,h:a.h+p.h/points.length}),{x:0,y:0,h:0});
    let xx=0,yy=0,xy=0,xh=0,yh=0;for(const p of points){const x=p.x-mean.x,y=p.y-mean.y,h=p.h-mean.h;xx+=x*x;yy+=y*y;xy+=x*y;xh+=x*h;yh+=y*h;}
    const det=xx*yy-xy*xy,plane={x:(xh*yy-yh*xy)/det,y:(yh*xx-xh*xy)/det};plane.h=mean.h-plane.x*mean.x-plane.y*mean.y;
    meta.goal=Math.round((total-65)*(4+meta.level*.12)/500)*500;
    const result={meta,points,total,count,drop,bounds,plane,open:true,point:i=>points[clamp(i,0,count)]};layouts.set(meta.level,result);return result;
  }
  function createTrack(Track,n=1){
    const {meta,points,total,count,drop,plane}=layout(n);
    const tr=new Track(points);tr.downhill=true;tr.open=true;tr.roadHalf=meta.half;tr.routeLevel=meta.level;tr.goal=meta.goal;tr.length=total;tr.finishS=total-65;tr.drop=drop;tr.maxHeight=drop+30;
    tr.layout={name:meta.name,level:meta.level,length:tr.finishS,stage:meta.stage,downhill:true};
    tr.point=i=>points[clamp(Math.trunc(i),0,points.length-1)];
    tr.tangentAt=i=>{const a=tr.point(i),b=tr.point(Math.min(points.length-1,i+1));if(i>=points.length-1){const p=tr.point(i-1);return Math.atan2(a.y-p.y,a.x-p.x);}return Math.atan2(b.y-a.y,b.x-a.x);};
    tr.normalAt=i=>{const a=tr.point(i-1),b=tr.point(i+1),d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};};
    const segments=points.slice(0,-1).map((p,i)=>{const q=points[i+1],dx=q.x-p.x,dy=q.y-p.y;const l2=dx*dx+dy*dy,len=Math.sqrt(l2);return {p,q,i,dx,dy,l2,len,tang:Math.atan2(dy,dx),grade:(p.h-q.h)/len};}),grid=new Map(),cell=40;
    for(const seg of segments){const {p,q}=seg;for(let x=Math.floor((Math.min(p.x,q.x)-45)/cell);x<=Math.floor((Math.max(p.x,q.x)+45)/cell);x++)for(let y=Math.floor((Math.min(p.y,q.y)-45)/cell);y<=Math.floor((Math.max(p.y,q.y)+45)/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);}}
    tr.sample=(x,y)=>{
      const local=grid.get(Math.floor(x/cell)+','+Math.floor(y/cell))||segments;let best=Infinity,chosen,tBest=0,cx=0,cy=0;
      for(const a of local){const t=clamp(((x-a.p.x)*a.dx+(y-a.p.y)*a.dy)/a.l2,0,1),px=a.p.x+t*a.dx,py=a.p.y+t*a.dy,d2=(x-px)**2+(y-py)**2;if(d2<best){best=d2;chosen=a;tBest=t;cx=px;cy=py;}}
      const a=chosen,t=tBest,distance=Math.sqrt(best),signed=((x-cx)*a.dy-(y-cy)*a.dx)/a.len;
      return {cx,cy,tang:a.tang,dist:((a.i===0&&t===0)||(a.i===segments.length-1&&t===1))?Math.sign(signed||1)*distance:signed,distance,i:a.i,s:mix(a.p.s,a.q.s,t),h:mix(a.p.h,a.q.h,t),grade:a.grade};
    };
    tr.sampleNearby=(x,y)=>grid.has(Math.floor(x/cell)+','+Math.floor(y/cell))?tr.sample(x,y):null;
    tr.nearestIndex=(x,y)=>tr.sample(x,y).i;
    tr.atDistance=distance=>{const i=clamp(Math.floor(distance/total*count),0,count-1),a=points[i],b=points[i+1],t=clamp((distance-a.s)/(b.s-a.s),0,1);return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),h:mix(a.h,b.h,t),i,s:mix(a.s,b.s,t)};};
    tr.baseHeight=(x,y)=>plane.h+plane.x*x+plane.y*y+9*Math.sin(x*.009)*Math.sin(y*.008)-12;
    const heightAt=(x,y,q)=>{
      if(!q)return tr.baseHeight(x,y);
      // Cut a flat shoulder into the hillside, then blend back into the valley.
      const t=smooth(clamp((q.distance-tr.roadHalf-1.3)/30,0,1));
      return mix(q.h,tr.baseHeight(x,y),t);
    };
    tr.terrainHeight=(x,y)=>heightAt(x,y,tr.sampleNearby(x,y));
    tr.surfaceHeight=(x,y)=>{const q=tr.sampleNearby(x,y);return heightAt(x,y,q)+(q&&q.distance<tr.roadHalf+1.1?DriftRoadContact.profile(q.distance-tr.roadHalf):0);};
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
    if(recover){car.pos.x=p.x;car.pos.y=p.y;car.angle=track.tangentAt(p.i);car.vel.x=car.vel.y=car.omega=car.throttleSm=0;car.gear=1;car.steerAngle=0;car.breakFlow();car.comboBreak=0;car.trailOn=false;car.trailGrace=0;car.tireTrails=[];car.smoke=[];}
    car.descent={s:checkpoint,maxS:recover?previous.maxS:0,checkpoint,motion:'driving',y:p.h,vy:0,roll:0,pitch:0,rollV:0,pitchV:0,fallTime:0,loadFront:.5,loadRear:.5};
    DriftRoadContact.reset(track,car,skin);car.descent.pitch=car.ride.pitch;car.descent.roll=car.ride.roll;car.descent.y=car.ride.height;return car.descent;
  }
  function advance(track,car,before,dt){
    const d=car.descent,q=track.sample(car.pos.x,car.pos.y),reference=d.routeS??d.s;
    const limit=Math.max(5,Math.min(12,(car.worldSpeed()+5)*dt*2.5));
    const continuous=d.motion==='driving'&&Math.abs(q.s-reference)<=limit&&Math.hypot(car.pos.x-before.x,car.pos.y-before.y)<=limit;
    // Follow the same stretch of road along its shoulder, even while scoring is
    // suspended. Rejoining must not compare against an old frozen asphalt pose.
    if(continuous&&q.distance<=track.roadHalf+8){
      d.routeS=q.s;d.routeLostTime=0;
      if(q.distance>track.roadHalf+1)return {valid:false,finished:false};
      const fresh=q.s>d.maxS+.01;d.s=q.s;d.maxS=Math.max(d.maxS,q.s);
      if(q.s>=d.checkpoint+60&&q.distance<track.roadHalf-1)d.checkpoint=Math.floor(q.s/60)*60;
      return {valid:fresh,finished:before.s<track.finishS&&q.s>=track.finishS&&d.maxS>=track.finishS};
    }
    // A lower switchback/teleport still cannot skip the road. Recover from an
    // invalid re-entry automatically instead of leaving the progress stuck.
    d.routeLostTime=d.motion==='driving'&&q.distance<=track.roadHalf+1?(d.routeLostTime||0)+dt:0;
    return {valid:false,finished:false,respawn:d.routeLostTime>.8};
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
    const d=car.descent;d.fallTime+=dt;car.smoke=[];car.trailOn=false;
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
    const q=track.sample(car.pos.x,car.pos.y),before={...car.pos,s:d.s},score=car.score,g=gravity(q,car.mass),speedBefore=car.worldSpeed();
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
      car.pos.x=after.cx+nx*(track.roadHalf+.4);car.pos.y=after.cy+ny*(track.roadHalf+.4);if(v>0){car.breakFlow();car.vel.x-=v*1.25*nx;car.vel.y-=v*1.25*ny;}car.omega*=.5;
    }
    const support=track.terrainHeight(car.pos.x,car.pos.y),height=car.ride?.height??q.h;
    if(after.distance>track.roadHalf+1.4&&(support<height-.65||(after.distance>track.roadHalf+3&&support<after.h-.8))){
      d.motion='falling';d.y=height+(car.bodyDimensions?.cgHeight||.65);d.vy=-q.grade*(car.vel.x*Math.cos(q.tang)+car.vel.y*Math.sin(q.tang));d.roll=car.ride?.roll||0;d.pitch=car.ride?.pitch||0;d.rollV=(car.ride?.vr||0)+side*.35;d.pitchV=car.ride?.vp||0;d.fallTime=0;
      car.score=score;car.breakFlow();return {respawn:false,finished:false};
    }
    if(car.ride)car.ride.height+=track.terrainHeight(car.pos.x,car.pos.y)-track.terrainHeight(before.x,before.y);
    DriftRoadContact.update(track,car,dt,skin);
    const acceleration=(car.worldSpeed()-speedBefore)/dt,transfer=clamp(-acceleration*.65/(G*2.5),-.22,.22);d.loadFront=.5+transfer;d.loadRear=.5-transfer;
    d.pitch=car.ride.pitch+clamp(acceleration*.006,-.045,.045);d.roll=car.ride.roll;d.y=car.ride.height;
    const result=advance(track,car,before,dt);if(!result.valid){const gained=Math.max(0,car.score-score);car.score=score;car.comboPoints=Math.max(0,car.comboPoints-gained);}
    return {...result,respawn:!!result.respawn||car.offTimer>=8};
  }
  return Object.freeze({count:routes.length,info,layout,createTrack,gravity,reset,step,advance});
})();
