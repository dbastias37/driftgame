const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');

async function checkFootprint(track,label){
  const {trackSurface,surfaceGeometry,raisedCurbGeometry}=await import('../js/track-surface.js');
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
