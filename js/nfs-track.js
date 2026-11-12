/* Summit's scenery and native driving surface share the same coordinate system.
 * No GLB parsing, raycasts or allocations of scene meshes in the physics loop.
 */
globalThis.DriftNFS = (()=>{
  'use strict';
  const catalog=[{id:201,slug:'summit',name:'Summit',asset:'summit.glb',climate:'snow',biome:'snow',description:'Bosque nevado, pueblo alpino, desfiladeros y túneles.'},{id:202,slug:'rocky',name:'Rocky Pass',asset:'rocky-pass.glb',climate:'clear',biome:'alpine',description:'Paso de montaña, bosque, barrancos y túneles de roca.'},{id:203,slug:'redrock',name:'Redrock Ridge',asset:'redrock-ridge.glb',climate:'clear',biome:'highland',description:'Cañones de roca roja, pueblo del desierto, puentes y galerías.'}];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const wrap=(v,n)=>((v%n)+n)%n;
  const cache=new Map();
  const meta=id=>catalog.find(c=>c.id===id)||catalog[0];
  function data(id=201){
    if(cache.has(id))return cache.get(id);
    const source=globalThis.DriftNFSData?.[meta(id).slug];
    if(!source?.sections?.length)throw new Error('NFS III driving data is missing');
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
    const support=Array.from({length:source.indices.length/3},(_,i)=>source.indices.slice(i*3,i*3+3).flatMap(n=>source.vertices.slice(n*3,n*3+3)));
    const supportGrid=grid(support,t=>[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7])]);
    const triangles=values=>Array.from({length:(values?.length||0)/9},(_,i)=>values.slice(i*9,i*9+9));
    const walls=triangles(source.walls),ceilings=triangles(source.ceilings);
    const bounds=t=>[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7])];
    const wallGrid=grid(walls,bounds,4),ceilingGrid=grid(ceilings,bounds);
    const prepared={...source,support,raw,points,segments,roadGrid,supportGrid,walls,wallGrid,ceilingGrid,length,step,at};cache.set(id,prepared);return prepared;
  }
  function info(id=201){const d=data(id),m=meta(id);return {...m,length:d.length,stage:'NFS III Especial',laps:4,relief:Math.max(...d.raw.map(p=>p.h))-Math.min(...d.raw.map(p=>p.h))};}
  function createTrack(Track,id=201){
    const d=data(id),m=meta(id),tr=new Track(d.points.map(p=>({...p})));
    Object.assign(tr,{nfs:true,summit:id===201,asset:m.asset,nfsSlug:m.slug,elevated:true,touringId:id,roadVersion:3,roadHalf:Math.min(...d.raw.map(p=>Math.min(p.left,p.right))),cutHalf:Math.max(...d.raw.map(p=>Math.max(p.left,p.right))),length:d.length,totalLength:d.length,raceLaps:4,biome:m.biome,climate:m.climate,maxHeight:Math.max(...d.raw.map(p=>p.h)),minHeight:Math.min(...d.raw.map(p=>p.h)),features:d.features.map(f=>({...f})),tunnelHalf:7,tunnelWall:3,tunnelRise:3,curbs:false,layout:{...info(id),level:0,elevated:true}});
    tr.atDistance=d.at;
    // Redrock's imported guide follows the rock/asphalt seam in this canyon.
    // Keep the racing line on the asphalt side; geometry and lap gates stay put.
    tr.aiOffsetAt=s=>id===203?-3.5*clamp((s-6470)/60,0,1)*clamp((7300-s)/60,0,1):0;
    tr.sample=(x,y,referenceHeight)=>{
      const candidates=d.roadGrid.get(Math.floor(x/32)+','+Math.floor(y/32))||d.segments;
      let best=Infinity,segment,t,cx,cy;
      for(const a of candidates){const f=clamp(((x-a.p.x)*a.dx+(y-a.p.y)*a.dy)/a.l2,0,1),px=a.p.x+a.dx*f,py=a.p.y+a.dy*f,dist=(x-px)**2+(y-py)**2+(referenceHeight===undefined?0:(mix(a.p.h,a.q.h,f)-referenceHeight)**2);if(dist<best){best=dist;segment=a;t=f;cx=px;cy=py;}}
      const a=segment,offset=(-(x-cx)*a.dy+(y-cy)*a.dx)/a.len,s=wrap(a.s+t*a.len,d.length);
      return {cx,cy,s,i:Math.floor(s/d.step),tang:a.tang,offset,dist:-offset,distance:Math.hypot(x-cx,y-cy),h:mix(a.p.h,a.q.h,t),grade:a.grade,bank:mix(a.p.bank,a.q.bank,t),left:mix(a.p.left,a.q.left,t),right:mix(a.p.right,a.q.right,t)};
    };
    tr.sampleNearby=(x,y,h)=>d.roadGrid.has(Math.floor(x/32)+','+Math.floor(y/32))?tr.sample(x,y,h):null;
    tr.nearestIndex=(x,y,h)=>tr.sample(x,y,h).i;
    tr.widthAt=s=>{const p=d.at(s);return Math.min(p.left,p.right);};
    tr.barrierHalfAt=q=>(q.offset<0?q.left:q.right);
    tr.featureAt=(s,kind)=>tr.features.find(f=>(!kind||f.kind===kind)&&wrap(s,tr.length)>=f.start&&wrap(s,tr.length)<=f.end)||null;
    tr.supportHeight=(x,y,reference)=>{
      const q=reference===undefined?tr.sample(x,y):null,expected=reference??(q.h+q.offset*Math.tan(q.bank));
      const candidates=d.supportGrid.get(Math.floor(x/32)+','+Math.floor(y/32))||[];
      let best=Infinity,height=null;
      for(const t of candidates){
        const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-8)continue;
        const a=((t[4]-t[7])*(x-t[6])+(t[6]-t[3])*(y-t[7]))/den,b=((t[7]-t[1])*(x-t[6])+(t[0]-t[6])*(y-t[7]))/den;
        if(a<-.00001||b<-.00001||a+b>1.00001)continue;
        const h=a*t[2]+b*t[5]+(1-a-b)*t[8],error=Math.abs(h-expected);
        if(error<best){best=error;height=h;}
      }
      return height;
    };
    tr.surfaceHeight=(x,y,h)=>tr.supportHeight(x,y,h)??tr.sample(x,y,h).h;
    tr.drivableAt=(x,y)=>tr.supportHeight(x,y)!==null;
    tr.footprintFits=(x,y,angle,dimensions)=>{
      const c=Math.cos(angle),s=Math.sin(angle),halfL=(dimensions?.length||4.4)/2,halfW=(dimensions?.width||1.9)/2;
      for(const xx of [-halfL,halfL])for(const zz of [-halfW,halfW])if(!tr.drivableAt(x+c*xx-s*zz,y+s*xx+c*zz))return false;
      return true;
    };
    tr.ceilingHeight=(x,y,base)=>{
      let roof=Infinity;
      for(const t of d.ceilingGrid.get(Math.floor(x/32)+','+Math.floor(y/32))||[]){
        const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-8)continue;
        const a=((t[4]-t[7])*(x-t[6])+(t[6]-t[3])*(y-t[7]))/den,b=((t[7]-t[1])*(x-t[6])+(t[0]-t[6])*(y-t[7]))/den;
        if(a<0||b<0||a+b>1)continue;
        const h=a*t[2]+b*t[5]+(1-a-b)*t[8];if(h>base+1.7)roof=Math.min(roof,h);
      }
      return roof;
    };
    tr.clipCamera=(position,target)=>{
      const origin=[target.x,target.z,target.y],ray=[position.x-target.x,position.z-target.z,position.y-target.y],length=Math.hypot(...ray);
      if(length<.1)return;
      const candidates=new Set();
      for(let i=0,n=Math.ceil(length/8);i<=n;i++){
        const x=origin[0]+ray[0]*i/n,y=origin[1]+ray[1]*i/n,key=Math.floor(x/32)+','+Math.floor(y/32);
        for(const t of d.wallGrid.get(key)||[])candidates.add(t);
      }
      const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
      let distance=1;
      for(const t of candidates){
        const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=cross(ray,e2),det=dot(e1,p);if(Math.abs(det)<1e-8)continue;
        const v=[origin[0]-t[0],origin[1]-t[1],origin[2]-t[2]],u=dot(v,p)/det;if(u<0||u>1)continue;
        const q=cross(v,e1),w=dot(ray,q)/det;if(w<0||u+w>1)continue;
        const hit=dot(e2,q)/det;if(hit>0&&hit<distance)distance=hit;
      }
      if(distance<1){distance=Math.max(.05,distance-.3/length);position.x=origin[0]+ray[0]*distance;position.z=origin[1]+ray[1]*distance;position.y=origin[2]+ray[2]*distance;}
    };
    // Slice actual wall triangles at the car's height. A rock arch is open
    // underneath, and a low rail cannot block a car flying above it.
    const clip=(poly,height,above)=>{
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],inside=above?a[2]>=height:a[2]<=height,next=above?b[2]>=height:b[2]<=height;
        if(inside)out.push(a);
        if(inside!==next){const f=(height-a[2])/(b[2]-a[2]);out.push([mix(a[0],b[0],f),mix(a[1],b[1],f),height]);}
      }
      return out;
    };
    tr.constrainCar=car=>{
      const saved=car._nfsPrevious,previous=saved&&Math.hypot(car.pos.x-saved.x,car.pos.y-saved.y)<20?saved:{...car.pos,angle:car.angle},end={...car.pos},dims=car.bodyDimensions||{length:4.4,width:1.9,height:1.4};
      const radius=dims.width*.5,axle=Math.max(0,dims.length*.5-radius),da=Math.atan2(Math.sin(car.angle-previous.angle),Math.cos(car.angle-previous.angle));
      const count=Math.max(1,Math.ceil((Math.hypot(end.x-previous.x,end.y-previous.y)+Math.abs(da)*dims.length*.5)/.35));
      let dx=(end.x-previous.x)/count,dy=(end.y-previous.y)/count,hit=false;
      car.pos.x=previous.x;car.pos.y=previous.y;
      for(let step=1;step<=count;step++){
        car.pos.x+=dx;car.pos.y+=dy;
        const angle=previous.angle+da*step/count,c=Math.cos(angle),sn=Math.sin(angle);
        const base=car.ride?.height??tr.surfaceHeight(car.pos.x,car.pos.y);
        const bottom=base+.22,top=base+(dims.height||1.4)-.1;
        for(let pass=0;pass<3;pass++){
          let corrected=false;
          const candidates=d.wallGrid.get(Math.floor(car.pos.x/32)+','+Math.floor(car.pos.y/32))||[];
          for(const t of candidates){
            if(Math.max(t[2],t[5],t[8])<bottom||Math.min(t[2],t[5],t[8])>top)continue;
            const poly=clip(clip([t.slice(0,3),t.slice(3,6),t.slice(6,9)],bottom,true),top,false);if(poly.length<2)continue;
            for(const along of [-axle,0,axle]){
              const x=car.pos.x+c*along,y=car.pos.y+sn*along;
              let best=Infinity,px,py;
              for(let j=0;j<poly.length;j++){
                const a=poly[j],b=poly[(j+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],l2=ex*ex+ey*ey;
                const u=l2?clamp(((x-a[0])*ex+(y-a[1])*ey)/l2,0,1):0,qx=a[0]+ex*u,qy=a[1]+ey*u,dist=(x-qx)**2+(y-qy)**2;
                if(dist<best){best=dist;px=qx;py=qy;}
              }
              if(best>=radius*radius)continue;
              let distance=Math.sqrt(best),nx=(x-px)/(distance||1),ny=(y-py)/(distance||1);
              if(distance<1e-7){nx=-dx;ny=-dy;const length=Math.hypot(nx,ny)||1;nx/=length;ny/=length;}
              const depth=radius-distance+.008;car.pos.x+=nx*depth;car.pos.y+=ny*depth;corrected=true;
              // Remove only motion into the wall; retain tangential travel.
              const into=car.vel.x*nx+car.vel.y*ny;
              if(into<0){
                const restitution=into<-3?.22:0,impulse=-(1+restitution)*into;
                car.vel.x+=nx*impulse;car.vel.y+=ny*impulse;
                const rx=c*along,ry=sn*along,torque=(rx*ny-ry*nx)*impulse/(dims.length*dims.length+dims.width*dims.width)*2;
                car.omega=clamp((car.omega||0)+torque,-2.5,2.5);car.yawRate=car.omega;
                if(into<-1)hit=true;
              }
              const inward=dx*nx+dy*ny;if(inward<0){dx-=inward*nx;dy-=inward*ny;}
            }
          }
          if(!corrected)break;
        }
      }
      if(hit){car.touringImpacts=(car.touringImpacts||0)+1;car.hitTimer=.25;car.breakFlow?.();}
      // A second solver pass after car-to-car contact must not sweep twice.
      car._nfsPrevious={...car.pos,angle:car.angle};
    };
    tr.terrainHeight=tr.surfaceHeight;
    tr.cameraFloor=(x,y,reference)=>tr.supportHeight(x,y,reference)??reference??tr.sample(x,y).h;
    tr.ribbonPoint=(s,offset=0,lift=0)=>{const p=d.at(s),x=p.x+p.nx*offset,y=p.y+p.ny*offset;return {x,y,h:tr.surfaceHeight(x,y)+lift};};
    const names=Array.from({length:6},(_,i)=>m.name+' · sector '+(i+1));
    tr.sectors=names.map((name,i)=>({name,start:tr.length*i/names.length,end:tr.length*(i+1)/names.length}));
    tr.sectorAt=s=>tr.sectors[Math.min(names.length-1,Math.floor(wrap(s,tr.length)/tr.length*names.length))];
    return tr;
  }
  return Object.freeze({catalog,info,createTrack,triangles:id=>data(id).support});
})();
