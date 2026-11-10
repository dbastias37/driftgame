const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

test('five long original loops have gentle grades, continuous banks and separated road corridors',()=>{
  const r=harness(),tracks=r(`Array.from({length:5},(_,i)=>{const t=DriftTouring.createTrack(Track,i+1);return {points:t.points,length:t.length,half:t.roadHalf,features:t.features,radius:DriftTouring.layout(i+1).minRadius,grades:t.points.map(p=>t.sample(p.x,p.y).grade)}})`);
  for(const t of tracks){
    assert(t.length>=6400&&t.length<=8400);assert(t.radius>100);let length=0,up=false,down=false;
    for(let i=0;i<t.points.length;i++){
      const p=t.points[i],q=t.points[(i+1)%t.points.length],ds=Math.hypot(q.x-p.x,q.y-p.y);length+=ds;
      assert(ds>3.99&&ds<4.01);assert(Math.abs(t.grades[i])<.075);assert(Math.abs(q.bank-p.bank)/ds<.0015);assert(Math.abs(p.bank)<=Math.PI/20+.00001);
      up||=t.grades[i]>.02;down||=t.grades[i]<-.02;
      for(let j=i+35;j<t.points.length;j+=13){const separation=Math.min(j-i,t.points.length-j+i);if(separation<35)continue;assert(Math.hypot(p.x-t.points[j].x,p.y-t.points[j].y)>t.half*2+45,'Distinct road sections or structures overlap');}
    }
    assert(up&&down);assert(Math.abs(length-t.length)<.1);assert(t.features.some(f=>f.kind==='tunnel'));assert(t.features.some(f=>f.kind==='bridge'));
    assert(Math.abs(t.grades[0]-t.grades.at(-1))<.001);
  }
});

test('gravity follows grade and banking, brakes hold on a slope and barriers protect the full vehicle',()=>{
  const r=harness();assert(r('DriftTouring.gravity({grade:.05,bank:0,tang:0}).x')<0);assert(r('DriftTouring.gravity({grade:-.05,bank:0,tang:0}).x')>0);assert(r('DriftTouring.gravity({grade:0,bank:.1,tang:0}).y')<0);
  r("startWithTrack(DriftTouring.createTrack(Track,4),'race');state='running';var p=track.atDistance(track.length*.25);player.pos={x:p.x,y:p.y};player.angle=track.tangentAt(p.i);DriftRoadContact.reset(track,player,chosen.sprite);var before={...player.pos};keys.add(' ');for(let i=0;i<300;i++)simulate(SIM_DT);");
  assert.equal(r('player.worldSpeed()'),0);assert(r('Math.hypot(player.pos.x-before.x,player.pos.y-before.y)')<.001);
  const results=r(`(()=>{const output=[];for(const f of track.features)for(const side of [-1,1]){const p=track.atDistance((f.start+f.end)/2),a=track.tangentAt(p.i),n=track.normalAt(p.i);player.pos={x:p.x+n.x*(track.roadHalf+2)*side,y:p.y+n.y*(track.roadHalf+2)*side};player.angle=a+side*.4;player.vel={x:n.x*55*side,y:n.y*55*side};DriftTouring.afterStep(track,player);const q=track.sample(player.pos.x,player.pos.y);output.push({distance:q.distance,velocity:player.vel.x*n.x*side+player.vel.y*n.y*side});}return output})()`);
  for(const out of results){assert(out.distance<12.5);assert(out.velocity<=0);}
});

test('touring selection preserves four/five laps, preview return, restart and record identity',()=>{
  const r=harness();r("mode='race';showCircuitMenu();previewTouring(4,5);confirmTrackPreview();returnToTrackPreview();");assert.equal(r('previewSelection.track.touringId'),4);assert.equal(r('previewSelection.track.raceLaps'),5);
  r("confirmTrackPreview();$('#btnChooseStart').click();");assert.equal(r('TOTAL_LAPS'),5);assert(r('currentTrackId').startsWith('TOURING.v1.4:'));assert.equal(r('track.trackProps.props.length'),0);
  r('restartRaceSameTrack()');assert.equal(r('TOTAL_LAPS'),5);assert.equal(r('track.touringId'),4);
  r("startWithTrack(DriftTouring.createTrack(Track,2),'race')");assert.equal(r('TOTAL_LAPS'),4);assert.equal(r('lap'),1);
  r("startWithTrack(presetTrack(2),'race')");assert.equal(r('TOTAL_LAPS'),5);assert.equal(r('!!track.elevated'),false);
});

test('road contact remains attached over crests, banks and the closed seam at 200 km/h',()=>{
  const r=harness();const results=r(`(()=>{const result=[];for(let id=1;id<=5;id++){const t=DriftTouring.createTrack(Track,id),car=new Car(t);car.skin='blue';let maxError=0,maxJump=0;DriftRoadContact.reset(t,car,'blue');let prev=car.ride.height;for(let s=0;s<t.length+25;s+=55.55/60){const p=t.atDistance(s);car.pos={x:p.x,y:p.y};car.angle=t.tangentAt(p.i);DriftRoadContact.update(t,car,1/60,'blue');const contact=DriftRoadContact.contacts(t,car,'blue');maxError=Math.max(maxError,Math.abs(contact.height-car.ride.height));maxJump=Math.max(maxJump,Math.abs(prev-car.ride.height));prev=car.ride.height;}result.push({maxError,maxJump})}return result})()`);
  for(const result of results){assert(result.maxError<.03,JSON.stringify(result));assert(result.maxJump<.12,JSON.stringify(result));}
});

test('all five circuits are drivable for a full lap by the real vehicle model and AI',()=>{
  const r=harness();const results=r(`(()=>{const result=[];for(let id=1;id<=5;id++){const tr=DriftTouring.createTrack(Track,id),car=new Car(tr),data=CAR_DATA[(id-1)%CAR_DATA.length];DriftNet.configure(car,data,true);DriftRoadContact.reset(tr,car,car.skin);let distance=0,last=tr.sample(car.pos.x,car.pos.y).s,off=0,hit=0,maxHeightError=0,steps=0;while(distance<tr.length+20&&steps<36000){const input=DriftRace.drive(car,tr);car.update(1/60,input,tr);DriftRoadContact.update(tr,car,1/60,car.skin);const q=tr.sample(car.pos.x,car.pos.y);let ds=q.s-last;if(ds<-tr.length/2)ds+=tr.length;if(ds>tr.length/2)ds-=tr.length;distance+=ds;last=q.s;off+=Number(car.offTrack);hit=car.touringImpacts||0;maxHeightError=Math.max(maxHeightError,Math.abs(car.ride.height-tr.surfaceHeight(car.pos.x,car.pos.y)));steps++;}result.push({id,skin:car.skin,distance,length:tr.length,off,hit,maxHeightError,seconds:steps/60});}return result})()`);
  console.log('Touring full-lap simulation:',JSON.stringify(results));
  for(const result of results){assert(result.distance>result.length,JSON.stringify(result));assert.equal(result.off,0,JSON.stringify(result));assert.equal(result.hit,0,JSON.stringify(result));assert(result.maxHeightError<.15,JSON.stringify(result));}
});

test('ordered gates award exactly four laps and finish freezes the race',()=>{
  const r=harness();r("renderPrefs.rivals=0;startWithTrack(DriftTouring.createTrack(Track,1),'race');state='running';");
  r(`for(let lapPass=0;lapPass<4;lapPass++){for(let i=1;i<=track.points.length;i++){raceTime+=.1;lapTime+=.1;advanceLap(i-1,i%track.points.length);}}`);
  assert.equal(r('state'),'finished');const before=r('raceTime');r('simulate(1)');assert.equal(r('raceTime'),before);
});

test('tunnel camera keeps all views inside the clear opening and permits mounted cameras',()=>{
  const r=harness(),results=r(`(()=>{const out=[];for(let id=1;id<=5;id++){const tr=DriftTouring.createTrack(Track,id);for(const tunnel of tr.features.filter(f=>f.kind==='tunnel'))for(const s of [tunnel.start-10,tunnel.start+1,(tunnel.start+tunnel.end)/2,tunnel.end-1]){const p=tr.atDistance(s),car={pos:p,angle:tr.tangentAt(p.i)};for(const mounted of [false,true]){const eye={x:p.x,y:p.h+40,z:p.y},target={x:0,y:0,z:0};DriftTouring.constrainCamera(tr,car,eye,target,mounted);out.push({height:eye.y-tr.surfaceHeight(eye.x,eye.z),dist:tr.sample(eye.x,eye.z).distance});}}}return out})()`);
  for(const result of results){assert(result.height>=.19&&result.height<=6.31);assert(result.dist<11.01);}
});
