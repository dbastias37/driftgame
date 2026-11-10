import * as T from '../vendor/three.module.min.js';
import {batchWorld} from './world-optimization.js?v=1.0.0-prealpha.10';
import {buildStreetLights} from './atmosphere.js?v=1.0.0-prealpha.10';

const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
function box(g,m,x,y,z,w,h,d){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;}
export function buildTraining(track,world){
  const asphalt=mat(0x444d52),concrete=mat(0x939d98),white=mat(0xcbd0b8),yellow=mat(0xe6bc52),dark=mat(0x192c32),teal=mat(0x255b61),orange=mat(0xf68734),glass=mat(0x345562,{metalness:.4,roughness:.24}),green=mat(0x3b5941),trunk=mat(0x554b3d);
  asphalt.userData.roadSurface=true;
  const floor=new T.Mesh(new T.PlaneGeometry(248,196,32,26),asphalt);floor.rotation.x=-Math.PI/2;floor.position.set(0,.002,6);floor.name='training-asphalt';floor.renderOrder=-90;world.add(floor);
  // A real hole under the lot avoids depth interference between snapped coplanar surfaces.
  const grass=mat(0x56654e);
  for(const [x,z,w,d] of [[-612,0,976,2200],[612,0,976,2200],[0,-596,248,1008],[0,610,248,978]]){const ground=new T.Mesh(new T.PlaneGeometry(w,d),grass);ground.rotation.x=-Math.PI/2;ground.position.set(x,-.14,z);ground.renderOrder=-100;world.add(ground);}
  // The entrance apron starts exactly where the lot ends (z=104). It used to
  // overlap the lot by three metres at only 2 mm separation, causing flicker.
  box(world,asphalt,0,-.068,112.5,248,.14,17);
  for(const s of track.solids.slice(1,8))box(world,concrete,s.x,.18,s.y,s.w,.36,s.d);
  // Painted stalls occupy the apron, without physical dividers across the racing line.
  const paint=(x,z,w,d,m=white)=>{const o=box(world,m,x,.07,z,w,.012,d);o.renderOrder=-70;};
  for(const row of [-69,70,87]){for(let x=-102;x<=102;x+=5.5)paint(x,row,.14,9);paint(0,row+4.5,210,.14);}
  for(const side of [-1,1])for(let z=-48;z<=50;z+=5.5){paint(side*105,z,10,.14);paint(side*100,z,.14,5.5);}
  // Course arrows are paint. The only course boundaries are movable cones.
  for(let i=0;i<track.points.length;i+=4){const p=track.point(i);if(Math.hypot(p.x,p.y)<12)continue;const dash=box(world,yellow,p.x,.07,p.y,1.7,.012,.16);dash.rotation.y=-track.tangentAt(i);dash.renderOrder=-70;}
  for(let i=12;i<track.points.length;i+=45){const p=track.point(i),a=track.tangentAt(i),g=new T.Group();g.position.set(p.x,.032,p.y);g.rotation.y=-a;world.add(g);box(g,yellow,0,0,0,2.2,.014,.24);for(const s of [-1,1]){const tip=box(g,yellow,.75,0,s*.3,.9,.014,.22);tip.rotation.y=-s*.65;}}
  const start=track.point(0),gate=new T.Group();gate.position.set(start.x,0,start.y);gate.rotation.y=-track.tangentAt(0);world.add(gate);
  for(let row=0;row<2;row++)for(let j=-7;j<7;j++)box(gate,(row+j)%2?white:dark,row*.55,.045,j+.5,.55,.02,1);
  // Large supermarket, canopy, loading doors and glowing window panels.
  box(world,concrete,0,7,-123,174,14,28);box(world,teal,0,12.5,-108.8,174,3,.3);box(world,dark,0,14.2,-123,177,.5,30);
  box(world,white,0,7.8,-104,150,.4,10);for(const x of [-70,-35,35,70])box(world,teal,x,3.8,-101,.5,7.6,.5);
  for(let x=-74;x<=74;x+=12){box(world,dark,x,3.6,-108.65,10,6.5,.2);box(world,glass,x,3.6,-108.45,9.6,6.1,.12);box(world,white,x,3.6,-108.3,.10,6.2,.1);}
  for(const x of [-14,14]){box(world,teal,x,2.7,-108.15,7,5.4,.25);box(world,glass,x,2.6,-107.95,6.4,5.1,.12);box(world,white,x,2.4,-107.8,.12,4.8,.1);}
  for(const x of [-65,-39,42,68]){box(world,dark,x,15,-123,12,2,6);for(let i=0;i<6;i++)box(world,concrete,x-4+i*1.5,16.1,-123,.6,.2,5);}
  // Landscaped outer edges keep the eight and central crossing completely clear.
  for(const x of [-117,117])for(const z of [-75,-48,-18,13,44,77]){box(world,concrete,x,.25,z,5,.5,12);for(let j=-3;j<=3;j+=3){const bush=new T.Mesh(new T.IcosahedronGeometry(2.5,0),green);bush.position.set(x,1.8,z+j);bush.scale.y=.7;world.add(bush);}}
  for(const x of [-55,-12,12,55]){box(world,concrete,x,.25,99,12,.5,5);for(let j=-3;j<=3;j+=3){const bush=new T.Mesh(new T.IcosahedronGeometry(2.3,0),green);bush.position.set(x+j,1.6,99);world.add(bush);}}
  for(const x of [-131,131])for(let z=-100;z<110;z+=35){box(world,trunk,x,2.4,z,.6,4.8,.6);const tree=new T.Mesh(new T.IcosahedronGeometry(4,0),green);tree.position.set(x,6,z);world.add(tree);}
  const street=buildStreetLights(track,world);batchWorld(world,80);
  // Moving props are added after batching, so their transforms stay live.
  const props=new T.Group();props.name='training-props';world.add(props);const count=track.coneSpawns.length;
  const rubber=mat(0x202b2d),stripe=mat(0xf0e6c8),coneGeo=new T.CylinderGeometry(.055,.31,.73,7);coneGeo.translate(0,.015,0);
  const baseGeo=new T.BoxGeometry(.72,.09,.72);baseGeo.translate(0,-.365,0);
  const bandGeo=new T.CylinderGeometry(.135,.19,.16,7);bandGeo.translate(0,.06,0);
  const parts=[[coneGeo,orange],[baseGeo,rubber],[bandGeo,stripe]].map(([geo,m])=>{const mesh=new T.InstancedMesh(geo,m,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);props.add(mesh);return mesh;});
  const arms=[];
  for(const p of track.gates){box(props,orange,p.x-5.5,.8,p.y,.85,1.6,.85);const pivot=new T.Group();pivot.position.set(p.x-5.5,1.45,p.y);props.add(pivot);box(pivot,white,5.1,0,0,10.2,.16,.2);for(let i=0;i<10;i+=2)box(pivot,orange,i+.55,0,.11,.7,.18,.025);arms.push(pivot);}
  const o=new T.Object3D();
  function update(){const run=track.practice;
    for(const cone of run.cones){o.position.set(cone.x,cone.z+(cone.down?.33:.41),cone.y);o.rotation.set(cone.tiltX,0,cone.tiltY,'XYZ');o.updateMatrix();for(const part of parts)part.setMatrixAt(cone.id,o.matrix);}
    for(const part of parts)part.instanceMatrix.needsUpdate=true;arms.forEach((arm,i)=>arm.rotation.z=run.gateAngles[i]);
  }
  update();return {street,update,parts,arms};
}
