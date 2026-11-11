import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import * as T from '../vendor/three.module.min.js';
import '../js/road-expeditions.js';
import '../js/touring-circuits.js';
import '../js/road-contact.js';
import '../js/game-options.js';
import {Track} from '../server/engine.js';
import {buildTouring} from '../js/touring-scene.js';
import {SoftwareRenderer} from '../js/software-renderer.js';
import {batchWorld,updateWorldVisibility} from '../js/world-optimization.js';
export function canvas(){const c={width:128,height:128,style:{},addEventListener(){},removeEventListener(){}};const ctx={createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData(i){c.pixels=i;},getImageData(x,y,w,h){return c.pixels||this.createImageData(w,h);},drawImage(i){c.pixels=i.pixels;},fillRect(){},fillText(){},clearRect(){},beginPath(){},arc(){},fill(){},createRadialGradient:()=>({addColorStop(){}})};c.getContext=t=>t==='2d'?ctx:null;return c;}
const table=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),8+data.length);return out;}
function png(data,w,h){const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=6;const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(data.buffer,data.byteOffset+y*w*4,w*4).copy(raw,y*(w*4+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
export async function renderOverview(output,id=1){
  globalThis.document={createElement:canvas};
  const track=DriftTouring.createTrack(Track,id),world=new T.Group(),buildStart=performance.now();buildTouring(track,world,false);world.updateMatrixWorld(true);
  const road=[],terrain=[],structures=[];let triangles=0,meshes=0;
  world.traverse(o=>{if(o.geometry){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count||1);}if(o.name==='touring-road')road.push(o);if(o.name==='mountain-terrain')terrain.push(o);if(o.name.includes('tunnel')||o.name.includes('portal')||o.name==='touring-mountain-face'||o.name.includes('bridge')||o.name.includes('truss'))structures.push(o);});
  const audit={samples:0,gaps:0,intrusions:0,maxError:0,clearance:Infinity},ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  for(let s=1;s<track.length;s+=47)for(const offset of [-10,0,10]){const p=track.ribbonPoint(s,offset);ray.set(new T.Vector3(p.x,p.h+2,p.y),down);const hits=ray.intersectObjects(road,false);audit.samples++;if(!hits.length)audit.gaps++;else audit.maxError=Math.max(audit.maxError,Math.abs(hits[0].point.y-track.surfaceHeight(p.x,p.y)));const ground=ray.intersectObjects(terrain,false);if(ground.length&&ground[0].point.y>=p.h-.05)audit.intrusions++;}
  for(const f of track.features)for(let s=f.start;s<=f.end;s+=17)for(const offset of [-10,0,10]){const p=track.ribbonPoint(s,offset);ray.set(new T.Vector3(p.x,p.h+.15,p.y),new T.Vector3(0,1,0));const hits=ray.intersectObjects(structures,false);if(hits.length)audit.clearance=Math.min(audit.clearance,hits[0].distance);}
  batchWorld(world);updateWorldVisibility(world,new T.PerspectiveCamera(),Infinity,true);let batchedMeshes=0;world.traverse(o=>{if(o.isMesh)batchedMeshes++;});
  const image=canvas(),renderer=new SoftwareRenderer(image);renderer.retro={...DriftOptions.presets.clean,resolution:800};renderer.setRenderScale(2);renderer.setSize(1200,800);
  const scene=new T.Scene();scene.background=new T.Color(0xb9c7c3);scene.add(world);const b=track.bounds,cx=b.minX+b.w/2,cz=b.minY+b.h/2,camera=new T.PerspectiveCamera(48,1.5,.5,16000);camera.position.set(cx+700,2350,cz+1700);camera.lookAt(cx,95,cz);camera.updateProjectionMatrix();renderer.render(scene,camera);await fs.writeFile(output,png(image.pixels.data,renderer.w,renderer.h));
  const result={id,meshes,batchedMeshes,triangles,audit,length:track.length,relief:track.maxHeight-track.minHeight,softwareRender:true};renderer.dispose();world.traverse(o=>{o.geometry?.dispose();});return result;
}
