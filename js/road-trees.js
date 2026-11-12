import * as T from '../vendor/three.module.min.js';
import broadleafTrees from '../assets/scenery/trees-data.js';
import pineTrees from '../assets/scenery/pine-tree-data.js';
const trees=[...broadleafTrees,...pineTrees];
export let roadTreeRevision=0;

// The supplied FBX trees and pine retain their original mesh and UVs nearby. Shared,
// reduced meshes replace them only at distance; both levels use the same cells.
export function addRoadTrees(world,matrices,{low=false,snow=false,cellSize=64,lodByBounds=false,cellBudget=Infinity}={}){
  // Keep sparse forests within a draw-chunk budget. Start with small cells and
  // only enlarge when the existing terrain leaves fewer batching slots.
  if(Number.isFinite(cellBudget)){
    const point=new T.Vector3();
    const count=size=>{
      const cells=trees.map(()=>new Set());
      matrices.forEach((matrix,i)=>{point.setFromMatrixPosition(matrix);cells[i%trees.length].add(Math.floor(point.x/size)+','+Math.floor(point.z/size));});
      return cells.reduce((sum,set,i)=>sum+set.size*trees[i].lods.reduce((n,parts)=>n+parts.length,0),0);
    };
    for(const size of [96,128,160,192,256,320,384,512,640,768,1024]){cellSize=size;if(count(size)<=cellBudget)break;}
  }
  const canLoad=typeof document!=='undefined'&&typeof document.createElementNS==='function';
  const maps=canLoad?['tree-bark.png','tree-leaves.png','pine-bark.jpg','pine-leaves.png'].map(file=>{
    const map=new T.TextureLoader().load(new URL('../assets/scenery/'+file,import.meta.url).href,texture=>{
      const image=texture.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);texture.image=c;texture.needsUpdate=true;roadTreeRevision++;
    });
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
  }):[null,null,null,null];
  const materials=maps.map((map,i)=>new T.MeshStandardMaterial({map,color:map?0xffffff:i%2?(snow?0xabbcb4:0x69863d):0x76674e,alphaTest:i%2?.45:0,side:i%2?T.DoubleSide:T.FrontSide,roughness:1}));
  if(snow)for(const i of [1,3]){
    materials[i].onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.80, 0.86, 0.90), smoothstep(0.12, 0.7, inverseTransformDirection(normal, viewMatrix).y) * 0.68);\n#include <dithering_fragment>');
    };
    materials[i].customProgramCacheKey=()=> 'road-tree-snow-v1';
  }
  const materialIndex={bark:0,leaves:1,'pine-bark':2,'pine-leaves':3};
  trees.forEach((tree,variant)=>{
    const placements=matrices.filter((_,i)=>i%trees.length===variant);
    tree.lods.forEach((parts,level)=>parts.forEach(part=>{
      if(!part.index.length||!placements.length)return;
      const g=new T.BufferGeometry();
      for(const [name,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(name,new T.Float32BufferAttribute(part[name],size));
      g.setIndex(part.index);g.computeBoundingBox();g.computeBoundingSphere();
      const mesh=new T.InstancedMesh(g,materials[materialIndex[part.material]],placements.length);
      mesh.name='road-tree-'+tree.name+'-'+part.material+'-lod'+level;
      Object.assign(mesh.userData,{sourceAsset:tree.sourceAsset||'trees.fbx',cellSize,lodByBounds,lodMin:level?(low?90:150):0,lodMax:level?Infinity:(low?90:150),overviewLOD:level===1});
      placements.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));world.add(mesh);
    }));
  });
}
