/* Movable trackside tyres. Fixed simulation ticks; no render-state ownership. */
globalThis.DriftTrackProps=(()=>{
  const material=Object.freeze({mass:10,radius:.42,height:.24,friction:.54,restitution:.32,penalty:100});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const ground=(track,x,y)=>track.downhill?track.terrainHeight(x,y):0;
  function spawns(track){
    if(!track.layout&&!track.downhill)return [];
    const points=track.points,L=points.length,candidates=[];
    for(let i=10;i<L-10;i+=3){const a=track.tangentAt(i-5),b=track.tangentAt(i+5),turn=wrap(b-a),p=track.point(i);if(Math.abs(turn)<.045)continue;
      if(Math.hypot(p.x-points[0].x,p.y-points[0].y)<32)continue;
      candidates.push({i,p,turn,weight:Math.abs(turn)});
    }
    candidates.sort((a,b)=>b.weight-a.weight);const selected=[];
    for(const c of candidates){if(selected.every(s=>Math.hypot(s.p.x-c.p.x,s.p.y-c.p.y)>65)){selected.push(c);if(selected.length===3)break;}}
    const result=[];
    for(const c of selected){const a=track.tangentAt(c.i),n=track.normalAt(c.i),side=-Math.sign(c.turn); // outside of the turn
      for(let j=-1;j<=1;j++){
        const x=c.p.x+n.x*side*(track.roadHalf+.35)+Math.cos(a)*j*2.4,y=c.p.y+n.y*side*(track.roadHalf+.35)+Math.sin(a)*j*2.4;
        const q=track.sample(x,y);if(Math.abs(q.dist??q.distance)<track.roadHalf-.5)continue;
        if(result.some(p=>Math.hypot(x-p.x,y-p.y)<1.5))continue;
        result.push({x,y,ground:ground(track,x,y),heading:a});
      }
    }
    return result;
  }
  function prepare(track,{reset=false,enabled=true}={}){if(!Object.hasOwn(track,'trackProps'))Object.defineProperty(track,'trackProps',{value:null,writable:true,configurable:true});if(!enabled){track.trackProps=null;return null;}if(reset||!track.trackProps)track.trackProps=new Run(track);return track.trackProps;}
  class Run{
    constructor(track){Object.defineProperty(this,'track',{value:track});this.spawns=spawns(track);this.reset();}
    reset(){this.props=this.spawns.map((p,id)=>({...p,id,z:0,vx:0,vy:0,vz:0,tiltX:0,tiltY:0,spinX:0,spinY:0,down:false,penalized:false,sleep:true}));this.last=new WeakMap();this.owners=new Map();this.notice=0;this.hits=0;this.time=0;}
    penalize(prop,car,player){if(prop.penalized)return;prop.penalized=true;this.owners.set(prop.id,car);car.score-=material.penalty;car.breakFlow?.();car.impactCount=(car.impactCount||0)+1;car.hitTimer=.4;if(car===player){this.hits++;this.notice=2.5;}}
    step(dt,cars,player=cars[0]){
      if(!(dt>0))return;this.time+=dt;this.notice=Math.max(0,this.notice-dt);if(!this.props.length)return;
      let distance=0;const sweeps=[];
      for(const car of cars){if(car.descent?.motion==='falling'){this.last.delete(car);continue;}const end={...car.pos},prior=this.last.get(car)||end,moved=Math.hypot(end.x-prior.x,end.y-prior.y),start=moved>18?end:prior;distance=Math.max(distance,moved>18?0:moved);sweeps.push({car,dx:end.x-start.x,dy:end.y-start.y});car.pos.x=start.x;car.pos.y=start.y;}
      const n=Math.min(32,Math.max(1,Math.ceil(dt*120),Math.ceil(distance/.22))),h=dt/n;
      for(let k=0;k<n;k++){
        for(const {car,dx,dy} of sweeps){car.pos.x+=dx/n;car.pos.y+=dy/n;
          for(const prop of this.props){if(Math.abs(prop.x-car.pos.x)>5||Math.abs(prop.y-car.pos.y)>5)continue;if(DriftTraining.strike(car,prop,material))this.penalize(prop,car,player);}
        }
        for(const p of this.props){if(p.sleep)continue;
          const before=p.ground;p.x+=p.vx*h;p.y+=p.vy*h;p.ground=ground(this.track,p.x,p.y);p.z+=before-p.ground;p.vz-=9.81*h;p.z+=p.vz*h;p.tiltX+=p.spinX*h;p.tiltY+=p.spinY*h;
          if(p.z<=0){p.z=0;p.vz=Math.abs(p.vz)>.8?-p.vz*material.restitution:0;
            const speed=Math.hypot(p.vx,p.vy),drag=Math.max(0,1-material.friction*9.81*h/Math.max(.001,speed));p.vx*=drag;p.vy*=drag;p.spinX*=Math.exp(-h*3.3);p.spinY*=Math.exp(-h*3.3);
            // Rubber rings settle flat rather than floating at their last tumble angle.
            p.tiltX*=Math.exp(-h*3);p.tiltY*=Math.exp(-h*3);
            if(speed<.06&&Math.abs(p.vz)<.05&&Math.hypot(p.spinX,p.spinY,p.tiltX,p.tiltY)<.04){p.vx=p.vy=p.vz=p.spinX=p.spinY=p.tiltX=p.tiltY=0;p.sleep=true;}
          }
          if(this.track.training){const lot=this.track.lot;for(const [axis,v,min,max] of [['x','vx',lot.minX+.5,lot.maxX-.5],['y','vy',lot.minY+.5,119]])if(p[axis]<min||p[axis]>max){p[axis]=clamp(p[axis],min,max);p[v]*=-material.restitution;}}
        }
        for(let i=0;i<this.props.length;i++)for(let j=i+1;j<this.props.length;j++){
          const a=this.props[i],b=this.props[j];if(a.sleep&&b.sleep||Math.abs(a.ground+a.z-b.ground-b.z)>.5)continue;
          const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=material.radius*2;if(d>=r)continue;const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0,over=(r-d)*.5;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;
          const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(closing>=0)continue;const push=-closing*(1+material.restitution)*.5;a.vx-=nx*push;a.vy-=ny*push;b.vx+=nx*push;b.vy+=ny*push;a.sleep=b.sleep=false;
          const owner=this.owners.get(a.id)||this.owners.get(b.id);if(owner&&push>1.5){this.penalize(a,owner,player);this.penalize(b,owner,player);}
        }
      }
      for(const {car} of sweeps)this.last.set(car,{...car.pos});
    }
  }
  return {Run,prepare,spawns,material,ground};
})();
