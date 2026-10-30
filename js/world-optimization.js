import * as T from '../vendor/three.module.min.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

// Bake static transforms once, keeping spatial chunks small enough to cull.
// No renderer or quality setting changes the simulation or collision mesh.
export function batchWorld(world,size=128){
  world.updateMatrixWorld(true);
  const batches=new Map(),old=new Set(),remove=[];
  world.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.transparent||o.userData.dynamic)return;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new T.Vector3());
    const key=[o.material.uuid,Math.floor(center.x/size),Math.floor(center.z/size),Object.keys(geometry.attributes).sort().join(','),!!geometry.index,o.renderOrder].join(':');
    if(!batches.has(key))batches.set(key,{geometries:[],material:o.material,name:o.name,order:o.renderOrder});
    batches.get(key).geometries.push(geometry);remove.push(o);old.add(o.geometry);
  });
  for(const o of remove)o.removeFromParent();
  for(const group of batches.values()){
    const g=mergeGeometries(group.geometries,false);group.geometries.forEach(g=>g.dispose());
    if(!g)throw new Error('Incompatible world geometry');
    g.computeBoundingSphere();const m=new T.Mesh(g,group.material);m.name=group.name;m.renderOrder=group.order;m.matrixAutoUpdate=false;world.add(m);
  }
  old.forEach(g=>g.dispose());
  const empty=[];world.traverse(o=>{if(o!==world&&o.isGroup&&!o.children.length)empty.push(o);});empty.forEach(o=>o.removeFromParent());
  // Instanced vegetation is also split spatially; a global instance bound would
  // keep every tree alive while driving through a small corner of the map.
  const instances=world.children.filter(o=>o.isInstancedMesh);
  for(const source of instances){
    const cells=new Map(),m=new T.Matrix4(),p=new T.Vector3();
    for(let i=0;i<source.count;i++){source.getMatrixAt(i,m);p.setFromMatrixPosition(m);const key=Math.floor(p.x/size)+','+Math.floor(p.z/size);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(m.clone());}
    source.removeFromParent();
    for(const matrices of cells.values()){const target=new T.InstancedMesh(source.geometry,source.material,matrices.length);matrices.forEach((m,i)=>target.setMatrixAt(i,m));target.computeBoundingSphere();target.matrixAutoUpdate=false;world.add(target);}
    source.dispose();
  }
  const chunks=[];world.traverse(o=>{if(!o.isMesh)return;if(o.isInstancedMesh){o.computeBoundingSphere();}else if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();chunks.push(o);});
  world.updateMatrixWorld(true);
  // This world is static. Cache world bounds once instead of transforming
  // hundreds of spheres and taking square roots on every rendered frame.
  for(const o of chunks)o.userData.worldBound=(o.isInstancedMesh?o.boundingSphere:o.geometry.boundingSphere).clone().applyMatrix4(o.matrixWorld);
  world.userData.chunks=chunks;return chunks;
}

export function updateWorldVisibility(world,camera,far,overview=false){
  let visible=0;
  for(const o of world.userData.chunks||[]){
    const sphere=o.userData.worldBound;
    // Cull only after the complete chunk is beyond opaque fog. No timed or
    // speed-dependent loading, so fast driving/reversing cannot reveal a hole.
    o.visible=overview||camera.position.distanceToSquared(sphere.center)<(far+12+sphere.radius)**2;
    if(o.visible)visible++;
  }
  world.userData.visibleChunks=visible;
}
