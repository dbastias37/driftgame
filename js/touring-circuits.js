/* Original closed road circuits. Metres, radians and seconds throughout.
 * A distance-sampled ribbon is the authority for drawing, tyres and barriers.
 * Existing flat tracks and the point-to-point downhill mode keep their rules.
 */
globalThis.DriftTouring ||= (()=>{
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const wrap=(s,length)=>((s%length)+length)%length,smooth=t=>t*t*(3-2*t);
  const definitions=globalThis.DriftRoadExpeditions;
  if(!definitions?.length)throw new Error("Road expedition catalogue must load before touring");
  const dataBankFactor=d=>d.biome==='highland'?80:38;
  const cache=new Map();
  const definition=n=>definitions[clamp(Math.trunc(n)||1,1,definitions.length)-1];
  function info(n){if(n===201)return DriftSummit.info();if(n>=101&&n<=105)return {...DriftTouringLegacy.info(n-100),id:n,climate:'clear'};const d=definition(n);return {id:definitions.indexOf(d)+1,name:d.name,length:d.length,relief:d.relief,bank:d.bank,description:d.description,stage:'Carreteras · '+({clear:'Despejado',rain:'Lluvia',fog:'Bruma',snow:'Nieve'}[d.climate]),laps:4,biome:d.biome,climate:d.climate,sectors:d.landmarks,sectorBreaks:d.sectorBreaks};}
  // Monotone periodic cubic Hermite height: independent authored crests/valleys.
  // Zero derivative at extrema, harmonic derivatives elsewhere; no overshoot.
  function elevation(d,u){
    const h=d.heights,N=h.length-1,t=wrap(u,1)*N,i=Math.floor(t),v=t-i;
    const slope=k=>{const a=h[(k-1+N)%N],b=h[k%N],c=h[(k+1)%N],left=b-a,right=c-b;return left*right<=0?0:2*left*right/(left+right);};
    const a=h[i],b=h[(i+1)%N],m=slope(i),n=slope(i+1),v2=v*v,v3=v2*v;
    return (2*v3-3*v2+1)*a+(v3-2*v2+v)*m+(-2*v3+3*v2)*b+(v3-v2)*n;
  }
  function layout(n){
    const meta=info(n),d=definition(n);if(cache.has(meta.id))return cache.get(meta.id);
    // Periodic cubic B-spline: C2 at every control point, including the seam.
    // The periodic control solve preserves the authored corner positions.
    const N=d.nodes.length,dense=[];
    // Periodic interpolating C2 spline: solve B-spline controls so authored
    // hairpins remain intentional instead of being rounded into generic ovals.
    let nodes=d.nodes.map(p=>p.slice());
    for(let iteration=0;iteration<40;iteration++)nodes=nodes.map((p,i)=>[0,1].map(k=>(6*d.nodes[i][k]-nodes[(i-1+N)%N][k]-nodes[(i+1)%N][k])/4));
    for(let i=0;i<N;i++)for(let j=0;j<160;j++){
      const t=j/160,t2=t*t,t3=t2*t,w=[(1-3*t+3*t2-t3)/6,(4-6*t2+3*t3)/6,(1+3*t+3*t2-3*t3)/6,t3/6];
      const p={x:0,y:0};for(let k=0;k<4;k++){p.x+=nodes[(i+k+N-1)%N][0]*w[k];p.y+=nodes[(i+k+N-1)%N][1]*w[k];}dense.push(p);
    }
    dense.push({...dense[0]});const ends=[0];for(let i=1;i<dense.length;i++)ends.push(ends[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const total=ends.at(-1),scale=d.length/total,count=Math.ceil(d.length/4),points=[];let seg=1;
    for(let i=0;i<count;i++){
      const distance=total*i/count;while(ends[seg]<distance)seg++;
      const t=(distance-ends[seg-1])/(ends[seg]-ends[seg-1]),a=dense[seg-1],b=dense[seg];
      const h=elevation(d,i/count);
      points.push({x:(mix(a.x,b.x,t)-dense[0].x)*scale,y:(mix(a.y,b.y,t)-dense[0].y)*scale,h,s:i*d.length/count});
    }
    const point=i=>points[(i+count)%count],step=d.length/count;
    const curvature=points.map((p,i)=>{const a=point(i-4),b=point(i+4),ab=Math.hypot(p.x-a.x,p.y-a.y),bc=Math.hypot(b.x-p.x,b.y-p.y),ac=Math.hypot(b.x-a.x,b.y-a.y);return 2*((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/(ab*bc*ac);});
    const banks=curvature.map(k=>clamp(-k*(dataBankFactor(d)),-d.bank*Math.PI/180,d.bank*Math.PI/180));
    // Smooth over ~320 m; a bank never changes abruptly at a curve entry.
    for(let i=0;i<count;i++){
      let bank=0,weight=0;for(let k=-40;k<=40;k++){const w=41-Math.abs(k);bank+=banks[(i+k+count)%count]*w;weight+=w;}
      const a=point(i-1),b=point(i+1),len=Math.hypot(b.x-a.x,b.y-a.y);Object.assign(points[i],{bank:bank/weight,nx:-(b.y-a.y)/len,ny:(b.x-a.x)/len,curvature:curvature[i]});
    }
    const features=[];
    for(const [kind,ranges] of [['tunnel',d.tunnels],['bridge',d.bridges]])for(const [start,end] of ranges)features.push({kind,start:Math.round(start*count)*step,end:Math.round(end*count)*step,style:kind==='bridge'?d.bridge:'vault'});
    const result={...meta,points,count,step,features,minRadius:1/Math.max(...curvature.map(Math.abs))};cache.set(meta.id,result);return result;
  }
  function createTrack(Track,n=1){
    if(n===201)return DriftSummit.createTrack(Track);
    if(n>=101&&n<=105){const tr=DriftTouringLegacy.createTrack(Track,n-100);Object.assign(tr,{legacyId:n-100,touringId:n,climate:'clear',roadVersion:2,tunnelHalf:22,tunnelWall:10,tunnelRise:12});tr.layout=info(n);return tr;}
    const data=layout(n),points=data.points.map(p=>({...p})),tr=new Track(points),count=points.length;
    Object.assign(tr,{elevated:true,touringId:data.id,roadHalf:12,length:data.length,totalLength:data.length,maxHeight:Math.max(...points.map(p=>p.h)),minHeight:Math.min(...points.map(p=>p.h)),raceLaps:4,features:data.features.map(f=>({...f})),biome:data.biome,climate:data.climate,roadVersion:3,terrainStep:16,cutHalf:15.8,tunnelHalf:22,tunnelWall:10,tunnelRise:12});
    tr.layout={...info(n),level:0,elevated:true};
    tr.sectors=data.sectors.map((name,i)=>({name,start:(data.sectorBreaks?.[i]??i/data.sectors.length)*tr.length,end:(data.sectorBreaks?.[i+1]??(i+1)/data.sectors.length)*tr.length,kind:["meadow","forest","slope","pass","valley","open"][i]}));
    tr.sectorAt=s=>tr.sectors.find(f=>wrap(s,tr.length)>=f.start&&wrap(s,tr.length)<f.end)||tr.sectors[0];tr.normalAt=i=>{const p=tr.point(i);return {x:p.nx,y:p.ny};};
    tr.featureAt=(s,kind)=>tr.features.find(f=>(!kind||f.kind===kind)&&s>=f.start&&s<=f.end)||null;
    tr.atDistance=s=>{s=wrap(s,tr.length);const i=Math.min(count-1,Math.floor(s/data.step)),a=points[i],b=points[(i+1)%count],t=(s-a.s)/data.step;return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),h:mix(a.h,b.h,t),bank:mix(a.bank,b.bank,t),nx:mix(a.nx,b.nx,t),ny:mix(a.ny,b.ny,t),i,s};};
    const segments=points.map((p,i)=>{const q=points[(i+1)%count],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);return{p,q,i,dx,dy,len,l2:len*len,tang:Math.atan2(dy,dx),grade:(q.h-p.h)/len};}),grid=new Map(),roadGrid=new Map(),cell=48,pad=90;
    for(const seg of segments)for(let x=Math.floor((Math.min(seg.p.x,seg.q.x)-pad)/cell);x<=Math.floor((Math.max(seg.p.x,seg.q.x)+pad)/cell);x++)for(let y=Math.floor((Math.min(seg.p.y,seg.q.y)-pad)/cell);y<=Math.floor((Math.max(seg.p.y,seg.q.y)+pad)/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);}
    for(const seg of segments)for(let x=Math.floor((Math.min(seg.p.x,seg.q.x)-22)/24);x<=Math.floor((Math.max(seg.p.x,seg.q.x)+22)/24);x++)for(let y=Math.floor((Math.min(seg.p.y,seg.q.y)-22)/24);y<=Math.floor((Math.max(seg.p.y,seg.q.y)+22)/24);y++){const key=x+','+y;if(!roadGrid.has(key))roadGrid.set(key,[]);roadGrid.get(key).push(seg);}
    tr.sample=(x,y)=>{
      const local=roadGrid.get(Math.floor(x/24)+','+Math.floor(y/24))||grid.get(Math.floor(x/cell)+','+Math.floor(y/cell))||segments;let best=Infinity,a,t,cx,cy;
      for(const seg of local){const f=clamp(((x-seg.p.x)*seg.dx+(y-seg.p.y)*seg.dy)/seg.l2,0,1),px=seg.p.x+seg.dx*f,py=seg.p.y+seg.dy*f,d=(px-x)**2+(py-y)**2;if(d<best){best=d;a=seg;t=f;cx=px;cy=py;}}
      const offset=(-(x-cx)*a.dy+(y-cy)*a.dx)/a.len,bank=mix(a.p.bank,a.q.bank,t);
      return {cx,cy,tang:a.tang,dist:-offset,offset,distance:Math.sqrt(best),h:mix(a.p.h,a.q.h,t),bank,grade:a.grade+offset*(Math.tan(a.q.bank)-Math.tan(a.p.bank))/a.len,i:a.i,s:wrap(a.p.s+t*data.step,tr.length)};
    };
    tr.sampleNearby=(x,y)=>grid.has(Math.floor(x/cell)+','+Math.floor(y/cell))?tr.sample(x,y):null;
    tr.nearestIndex=(x,y)=>tr.sample(x,y).i;
    tr.ribbonPoint=(s,offset=0,lift=0)=>{const p=tr.atDistance(s);return {x:p.x+p.nx*offset,y:p.y+p.ny*offset,h:p.h+Math.tan(p.bank)*offset+lift};};
    const b=tr.bounds,cx=b.minX+b.w/2,cy=b.minY+b.h/2;
    const hills=Array.from({length:24},(_,i)=>tr.atDistance(i*tr.length/24));
    const ridges=[.14,.31,.47,.68,.86].map((u,i)=>{const p=tr.atDistance(u*tr.length),offset=(i%2?1:-1)*(160+i*32);return {x:p.x+p.nx*offset,y:p.y+p.ny*offset,r:220+i*34,height:55+(tr.maxHeight-tr.minHeight)*.45+i*7};});
    tr.baseHeight=(x,y)=>{
      let sum=0,weight=0;for(const p of hills){const d=(x-p.x)**2+(y-p.y)**2+180**2,w=1/(d*Math.sqrt(d));sum+=p.h*w;weight+=w;}
      let h=sum/weight-5+9*Math.sin((x-cx)*.0023)*Math.cos((y-cy)*.0031);
      for(const ridge of ridges)h+=ridge.height*Math.exp(-((x-ridge.x)**2+(y-ridge.y)**2)/(ridge.r*ridge.r));
      if(tr.biome==='lake')h-=110*Math.exp(-((x-cx)**2+(y-cy)**2)/(Math.min(b.w,b.h)*.24)**2);
      if(tr.biome==='coast')h-=130*smooth(clamp((x-b.maxX+80)/240,0,1));
      return h;
    };
    tr.terrainHeight=(x,y)=>{
      const q=tr.sampleNearby(x,y),base=tr.baseHeight(x,y);if(!q)return base;
      const road=q.h+clamp(q.offset,-tr.cutHalf,tr.cutHalf)*Math.tan(q.bank);
      const bridge=tr.features.find(f=>f.kind==='bridge'&&q.s>f.start-65&&q.s<f.end+65);
      const cut=bridge?smooth(clamp(Math.min(q.s-bridge.start+65,bridge.end+65-q.s)/65,0,1)):0;
      const edge=mix(road,Math.min(base,q.h-23),cut),blend=smooth(clamp((q.distance-tr.cutHalf)/65,0,1));
      return mix(edge,base,blend);
    };
    tr.surfaceHeight=(x,y)=>{const q=tr.sampleNearby(x,y);if(q&&q.distance<=tr.cutHalf)return q.h+q.offset*Math.tan(q.bank)+(globalThis.DriftRoadContact?.profile(q.distance-tr.roadHalf)||0);return tr.terrainHeight(x,y);};
    tr.cameraFloor=(x,y)=>{const q=tr.sampleNearby(x,y);return q&&q.distance<tr.cutHalf?tr.surfaceHeight(x,y):tr.terrainHeight(x,y);};
    return tr;
  }
  function gravity(q){const slope=Math.tan(q.bank),denom=1+q.grade*q.grade+slope*slope,g=-9.81/denom,c=Math.cos(q.tang),s=Math.sin(q.tang);return {x:g*(q.grade*c-slope*s),y:g*(q.grade*s+slope*c)};}
  function beforeStep(track,car,dt,input){
    const q=track.sample(car.pos.x,car.pos.y),g=gravity(q);
    car.gradeLoad=-car.mass*(g.x*Math.cos(car.angle)+g.y*Math.sin(car.angle));
    car.hitTimer=Math.max(0,(car.hitTimer||0)-dt);
    const hold=!!(input.brake||input.handbrake)&&!input.accel&&car.worldSpeed()<.8;
    car._touringHold=hold?{...car.pos}:null;
    if(!hold){car.vel.x+=g.x*dt;car.vel.y+=g.y*dt;}
  }
  function afterStep(track,car){
    if(car._touringHold){Object.assign(car.pos,car._touringHold);car.vel.x=car.vel.y=car.omega=0;}
    const q=track.sample(car.pos.x,car.pos.y),angle=car.angle-q.tang,dimensions=car.bodyDimensions||{length:4.4,width:1.96};
    const extent=Math.abs(Math.cos(angle))*dimensions.width/2+Math.abs(Math.sin(angle))*dimensions.length/2;
    const limit=(track.barrierHalfAt?track.barrierHalfAt(q):track.roadHalf+1.4)-extent;
    if(Math.abs(q.offset)>limit){
      const sign=Math.sign(q.offset),nx=-Math.sin(q.tang)*sign,ny=Math.cos(q.tang)*sign,out=car.vel.x*nx+car.vel.y*ny;
      car.pos.x=q.cx+nx*limit;car.pos.y=q.cy+ny*limit;
      if(out>0){car.vel.x-=out*1.12*nx;car.vel.y-=out*1.12*ny;car.omega*=.6;car.breakFlow();car.hitTimer=.2;car.touringImpacts=(car.touringImpacts||0)+1;}
    }
  }
  function constrainCamera(track,car,position,target,mounted=false){
    const q=track.sample(position.x,position.z),feature=track.features.find(f=>f.kind==='tunnel'&&q.s>=f.start-12&&q.s<=f.end+12);
    if(!feature)return false;
    // Preserve yaw, look target, FOV and tracking spring. Only project an unsafe
    // eye into the enlarged vault. Ordinary chase/onboard poses are unchanged.
    const half=track.summit?track.widthAt(q.s)+.8:track.tunnelHalf||22,margin=.9,side=clamp(q.offset,-half+margin,half-margin);
    if(side!==q.offset){position.x=q.cx-Math.sin(q.tang)*side;position.z=q.cy+Math.cos(q.tang)*side;}
    const p=track.atDistance(q.s),road=p.h+Math.tan(p.bank)*side;
    const ceiling=track.summit?feature.clearance-margin:(track.tunnelWall||10)+(track.tunnelRise||12)*Math.sqrt(Math.max(0,1-(side/half)**2))-margin;
    // Begin lowering tall aerial views before the portal, without a hard cut.
    const inside=q.s>=feature.start&&q.s<=feature.end;
    const blend=inside?1:smooth(clamp(Math.min(q.s-feature.start+12,feature.end+12-q.s)/12,0,1));
    const safe=clamp(position.y,road+.2,road+ceiling);
    position.y=mix(position.y,safe,blend);
    return true;
  }
  function cameraDistanceScale(track,s){
    let proximity=0;
    for(const f of track.features||[])if(f.kind==='tunnel')proximity=Math.max(proximity,smooth(clamp(Math.min(s-f.start+28,f.end+28-s)/28,0,1)));
    return 1-.2*proximity;
  }
  return Object.freeze({count:definitions.length,info,layout,createTrack,gravity,beforeStep,afterStep,constrainCamera,cameraDistanceScale});
})();
