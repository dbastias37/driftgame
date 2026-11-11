import * as T from '../vendor/three.module.min.js';
import {buildMountainTerrain} from './mountain-terrain.js?v=1.0.0-prealpha.20';
import {addRoadTrees} from './road-trees.js';

const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
const palettes={snow:[0xd0dce0,0x8c9ca7,0x59736d],alpine:[0x526253,0x72847f,0x284b43],forest:[0x465b46,0x697571,0x244438],coast:[0x7b8061,0x9a9783,0x445c45],lake:[0x566c61,0x738582,0x2e554b],highland:[0x777c65,0x8c9185,0x465c48]};
function mesh(parent,g,m,name){const o=new T.Mesh(g,m);o.name=name;parent.add(o);return o;}
function geometry(pos,indices,uv=null){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;}
function asphaltTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);let seed=891;
  for(let i=0;i<image.data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const v=66+(seed>>>28);image.data.set([v,v+4,v+5,255],i);}ctx.putImageData(image,0,0);
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;return t;
}
// All transverse road sections use the exact same profile as tyre support.
export function roadRibbon(track,from,to,{start=0,end=track.length,lift=0,filter=()=>true,chunk=96}={}){
  const pieces=[],step=track.length/track.points.length;
  for(let begin=start;begin<end-.001;begin+=chunk){
    const finish=Math.min(end,begin+chunk),count=Math.ceil((finish-begin)/step),pos=[],uv=[],indices=[];
    for(let i=0;i<=count;i++){const s=begin+(finish-begin)*i/count;for(const offset of [from,to]){const extra=typeof lift==='function'?lift(offset,s):lift,p=track.ribbonPoint(s,offset,extra);
        const q=track.sample(p.x,p.y);p.h=q.h+q.offset*Math.tan(q.bank)+extra;pos.push(p.x,p.h,p.y);uv.push(s/9,offset/9);}}
    for(let i=0;i<count;i++){if(!filter(begin+(finish-begin)*(i+.5)/count))continue;const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    if(indices.length)pieces.push(geometry(pos,indices,uv));
  }
  return pieces;
}
// Common structural parts are instances, then spatially partitioned by batchWorld.
function hardware(world){
  const groups=new Map(),unit=new T.BoxGeometry(1,1,1),pose=new T.Object3D(),up=new T.Vector3(0,1,0);
  function box(m,x,y,z,w,h,d,heading=0,name='touring-hardware'){
    pose.position.set(x,y,z);pose.rotation.set(0,-heading,0);pose.scale.set(w,h,d);pose.updateMatrix();add(m,name,pose.matrix);
  }
  function add(m,name,matrix){const key=m.uuid+name;if(!groups.has(key))groups.set(key,{m,name,matrices:[]});groups.get(key).matrices.push(matrix.clone());}
  function beam(m,a,b,width=.22,depth=width,name='touring-bracing'){
    const v=new T.Vector3(b.x-a.x,b.h-a.h,b.y-a.y),length=v.length();if(length<.001)return;
    pose.position.set((a.x+b.x)/2,(a.h+b.h)/2,(a.y+b.y)/2);pose.quaternion.setFromUnitVectors(up,v.multiplyScalar(1/length));pose.scale.set(width,length,depth);pose.updateMatrix();add(m,name,pose.matrix);
  }
  function finish(){for(const {m,name,matrices} of groups.values()){const o=new T.InstancedMesh(unit,m,matrices.length);o.name=name;matrices.forEach((matrix,i)=>o.setMatrixAt(i,matrix));world.add(o);}}
  return {box,beam,finish};
}
function section(track,s,cross){return cross.map(([offset,height])=>track.ribbonPoint(s,offset,height));}
function shell(track,world,material,cross,start,end,name,step=8){
  for(let begin=start;begin<end-.001;begin+=64){
    const finish=Math.min(end,begin+64),count=Math.ceil((finish-begin)/step),pos=[],uv=[],index=[],W=cross.length;
    for(let i=0;i<=count;i++){const s=begin+(finish-begin)*i/count;for(const [j,p] of section(track,s,cross).entries()){pos.push(p.x,p.h,p.y);uv.push(s/6,j/3);}}
    for(let i=0;i<count;i++)for(let j=0;j<W-1;j++){const k=i*W+j;index.push(k,k+1,k+W,k+1,k+W+1,k+W);}
    mesh(world,geometry(pos,index,uv),material,name);
  }
}
function cap(track,world,material,a,b,s,name){
  const pos=[],indices=[];for(let j=0;j<a.length;j++){for(const p of section(track,s,[a[j],b[j]]))pos.push(p.x,p.h,p.y);if(j<a.length-1){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  mesh(world,geometry(pos,indices),material,name);
}
function tunnel(track,world,feature,h,M){
  const half=track.tunnelHalf||22,wall=track.tunnelWall||10,rise=track.tunnelRise||12,cross=[[-half,-.35],[-half,wall]];
  for(let j=1;j<12;j++){const angle=Math.PI-j*Math.PI/12;cross.push([Math.cos(angle)*half,wall+Math.sin(angle)*rise]);}cross.push([half,wall],[half,-.35]);
  const outer=cross.map(([x,y])=>[x*1.9,Math.max(-5,y*1.45)]),rim=cross.map(([x,y])=>[x+Math.sign(x)*1.3,y+1.1]);
  shell(track,world,M.lining,cross,feature.start,feature.end,'touring-tunnel-vault');
  shell(track,world,M.grass,outer,feature.start,feature.end,'touring-tunnel-mountain',16);
  for(const s of [feature.start,feature.end]){
    cap(track,world,M.rock,rim,outer,s,'touring-mountain-face');
    cap(track,world,M.portal,cross,rim,s+(s===feature.start?-.12:.12),'touring-tunnel-portal');
    shell(track,world,M.portal,rim,s-1.4,s+1.4,'touring-portal-collar');
    for(const side of [-1,1]){
      const p=track.ribbonPoint(s,side*(half+3),3.2),angle=track.tangentAt(track.atDistance(s).i);
      h.box(M.portal,p.x,p.h,p.y,3.6,6.4,5.2,angle,'touring-portal-buttress');
      const a=track.ribbonPoint(s+(s===feature.start?-14:14),side*(half+9),1.9),b=track.ribbonPoint(s,side*(half+4),3.1);
      h.beam(M.portal,a,b,3.2,1.3,'touring-portal-wing');
    }
  }
  for(let s=feature.start+6;s<feature.end;s+=24){
    const angle=track.tangentAt(track.atDistance(s).i);
    for(const side of [-1,1]){
      const p=track.ribbonPoint(s,side*(half-3.8),wall+1.8);
      h.box(M.light,p.x,p.h,p.y,4.8,.12,.35,angle,'touring-tunnel-luminaires');
      const q=track.ribbonPoint(s,side*(half-.16),1.1);
      h.box(M.service,q.x,q.h,q.y,1.1,1.65,.13,angle,'touring-tunnel-service');
      const marker=track.ribbonPoint(s,side*(half-.24),2.35);h.box(M.escape,marker.x,marker.h,marker.y,.55,.22,.12,angle,'touring-tunnel-exit-markers');
    }
  }
  for(let s=feature.start;s<feature.end;s+=8)for(const side of [-1,1]){
    const end=Math.min(feature.end,s+8);
    for(const lift of [3.3,3.6])h.beam(M.dark,track.ribbonPoint(s,side*(half-.14),lift),track.ribbonPoint(end,side*(half-.14),lift),.12,.12,'touring-tunnel-conduit');
    if(Math.round((s-feature.start)/8)%4===0){const a=section(track,s,cross);for(let j=1;j<a.length;j++)h.beam(M.rib,a[j-1],a[j],.14,.18,'touring-vault-ribs');}
  }
}
function bridge(track,world,f,h,M){
  const length=f.end-f.start,spans=Math.ceil(length/64),span=length/spans,half=track.roadHalf+2;
  for(const g of roadRibbon(track,-half,half,{start:f.start,end:f.end,lift:-.8}))mesh(world,g,M.concrete,'touring-bridge-deck');
  for(let i=0;i<=spans;i++){
    const s=f.start+i*span,p=track.atDistance(s),angle=track.tangentAt(p.i);
    for(const side of [-1,1]){
      const edge=track.ribbonPoint(s,side*(half-3),-2.8),base=track.terrainHeight(edge.x,edge.y)-1,high=Math.max(3,edge.h-base);
      h.box(M.concrete,edge.x,base+high/2,edge.y,3.5,high,3.5,angle,'touring-bridge-piers');
      h.box(M.portal,edge.x,base+.65,edge.y,6,1.3,6,angle,'touring-bridge-footings');
    }
    h.box(M.concrete,p.x,p.h-2.2,p.y,4.6,1.6,half*2+1,angle,'touring-bridge-caps');
    const a=track.ribbonPoint(s,-half,-1),b=track.ribbonPoint(s,half,-1);h.beam(M.steel,a,b,.5,.5,'touring-deck-crossmembers');
  }
  for(let i=0;i<spans;i++){
    const start=f.start+i*span;
    for(const side of [-1,1]){
      const offset=side*(half+.1);
      if(f.style==='arch'){
        const arch=s=>track.ribbonPoint(s,offset,-26+20*Math.sin(Math.PI*(s-start)/span));
        for(let j=0;j<12;j++){const s=start+j*span/12,next=start+(j+1)*span/12;h.beam(M.concrete,arch(s),arch(next),1.5,2.1,'touring-bridge-arches');if(j%2===0)h.beam(M.concrete,arch(s),track.ribbonPoint(s,offset,-1.5),.8,1,'touring-arch-spandrels');}
      }else{
        for(let j=0;j<4;j++){
          const s=start+j*span/4,end=start+(j+1)*span/4,a=track.ribbonPoint(s,offset,-2.2),b=track.ribbonPoint(end,offset,-2.2),c=track.ribbonPoint(s,offset,5.3),d=track.ribbonPoint(end,offset,5.3);
          h.beam(M.steel,a,b,.4,.55,'touring-truss-lower-chord');h.beam(M.steel,c,d,.42,.52,'touring-truss-upper-chord');h.beam(M.steel,a,c,.32,.36,'touring-truss-posts');h.beam(M.steel,j%2?a:c,j%2?d:b,.27,.32,'touring-truss-diagonals');
        }
      }
    }
    for(let j=0;j<4;j++){const s=start+j*span/4;h.beam(M.dark,track.ribbonPoint(s,-half,-1.6),track.ribbonPoint(s,half,-1.6),.22,.4,'touring-bridge-floorbeams');}
  }
  for(let s=f.start;s<f.end;s+=12)for(const side of [-1,1])h.beam(M.steel,track.ribbonPoint(s,side*(half-3),-1.2),track.ribbonPoint(Math.min(f.end,s+12),side*(half-3),-1.2),.6,.65,'touring-bridge-girders');
}
function landscape(track,world,M,low){
  const b=track.bounds,pose=new T.Object3D(),trees=[],rocks=[];let seed=378+track.touringId;
  const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  // Road-side groves are dense where visible. They stay outside the clear zone.
  for(let s=0;s<track.length;s+=low?17:10)for(const side of [-1,1]){
    const p=track.atDistance(s),distance=track.roadHalf+13+rand()*50,x=p.x+p.nx*distance*side,y=p.y+p.ny*distance*side;
    if(track.featureAt(s,'bridge')||track.featureAt(s,'tunnel'))continue;
    const q=track.sampleNearby(x,y);if(q&&q.distance<track.roadHalf+9)continue;
    const sector=track.sectorAt?.(s);
    const density={meadow:.20,forest:1,slope:.65,pass:.35,valley:.55,open:.12}[sector?.kind]??1;
    if(rand()>density)continue;
    const scale=.7+rand()*1.3;pose.position.set(x,track.terrainHeight(x,y),y);pose.rotation.set(0,rand()*6.28,0);pose.scale.set(scale,scale*(.85+rand()*.5),scale);pose.updateMatrix();trees.push(pose.matrix.clone());
  }
  for(let i=0;i<(low?250:600);i++){
    const x=b.minX-180+rand()*(b.w+360),y=b.minY-180+rand()*(b.h+360),q=track.sampleNearby(x,y);
    if(q&&(q.distance<track.roadHalf+12||track.featureAt(q.s,'tunnel')&&q.distance<65))continue;
    pose.position.set(x,track.terrainHeight(x,y)-1,y);pose.rotation.set(rand()*.6,rand()*6.28,rand()*.4);pose.scale.set(3+rand()*9,3+rand()*9,3+rand()*6);pose.updateMatrix();rocks.push(pose.matrix.clone());
  }
  addRoadTrees(world,trees,{low,snow:track.biome==='snow'});
  const stones=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),M.rock,rocks.length);stones.name='touring-rocks';rocks.forEach((matrix,i)=>stones.setMatrixAt(i,matrix));world.add(stones);
  // A distant continuous land skirt, lowered below the near terrain boundary.
  const tile=64,x0=Math.floor((b.minX-160)/tile)*tile,z0=Math.floor((b.minY-180)/tile)*tile,x1=Math.ceil((b.maxX+160)/tile)*tile,z1=Math.ceil((b.maxY+180)/tile)*tile;
  // Continue the near heightfield using coarse outer tiles with the same exact
  // boundary heights. No floating rectangular plateau over a flat green plane.
  const positions=[],indices=[];
  for(let x=x0-1536;x<x1+1536;x+=tile)for(let z=z0-1536;z<z1+1536;z+=tile){
    if(x>=x0&&x<x1&&z>=z0&&z<z1)continue;
    const k=positions.length/3;
    for(const [px,pz] of [[x,z],[x+tile,z],[x+tile,z+tile],[x,z+tile]])positions.push(px,track.terrainHeight(px,pz),pz);
    indices.push(k,k+2,k+1,k,k+3,k+2);
  }
  mesh(world,geometry(positions,indices),M.grass,'touring-horizon');
  if(track.biome==='coast'||track.biome==='lake'){
    const water=mesh(world,new T.CircleGeometry(Math.min(b.w,b.h)*(track.biome==='lake'?.23:.8),64),M.water,'touring-water');water.rotation.x=-Math.PI/2;water.position.set(track.biome==='coast'?b.maxX+450:b.minX+b.w*.5,4,b.minY+b.h*.5);
  }
}
// Recognizable landmarks outside the driving/camera corridor. Shared hardware
// stays instanced; no per-frame rebuilding or hundreds of separate tree meshes.
function landmarks(track,world,h,M){
  for(const [i,sector] of (track.sectors||[]).entries()){
    const s=sector.start+(sector.end-sector.start)*.48;
    if(track.featureAt(s))continue;
    const p=track.ribbonPoint(s,(i%2?-1:1)*(track.roadHalf+24));p.h=track.terrainHeight(p.x,p.y);
    const a=track.tangentAt(track.atDistance(s).i);
    if(i===0||i===5){
      h.box(M.portal,p.x,p.h+2.2,p.y,9,4.4,6,a,'road-lodge');
      h.box(M.steel,p.x,p.h+4.7,p.y,10,.7,7,a,'road-lodge-roof');
      h.box(M.dark,p.x,p.h+1.2,p.y,2,2.4,6.05,a,'road-lodge-door');
    }else if(i===1){
      h.box(M.steel,p.x,p.h+5,p.y,.5,10,.5,a,'road-watchtower');
      h.box(M.portal,p.x,p.h+9.5,p.y,4,1,4,a,'road-watchtower-platform');
      h.box(M.dark,p.x,p.h+12,p.y,5,.7,5,a,'road-watchtower-roof');
    }else if(i===2){
      h.box(M.portal,p.x,p.h+1,p.y,13,2,8,a,'road-overlook');
      for(const delta of [-5,0,5])h.box(M.steel,p.x+Math.cos(a)*delta,p.h+3,p.y+Math.sin(a)*delta,.2,2,.2,a,'road-overlook-rail');
    }else{
      h.box(M.rock,p.x,p.h+6,p.y,6,12,8,a,'road-standing-stone');
    }
  }
}
export function buildTouring(track,world,low=false){
  const [grass,rock]=palettes[track.biome],M={grass:mat(grass),rock:mat(rock,{side:T.DoubleSide,flatShading:true}),asphalt:mat(0xb8bec1,{map:asphaltTexture()}),white:mat(0xe6e2cb),sand:mat(0x8a8674),dark:mat(0x283b43),steel:mat(track.biome==='forest'?0x7e4538:0x586c71,{metalness:.5}),concrete:mat(0x929b93),portal:mat(0xb6b9a9,{side:T.DoubleSide}),lining:mat(0x697a79,{side:T.DoubleSide,emissive:0x425250,emissiveIntensity:.35}),rib:mat(0x425351),service:mat(0x345961),light:new T.MeshBasicMaterial({color:0xe3ffd6}),escape:new T.MeshBasicMaterial({color:0x72d6a0}),water:mat(0x466d7d,{roughness:.27,metalness:.25})};
  const h=hardware(world),half=track.roadHalf;
  M.asphalt.userData.roadSurface=true;
  buildMountainTerrain(track,world,mat(0xffffff,{vertexColors:true,flatShading:true}));
  function band(a,b,m,options={}){for(const g of roadRibbon(track,a,b,options))mesh(world,g,m,'touring-road');}
  const dashed=s=>Math.floor(s/12)%2===0;
  band(-half+.16,-.09,M.asphalt);band(.09,half-.16,M.asphalt);band(-.09,.09,M.asphalt,{filter:s=>!dashed(s)});band(-.09,.09,M.white,{filter:dashed});
  for(const side of [-1,1]){
    band(side<0?-half-.16:half-.16,side<0?-half+.16:half+.16,M.white);
  }
  // Shoulders and kerbs are outside the carriageway, with matching support.
  for(const [a,b] of [[-track.cutHalf,-half-.86],[half+.86,track.cutHalf]]){
    band(a,b,M.sand,{filter:s=>!track.featureAt(s)});
    band(a,b,M.concrete,{filter:s=>!!track.featureAt(s)});
  }
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const a=half+.16+j*.7/6,b=half+.16+(j+1)*.7/6;
    band(side<0?-b:a,side<0?-a:b,j%2?M.white:M.portal,{lift:o=>globalThis.DriftRoadContact.profile(Math.abs(o)-half)+.018});
  }
  for(let s=0;s<track.length;s+=12){
    const end=Math.min(s+12,track.length),p=track.atDistance(s),angle=track.tangentAt(p.i);
    for(const side of [-1,1]){
      const offset=side*(half+1.5),post=track.ribbonPoint(s,offset,.6);h.box(M.steel,post.x,post.h,post.y,.16,1.2,.18,angle,'touring-guard-posts');
      for(const lift of [.63,1.02])h.beam(M.steel,track.ribbonPoint(s,offset,lift),track.ribbonPoint(end,offset,lift),.18,.12,'touring-guardrails');
      if(Math.round(s/12)%3===0){const r=track.ribbonPoint(s,offset,1.12);h.box(M.white,r.x,r.h,r.y,.16,.12,.26,angle,'touring-reflectors');}
    }
  }
  for(const feature of track.features)if(feature.kind==='tunnel')tunnel(track,world,feature,h,M);else bridge(track,world,feature,h,M);
  const start=track.atDistance(0),angle=track.tangentAt(0);
  for(const side of [-1,1]){const p=track.ribbonPoint(0,side*(half+3.8),4.1);h.box(M.steel,p.x,p.h,p.y,.8,8.2,.8,angle,'touring-start-pillars');}
  h.beam(M.dark,track.ribbonPoint(0,-half-4,8.2),track.ribbonPoint(0,half+4,8.2),.8,1.1,'touring-start-gantry');
  for(let j=-12;j<12;j++)for(let row=0;row<2;row++){const p=track.ribbonPoint(row*.7,j+.5,.035);h.box((j+row)%2?M.white:M.dark,p.x,p.h,p.y,.7,.03,1,angle,'touring-finish-checkers');}
  landscape(track,world,M,low);landmarks(track,world,h,M);h.finish();
  world.userData.touring={id:track.touringId,tunnels:track.features.filter(f=>f.kind==='tunnel').length,bridges:track.features.filter(f=>f.kind==='bridge').length};
  return world;
}
