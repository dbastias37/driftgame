import * as T from '../vendor/three.module.min.js';
import C from '../vendor/clipper.module.js';
const SCALE=10000;
export function roadFootprint(track){
  const edge=side=>track.points.map((p,i)=>{const n=track.normalAt(i),d=(track.roadHalf+1.3)*side;return {X:Math.round((p.x+n.x*d)*SCALE),Y:Math.round((p.y+n.y*d)*SCALE)};});
  return [...edge(-1),...edge(1).reverse()];
}
// Terrain is cut out underneath the shoulder instead of trying to hide a
// coarse heightfield by lowering selected vertices. Both boundaries coincide.
export function buildMountainTerrain(track,world,material){
  const b=track.bounds,tile=64,step=8,footprint=roadFootprint(track),cache=new Map();
  const sample=(x,z)=>{const key=x+','+z;if(!cache.has(key)){const q=track.sampleNearby(x,z);let h=track.baseHeight(x,z);if(q){const t=Math.max(0,Math.min(1,(q.distance-track.roadHalf-1.3)/30));h=q.h+(h-q.h)*t*t*(3-2*t);}cache.set(key,{q,h});}return cache.get(key);};
  for(let x=Math.floor((b.minX-160)/tile)*tile;x<b.maxX+160;x+=tile)for(let z=Math.floor((b.minY-180)/tile)*tile;z<b.maxY+180;z+=tile){
    const vertices=[],colors=[];
    const vertex=p=>{const px=p.X/SCALE,pz=p.Y/SCALE,{q,h}=sample(px,pz);vertices.push(px,h,pz);const slope=q?Math.abs(track.baseHeight(px,pz)-q.h)/Math.max(8,q.distance):0;const c=new T.Color(slope>.6?0x728a84:0x526253);colors.push(c.r,c.g,c.b);};
    const triangulate=node=>{
      if(!node.IsHole()&&node.Contour().length>=3){
        const outer=node.Contour(),holes=node.Childs().filter(n=>n.IsHole()).map(n=>n.Contour());
        const vector=ring=>ring.map(p=>new T.Vector2(p.X,p.Y)),all=[...outer,...holes.flat()];
        for(let [a,b,c] of T.ShapeUtils.triangulateShape(vector(outer),holes.map(vector))){const p=all[a],q=all[b],r=all[c];if((q.X-p.X)*(r.Y-p.Y)-(q.Y-p.Y)*(r.X-p.X)>0)[b,c]=[c,b];for(const i of [a,b,c])vertex(all[i]);}
      }
      node.Childs().forEach(triangulate);
    };
    for(let j=0;j<tile;j+=step)for(let i=0;i<tile;i+=step){
      const xx=x+i,zz=z+j,ring=[[xx,zz],[xx+step,zz],[xx+step,zz+step],[xx,zz+step]].map(([x,z])=>({X:Math.round(x*SCALE),Y:Math.round(z*SCALE)}));
      const {q}=sample(xx+step/2,zz+step/2);
      if(!q||q.distance>track.roadHalf+1.3+step*Math.SQRT2){for(const n of [0,2,1,0,3,2])vertex(ring[n]);continue;}
      const clip=new C.Clipper(),tree=new C.PolyTree();clip.AddPath(ring,C.PolyType.ptSubject,true);clip.AddPath(footprint,C.PolyType.ptClip,true);clip.Execute(C.ClipType.ctDifference,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);triangulate(tree);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name='mountain-terrain';world.add(mesh);
  }
}
