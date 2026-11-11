const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./harness.cjs');
test('supplied tree LODs share exact placement and switch without a gap or double rendering',async()=>{
  const T=await import('../vendor/three.module.min.js'),{addRoadTrees}=await import('../js/road-trees.js'),{batchWorld,updateWorldVisibility}=await import('../js/world-optimization.js');
  const world=new T.Group(),camera=new T.PerspectiveCamera(),placements=[new T.Matrix4().makeTranslation(0,0,0),new T.Matrix4().makeTranslation(10,0,0)];
  addRoadTrees(world,placements);batchWorld(world);
  const snapshots=[];
  for(const distance of [0,149,151,500]){
    camera.position.set(0,0,distance);updateWorldVisibility(world,camera,1000);
    const parts=world.children.filter(o=>o.visible),seen=new Set();
    for(const o of parts){const key=o.name.replace(/-lod\d$/,'');assert(!seen.has(key),'Both LODs visible');seen.add(key);}
    assert.equal(parts.length,4,'A bark or leaf part disappeared');snapshots.push(parts.reduce((n,o)=>n+o.geometry.index.count/3,0));
  }
  assert(snapshots[0]>snapshots[3]*4,'Distant detail does not reduce work');
  updateWorldVisibility(world,camera,Infinity,true);assert(world.children.filter(o=>o.visible).every(o=>o.name.endsWith('lod1')));
});
test('five original touring circuits remain selectable with separate records and restart identity',()=>{
  const r=harness();
  const tracks=r(`Array.from({length:5},(_,i)=>{const t=DriftTouring.createTrack(Track,101+i);startWithTrack(t,'tt');return {id:t.touringId,legacy:t.legacyId,name:t.layout.name,length:t.length,key:currentTrackId};})`);
  assert.deepEqual(tracks.map(t=>t.length),[6400,6800,7200,7800,8400]);
  assert.equal(new Set(tracks.map(t=>t.key)).size,5);assert(tracks.every(t=>t.key.startsWith('TOURING.v1.')));
  r("mode='race';previewTouring(104,5);confirmTrackPreview();showCircuitMenu();");
  assert.equal(r('previewSelection.track.touringId'),104);assert.equal(r('previewSelection.track.raceLaps'),5);
});
test('tunnel approach changes chase distance continuously without modifying vehicle state',()=>{
  const r=harness(),result=r(`(()=>{const t=DriftTouring.createTrack(Track,1),f=t.features.find(f=>f.kind==='tunnel'),car=new Car(t),before=JSON.stringify(car),values=[];for(let s=f.start-40;s<=f.end+40;s+=.25)values.push(DriftTouring.cameraDistanceScale(t,s));return {values,same:before===JSON.stringify(car)}})()`);
  assert(result.same);assert.equal(result.values[0],1);assert.equal(result.values.at(-1),1);assert(Math.min(...result.values)===.8);
  assert(result.values.slice(1).every((v,i)=>Math.abs(v-result.values[i])<.003));
});
test('Summit contains its original atlas and every geometry accessor stays in the GLB buffer',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../assets/bonus/summit.glb'));
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
  const size=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+size)),binary=b.subarray(28+size);
  assert.equal(json.images.length,1);assert.equal(json.images[0].mimeType,'image/png');assert.equal(json.meshes.length,1205);
  assert(json.images.every(i=>i.bufferView!==undefined&&!i.uri));assert(json.buffers.every(i=>!i.uri));
  for(const v of json.bufferViews)assert((v.byteOffset||0)+v.byteLength<=binary.length);
  const image=json.bufferViews[json.images[0].bufferView],png=binary.subarray(image.byteOffset,image.byteOffset+image.byteLength);assert.equal(png.subarray(1,4).toString(),'PNG');
});
