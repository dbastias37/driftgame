// Keep legacy top-down images consistent with the actual imported 3D vehicles.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as T from '../vendor/three.module.min.js';
import {parseReplacement,createReplacement} from '../js/replacement-model.js';
import {SoftwareRenderer} from '../js/software-renderer.js';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.CAR_CANVAS_MODULE||'@napi-rs/canvas');
global.self=global;global.document={createElement:()=>createCanvas(512,512)};global.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
for(const [skin,file] of [['gray','chevrolet-nova-ss'],['blue','nissan-skyline-r34']]){
 const data=fs.readFileSync(new URL('../assets/models/'+file+'.glb',import.meta.url));
 const template=await parseReplacement(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),skin),car=createReplacement(template);
 const scene=new T.Scene();scene.add(car.root);car.root.getObjectByName('contact-shadow').visible=false;
 const canvas=createCanvas(128,256),renderer=new SoftwareRenderer(canvas);renderer.setSize(128,256);
 const half=template.fit.length*.52,camera=new T.OrthographicCamera(-half/2,half/2,half,-half,.1,30);camera.position.set(0,10,0);camera.up.set(1,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
 fs.writeFileSync(new URL('../assets/cars/'+skin+'.png',import.meta.url),canvas.toBuffer('image/png'));
 console.log(JSON.stringify({skin,bytes:data.length,triangles:template.parts.reduce((s,p)=>s+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0),parts:template.parts.length}));
}
