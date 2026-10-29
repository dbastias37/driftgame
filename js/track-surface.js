import * as T from '../vendor/three.module.min.js';
import C from '../vendor/clipper.module.js';

// Visual footprint only. Never resample or replace the simulation's track.points.
// Integer clipping removes folds in tight bends before triangulation, including
// tracks with unevenly spaced points, hairpins and user-drawn crossings.
const SCALE=10000, HEIGHT=.015;
const cache=new WeakMap();
const point=p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)});
const paths=tree=>C.Clipper.PolyTreeToPaths(tree);

function clip(subject,cut=[],operation=C.ClipType.ctUnion){
  const c=new C.Clipper(),tree=new C.PolyTree();
  c.StrictlySimple=true;
  c.AddPaths(subject,C.PolyType.ptSubject,true);
  if(cut.length)c.AddPaths(cut,C.PolyType.ptClip,true);
  c.Execute(operation,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
  return tree;
}
function stroke(lines,radius,closed=true){
  const offset=new C.ClipperOffset(2,.03*SCALE),out=[];
  offset.AddPaths(lines,C.JoinType.jtRound,closed?C.EndType.etClosedLine:C.EndType.etOpenButt);
  offset.Execute(out,radius*SCALE);
  return out;
}
const subtract=(outer,inner)=>clip(outer,inner,C.ClipType.ctDifference);

// Divide markings by arc length, not by the density of source samples.
function dashes(contours,length=2.8,duty=.5){
  const out=[];
  for(const contour of contours){
    const lengths=contour.map((p,i)=>{const q=contour[(i+1)%contour.length];return Math.hypot(q.X-p.X,q.Y-p.Y);});
    const total=lengths.reduce((a,b)=>a+b,0);
    if(total<1)continue;
    const count=Math.max(1,Math.round(total/(length*SCALE/duty))),period=total/count;
    let distance=0,part=null;
    for(let i=0;i<contour.length;i++){
      const a=contour[i],b=contour[(i+1)%contour.length],len=lengths[i];
      let used=0;
      while(used<len-.0001){
        const absolute=distance+used,cycle=Math.floor((absolute+.0001)/period);
        const phase=absolute-cycle*period,on=phase<period*duty-.0001;
        const end=Math.min(len,used+(on?period*duty:period)-phase);
        const at=d=>({X:Math.round(a.X+(b.X-a.X)*d/len),Y:Math.round(a.Y+(b.Y-a.Y)*d/len)});
        if(on){if(!part)part=[at(used)];part.push(at(end));}
        else if(part){out.push(part);part=null;}
        used=end;
      }
      distance+=len;
    }
    if(part)out.push(part);
  }
  return out;
}

export function trackSurface(track){
  const existing=cache.get(track);
  if(existing?.half===track.roadHalf)return existing;
  const center=C.Clipper.CleanPolygon(track.points.map(point),.03*SCALE),half=track.roadHalf;
  const asphalt=stroke([center],half-.16);
  const edge=stroke([center],half+.16),curb=stroke([center],half+.86);
  const outside=stroke([center],half+4),curbBand=paths(subtract(curb,edge));
  const middle=stroke([center],half+.51);
  const centerPaint=stroke(dashes([center],3,.25),.075,false);
  const centerLine=clip(asphalt,centerPaint,C.ClipType.ctIntersection);
  const regions={
    asphalt:subtract(asphalt,paths(centerLine)),
    edge:subtract(edge,asphalt),
    curb:clip(curbBand),
    runoff:subtract(outside,curb),
    centerLine,
  };
  const curbContours=middle.map(contour=>{
    let distance=0;
    const segments=contour.map((p,i)=>{
      const q=contour[(i+1)%contour.length],x=p.X/SCALE,z=p.Y/SCALE;
      const dx=(q.X-p.X)/SCALE,dz=(q.Y-p.Y)/SCALE,len=Math.hypot(dx,dz);
      const segment={x,z,dx,dz,len,start:distance};distance+=len;return segment;
    });
    return {segments,length:distance,period:distance/Math.max(1,Math.round(distance/5.6))};
  });
  const footprint=clip(outside),markerOffset=new C.ClipperOffset(2,.03*SCALE),markerPaths=[];
  markerOffset.AddPaths(paths(footprint),C.JoinType.jtRound,C.EndType.etClosedPolygon);
  markerOffset.Execute(markerPaths,2*SCALE);
  const markers=[];
  for(const contour of markerPaths){
    const lengths=contour.map((p,i)=>{const q=contour[(i+1)%contour.length];return Math.hypot(q.X-p.X,q.Y-p.Y);});
    const total=lengths.reduce((a,b)=>a+b,0),count=Math.max(1,Math.floor(total/(12*SCALE)));
    let segment=0,start=0;
    for(let i=0;i<count;i++){
      const s=i*total/count;
      while(segment<lengths.length-1&&start+lengths[segment]<s)start+=lengths[segment++];
      const p=contour[segment],q=contour[(segment+1)%contour.length],t=(s-start)/(lengths[segment]||1);
      markers.push({x:(p.X+(q.X-p.X)*t)/SCALE,z:(p.Y+(q.Y-p.Y)*t)/SCALE});
    }
  }
  const result={half,regions,curbContours,footprint,markers};
  cache.set(track,result);
  return result;
}

function project(x,z,contour){
  let best={distance:Infinity,s:0};
  for(const p of contour.segments){
    if(p.len<1e-8)continue;
    const t=Math.max(0,Math.min(1,((x-p.x)*p.dx+(z-p.z)*p.dz)/(p.len*p.len)));
    const distance=(x-p.x-t*p.dx)**2+(z-p.z-t*p.dz)**2;
    if(distance<best.distance)best={distance,s:p.start+t*p.len};
  }
  return best;
}

export function surfaceGeometry(tree,curbContours=null){
  const vertices=[],uv=[],indices=[];
  function visit(node){
    if(!node.IsHole()&&node.Contour().length>=3){
      const convert=ring=>ring.map(p=>new T.Vector2(Math.fround(p.X/SCALE),Math.fround(p.Y/SCALE)));
      const outer=convert(node.Contour()),holes=node.Childs().filter(n=>n.IsHole()).map(n=>convert(n.Contour()));
      const faces=T.ShapeUtils.triangulateShape(outer,holes),points=outer.concat(...holes),base=vertices.length/3;
      if(!curbContours)for(const p of points){vertices.push(p.x,HEIGHT,p.y);uv.push(p.x/9,p.y/9);}
      for(let [a,b,c] of faces){
        const p=points[a],q=points[b],r=points[c],area=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
        if(Math.abs(area)<1e-10)continue;
        // X/Z coordinates require clockwise winding for upward (+Y) normals.
        if(area>0)[b,c]=[c,b];
        if(!curbContours){indices.push(base+a,base+b,base+c);continue;}
        const tri=[points[a],points[b],points[c]],cx=(p.x+q.x+r.x)/3,cz=(p.y+q.y+r.y)/3;
        let contour=curbContours[0],nearest=Infinity;
        for(const loop of curbContours){const d=project(cx,cz,loop).distance;if(d<nearest){nearest=d;contour=loop;}}
        const distances=tri.map(p=>project(p.x,p.y,contour).s);
        if(Math.max(...distances)-Math.min(...distances)>contour.length/2){
          for(let i=0;i<3;i++)if(distances[i]<contour.length/2)distances[i]+=contour.length;
        }
        for(let i=0;i<3;i++){
          indices.push(vertices.length/3);vertices.push(tri[i].x,HEIGHT,tri[i].y);
          uv.push(distances[i]/contour.period,.5);
        }
      }
    }
    for(const child of node.Childs())visit(child);
  }
  visit(tree);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
