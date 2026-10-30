import * as T from '../vendor/three.module.min.js';
import {buildMountainTerrain} from './mountain-terrain.js?v=0.8.0';
import {batchWorld} from './world-optimization.js?v=0.8.0';
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
function mesh(parent,geo,material,x=0,y=0,z=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);parent.add(o);return o;}
function box(p,m,x,y,z,w,h,d){return mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);}
function noise(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),data=g.createImageData(128,128);let seed=76;for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=62+(seed>>>28);data.data[i]=v;data.data[i+1]=v+6;data.data[i+2]=v+7;data.data[i+3]=255;}g.putImageData(data,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;return t;}
function band(track,parent,material,a,b,height=()=>.025,filter=()=>true){
  // Short pieces allow the same camera culling as flat-circuit kerbs.
  for(let start=0;start<track.points.length-1;start+=24){
    const end=Math.min(track.points.length-1,start+24),pos=[],uv=[],indices=[];
    for(let i=start;i<=end;i++){const p=track.points[i],n=track.normalAt(i);for(const offset of [a,b]){pos.push(p.x+n.x*offset,p.h+height(offset,p.s),p.y+n.y*offset);uv.push(p.s/8,offset/8);}}
    for(let i=start;i<end;i++){if(!filter(track.points[i].s))continue;const k=(i-start)*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    if(!indices.length)continue;
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();mesh(parent,geo,material).name='mountain-road';
  }
}
function label(text){const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.fillStyle='#17242b';g.fillRect(0,0,512,96);g.fillStyle='#f0f0e7';g.textAlign='center';g.font='bold 48px Arial';g.fillText(text,256,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:t,side:T.DoubleSide});}
export function buildMountain(track,world,low=false){
  const grass=mat(0x526253),rock=mat(0x728a84),dark=mat(0x283b43),white=mat(0xdde0d3),orange=mat(0xc85837),metal=mat(0x8a9694,{metalness:.45}),asphalt=mat(0xaeb7ba,{map:noise()}),sand=mat(0x7a8074);
  const b=track.bounds,tile=64,step=8;
  buildMountainTerrain(track,world,mat(0xffffff,{vertexColors:true,flatShading:true}));
  const distantMaterial=mat(0x526253);
  // Continue the mountain outside the detailed road area; no floating rectangle.
  for(let x=Math.floor((b.minX-700)/tile)*tile;x<b.maxX+700;x+=tile)for(let z=Math.floor((b.minY-700)/tile)*tile;z<b.maxY+700;z+=tile){
    if(x>=Math.floor((b.minX-160)/tile)*tile&&x<b.maxX+160&&z>=Math.floor((b.minY-180)/tile)*tile&&z<b.maxY+180)continue;
    const pos=[],indices=[],N=5;
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const px=x+i*16,pz=z+j*16;pos.push(px,track.baseHeight(px,pz),pz);if(i<N-1&&j<N-1){const k=j*N+i;indices.push(k,k+N,k+1,k+1,k+N,k+N+1);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(world,geo,distantMaterial);
  }
  for(let i=0;i<12;i++){const angle=i*Math.PI/6,radius=Math.max(b.w,b.h)*.6+500,x=b.minX+b.w/2+Math.cos(angle)*radius,z=b.minY+b.h/2+Math.sin(angle)*radius;mesh(world,new T.ConeGeometry(170+(i%3)*45,160+(i%4)*40,6),rock,x,track.baseHeight(x,z)+35,z);}
  // The real open ribbon, shoulders and rounded curb share the physics heights.
  const half=track.roadHalf;
  for(const side of [-1,1])band(track,world,sand,side<0?-half-1.3:half+.86,side<0?-half-.86:half+1.3,()=>.02);
  band(track,world,asphalt,-half+.16,half-.16,()=>.02);
  const start=track.points[0],heading=track.tangentAt(0),apron=box(world,asphalt,start.x-Math.cos(heading)*2,start.h-.04,start.y-Math.sin(heading)*2,4,.12,half*2);apron.rotation.y=-heading;
  const curbCanvas=document.createElement('canvas');curbCanvas.width=64;curbCanvas.height=4;const cg=curbCanvas.getContext('2d');cg.fillStyle='#c85837';cg.fillRect(0,0,32,4);cg.fillStyle='#dde0d3';cg.fillRect(32,0,32,4);
  const curbMap=new T.CanvasTexture(curbCanvas);curbMap.wrapS=T.RepeatWrapping;curbMap.colorSpace=T.SRGBColorSpace;
  const curbMat=mat(0xffffff,{map:curbMap});
  for(const side of [-1,1]){
    band(track,world,white,side<0?-half-.16:half-.16,side<0?-half+.16:half+.16,()=>.02);
    // One textured surface replaces twelve alternating meshes per road chunk.
    for(let k=0;k<6;k++){
      const aa=half+.16+k*.70/6,bb=half+.16+(k+1)*.70/6;
      band(track,world,curbMat,side<0?-bb:aa,side<0?-aa:bb,o=>.02+globalThis.DriftRoadContact.profile(Math.abs(o)-half));
    }
  }
  band(track,world,mat(0xcfc8a3),-.09,.09,()=>.045,s=>Math.floor(s/7)%2===0);
  const object=new T.Object3D(),treeGeo=new T.ConeGeometry(2.8,10,5),treeMat=mat(0x284b43),trees=new T.InstancedMesh(treeGeo,treeMat,low?230:650);let ti=0,seed=734;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  for(let i=0;i<5000&&ti<trees.count;i++){
    const x=b.minX-100+random()*(b.w+200),z=b.minY-100+random()*(b.h+200),q=track.sampleNearby(x,z);if(q&&q.distance<half+8)continue;
    const scale=.7+random()*.9;object.position.set(x,track.terrainHeight(x,z)+5*scale,z);object.rotation.set(0,random()*6.28,0);object.scale.setScalar(scale);object.updateMatrix();trees.setMatrixAt(ti++,object.matrix);
  }trees.count=ti;world.add(trees);
  for(let i=0;i<track.points.length-1;i+=3){const p=track.points[i],n=track.normalAt(i),q=track.points[Math.min(i+3,track.points.length-1)];
    for(const side of [-1,1]){
      const x=p.x+n.x*(half+1.15)*side,z=p.y+n.y*(half+1.15)*side;
      if(track.barrierAt(p.s,side)){
        box(world,metal,x,p.h+.55,z,.14,1.1,.14);
        const nn=track.normalAt(Math.min(i+3,track.points.length-1)),xx=q.x+nn.x*(half+1.15)*side,zz=q.y+nn.y*(half+1.15)*side;
        const beam=box(world,metal,(x+xx)/2,(p.h+q.h)/2+.83,(z+zz)/2,Math.hypot(xx-x,zz-z,q.h-p.h),.26,.09);beam.rotation.set(0,-Math.atan2(zz-z,xx-x),Math.atan2(q.h-p.h,Math.hypot(xx-x,zz-z)),'YXZ');
      }else if(i%9===0){box(world,white,x,p.h+.45,z,.16,.9,.16);box(world,orange,x,p.h+.76,z,.2,.14,.2);}
    }
    if(i%30===0){const x=p.x+n.x*(half+10),z=p.y+n.y*(half+10),stone=mesh(world,new T.DodecahedronGeometry(3.3,0),rock,x,track.terrainHeight(x,z)+1,z);stone.scale.set(1.1,1.7,.8);}
  }
  for(const [s,text] of [[0,'CERRO ABAJO'],[track.finishS,'META / 100%']]){
    const p=track.atDistance(s),a=track.tangentAt(p.i),gate=new T.Group();gate.position.set(p.x,p.h,p.y);gate.rotation.y=-a;world.add(gate);
    for(const side of [-1,1])box(gate,dark,0,3.7,side*(half+2),.4,7.4,.4);
    box(gate,dark,0,7.4,0,.6,.8,(half+2)*2);const sign=mesh(gate,new T.PlaneGeometry(half*1.6,1.5),label(text),-.32,7.3,0);sign.rotation.y=-Math.PI/2;
    for(let j=-Math.floor(half);j<half;j++)for(let row=0;row<2;row++)box(gate,(j+row)%2?white:dark,row*.6,.065,j+.5,.6,.03,1);
  }
  // Kilometer / hairpin markers are scenery, not invisible collision walls.
  const chevron=label('› › ›');
  for(let s=180;s<track.finishS;s+=220){const p=track.atDistance(s),n=track.normalAt(p.i),x=p.x+n.x*(half+2.3),z=p.y+n.y*(half+2.3);box(world,dark,x,p.h+1,z,.12,2,.12);const sign=mesh(world,new T.PlaneGeometry(2.7,1.2),chevron,x,p.h+2,z);sign.rotation.y=-track.tangentAt(p.i)-Math.PI/2;}
  batchWorld(world);
  return world;
}
