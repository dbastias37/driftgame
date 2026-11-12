import * as T from '../vendor/three.module.min.js';
// Weld only sub-centimetre import seams, in world space. Keep each face's UVs:
// merging UV islands would smear the supplied atlas across unrelated surfaces.
export function repairNFSGeometry(root){
  root.updateMatrixWorld(true);
  const cells=new Map(),seen=new Set(),epsilon=.012,point=new T.Vector3();
  let welded=0,duplicates=0;
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const g=mesh.geometry,positions=g.attributes.position,inverse=mesh.matrixWorld.clone().invert(),keys=[];
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const ix=Math.floor(point.x/epsilon),iy=Math.floor(point.y/epsilon),iz=Math.floor(point.z/epsilon);let match;
      for(let x=-1;x<=1&&!match;x++)for(let y=-1;y<=1&&!match;y++)for(let z=-1;z<=1&&!match;z++)
        match=cells.get(`${ix+x},${iy+y},${iz+z}`)?.find(p=>p.distanceToSquared(point)<epsilon*epsilon);
      if(match){if(match.distanceToSquared(point)>1e-12)welded++;point.copy(match);}
      else{const key=`${ix},${iy},${iz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(point.clone());}
      keys.push(`${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`);
      point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);
    }
    const indices=g.index?Array.from(g.index.array):Array.from({length:positions.count},(_,i)=>i),kept=[];
    for(let i=0;i<indices.length;i+=3){
      const face=indices.slice(i,i+3),key=face.map(j=>keys[j]).sort().join('|');
      if(seen.has(key)){duplicates++;continue;}
      seen.add(key);kept.push(...face);
    }
    g.setIndex(kept);positions.needsUpdate=true;g.computeBoundingSphere();
  });
  return {welded,duplicates};
}
