/* Deterministic parking practice. Metres, seconds, kilograms; no rendering clock. */
globalThis.DriftTraining=(()=>{
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const material=Object.freeze({mass:3.8,radius:.36,height:.82,friction:.68,restitution:.18,penalty:100});
  function create(Track){
    const points=Array.from({length:360},(_,i)=>{const t=i/360*TAU-Math.PI/2;return {x:70*Math.sin(t),y:42*Math.sin(2*t)};});
    const track=new Track(points);track.training=true;track.roadHalf=7;
    track.lot={minX:-124,maxX:124,minY:-92,maxY:104};
    track.bounds={minX:-130,minY:-141,maxX:130,maxY:120,w:260,h:261};
    track.layout={name:'Mercado Ocho',stage:'Entrenamiento abierto',length:0};
    let total=0,next=0;const cones=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length];total+=Math.hypot(q.x-p.x,q.y-p.y);
      if(total<next)continue;next=total+5.4;
      const n=track.normalAt(i);
      for(const side of [-1,1]){
        const x=p.x+n.x*track.roadHalf*side,y=p.y+n.y*track.roadHalf*side;
        // The crossing is an open junction: neither branch cuts through a wall of cones.
        if(Math.hypot(x,y)<18)continue;
        // A south opening links the eight to the free practice apron.
        if(x>25&&x<42&&y>41)continue;
        cones.push({x,y});
      }
    }
    track.layout.length=track.totalLength=total;track.coneSpawns=cones;
    track.lampSites=[[-112,-67],[0,-81],[112,-67],[-112,34],[112,34],[-77,92],[77,92]].map(([x,y])=>({x,y}));
    track.gates=[{x:-34,y:102,angle:0},{x:34,y:102,angle:0}];
    track.solids=[{x:0,y:-123,w:174,d:28},
      {x:-125,y:13.5,w:2,d:215},{x:125,y:13.5,w:2,d:215},{x:0,y:-93,w:250,d:2},
      {x:-85,y:105,w:80,d:2},{x:0,y:105,w:46,d:2},{x:85,y:105,w:80,d:2},
      // Exit pockets allow the automatic arms to open without leaving the world.
      {x:0,y:120,w:250,d:2},
      ...track.lampSites.map(p=>({...p,w:.65,d:.65})),
      ...track.gates.map(p=>({x:p.x-5.5,y:p.y,w:1,d:1})),
      ...[-117,117].flatMap(x=>[-75,-48,-18,13,44,77].map(y=>({x,y,w:5,d:12}))),
      ...[-55,-12,12,55].map(x=>({x,y:99,w:12,d:5}))];
    track.practice=new Run(track);return track;
  }
  function bounds(car){return car.bodyDimensions||{length:4.4,width:1.8,height:1.4};}
  function inertia(car){const d=bounds(car);return car.mass*(d.length*d.length+d.width*d.width)/12*(car.handling?.yaw||1);}
  function coneContact(car,cone,properties=material){
    const base=Number.isFinite(cone.ground)?cone.ground-(car.ride?.height||0):0;
    if(cone.z+base>bounds(car).height||cone.z+base+properties.height<-.03)return null;
    const c=Math.cos(car.angle),s=Math.sin(car.angle),d=bounds(car),dx=cone.x-car.pos.x,dy=cone.y-car.pos.y,lx=dx*c+dy*s,ly=-dx*s+dy*c;
    let qx=clamp(lx,-d.length/2,d.length/2),qy=clamp(ly,-d.width/2,d.width/2),nx=lx-qx,ny=ly-qy,dist=Math.hypot(nx,ny);
    if(dist>=properties.radius)return null;
    if(dist<1e-6){const ex=d.length/2-Math.abs(lx),ey=d.width/2-Math.abs(ly);if(ex<ey){nx=Math.sign(lx)||1;ny=0;qx=nx*d.length/2;dist=-ex;}else{nx=0;ny=Math.sign(ly)||1;qy=ny*d.width/2;dist=-ey;}}
    else{nx/=dist;ny/=dist;}
    return {nx:nx*c-ny*s,ny:nx*s+ny*c,rx:qx*c-qy*s,ry:qx*s+qy*c,depth:properties.radius-dist};
  }
  function strike(car,cone,properties=material){
    const material=properties,hit=coneContact(car,cone,material);if(!hit)return false;
    const {nx,ny,rx,ry,depth}=hit,inv=1/car.mass,ic=1/inertia(car),lever=rx*ny-ry*nx;
    const vx=cone.vx-car.vel.x+(car.omega||0)*ry,vy=cone.vy-car.vel.y-(car.omega||0)*rx,closing=vx*nx+vy*ny;
    const correction=Math.max(0,depth-.002)*.8/(inv+1/material.mass);
    cone.x+=nx*correction/material.mass;cone.y+=ny*correction/material.mass;car.pos.x-=nx*correction*inv;car.pos.y-=ny*correction*inv;
    if(closing>=0)return false;
    const j=-(1+material.restitution)*closing/(inv+1/material.mass+lever*lever*ic);
    car.vel.x-=j*nx*inv;car.vel.y-=j*ny*inv;car.omega=(car.omega||0)-lever*j*ic;car.yawRate=car.omega;
    cone.vx+=j*nx/material.mass;cone.vy+=j*ny/material.mass;cone.sleep=false;
    const impact=j/material.mass;
    if(impact>1.5){
      // Divert a portion of horizontal energy upward, rather than inventing a launch force.
      const speed=Math.hypot(cone.vx,cone.vy),lift=Math.min(5,speed*.23);
      const planar=Math.sqrt(Math.max(0,speed*speed-lift*lift))/Math.max(.001,speed);cone.vx*=planar;cone.vy*=planar;cone.vz=Math.max(cone.vz,lift);
      cone.spinX+=ny*impact*.35;cone.spinY-=nx*impact*.35;
      cone.down=true;return true;
    }
    return false;
  }
  function staticContact(car,solid){
    // SAT between the rotated car and each fixed parking obstacle.
    const d=bounds(car),c=Math.cos(car.angle),s=Math.sin(car.angle),dx=car.pos.x-solid.x,dy=car.pos.y-solid.y;
    if(Math.abs(dx)>solid.w/2+d.length||Math.abs(dy)>solid.d/2+d.length)return;
    let depth=Infinity,nx=0,ny=0;
    for(const [x,y] of [[1,0],[0,1],[c,s],[-s,c]]){const r=Math.abs(x*c+y*s)*d.length/2+Math.abs(-x*s+y*c)*d.width/2+Math.abs(x)*solid.w/2+Math.abs(y)*solid.d/2,v=dx*x+dy*y,o=r-Math.abs(v);if(o<=0)return;if(o<depth){depth=o;nx=x*Math.sign(v||1);ny=y*Math.sign(v||1);}}
    car.pos.x+=nx*(depth+.001);car.pos.y+=ny*(depth+.001);const v=car.vel.x*nx+car.vel.y*ny;
    if(v<0){car.vel.x-=nx*v*1.12;car.vel.y-=ny*v*1.12;car.omega*=.65;car.hitTimer=.3;car.breakFlow?.();}
  }
  class Run{
    constructor(track){this.track=track;this.reset();}
    reset(){this.cones=this.track.coneSpawns.map((p,id)=>({...p,id,z:0,vx:0,vy:0,vz:0,tiltX:0,tiltY:0,spinX:0,spinY:0,down:false,penalized:false,sleep:true}));this.hits=0;this.penalties=0;this.laps=0;this.gate=1;this.notice=0;this.last=null;this.gateAngles=this.track.gates.map(()=>0);this.time=0;}
    penalize(cone,car){if(!cone.down||cone.penalized)return;cone.penalized=true;this.hits++;this.penalties+=material.penalty;car.score-=material.penalty;car.breakFlow?.();this.notice=2.5;}
    collideCones(car){
      const diameter=material.radius*2;
      for(let i=0;i<this.cones.length;i++)for(let j=i+1;j<this.cones.length;j++){
        const a=this.cones[i],b=this.cones[j];if(a.sleep&&b.sleep||Math.abs(a.z-b.z)>.55)continue;
        const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>=diameter||Math.abs(dy)>=diameter)continue;
        const dist=Math.hypot(dx,dy);if(dist>=diameter)continue;
        const nx=dist>1e-6?dx/dist:1,ny=dist>1e-6?dy/dist:0,correction=(diameter-dist)*.5;
        a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
        const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(closing>=0)continue;
        const impulse=-(1+material.restitution)*closing*.5;
        a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;a.sleep=b.sleep=false;
        if(impulse>1.5)for(const [cone,sign] of [[a,-1],[b,1]]){cone.down=true;cone.spinX+=ny*impulse*.35*sign;cone.spinY-=nx*impulse*.35*sign;this.penalize(cone,car);}
      }
    }
    step(dt,car){
      this.time+=dt;this.notice=Math.max(0,this.notice-dt);
      const old=this.last||car.pos,end={...car.pos},dx=end.x-old.x,dy=end.y-old.y,n=Math.min(24,Math.max(1,Math.ceil(dt*120),Math.ceil(Math.hypot(dx,dy)/.24))),h=dt/n;
      car.pos.x=old.x;car.pos.y=old.y;
      for(let k=1;k<=n;k++){
        car.pos.x+=dx/n;car.pos.y+=dy/n;
        for(const solid of this.track.solids)staticContact(car,solid);
        for(let i=0;i<this.track.gates.length;i++)if(this.gateAngles[i]<.7){const g=this.track.gates[i];staticContact(car,{x:g.x-.4,y:g.y,w:10.2*Math.cos(this.gateAngles[i]),d:.25});}
        for(const cone of this.cones){
          if(strike(car,cone))this.penalize(cone,car);
          if(cone.sleep)continue;
          cone.x+=cone.vx*h;cone.y+=cone.vy*h;cone.vz-=9.81*h;cone.z+=cone.vz*h;
          cone.tiltX+=cone.spinX*h;cone.tiltY+=cone.spinY*h;
          if(cone.z<=0){cone.z=0;if(cone.vz<0)cone.vz=Math.abs(cone.vz)>.7?-cone.vz*material.restitution:0;
            const speed=Math.hypot(cone.vx,cone.vy),factor=Math.max(0,1-material.friction*9.81*h/Math.max(.001,speed));cone.vx*=factor;cone.vy*=factor;
            cone.spinX*=Math.exp(-h*5);cone.spinY*=Math.exp(-h*5);
            if(cone.down){const tilt=Math.hypot(cone.tiltX,cone.tiltY)||.01,scale=(Math.PI/2-tilt)*Math.min(1,h*7)/tilt;cone.tiltX+=cone.tiltX*scale;cone.tiltY+=cone.tiltY*scale;}
            if(speed<.06&&Math.abs(cone.vz)<.05&&Math.hypot(cone.spinX,cone.spinY)<.05){cone.vx=cone.vy=cone.vz=0;cone.sleep=true;}
          }
          const lot=this.track.lot;for(const [axis,velocity,lo,hi] of [['x','vx',lot.minX,lot.maxX],['y','vy',lot.minY,119]])if(cone[axis]<lo||cone[axis]>hi){cone[axis]=clamp(cone[axis],lo,hi);cone[velocity]*=-material.restitution;}
        }
        this.collideCones(car);
      }
      this.last={...car.pos};
      for(let i=0;i<this.track.gates.length;i++){const p=this.track.gates[i],near=Math.hypot(car.pos.x-p.x,car.pos.y-p.y)<20,target=near?Math.PI*.47:0;this.gateAngles[i]+=clamp(target-this.gateAngles[i],-dt*.8,dt*1.05);}
      // Eight ordered gates disambiguate the two branches at the central crossing.
      const p=this.track.point(Math.round(this.gate*this.track.points.length/8)),a=this.track.tangentAt(Math.round(this.gate*this.track.points.length/8));
      if(Math.hypot(car.pos.x-p.x,car.pos.y-p.y)<10&&car.vel.x*Math.cos(a)+car.vel.y*Math.sin(a)>1){this.gate++;if(this.gate===9){this.gate=1;this.laps++;}}
    }
  }
  return {create,Run,material,coneContact,strike,staticContact};
})();
