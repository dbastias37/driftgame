/* Movable tyre stacks. Sleeping piles wake into individual rigid props on impact. */
globalThis.DriftTrackProps=(()=>{
  const material=Object.freeze({mass:10,radius:.42,height:.24,friction:.54,restitution:.32,penalty:100});
  const MAX_PROPS=36,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const ground=(track,x,y)=>track.downhill?track.terrainHeight(x,y):0;
  const height=p=>material.height+.60*Math.abs(Math.sin(Math.hypot(p.tiltX,p.tiltY)));
  function spawns(track){
    if(track.elevated||!track.layout&&!track.downhill)return [];
    const points=track.points,L=points.length,candidates=[];
    for(let i=10;i<L-10;i+=3){const a=track.tangentAt(i-5),b=track.tangentAt(i+5),turn=wrap(b-a),p=track.point(i);if(Math.abs(turn)<.045)continue;
      if(Math.hypot(p.x-points[0].x,p.y-points[0].y)<32)continue;
      candidates.push({i,p,turn,weight:Math.abs(turn)});
    }
    candidates.sort((a,b)=>b.weight-a.weight);const selected=[],result=[];
    for(const c of candidates){
      if(selected.some(s=>Math.hypot(s.p.x-c.p.x,s.p.y-c.p.y)<=65))continue;
      const a=track.tangentAt(c.i),n=track.normalAt(c.i),side=-Math.sign(c.turn);
      // Move the entire group outward if a tight bend would put one pile on
      // the road. Each selected curve keeps all three piles (3 / 4 / 5 rings).
      for(let attempt=0;attempt<7;attempt++){
        const cluster=[];
        for(let j=-1;j<=1;j++){
          const edge=track.roadHalf+.35+attempt*.55,x=c.p.x+n.x*side*edge+Math.cos(a)*j*1.35,y=c.p.y+n.y*side*edge+Math.sin(a)*j*1.35;
          const q=track.sample(x,y);if(Math.abs(q.dist??q.distance)<track.roadHalf-.5||result.some(p=>Math.hypot(x-p.x,y-p.y)<1.05))break;
          cluster.push({x,y,ground:ground(track,x,y),heading:a,count:j+4});
        }
        if(cluster.length===3){result.push(...cluster);selected.push(c);break;}
      }
      if(selected.length===3)break;
    }
    return result;
  }
  function prepare(track,{reset=false,enabled=true}={}){if(!Object.hasOwn(track,'trackProps'))Object.defineProperty(track,'trackProps',{value:null,writable:true,configurable:true});if(!enabled){track.trackProps=null;return null;}if(reset||!track.trackProps)track.trackProps=new Run(track);return track.trackProps;}
  class Run{
    constructor(track){Object.defineProperty(this,'track',{value:track});this.spawns=spawns(track);this.reset();}
    reset(){
      this.props=[];this.piles=this.spawns.map((spawn,pileId)=>{const units=[];
        for(let layer=0;layer<spawn.count;layer++){const p={...spawn,id:this.props.length,pileId,layer,z:layer*material.height,vx:0,vy:0,vz:0,tiltX:0,tiltY:0,spinX:0,spinY:0,down:false,penalized:false,sleep:true};this.props.push(p);units.push(p);}
        return {id:pileId,units,intact:true,penalized:false,material:{...material,mass:material.mass*units.length,height:material.height*units.length}};
      });
      this.last=new WeakMap();this.owners=new Map();this.notice=0;this.hits=0;this.time=0;
    }
    penalize(prop,car,player){
      const pile=this.piles[prop.pileId];if(pile.penalized)return;pile.penalized=true;
      for(const p of pile.units){p.penalized=true;this.owners.set(p.id,car);}
      car.score-=material.penalty;car.breakFlow?.();car.impactCount=(car.impactCount||0)+1;car.hitTimer=.4;if(car===player){this.hits++;this.notice=2.5;}
    }
    syncPile(pile){const base=pile.units[0];for(const p of pile.units.slice(1)){p.x=base.x;p.y=base.y;p.ground=base.ground;p.z=base.z+p.layer*material.height;}}
    release(pile){
      if(!pile.intact)return;this.syncPile(pile);pile.intact=false;const base=pile.units[0],vx=base.vx,vy=base.vy,vz=base.vz,sx=base.spinX,sy=base.spinY;
      // The impulse was computed using the mass of the ENTIRE pile. The rings
      // share that velocity; a small fan redirects (never multiplies) its energy.
      for(const p of pile.units){const fan=(p.layer-(pile.units.length-1)/2)*.035,c=Math.cos(fan),s=Math.sin(fan),loss=1-p.layer*.018;p.vx=(vx*c-vy*s)*loss;p.vy=(vx*s+vy*c)*loss;p.vz=vz*loss;p.spinX=sx*(1-p.layer*.04);p.spinY=sy*(1-p.layer*.04);p.down=true;p.sleep=false;}
    }
    integrate(p,h){
      if(p.sleep)return;
      const before=p.ground;p.x+=p.vx*h;p.y+=p.vy*h;p.ground=ground(this.track,p.x,p.y);p.z+=before-p.ground;p.vz-=9.81*h;p.z+=p.vz*h;p.tiltX+=p.spinX*h;p.tiltY+=p.spinY*h;
      if(p.z<=0){p.z=0;p.vz=Math.abs(p.vz)>.8?-p.vz*material.restitution:0;this.dampContact(p,h);}
      if(this.track.training){const lot=this.track.lot;for(const [axis,v,min,max] of [['x','vx',lot.minX+.5,lot.maxX-.5],['y','vy',lot.minY+.5,119]])if(p[axis]<min||p[axis]>max){p[axis]=clamp(p[axis],min,max);p[v]*=-material.restitution;}}
    }
    dampContact(p,h){
      const speed=Math.hypot(p.vx,p.vy),drag=Math.max(0,1-material.friction*9.81*h/Math.max(.001,speed));p.vx*=drag;p.vy*=drag;p.spinX*=Math.exp(-h*3.3);p.spinY*=Math.exp(-h*3.3);p.tiltX*=Math.exp(-h*3);p.tiltY*=Math.exp(-h*3);
      if(speed<.06&&Math.abs(p.vz)<.15&&Math.hypot(p.spinX,p.spinY,p.tiltX,p.tiltY)<.04){p.vx=p.vy=p.vz=p.spinX=p.spinY=p.tiltX=p.tiltY=0;p.sleep=true;}
    }
    collideProps(h,player){
      if(!this.props.some(p=>!p.sleep))return;
      const bodies=[];for(const pile of this.piles){if(pile.intact)bodies.push({p:pile.units[0],pile,mass:pile.material.mass,height:pile.material.height});else for(const p of pile.units)bodies.push({p,pile:null,mass:material.mass,height:height(p)});}
      // Sweep along X: only overlapping neighborhoods reach the narrow phase.
      bodies.sort((a,b)=>a.p.x-b.p.x);const diameter=material.radius*2;
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
        const A=bodies[i],B=bodies[j],a=A.p,b=B.p,dx=b.x-a.x;if(dx>=diameter)break;if(A.pile&&!A.pile.intact||B.pile&&!B.pile.intact||a.sleep&&b.sleep||Math.abs(b.y-a.y)>=diameter)continue;
        const dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=diameter)continue;
        const cy=(b.ground+b.z+B.height/2)-(a.ground+a.z+A.height/2),vertical=(A.height+B.height)/2-Math.abs(cy);if(vertical<=0)continue;
        const radial=diameter-d,useY=vertical<radial,nz=useY?(Math.sign(cy)||1):0,nx=useY?0:d>1e-6?dx/d:1,ny=useY?0:d>1e-6?dy/d:0,invA=1/A.mass,invB=1/B.mass;
        const correction=Math.max(0,(useY?vertical:radial)-.001)*.8/(invA+invB);
        a.x-=nx*correction*invA;a.y-=ny*correction*invA;a.z=Math.max(0,a.z-nz*correction*invA);b.x+=nx*correction*invB;b.y+=ny*correction*invB;b.z=Math.max(0,b.z+nz*correction*invB);
        const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz;
        if(closing<0){const push=-closing*(1+material.restitution)/(invA+invB);a.vx-=nx*push*invA;a.vy-=ny*push*invA;a.vz-=nz*push*invA;b.vx+=nx*push*invB;b.vy+=ny*push*invB;b.vz+=nz*push*invB;a.sleep=b.sleep=false;
          if(A.pile)this.release(A.pile);if(B.pile)this.release(B.pile);
          const owner=this.owners.get(a.id)||this.owners.get(b.id);if(owner&&-closing>1.5){this.penalize(a,owner,player);this.penalize(b,owner,player);}
        }else{if(A.pile)this.syncPile(A.pile);if(B.pile)this.syncPile(B.pile);}
        if(useY){const top=cy>0?b:a;if(!this.piles[top.pileId].intact)this.dampContact(top,h);}
      }
    }
    step(dt,cars,player=cars[0]){
      if(!(dt>0))return;this.time+=dt;this.notice=Math.max(0,this.notice-dt);if(!this.props.length)return;
      let distance=0;const sweeps=[];
      for(const car of cars){if(car.descent?.motion==='falling'){this.last.delete(car);continue;}const end={...car.pos},prior=this.last.get(car)||end,moved=Math.hypot(end.x-prior.x,end.y-prior.y),start=moved>18?end:prior;distance=Math.max(distance,moved>18?0:moved);sweeps.push({car,dx:end.x-start.x,dy:end.y-start.y});car.pos.x=start.x;car.pos.y=start.y;}
      const n=Math.min(32,Math.max(1,Math.ceil(dt*120),Math.ceil(distance/.22))),h=dt/n;
      for(let k=0;k<n;k++){
        for(const {car,dx,dy} of sweeps){car.pos.x+=dx/n;car.pos.y+=dy/n;
          for(const pile of this.piles){const candidates=pile.intact?[pile.units[0]]:pile.units;
            for(const p of candidates){if(Math.abs(p.x-car.pos.x)>5||Math.abs(p.y-car.pos.y)>5)continue;const hit=DriftTraining.strike(car,p,pile.intact?pile.material:material);if(pile.intact){if(!p.sleep)this.release(pile);else this.syncPile(pile);}if(hit)this.penalize(p,car,player);}
          }
        }
        for(const p of this.props){
          // A sleeping loose ring must fall if its supporting ring is moved.
          if(p.sleep&&p.z>.01&&!this.piles[p.pileId].intact&&!this.props.some(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<material.radius&&Math.abs(q.ground+q.z+height(q)-p.ground-p.z)<.035))p.sleep=false;
          this.integrate(p,h);
        }
        this.collideProps(h,player);
      }
      for(const {car} of sweeps)this.last.set(car,{...car.pos});
    }
  }
  return {Run,prepare,spawns,material,ground,MAX_PROPS};
})();
