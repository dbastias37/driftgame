// Regenerate the 2D sprite from the same supplied model used in the garage.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as T from '../vendor/three.module.min.js';
import {parseFujiwara,createFujiwara} from '../js/fujiwara-model.js';
import {SoftwareRenderer} from '../js/software-renderer.js';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.FUJIWARA_CANVAS_MODULE||'@napi-rs/canvas');
global.self=global;global.document={createElement:()=>createCanvas(512,512)};global.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
const data=fs.readFileSync(new URL('../assets/models/ae86-fujiwara.glb',import.meta.url));
const template=await parseFujiwara(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),car=createFujiwara(template);
const scene=new T.Scene();scene.background=new T.Color(0x859599);scene.add(car.root);
const canvas=createCanvas(640,420),renderer=new SoftwareRenderer(canvas);renderer.setSize(640,420);
for(const [name,position]of[['front',[4.8,2.3,4.8]],['back',[-4.8,2,4.8]],['side',[0,1.2,6]]]){
  const camera=new T.PerspectiveCamera(36,640/420,.1,100);camera.position.set(...position);camera.lookAt(0,.7,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  if(process.argv[2])fs.writeFileSync(`${process.argv[2]}/fujiwara-${name}.png`,canvas.toBuffer('image/png'));
}
car.root.getObjectByName('contact-shadow').visible=false;scene.background=null;
const camera=new T.OrthographicCamera(-1.1,1.1,2.2,-2.2,.1,30);camera.position.set(0,10,0);camera.up.set(1,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
renderer.setSize(128,256);renderer.render(scene,camera);fs.writeFileSync(new URL('../assets/cars/fujiwara.png',import.meta.url),canvas.toBuffer('image/png'));
const bounds=new T.Box3().setFromObject(car.body);console.log(JSON.stringify({bytes:data.length,parts:template.parts.length,triangles:template.parts.reduce((n,p)=>n+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0),size:bounds.getSize(new T.Vector3()).toArray(),wheels:car.wheels.map(w=>({center:w.steer.position.toArray(),radius:w.radius}))},null,2));
