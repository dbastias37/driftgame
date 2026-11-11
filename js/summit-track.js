/* Summit's scenery and native driving surface share the same coordinate system.
 * No GLB parsing, raycasts or allocations of scene meshes in the physics loop.
 */
globalThis.DriftSummit = (()=>{
  'use strict';
  const ID=201,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const wrap=(v,n)=>((v%n)+n)%n;
  let prepared;
  function data(){
    if(prepared)return prepared;
    const source=globalThis.DriftSummitData;
    if(!source?.sections?.length)throw new Error('Summit driving data is missing');
    const raw=source.sections.map(([x,y,h,left,right,bank])=>({x,y,h,left,right,bank})),ends=[0];
    raw.forEach((p,i)=>{const q=raw[(i+1)%raw.length];ends.push(ends.at(-1)+Math.hypot(q.x-p.x,q.y-p.y));});
    const length=ends.at(-1),count=Math.ceil(length/3),step=length/count;
    function at(s){
      s=wrap(s,length);let lo=0,hi=raw.length;
      while(lo+1<hi){const mid=(lo+hi)>>1;if(ends[mid]<=s)lo=mid;else hi=mid;}
      const p=raw[lo],q=raw[(lo+1)%raw.length],t=(s-ends[lo])/(ends[lo+1]-ends[lo]),dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
      return {x:mix(p.x,q.x,t),y:mix(p.y,q.y,t),h:mix(p.h,q.h,t),bank:mix(p.bank,q.bank,t),left:mix(p.left,q.left,t),right:mix(p.right,q.right,t),nx:-dy/len,ny:dx/len,s,i:Math.min(count-1,Math.floor(s/step))};
    }
    const points=Array.from({length:count},(_,i)=>at(i*step));
    const segments=raw.map((p,i)=>{const q=raw[(i+1)%raw.length],dx=q.x-p.x,dy=q.y-p.y,len=ends[i+1]-ends[i];return {p,q,dx,dy,len,l2:len*len,s:ends[i],tang:Math.atan2(dy,dx),grade:(q.h-p.h)/len};});
    function grid(items,bounds,pad=0){
      const result=new Map();items.forEach(item=>{const b=bounds(item);for(let x=Math.floor((b[0]-pad)/32);x<=Math.floor((b[2]+pad)/32);x++)for(let y=Math.floor((b[1]-pad)/32);y<=Math.floor((b[3]+pad)/32);y++){const key=x+','+y;if(!result.has(key))result.set(key,[]);result.get(key).push(item);}});return result;
    }
    const roadGrid=grid(segments,a=>[Math.min(a.p.x,a.q.x),Math.min(a.p.y,a.q.y),Math.max(a.p.x,a.q.x),Math.max(a.p.y,a.q.y)],45);
    const supportGrid=grid(source.support,t=>[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7])]);
    prepared={...source,raw,points,segments,roadGrid,supportGrid,length,step,at};return prepared;
  }
  function info(){const d=data();return {id:ID,name:'Summit',length:d.length,biome:'snow',climate:'snow',stage:'Summit · ruta alpina',laps:4,description:'Bosque nevado, pueblo alpino, desfiladeros y túneles. Recorrido del modelo Summit con la conducción de DR1FT.',relief:251};}
  function createTrack(Track){
    const d=data(),tr=new Track(d.points.map(p=>({...p})));
    Object.assign(tr,{summit:true,elevated:true,touringId:ID,roadVersion:3,roadHalf:5.5,cutHalf:7,length:d.length,totalLength:d.length,raceLaps:4,biome:'snow',climate:'snow',maxHeight:Math.max(...d.raw.map(p=>p.h)),minHeight:Math.min(...d.raw.map(p=>p.h)),features:d.features.map(f=>({...f})),tunnelHalf:7,tunnelWall:3,tunnelRise:3,curbs:false,layout:{...info(),level:0,elevated:true}});
    tr.atDistance=d.at;
    tr.sample=(x,y)=>{
      const candidates=d.roadGrid.get(Math.floor(x/32)+','+Math.floor(y/32))||d.segments;
      let best=Infinity,segment,t,cx,cy;
      for(const a of candidates){const f=clamp(((x-a.p.x)*a.dx+(y-a.p.y)*a.dy)/a.l2,0,1),px=a.p.x+a.dx*f,py=a.p.y+a.dy*f,dist=(x-px)**2+(y-py)**2;if(dist<best){best=dist;segment=a;t=f;cx=px;cy=py;}}
      const a=segment,offset=(-(x-cx)*a.dy+(y-cy)*a.dx)/a.len,s=wrap(a.s+t*a.len,d.length);
      return {cx,cy,s,i:Math.floor(s/d.step),tang:a.tang,offset,dist:-offset,distance:Math.sqrt(best),h:mix(a.p.h,a.q.h,t),grade:a.grade,bank:mix(a.p.bank,a.q.bank,t),left:mix(a.p.left,a.q.left,t),right:mix(a.p.right,a.q.right,t)};
    };
    tr.sampleNearby=(x,y)=>d.roadGrid.has(Math.floor(x/32)+','+Math.floor(y/32))?tr.sample(x,y):null;
    tr.nearestIndex=(x,y)=>tr.sample(x,y).i;
    tr.widthAt=s=>{const p=d.at(s);return Math.min(p.left,p.right);};
    tr.barrierHalfAt=q=>(q.offset<0?q.left:q.right)+1.15;
    tr.featureAt=(s,kind)=>tr.features.find(f=>(!kind||f.kind===kind)&&wrap(s,tr.length)>=f.start&&wrap(s,tr.length)<=f.end)||null;
    tr.surfaceHeight=(x,y)=>{
      const q=tr.sample(x,y),expected=q.h+q.offset*Math.tan(q.bank);
      const candidates=d.supportGrid.get(Math.floor(x/32)+','+Math.floor(y/32))||[];
      let best=Infinity,height=expected;
      for(const t of candidates){
        const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-8)continue;
        const a=((t[4]-t[7])*(x-t[6])+(t[6]-t[3])*(y-t[7]))/den,b=((t[7]-t[1])*(x-t[6])+(t[0]-t[6])*(y-t[7]))/den;
        if(a<-.00001||b<-.00001||a+b>1.00001)continue;
        const h=a*t[2]+b*t[5]+(1-a-b)*t[8],error=Math.abs(h-expected);
        if(error<best){best=error;height=h;}
      }
      return height;
    };
    tr.terrainHeight=tr.surfaceHeight;tr.cameraFloor=tr.surfaceHeight;
    tr.ribbonPoint=(s,offset=0,lift=0)=>{const p=d.at(s),x=p.x+p.nx*offset,y=p.y+p.ny*offset;return {x,y,h:tr.surfaceHeight(x,y)+lift};};
    const names=['Bosque de partida','Ascenso alpino','Pueblo de montaña','Paso de la cumbre','Descenso de roca','Regreso al valle'];
    tr.sectors=names.map((name,i)=>({name,start:tr.length*i/names.length,end:tr.length*(i+1)/names.length}));
    tr.sectorAt=s=>tr.sectors[Math.min(names.length-1,Math.floor(wrap(s,tr.length)/tr.length*names.length))];
    return tr;
  }
  return Object.freeze({id:ID,info,createTrack});
})();
