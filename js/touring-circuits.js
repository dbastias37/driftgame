/* Original closed road circuits. Metres, radians and seconds throughout.
 * A distance-sampled ribbon is the authority for drawing, tyres and barriers.
 * Existing flat tracks and the point-to-point downhill mode keep their rules.
 */
globalThis.DriftTouring ||= (()=>{
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const wrap=(s,length)=>((s%length)+length)%length,smooth=t=>t*t*(3-2*t);
  const definitions=[
    {name:'Sierra del Cóndor',length:6400,relief:76,bank:6,biome:'alpine',bridge:'truss',
      description:'Ascenso al macizo, túnel iluminado y viaducto de acero sobre el valle.',
      nodes:[[0,0],[550,0],[1000,-80],[1260,-340],[1120,-650],[780,-720],[550,-530],[270,-590],[140,-940],[-200,-1120],[-600,-930],[-820,-590],[-660,-220],[-300,-40]],tunnels:[[.28,.345]],bridges:[[.69,.755]]},
    {name:'Costa del Viento',length:6800,relief:58,bank:5,biome:'coast',bridge:'arch',
      description:'Curvas abiertas junto al mar, dos pasos en roca y un puente de arcos.',
      nodes:[[0,0],[700,0],[1220,-100],[1550,-400],[1350,-690],[1000,-720],[730,-480],[450,-490],[300,-830],[-50,-1080],[-450,-1020],[-730,-700],[-650,-360],[-380,-130]],tunnels:[[.23,.28],[.51,.565]],bridges:[[.78,.84]]},
    {name:'Bosque de los Pinos',length:7200,relief:92,bank:6,biome:'forest',bridge:'truss',
      description:'Bosque profundo, eses de radio largo y una galería excavada en la montaña.',
      nodes:[[0,0],[650,0],[1080,-240],[1160,-600],[870,-820],[470,-760],[280,-1030],[-80,-1210],[-410,-960],[-340,-650],[-620,-450],[-800,-160],[-560,130],[-240,70]],tunnels:[[.38,.455]],bridges:[[.64,.705]]},
    {name:'Embalse Alto',length:7800,relief:108,bank:7,biome:'lake',bridge:'arch',
      description:'Vuelta al embalse, subida panorámica, túnel de cumbre y viaducto de hormigón.',
      nodes:[[0,0],[850,0],[1400,-240],[1510,-660],[1270,-1000],[850,-1100],[540,-910],[210,-1000],[-80,-1340],[-470,-1280],[-680,-950],[-530,-620],[-850,-430],[-790,-120],[-400,10]],tunnels:[[.32,.40]],bridges:[[.60,.68]]},
    {name:'Anillo de la Cumbre',length:8400,relief:68,bank:9,biome:'highland',bridge:'truss',
      description:'Grandes curvas peraltadas, rectas rápidas y un largo túnel bajo la cumbre.',
      nodes:[[0,0],[900,0],[1500,-220],[1770,-650],[1510,-1120],[900,-1350],[250,-1190],[-280,-1290],[-830,-990],[-1010,-530],[-690,-130]],tunnels:[[.27,.35]],bridges:[[.72,.79]]},
  ];
  const dataBankFactor=d=>d.biome==='highland'?80:38;
  const cache=new Map();
  const definition=n=>definitions[clamp(Math.trunc(n)||1,1,definitions.length)-1];
  function info(n){const d=definition(n);return {id:definitions.indexOf(d)+1,name:d.name,length:d.length,relief:d.relief,bank:d.bank,description:d.description,stage:'Circuitos 2.0',laps:4,biome:d.biome};}
  function layout(n){
    const meta=info(n),d=definition(n);if(cache.has(meta.id))return cache.get(meta.id);
    // Periodic cubic B-spline: C2 at every control point, including the seam.
    // Convex weights prevent the overshoot of a loosely drawn Catmull spline.
    const nodes=d.nodes,N=nodes.length,dense=[];
    for(let i=0;i<N;i++)for(let j=0;j<160;j++){
      const t=j/160,t2=t*t,t3=t2*t,w=[(1-3*t+3*t2-t3)/6,(4-6*t2+3*t3)/6,(1+3*t+3*t2-3*t3)/6,t3/6];
      const p={x:0,y:0};for(let k=0;k<4;k++){p.x+=nodes[(i+k+N-1)%N][0]*w[k];p.y+=nodes[(i+k+N-1)%N][1]*w[k];}dense.push(p);
    }
    dense.push({...dense[0]});const ends=[0];for(let i=1;i<dense.length;i++)ends.push(ends[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const total=ends.at(-1),scale=d.length/total,count=Math.ceil(d.length/4),points=[];let seg=1;
    for(let i=0;i<count;i++){
      const distance=total*i/count;while(ends[seg]<distance)seg++;
      const t=(distance-ends[seg-1])/(ends[seg]-ends[seg-1]),a=dense[seg-1],b=dense[seg];
      const phase=i/count*TAU,h=34+d.relief*(.5-.5*Math.cos(phase))+.07*d.relief*Math.sin(phase*2)**2;
      points.push({x:(mix(a.x,b.x,t)-dense[0].x)*scale,y:(mix(a.y,b.y,t)-dense[0].y)*scale,h,s:i*d.length/count});
    }
    const point=i=>points[(i+count)%count],step=d.length/count;
    const curvature=points.map((p,i)=>{const a=point(i-4),b=point(i+4),ab=Math.hypot(p.x-a.x,p.y-a.y),bc=Math.hypot(b.x-p.x,b.y-p.y),ac=Math.hypot(b.x-a.x,b.y-a.y);return 2*((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/(ab*bc*ac);});
    const banks=curvature.map(k=>clamp(-k*(dataBankFactor(d)),-d.bank*Math.PI/180,d.bank*Math.PI/180));
    // Smooth over ~120 m; a bank never changes abruptly at a curve entry.
    for(let i=0;i<count;i++){
      let bank=0,weight=0;for(let k=-15;k<=15;k++){const w=16-Math.abs(k);bank+=banks[(i+k+count)%count]*w;weight+=w;}
      const a=point(i-1),b=point(i+1),len=Math.hypot(b.x-a.x,b.y-a.y);Object.assign(points[i],{bank:bank/weight,nx:-(b.y-a.y)/len,ny:(b.x-a.x)/len,curvature:curvature[i]});
    }
    const features=[];
    for(const [kind,ranges] of [['tunnel',d.tunnels],['bridge',d.bridges]])for(const [start,end] of ranges)features.push({kind,start:Math.round(start*count)*step,end:Math.round(end*count)*step,style:kind==='bridge'?d.bridge:'vault'});
    const result={...meta,points,count,step,features,minRadius:1/Math.max(...curvature.map(Math.abs))};cache.set(meta.id,result);return result;
  }
  function createTrack(Track,n=1){
    const data=layout(n),points=data.points.map(p=>({...p})),tr=new Track(points),count=points.length;
    Object.assign(tr,{elevated:true,touringId:data.id,roadHalf:12,length:data.length,totalLength:data.length,maxHeight:Math.max(...points.map(p=>p.h)),minHeight:Math.min(...points.map(p=>p.h)),raceLaps:4,features:data.features.map(f=>({...f})),biome:data.biome,terrainStep:16,cutHalf:15.8});
    tr.layout={...info(n),level:0,elevated:true};tr.normalAt=i=>{const p=tr.point(i);return {x:p.nx,y:p.ny};};
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
    tr.baseHeight=(x,y)=>{
      let sum=0,weight=0;for(const p of hills){const d=(x-p.x)**2+(y-p.y)**2+180**2,w=1/(d*Math.sqrt(d));sum+=p.h*w;weight+=w;}
      let h=sum/weight-5+9*Math.sin((x-cx)*.0023)*Math.cos((y-cy)*.0031);
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
    car.hitTimer=Math.max(0,(car.hitTimer||0)-dt);
    const hold=!!(input.brake||input.handbrake)&&!input.accel&&car.worldSpeed()<.8;
    car._touringHold=hold?{...car.pos}:null;
    if(!hold){car.vel.x+=g.x*dt;car.vel.y+=g.y*dt;}
  }
  function afterStep(track,car){
    if(car._touringHold){Object.assign(car.pos,car._touringHold);car.vel.x=car.vel.y=car.omega=0;}
    const q=track.sample(car.pos.x,car.pos.y),angle=car.angle-q.tang,dimensions=car.bodyDimensions||{length:4.4,width:1.96};
    const extent=Math.abs(Math.cos(angle))*dimensions.width/2+Math.abs(Math.sin(angle))*dimensions.length/2;
    const limit=track.roadHalf+1.4-extent;
    if(Math.abs(q.offset)>limit){
      const sign=Math.sign(q.offset),nx=-Math.sin(q.tang)*sign,ny=Math.cos(q.tang)*sign,out=car.vel.x*nx+car.vel.y*ny;
      car.pos.x=q.cx+nx*limit;car.pos.y=q.cy+ny*limit;
      if(out>0){car.vel.x-=out*1.12*nx;car.vel.y-=out*1.12*ny;car.omega*=.6;car.breakFlow();car.hitTimer=.2;car.touringImpacts=(car.touringImpacts||0)+1;}
    }
  }
  function constrainCamera(track,car,position,target,mounted=false){
    const q=track.sample(car.pos.x,car.pos.y),near=track.features.find(f=>f.kind==='tunnel'&&q.s>f.start-22&&q.s<f.end+22);
    if(!near)return false;
    // Exterior aerial shots automatically follow from inside the tunnel. Keep
    // the player's selected camera; restore its framing when the car emerges.
    if(!mounted){position.x=car.pos.x-Math.cos(car.angle)*11;position.z=car.pos.y-Math.sin(car.angle)*11;position.y=track.surfaceHeight(position.x,position.z)+4.2;}
    const sample=track.sample(position.x,position.z),side=clamp(sample.offset,-track.roadHalf+1,track.roadHalf-1);
    position.x=sample.cx-Math.sin(sample.tang)*side;position.z=sample.cy+Math.cos(sample.tang)*side;
    const road=track.surfaceHeight(position.x,position.z);position.y=clamp(position.y,road+.2,road+6.3);
    if(target&&!mounted){target.x=car.pos.x+Math.cos(car.angle)*10;target.z=car.pos.y+Math.sin(car.angle)*10;target.y=track.surfaceHeight(target.x,target.z)+1;}
    return true;
  }
  return Object.freeze({count:definitions.length,info,layout,createTrack,gravity,beforeStep,afterStep,constrainCamera});
})();
