const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {harness}=require('./harness.cjs');
test('NFS III Especial selects all three independent maps, laps and record namespaces',()=>{
 const r=harness();r("document.getElementById('btnSummit').click()");assert.equal(r('previewSelection.track.touringId'),201);
 for(const [id,slug,asset] of [[201,'summit','summit.glb'],[202,'rocky','rocky-pass.glb'],[203,'redrock','redrock-ridge.glb']]){
  const result=r(`(()=>{previewTouring(${id},5);const t=previewSelection.track;startWithTrack(t,'tt');return {name:t.layout.name,stage:t.layout.stage,laps:t.raceLaps,key:currentTrackId,length:t.length,hash:DriftNFSData['${slug}'].sourceSHA256,start:t.atDistance(0),end:t.atDistance(t.length)}})()`);
  assert.equal(result.stage,'NFS III Especial');assert.equal(result.laps,5);assert(result.key.startsWith('NFSIII.v3.'+slug));assert.deepEqual(result.start,result.end);assert(result.length>8700&&result.length<10400);
  assert.equal(result.hash,crypto.createHash('sha256').update(fs.readFileSync(new URL('../assets/bonus/'+asset,'file://'+__filename))).digest('hex'));
 }
});
test('lateral floor remains usable beyond the central asphalt, with no invisible centre-line clamp',()=>{
 const r=harness();const rows=r(`(()=>{return [201,202,203].map(id=>{const t=DriftTouring.createTrack(Track,id),c=configureSelectedCar(new Car(t),CAR_DATA[0]);let checked=0,maxShift=0;for(let s=10;s<t.length;s+=41){const p=t.atDistance(s);for(const side of [-1,1]){const o=side*(t.roadHalf+4),x=p.x+p.nx*o,y=p.y+p.ny*o,a=t.sample(p.x,p.y,p.h).tang;if(!t.footprintFits(x,y,a,c.bodyDimensions))continue;c.pos={x,y};c.angle=a;c.vel={x:0,y:0};DriftTouring.afterStep(t,c);maxShift=Math.max(maxShift,Math.hypot(c.pos.x-x,c.pos.y-y));checked++;}}return {id,checked,maxShift}})})()`);
 for(const row of rows){assert(row.checked>50,JSON.stringify(row));assert(row.maxShift<2,'Only local separation from visible walls is allowed: '+JSON.stringify(row));}
});
test('Redrock bridge and road below keep their distinct level, route station and wheel support',()=>{
 const r=harness();const rows=r(`(()=>{const t=DriftTouring.createTrack(Track,203);return [685,8665].map(s=>{const p=t.atDistance(s),q=t.sample(p.x,p.y,p.h),c={pos:{x:p.x,y:p.y},angle:q.tang,vel:{x:0,y:0}};DriftRoadContact.reset(t,c,'blue');c.ride.groundHeight=p.h;DriftRoadContact.update(t,c,1/60,'blue');return {s,station:q.s,h:p.h,support:t.surfaceHeight(p.x,p.y,p.h),ride:c.ride.height}})})()`);
 assert(rows[1].h-rows[0].h>5);for(const row of rows){assert(Math.abs(row.s-row.station)<.001);assert(Math.abs(row.h-row.support)<.01);assert(Math.abs(row.h-row.ride)<.08);}
});
test('both supplied maps retain their embedded texture atlas and valid geometry',()=>{
 for(const name of ['rocky-pass','redrock-ridge']){const b=fs.readFileSync(new URL('../assets/bonus/'+name+'.glb','file://'+__filename)),size=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+size));assert.equal(b.readUInt32LE(8),b.length);assert(g.meshes.length>1000);assert(g.images.some(i=>i.bufferView!==undefined&&i.mimeType==='image/png'));for(const view of g.bufferViews)assert((view.byteOffset||0)+view.byteLength<=g.buffers[0].byteLength);}
});

test('respawning beside the Redrock crossing stays on the same road level',()=>{
 const r=harness();
 const rows=r(`(()=>{startWithTrack(DriftTouring.createTrack(Track,203),'tt');return [683,8665].flatMap(s=>[-3,3].map(offset=>{const p=track.atDistance(s);player.pos={x:p.x+p.nx*offset,y:p.y+p.ny*offset};player.angle=track.sample(p.x,p.y,p.h).tang;DriftRoadContact.reset(track,player,player.skin,p.h);player.ride.airborne=true;player.ride.flightVy=4;player.ride.height+=2;respawnAtNearestCenter();const q=track.sample(player.pos.x,player.pos.y,player.ride.groundHeight);return {s,station:q.s,expected:p.h,height:player.ride.height,airborne:player.ride.airborne,vy:player.ride.flightVy}}))})()`);
 for(const row of rows){assert(Math.abs(row.station-row.s)<2,JSON.stringify(row));assert(Math.abs(row.height-row.expected)<.15,JSON.stringify(row));assert.equal(row.airborne,false);assert.equal(row.vy,0);}
});
