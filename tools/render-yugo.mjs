import fs from 'node:fs';
import * as T from '../vendor/three.module.min.js';
import {parseYugo,createYugo} from '../js/yugo-model.js';
import {SoftwareRenderer} from '../js/software-renderer.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.YUGO_CANVAS_MODULE||'@napi-rs/canvas');
global.self=global;global.document={createElement:()=>createCanvas(512,512)};global.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
const b=fs.readFileSync(new URL('../assets/models/yugo-koral-55-pixel.glb',import.meta.url)),t=await parseYugo(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),car=createYugo(t);
const scene=new T.Scene();scene.background=new T.Color(0x859599);scene.add(car.root);const c=createCanvas(640,420),r=new SoftwareRenderer(c);r.setSize(640,420);
for(const [name,position]of[['front',[4.3,2.2,4.3]],['back',[-4.3,1.8,4.3]],['side',[0,1,5.2]]]){const camera=new T.PerspectiveCamera(36,640/420,.1,100);camera.position.set(...position);camera.lookAt(0,.65,0);camera.updateProjectionMatrix();r.render(scene,camera);if(process.argv[2])fs.writeFileSync(process.argv[2]+'/yugo-'+name+'.png',c.toBuffer('image/png'));}
// 2D sprite is rendered from the same mesh; 4 m viewport matches Car.draw.
car.root.children.at(-1).visible=false;scene.background=null;const camera=new T.OrthographicCamera(-1,1,2,-2,.1,30);camera.position.set(0,10,0);camera.up.set(1,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();r.setSize(128,256);r.render(scene,camera);fs.writeFileSync(new URL('../assets/cars/yugo.png',import.meta.url),c.toBuffer('image/png'));
