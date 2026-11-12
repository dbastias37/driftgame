/* Breakaway road furniture. All impulse goes to the sign: this module never
 * writes a car's position, velocity, steering, score or combo. */
globalThis.DriftSigns=(()=>{
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const faceKey=t=>[0,3,6].map(i=>t.slice(i,i+3).map(v=>Math.round(v*1000)).join(',')).sort((a,b)=>{const aa=a.split(',').map(Number),bb=b.split(',').map(Number);return aa[0]-bb[0]||aa[1]-bb[1]||aa[2]-bb[2];}).join('|');
  function definitions(track){
    if(track.nfs)return globalThis.DriftSignData?.[track.nfsSlug]?.signs||[];
    const out=[];
    if(track.downhill){
      for(let s=180;s<track.finishS;s+=220){const p=track.atDistance(s),n=track.normalAt(p.i);out.push({kind:'chevron',x:p.x+n.x*(track.roadHalf+2.3),y:p.y+n.y*(track.roadHalf+2.3),ground:p.h,height:2.5,width:2.8,pole:2});}
      for(let i=0;i<track.points.length-1;i+=9){const p=track.points[i],n=track.normalAt(i);for(const side of [-1,1])if(!track.barrierAt(p.s,side))out.push({kind:'marker',x:p.x+n.x*(track.roadHalf+1.15)*side,y:p.y+n.y*(track.roadHalf+1.15)*side,ground:p.h,height:.9,width:.2,pole:.9});}
    }else if(!track.elevated&&!track.training){
      for(const p of track.roadSignMarkers||track.layout?.markers||[])out.push({kind:'marker',x:p.x,y:p.z,ground:0,height:1.2,width:.16,pole:1.2});
    }
    return out;
  }
  const floor=(track,x,y,h)=>track.surfaceHeight?.(x,y,h)??track.terrainHeight?.(x,y,h)??0;
  function spawn(track,def,id){
    const q=track.sample(def.x,def.y,def.ground),tang=q.tang??track.tangentAt(q.i);
    return {id,def,x:def.x,y:def.y,ground:def.ground,lift:0,yaw:-tang-Math.PI/2,tilt:0,vx:0,vy:0,spin:0,hit:false,settled:false,age:0,floor:floor(track,def.x,def.y,def.ground)};
  }
  // A thin oriented board against the actual car rectangle (four SAT axes).
  function overlaps(p,x,y,a,dims,bottom,top){
    const d=p.def;if(top<d.ground||bottom>d.ground+d.height)return false;
    const dx=d.x-x,dy=d.y-y,c=Math.cos(a),s=Math.sin(a),u=dx*c+dy*s,v=-dx*s+dy*c,L=dims.length/2,W=dims.width/2;
    const rx=Math.cos(p.yaw),ry=-Math.sin(p.yaw),A=rx*c+ry*s,B=-rx*s+ry*c,H=d.width/2,D=.06;
    for(const post of d.posts||(d.pole?[{x:0,bottom:0,height:d.pole}]:[]))if(bottom<d.ground+post.bottom+post.height&&top>d.ground+post.bottom&&Math.hypot(Math.max(0,Math.abs(u+post.x*A)-L),Math.max(0,Math.abs(v+post.x*B)-W))<.16)return true;
    if(d.kind==='marker'||top<d.ground+(d.boardBottom??Math.max(0,(d.pole||0)-.15)))return false;
    return Math.abs(u)<=L+Math.abs(A)*H+Math.abs(B)*D&&Math.abs(v)<=W+Math.abs(B)*H+Math.abs(A)*D&&Math.abs(dx*rx+dy*ry)<=H+L*Math.abs(A)+W*Math.abs(B)&&Math.abs(-dx*ry+dy*rx)<=D+L*Math.abs(B)+W*Math.abs(A);
  }
  class Run{
    constructor(track,defs=definitions(track)){
      this.track=track;this.signs=defs.map((d,i)=>spawn(track,d,i));this.previous=new WeakMap();this.previousById=new Map();this.grid=new Map();this.moving=new Set();this.revision=0;
      for(const p of this.signs){const r=p.def.width/2+.3;for(let x=Math.floor((p.x-r)/32);x<=Math.floor((p.x+r)/32);x++)for(let y=Math.floor((p.y-r)/32);y<=Math.floor((p.y+r)/32);y++){const key=x+','+y;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(p);}}
    }
    strike(p,car){
      const speed=Math.hypot(car.vel.x,car.vel.y);if(p.hit||speed<.15)return;
      p.hit=true;p.vx=car.vel.x/speed*Math.min(17,speed*.32);p.vy=car.vel.y/speed*Math.min(17,speed*.32);p.targetYaw=Math.atan2(car.vel.x,car.vel.y);p.spin=clamp(1.2+speed*.065,1.2,5.5);this.moving.add(p);this.revision++;
    }
    step(dt,cars=[]){
      if(!(dt>0))return;dt=Math.min(dt,.1);
      for(const car of cars){
        if(!car?.pos||!car.vel)continue;
        const now={x:car.pos.x,y:car.pos.y,angle:car.angle,height:car.ride?.height??car.descent?.y??floor(this.track,car.pos.x,car.pos.y)};
        const old=this.previous.get(car)||(car.id&&this.previousById.get(car.id))||now;this.previous.set(car,now);if(car.id)this.previousById.set(car.id,now);
        const distance=Math.hypot(now.x-old.x,now.y-old.y);
        // Respawn/reconciliation is not a physical sweep through the map.
        if(distance>18||car.descent?.motion==='falling')continue;
        const dims=car.bodyDimensions||{length:4.4,width:1.9,height:1.4},r=Math.hypot(dims.length,dims.width)/2+.2,candidates=new Set();
        for(let x=Math.floor((Math.min(now.x,old.x)-r)/32);x<=Math.floor((Math.max(now.x,old.x)+r)/32);x++)for(let y=Math.floor((Math.min(now.y,old.y)-r)/32);y<=Math.floor((Math.max(now.y,old.y)+r)/32);y++)for(const p of this.grid.get(x+','+y)||[])if(!p.hit)candidates.add(p);
        const da=angle(old.angle,now.angle),n=Math.max(1,Math.ceil((distance+Math.abs(da)*r)/.35));
        for(const p of candidates)for(let k=0;k<=n;k++){const f=k/n,base=old.height+(now.height-old.height)*f;if(overlaps(p,old.x+(now.x-old.x)*f,old.y+(now.y-old.y)*f,old.angle+da*f,dims,base+.1,base+(dims.height||1.4))){this.strike(p,car);break;}}
      }
      for(const p of this.moving){
        p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const drag=Math.exp(-2.1*dt);p.vx*=drag;p.vy*=drag;
        p.yaw+=angle(p.yaw,p.targetYaw)*Math.min(1,dt*10);
        p.spin+=Math.sin(p.tilt)*8*dt;p.tilt+=p.spin*dt;
        if(p.tilt>=Math.PI/2){p.tilt=Math.PI/2;p.spin=Math.abs(p.spin)>.65?-p.spin*.16:0;}
        p.ground=p.def.ground+floor(this.track,p.x,p.y,p.def.ground)-p.floor;p.lift=.07*Math.sin(p.tilt);
        if(p.age>1.5&&Math.hypot(p.vx,p.vy)<.08&&Math.abs(p.spin)<.65){p.tilt=Math.PI/2;p.yaw=p.targetYaw;p.vx=p.vy=p.spin=0;p.settled=true;this.moving.delete(p);}
      }
    }
  }
  function prepare(track,{reset=false}={}){if(reset||!track.roadSigns)Object.defineProperty(track,'roadSigns',{value:new Run(track),writable:true,configurable:true});return track.roadSigns;}
  return {Run,prepare,definitions,faceKey,overlaps};
})();
