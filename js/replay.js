/* Local pose recording only. Playback never calls a physics step or restores a live car. */
globalThis.DriftReplay=(()=>{
  const STRIDE=31,HZ=20,MAX_SECONDS=600;
  const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  class Recorder{
    constructor(seconds=MAX_SECONDS){this.maxSeconds=seconds;this.capacity=Math.ceil(seconds*HZ)+1;this.clear();}
    clear(){this.count=0;this.head=0;this.lastTime=-Infinity;this.channels=new Map();this.times=new Float64Array(this.capacity);this.meta=null;}
    reset(meta){this.clear();this.meta=meta;}
    index(i){return (this.head-this.count+i+this.capacity)%this.capacity;}
    get start(){return this.count?this.times[this.index(0)]:0;}
    get end(){return this.count?this.times[this.index(this.count-1)]:0;}
    get duration(){return this.end-this.start;}
    get bytes(){return this.times.byteLength+[...this.channels.values()].reduce((s,c)=>s+c.data.byteLength,0);}
    capture(time,player,rivals=[]){
      if(!this.meta||!Number.isFinite(time)||time-this.lastTime<1/HZ-1e-6)return false;
      const slot=this.head;this.times[slot]=time;
      for(const [id,car,skin] of [['self',player,this.meta.skin],...rivals.slice(0,2).map(c=>[c.id,c,c.skin])]){
        let channel=this.channels.get(id);
        if(!channel){channel={id,skin,name:car.name||'',color:car.color,dimensions:car.bodyDimensions?{...car.bodyDimensions}:null,data:new Float32Array(this.capacity*STRIDE),last:null,travel:0,first:time};this.channels.set(id,channel);}
        const r=car.ride||{},d=car.descent||{},a=channel.data,k=slot*STRIDE,last=channel.last;
        const cut=last&&(Math.hypot(car.pos.x-last.x,car.pos.y-last.y)>18||(last.falling&&d.motion!=='falling'))?1:0;
        const rolling=car.vel.x*Math.cos(car.angle)+car.vel.y*Math.sin(car.angle);
        if(last&&!cut)channel.travel+=(rolling+last.rolling)*.5*Math.min(.25,time-last.time);
        const values=[car.pos.x,car.pos.y,car.angle,car.vel.x,car.vel.y,car.steerAngle||0,car.omega||0,car.gear||1,car.handbrake?1:0,r.height||0,r.roll||0,r.pitch||0,...[0,1,2,3].map(i=>r.wheels?.[i]?.height||0),d.motion==='falling'?1:0,d.y||0,d.roll||0,d.pitch||0,car.score||0,car.mult||1,car.comboPoints||0,car.driftTime||0,car.redBlink?1:0,cut,d.s||0,car.descent?1:0,car.trailOn?1:0,1,channel.travel];
        a.set(values,k);channel.last={x:car.pos.x,y:car.pos.y,falling:d.motion==='falling',rolling,time};
      }
      // Missing rivals are marked, never filled with a stale overwritten ring slot.
      const ids=new Set(rivals.slice(0,2).map(c=>c.id));for(const [id,c] of this.channels)if(id!=='self'&&!ids.has(id))c.data[slot*STRIDE+29]=0;
      this.head=(slot+1)%this.capacity;this.count=Math.min(this.capacity,this.count+1);this.lastTime=time;while(this.count>1&&time-this.start>this.maxSeconds+1e-6)this.count--;return true;
    }
    sample(time){
      if(!this.count)return null;time=Math.max(this.start,Math.min(this.end,time));
      let lo=0,hi=this.count-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(this.times[this.index(mid)]<=time)lo=mid;else hi=mid-1;}
      const i=this.index(lo),j=this.index(Math.min(this.count-1,lo+1)),ta=this.times[i],tb=this.times[j],u=tb>ta?(time-ta)/(tb-ta):0;
      const poses=[];
      for(const c of this.channels.values()){
        if(time<c.first)continue;const a=i*STRIDE,b=j*STRIDE,buffer=c.data;if(!buffer[a+29])continue;
        const t=buffer[b+25]||!buffer[b+29]?0:u;
        const get=n=>buffer[a+n]+(buffer[b+n]-buffer[a+n])*t,pick=n=>buffer[(t<.5?a:b)+n],rot=n=>angle(buffer[a+n],buffer[b+n],t);
        const pose={id:c.id,skin:c.skin,name:c.name,color:c.color,bodyDimensions:c.dimensions,pos:{x:get(0),y:get(1)},angle:rot(2),vel:{x:get(3),y:get(4)},steerAngle:get(5),omega:get(6),gear:pick(7),handbrake:!!pick(8),score:get(20),mult:pick(21),comboState:pick(21),comboPoints:get(22),driftTime:get(23),redBlink:!!pick(24),trailOn:!!pick(28),wheelTravel:get(30),smoke:[],tireTrails:[],worldSpeed(){return Math.hypot(this.vel.x,this.vel.y);}};
        pose.ride={height:get(9),roll:rot(10),pitch:rot(11),wheels:DriftRoadContact.wheelOffsets(c.skin).map((p,n)=>({...p,height:get(12+n)}))};
        if(pick(27))pose.descent={motion:pick(16)?'falling':'driving',y:get(17),roll:rot(18),pitch:rot(19),s:get(26)};
        poses.push(pose);
      }
      return {time,player:poses.find(p=>p.id==='self'),rivals:poses.filter(p=>p.id!=='self')};
    }
  }
  return {Recorder,MAX_SECONDS,HZ};
})();
