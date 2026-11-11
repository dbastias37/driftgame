import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {SoftwareRenderer} from './software-renderer.js';
import {batchWorld} from './world-optimization.js';
import {disposeGroup} from './view3d.js';

const canvas=document.getElementById('scene'),status=document.getElementById('status');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.1,10000);
scene.background=new T.Color(0x9eafb9);
let renderer,root,radius=100,baseDistance=300,yaw=.65,pitch=.85,zoom=1,rotate=false,dirty=true,disposed=false,last=0;
const target=new T.Vector3(),center=new T.Vector3();
try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;}
catch{renderer=new SoftwareRenderer(canvas);}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
function setZoom(value){zoom=Math.max(.08,Math.min(2,value));document.getElementById('zoom').value=zoom;dirty=true;}
function home(){target.copy(center);yaw=.65;pitch=.85;setZoom(1);}
function render(now){
  if(disposed)return;requestAnimationFrame(render);
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  if(document.hidden)return;
  if(rotate){yaw+=dt*.08;dirty=true;}
  if(!dirty||!root)return;dirty=false;
  const fit=Math.max(1,1/camera.aspect),distance=baseDistance*zoom*fit;
  camera.position.set(target.x+Math.cos(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.sin(yaw)*Math.cos(pitch)*distance);
  camera.near=Math.max(.01,radius*.00005);camera.far=distance+radius*5;camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.render(scene,camera);
}
document.getElementById('aerial').onclick=()=>{pitch=1.35;setZoom(.8);};
document.getElementById('detail').onclick=()=>{pitch=.22;setZoom(.24);};
document.getElementById('reset').onclick=home;
document.getElementById('zoom').oninput=e=>setZoom(Number(e.target.value));
document.getElementById('rotate').onclick=e=>{rotate=!rotate;e.currentTarget.setAttribute('aria-pressed',String(rotate));dirty=true;};
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(e.deltaY*.001));},{passive:false});
const pointers=new Map();let pinch=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;});
canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;
  const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0&&d>0)setZoom(zoom*pinch/d);pinch=d;}
  else if(e.shiftKey||e.buttons===2){const step=baseDistance*zoom/Math.max(300,innerHeight);target.x+=(-Math.sin(yaw)*dx+Math.cos(yaw)*dy)*step;target.z+=(Math.cos(yaw)*dx+Math.sin(yaw)*dy)*step;}
  else{yaw-=dx*.006;pitch=Math.max(.05,Math.min(1.5,pitch+dy*.004));}
  dirty=true;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{last=0;dirty=true;});
window.addEventListener('pagehide',()=>{disposed=true;disposeGroup(scene);renderer.dispose();});
resize();requestAnimationFrame(render);
try{
  const result=await new GLTFLoader().loadAsync(new URL('../assets/bonus/summit.glb',import.meta.url).href);
  if(disposed){disposeGroup(result.scene);}else{
    root=result.scene;root.updateMatrixWorld(true);
    const box=new T.Box3().setFromObject(root);box.getCenter(center);radius=box.getSize(new T.Vector3()).length()/2;baseDistance=radius/Math.sin(camera.fov*Math.PI/360)*1.06;
    const materials=new Map(),textures=new Set();
    root.traverse(o=>{if(!o.isMesh)return;const original=o.material;
      if(!materials.has(original)){
        const map=original.map;
        // NFS's supplied atlas contains baked scenery colour. Unlit rendering
        // keeps that texture legible rather than applying a second PBR light.
        if(map&&!textures.has(map)){textures.add(map);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
          if(map.image&&!map.image.getContext){const c=document.createElement('canvas');c.width=map.image.width;c.height=map.image.height;c.getContext('2d').drawImage(map.image,0,0);map.image=c;map.needsUpdate=true;}}
        materials.set(original,new T.MeshBasicMaterial({map,color:original.color,side:T.DoubleSide,alphaTest:.2}));
      }o.material=materials.get(original);
    });
    materials.forEach((_,source)=>source.dispose());
    // Bake static transforms once and merge only neighbouring pieces sharing
    // the original atlas. No retopology, texture replacement or decimation.
    batchWorld(root,Math.max(1,radius/10));scene.add(root);home();status.textContent='';
  }
}catch(error){status.textContent='No se pudo cargar Summit. Abre el juego desde un servidor local y vuelve a intentarlo.';status.id='error';console.error('Summit:',error);}
