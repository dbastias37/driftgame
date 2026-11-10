const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');

async function checkFootprint(track,label){
  const {trackSurface,surfaceGeometry,raisedCurbGeometry,groundGeometry}=await import('../js/track-surface.js');
  const {default:C}=await import('../vendor/clipper.module.js');
  const before=JSON.stringify(track),surface=trackSurface(track);
  const paths=tree=>C.Clipper.PolyTreeToPaths(tree);
  const area=tree=>Math.abs(paths(tree).reduce((sum,p)=>sum+C.Clipper.Area(p),0))/1e8;
  const regions=Object.entries(surface.regions);
  let total=0;
  for(const [name,tree] of regions){
    const geometry=name==='curb'?raisedCurbGeometry(track,surface.curbContours):surfaceGeometry(tree),p=geometry.attributes.position,uv=geometry.attributes.uv,idx=geometry.index;
    assert.ok(Array.from(p.array).every(Number.isFinite),`${label}/${name}: finite geometry`);
    assert.ok(Array.from(uv.array).every(Number.isFinite),`${label}/${name}: finite UVs`);
    let trianglesArea=0;
    for(let k=0;k<idx.count;k+=3){
      const a=idx.getX(k),b=idx.getX(k+1),c=idx.getX(k+2);
      const cross=(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a));
      assert.ok(cross<=1e-5,`${label}/${name}: inverted triangle ${k/3}`);
      trianglesArea-=cross/2;
    }
    const expected=area(tree);
    assert.ok(Math.abs(trianglesArea-expected)<Math.max(.015,expected*.00001),`${label}/${name}: triangulation must cover its polygon including holes (${trianglesArea} / ${expected})`);
    total+=expected;geometry.dispose();
  }
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
    const clipping=new C.Clipper(),intersection=new C.PolyTree();
    clipping.AddPaths(paths(regions[i][1]),C.PolyType.ptSubject,true);
    clipping.AddPaths(paths(regions[j][1]),C.PolyType.ptClip,true);
    clipping.Execute(C.ClipType.ctIntersection,intersection,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    assert.ok(area(intersection)<.002,`${label}: ${regions[i][0]} overlaps ${regions[j][0]}`);
  }
  assert.ok(Math.abs(total-area(surface.footprint))<.02,`${label}: no gaps between surface regions`);
  const groundClip=new C.Clipper(),overlap=new C.PolyTree();
  groundClip.AddPaths(paths(surface.ground),C.PolyType.ptSubject,true);groundClip.AddPaths(paths(surface.footprint),C.PolyType.ptClip,true);
  groundClip.Execute(C.ClipType.ctIntersection,overlap,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
  assert.ok(area(overlap)<.002,`${label}: grass never exists below road, kerbs or runoff`);
  const ground=groundGeometry(track),gp=ground.attributes.position,grassVertices=new Set(Array.from({length:gp.count},(_,i)=>[gp.getX(i),gp.getY(i),gp.getZ(i)].join(',')));
  const runoff=surfaceGeometry(surface.regions.runoff),rp=runoff.attributes.position,runoffVertices=new Set(Array.from({length:rp.count},(_,i)=>[rp.getX(i),rp.getY(i),rp.getZ(i)].join(',')));
  for(const ring of paths(surface.footprint))for(const p of ring){const seam=[Math.fround(p.X/10000),Math.fround(.015),Math.fround(p.Y/10000)].join(',');assert(grassVertices.has(seam)&&runoffVertices.has(seam),`${label}: shared seam vertex ${seam}`);}
  ground.dispose();runoff.dispose();
  for(const marker of surface.markers){
    const p={X:Math.round(marker.x*10000),Y:Math.round(marker.z*10000)};
    let inside=false;
    for(const ring of paths(surface.footprint))if(C.Clipper.PointInPolygon(p,ring)!==0)inside=!inside;
    assert.equal(inside,false,`${label}: marker post placed on track/runoff`);
  }
  assert.equal(JSON.stringify(track),before,`${label}: physics points and width unchanged`);
  assert.equal(trackSurface(track),surface,'Reuse immutable visual layout between quality changes');
}

test('all 20 real circuits have upward, non-overlapping road, curb and runoff surfaces',async()=>{
  const run=harness();
  const tracks=run('Array.from({length:20},(_,i)=>{const t=presetTrack(i+1);return {points:t.points,roadHalf:t.roadHalf};})');
  for(let i=0;i<tracks.length;i++)await checkFootprint(tracks[i],`circuit ${i+1}`);
});

test('custom hairpins, crossings, reversed loops and duplicate points remain watertight',async()=>{
  const tracks=[
    {points:[{x:0,y:0},{x:100,y:0},{x:100,y:2},{x:2,y:2},{x:2,y:70},{x:0,y:70}],roadHalf:12},
    {points:[{x:-50,y:-50},{x:50,y:50},{x:-50,y:50},{x:50,y:-50}],roadHalf:8},
    {points:[{x:0,y:0},{x:0,y:0},{x:0,y:60},{x:60,y:60},{x:60,y:0},{x:0,y:0}],roadHalf:14},
  ];
  for(let i=0;i<tracks.length;i++)await checkFootprint(tracks[i],`custom ${i}`);
});

test('physics sampling and creative-editor helpers remain unchanged',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/track-sampling-v0.3.json'),'utf8'));
  // Preset routes intentionally changed in 0.3.3; physics queries and the
  // creative editor's legacy sampling are still held to their original code.
  for(const code of original.slice(0,4))assert.ok(html.includes(code),'Track queries and creative sampling must remain unchanged');
});

test('low driving cameras keep grass out of road pixels under maximum PSX jitter while moving',async()=>{
  const T=await import('../vendor/three.module.min.js'),{trackSurface,surfaceGeometry,groundGeometry}=await import('../js/track-surface.js');
  await import('../js/game-options.js');const {SoftwareRenderer}=await import('../js/software-renderer.js');
  const canvas={width:320,height:240,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})},renderer=new SoftwareRenderer(canvas);
  renderer.setSize(320,240);renderer.setRetro(DriftOptions.retro({...DriftOptions.presets.classic,jitter:3,affine:1,crt:0,dither:0,bits:24}));
  const track={points:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}],roadHalf:10},scene=new T.Scene(),camera=new T.PerspectiveCamera(76,4/3,.06,300);
  const ground=new T.Mesh(groundGeometry(track),new T.MeshBasicMaterial({color:0x00ff00}));scene.add(ground);
  for(const region of Object.values(trackSurface(track).regions))scene.add(new T.Mesh(surfaceGeometry(region),new T.MeshBasicMaterial({color:0xff0000})));
  for(let frame=0;frame<24;frame++){
    const x=-60+frame*.043;camera.position.set(x,.65,-100);camera.lookAt(x+50,.5,-100);camera.updateMatrixWorld();renderer.render(scene,camera);
    for(const d of [4,8,15,30,50]){const p=new T.Vector3(x+d,.015,-100).project(camera),px=Math.max(0,Math.min(renderer.w-1,Math.floor((p.x+1)*renderer.w/2))),py=Math.max(0,Math.min(renderer.h-1,Math.floor((1-p.y)*renderer.h/2))),i=(py*renderer.w+px)*4;assert(renderer.frame.data[i]>200&&renderer.frame.data[i+1]<20,`grass flicker at frame ${frame}, distance ${d}`);}
  }
  renderer.dispose();
});
