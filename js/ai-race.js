/* Offline opponents use the same fixed-step vehicle forces as the player. */
globalThis.DriftRace=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function grid(car,track,slot){const p=track.point(0),a=track.tangentAt(0),back=Math.floor(slot/2)*6;car.pos.x=p.x-Math.cos(a)*back-Math.sin(a)*(slot%2?3:-3);car.pos.y=p.y-Math.sin(a)*back+Math.cos(a)*(slot%2?3:-3);car.angle=a;}
  function drive(car,track,index=track.nearestIndex(car.pos.x,car.pos.y)){
    const speed=car.worldSpeed(),spacing=track.totalLength/track.points.length||4,look=Math.max(4,Math.round((7+speed*.8)/spacing)),target=track.point(index+look),distance=Math.hypot(target.x-car.pos.x,target.y-car.pos.y),error=wrap(Math.atan2(target.y-car.pos.y,target.x-car.pos.x)-car.angle);
    const bend=Math.abs(wrap(track.tangentAt(index+look+3)-track.tangentAt(index))),grip=(DriftOptions.weathers[car.conditions?.weather]||DriftOptions.weathers.clear).grip;
    const desired=clamp(25-bend*21-Math.abs(error)*7,9,25)*Math.sqrt(grip)*(car.pace||1);
    const steering=Math.atan2(2*Math.sin(error)*car.length,Math.max(2,distance))*1.30;
    const factor=clamp(1/(1+speed*.065),.18,1),axis=clamp(steering/(car.maxSteer*factor),-1,1);
    return {steerAxis:axis,accel:speed<desired,brake:speed>desired+1.2,handbrake:false};
  }
  function collide(a,b){
    const axes=car=>[{x:Math.cos(car.angle),y:Math.sin(car.angle)},{x:-Math.sin(car.angle),y:Math.cos(car.angle)}],aa=axes(a),bb=axes(b),ad=a.bodyDimensions||{length:4.4,width:1.8},bd=b.bodyDimensions||{length:4.4,width:1.8};
    const delta={x:b.pos.x-a.pos.x,y:b.pos.y-a.pos.y};if(Math.hypot(delta.x,delta.y)>(ad.length+bd.length)*.6)return false;
    let depth=Infinity,normal;
    for(const n of [...aa,...bb]){const ra=Math.abs(n.x*aa[0].x+n.y*aa[0].y)*ad.length*.5+Math.abs(n.x*aa[1].x+n.y*aa[1].y)*ad.width*.5,rb=Math.abs(n.x*bb[0].x+n.y*bb[0].y)*bd.length*.5+Math.abs(n.x*bb[1].x+n.y*bb[1].y)*bd.width*.5,d=delta.x*n.x+delta.y*n.y,overlap=ra+rb-Math.abs(d);if(overlap<=0)return false;if(overlap<depth){depth=overlap;normal={x:n.x*Math.sign(d||1),y:n.y*Math.sign(d||1)};}}
    const ia=1/a.mass,ib=1/b.mass,total=ia+ib,fix=Math.max(0,depth-.015)*.85/total;
    a.pos.x-=normal.x*fix*ia;a.pos.y-=normal.y*fix*ia;b.pos.x+=normal.x*fix*ib;b.pos.y+=normal.y*fix*ib;
    const relative=(b.vel.x-a.vel.x)*normal.x+(b.vel.y-a.vel.y)*normal.y;
    if(relative<0){const impulse=-(1+.15)*relative/total;for(const [c,sign,inv] of [[a,-1,ia],[b,1,ib]]){c.vel.x+=normal.x*impulse*sign*inv;c.vel.y+=normal.y*impulse*sign*inv;c.hitTimer=.5;if(relative<-1.5)c.breakFlow?.();}}
    return true;
  }
  function presentation(cars,elapsed){const progress=clamp(elapsed/2.4,0,1),remaining=4*(1-progress)**2;return cars.map(car=>({...car,pos:{x:car.pos.x-Math.cos(car.angle)*remaining,y:car.pos.y-Math.sin(car.angle)*remaining},wheelTravel:4-remaining,worldSpeed(){return 0;}}));}
  class Race{
    constructor(track,player,cars,{collisions=false,laps=5}={}){this.track=track;this.player=player;this.cars=cars;this.collisions=collisions;this.laps=laps;this.clock=0;this.total=track.points.length;this.entries=new Map();[player,...cars].forEach((car,slot)=>{grid(car,track,slot);this.entries.set(car,{index:track.nearestIndex(car.pos.x,car.pos.y),distance:-Math.floor(slot/2)*1.5,gate:1,lap:0,finished:0});});}
    step(dt){
      this.clock+=dt;
      for(const car of this.cars){const info=this.entries.get(car);car.update(dt,drive(car,this.track),this.track);DriftRoadContact.update(this.track,car,dt,car.skin);
        if(car.offTimer>4||car.wrongWay&&(car.wrongTime=(car.wrongTime||0)+dt)>3){const i=info.index,p=this.track.point(i);car.pos={x:p.x,y:p.y};car.angle=this.track.tangentAt(i);car.vel={x:0,y:0};car.omega=0;car.offTimer=car.wrongTime=0;DriftDynamics.reset(car);DriftRoadContact.reset(this.track,car,car.skin);}
        if(!car.wrongWay)car.wrongTime=0;
      }
      if(this.collisions){const cars=[this.player,...this.cars];for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)collide(cars[a],cars[b]);}
      for(const [car,info] of this.entries){if(info.finished)continue;const index=this.track.nearestIndex(car.pos.x,car.pos.y);let di=index-info.index;if(di>this.total/2)di-=this.total;if(di<-this.total/2)di+=this.total;
        if(!car.offTrack&&Math.abs(di)<Math.max(8,this.total*.04)){info.distance+=di;if(di>0){if(info.index>this.total*.75&&index<this.total*.25){if(info.gate===4){info.lap++;if(info.lap>=this.laps)info.finished=this.clock;}info.gate=1;}else if(info.gate<4&&info.index<this.total*info.gate/4&&index>=this.total*info.gate/4)info.gate++;}}
        info.index=index;
      }
    }
    standings(){return [...this.entries].sort((a,b)=>{const x=a[1],y=b[1];return x.finished||y.finished?(x.finished||Infinity)-(y.finished||Infinity):y.distance-x.distance;}).map(([car,info])=>({car,...info}));}
    place(){return this.standings().findIndex(e=>e.car===this.player)+1;}
    presentation(elapsed){return presentation([this.player,...this.cars],elapsed);}
  }
  return {Race,grid,drive,collide,presentation};
})();
