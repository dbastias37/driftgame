// Offline: bake the supplied CC-BY 4.0 Yugo into world coordinates before reduction.
import fs from 'node:fs';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
globalThis.self=globalThis;
const b=fs.readFileSync(process.argv[2]);
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
scene.updateMatrixWorld(true);const parts=[];
scene.traverse(n=>{if(n.isMesh){const g=n.geometry.clone().applyMatrix4(n.matrixWorld);parts.push({name:n.name,material:n.material.name,position:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});}});
fs.writeFileSync(process.argv[3],JSON.stringify(parts));
