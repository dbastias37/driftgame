import fs from 'node:fs';
const root=process.argv[2];
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128)})};return{width:1,height:1,clientWidth:600,clientHeight:400,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}}}
global.document={createElement:canvas};global.self=global;global.innerWidth=600;global.innerHeight=400;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:64,height:64});
const {DriftView3D}=await import(root+'/js/view3d.js'),{createTrack,createCar}=await import(root+'/server/engine.js'),{parseReplacement}=await import(root+'/js/replacement-model.js');
const b=fs.readFileSync(root+'/assets/models/nissan-skyline-r34.glb'),template=await parseReplacement(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'blue');
const original=console.error;console.error=()=>{};const v=new DriftView3D(canvas(),{quality:'low',loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:()=>Promise.resolve(template)});console.error=original;await v.skylineReady;
const track=createTrack(1),player=createCar(track,'blue',true,0),rivals=[1,2].map((n)=>Object.assign(createCar(track,'blue',true,n),{id:String(n),name:'Rival'}));
player.worldSpeed=()=>Math.hypot(player.vel.x,player.vel.y);
const retro=process.argv[3]==='psx'?{resolution:480,jitter:.6,affine:.65,bits:15,dither:.65,crt:.25,flat:true}:undefined;
for(const mode of ['chase','cinematic']){const times=[];for(let i=0;i<40;i++){const start=performance.now();v.render({track,player,rivals,dt:1/60,time:1+i/60,camera:mode,inMenu:mode==='cinematic',retro});if(i>9)times.push(performance.now()-start);}times.sort((a,b)=>a-b);console.log(JSON.stringify({root:root.split('/').at(-1),mode,retro:!!retro,width:v.renderer.w,height:v.renderer.h,medianMs:+times[15].toFixed(1),p95Ms:+times[28].toFixed(1)}));}v.dispose();
