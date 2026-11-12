import * as T from '../vendor/three.module.min.js';

// Remove the authored front/back/pole triangles BEFORE static world batching.
// Mesh indices come from GLTFLoader's associations, never mutable mesh names.
export function separateSigns(result,root,track){
  const data=globalThis.DriftSignData?.[track.nfsSlug];if(!data)return new Map();
  const materials=new Map();
  root.traverse(o=>{
    if(!o.isMesh)return;const key=o.userData.roadSignSource,faces=data.remove[key];if(!faces)return;
    materials.set(key,o.material);
    const g=o.geometry,index=g.index,remove=new Set(faces),kept=[],count=index?index.count:g.attributes.position.count;
    for(let i=0;i<count;i+=3)if(!remove.has(i/3))for(let j=0;j<3;j++)kept.push(index?index.getX(i+j):i+j);
    g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();
  });
  return materials;
}
function geometry(positions,uv){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;}
function add(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.userData.dynamic=true;parent.add(o);return o;}
function chevrons(){const shapes=[];for(const x of [-.9,0,.9]){const s=new T.Shape();s.moveTo(x-.27,.46);s.lineTo(x+.20,0);s.lineTo(x-.27,-.46);s.lineTo(x-.42,-.30);s.lineTo(x-.11,0);s.lineTo(x-.42,.30);s.closePath();shapes.push(s);}return new T.ShapeGeometry(shapes);}
export function buildRoadSigns(track,world,sourceMaterials=new Map()){
  const run=globalThis.DriftSigns?.prepare(track);if(!run?.signs.length)return null;
  const rear=new T.MeshBasicMaterial({color:0x535b5c,side:T.FrontSide}),metal=new T.MeshBasicMaterial({color:0x707777}),white=new T.MeshBasicMaterial({color:0xf0f0e7}),orange=new T.MeshBasicMaterial({color:0xc85837}),frontMaterials=new Map();
  const groups=run.signs.map(p=>{
    const d=p.def,g=new T.Group();g.name='breakaway-road-sign-'+p.id;world.add(g);
    if(d.kind==='marker'){
      add(g,new T.BoxGeometry(d.width,d.height,d.width),white,0,d.height/2);
      add(g,new T.BoxGeometry(d.width+.005,.14,d.width+.005),orange,0,d.height-.15);
    }else if(d.kind==='chevron'){
      add(g,new T.BoxGeometry(2.8,1.05,.06),rear,0,2);
      add(g,chevrons(),white,0,2,.035);
    }else{
      const source=sourceMaterials.get(d.source);if(!source)throw new Error('Missing road sign material: '+d.source);
      if(!frontMaterials.has(source)){const m=source.clone();m.side=T.FrontSide;m.polygonOffset=false;frontMaterials.set(source,m);}
      add(g,geometry(d.positions,d.uv),frontMaterials.get(source));
      // Separate, unprinted back with reversed winding: no coplanar double face.
      const back=[];for(let i=0;i<d.positions.length;i+=9)for(const j of [0,6,3])back.push(d.positions[i+j],d.positions[i+j+1],-.03);
      add(g,geometry(back),rear);
    }
    if(d.kind!=='marker')for(const post of d.posts||(d.pole>.15?[{x:0,bottom:0,height:d.pole}]:[]))add(g,new T.CylinderGeometry(.065,.065,post.height,5),metal,post.x,post.bottom+post.height/2,-.04);
    return g;
  });
  const standing=run.signs.map(p=>({x:p.x,y:p.y,ground:p.ground,lift:0,yaw:p.yaw,tilt:0}));
  function update(recorded=null,camera=null,far=Infinity){
    const poses=recorded===null?track.roadSigns.signs:null,byId=recorded===null?null:new Map(recorded.map(p=>[p.id,p]));
    groups.forEach((g,i)=>{const p=poses?.[i]||byId?.get(i)||standing[i];g.position.set(p.x,p.ground+(p.lift||0),p.y);g.rotation.set(p.tilt,p.yaw,0,'YXZ');g.visible=!camera||Math.hypot(camera.position.x-p.x,camera.position.z-p.y)<far+track.roadSigns.signs[i].def.width;});
  }
  update();return {groups,update};
}
