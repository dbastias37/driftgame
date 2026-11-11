import * as T from '../vendor/three.module.min.js';
import trees from '../assets/scenery/trees-data.js';
export let roadTreeRevision=0;

// The two supplied FBX trees keep their original mesh and UVs nearby. Shared,
// reduced meshes replace them only at distance; both levels use the same cells.
export function addRoadTrees(world,matrices,{low=false,snow=false}={}){
  const canLoad=typeof document!=='undefined'&&typeof document.createElementNS==='function';
  const maps=canLoad?['tree-bark.png','tree-leaves.png'].map(file=>{
    const map=new T.TextureLoader().load(new URL('../assets/scenery/'+file,import.meta.url).href,texture=>{
      const image=texture.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);texture.image=c;texture.needsUpdate=true;roadTreeRevision++;
    });
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
  }):[null,null];
  const materials=[new T.MeshStandardMaterial({map:maps[0],color:maps[0]?0xffffff:0x76674e,roughness:.94}),new T.MeshStandardMaterial({map:maps[1],color:maps[1]?0xffffff:(snow?0xabbcb4:0x69863d),alphaTest:.45,side:T.DoubleSide,roughness:1})];
  if(snow){
    materials[1].onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.80, 0.86, 0.90), smoothstep(0.12, 0.7, inverseTransformDirection(normal, viewMatrix).y) * 0.68);\n#include <dithering_fragment>');
    };
    materials[1].customProgramCacheKey=()=> 'road-tree-snow-v1';
  }
  trees.forEach((tree,variant)=>{
    const placements=matrices.filter((_,i)=>i%trees.length===variant);
    tree.lods.forEach((parts,level)=>parts.forEach(part=>{
      if(!part.index.length||!placements.length)return;
      const g=new T.BufferGeometry();
      for(const [name,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(name,new T.Float32BufferAttribute(part[name],size));
      g.setIndex(part.index);g.computeBoundingBox();g.computeBoundingSphere();
      const mesh=new T.InstancedMesh(g,materials[part.material==='leaves'?1:0],placements.length);
      mesh.name='road-tree-'+tree.name+'-'+part.material+'-lod'+level;
      Object.assign(mesh.userData,{sourceAsset:'trees.fbx',cellSize:64,lodMin:level?(low?90:150):0,lodMax:level?Infinity:(low?90:150),overviewLOD:level===1});
      placements.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));world.add(mesh);
    }));
  });
}
