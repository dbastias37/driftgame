const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const run=harness();
const tracks=run('Array.from({length:20},(_,i)=>CircuitLayouts.build(i+1))');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function segmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}

test('twenty distinct circuit layouts have continuous spacing, tangent seams and safe clearances',()=>{
  const signatures=new Set();
  for(const t of tracks){
    const p=t.points,N=p.length;let length=0,minRadius=Infinity;
    assert.equal(N%2,0,'Even samples preserve nearest-index lap gates');
    for(let i=0;i<N;i++){
      const a=p[i],b=p[(i+1)%N],c=p[(i+2)%N],d=distance(a,b);length+=d;
      assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
      assert.ok(d>3.9&&d<=4.01,`L${t.level}: uneven spacing/seam ${d}`);
      const area2=Math.abs(cross(a,b,c));
      if(area2>1e-7)minRadius=Math.min(minRadius,d*distance(b,c)*distance(c,a)/(2*area2));
      for(let j=i+2;j<N;j++){
        if(i===0&&j===N-1)continue;
        const u=p[j],v=p[(j+1)%N];
        assert.ok(!(cross(a,b,u)*cross(a,b,v)<0&&cross(u,v,a)*cross(u,v,b)<0),`L${t.level}: centerline crossing`);
        const separation=Math.min(j-i,N-j+i)*t.length/N;
        if(separation>(t.roadHalf+6)*Math.PI){
          assert.ok(segmentDistance(a,u,v)>2*(t.roadHalf+4)+2,`L${t.level}: unrelated road/runoff edges too close`);
        }
      }
    }
    assert.ok(Math.abs(length-t.length)<1,`L${t.level}: wrong lap length`);
    assert.ok(minRadius>t.roadHalf+7,`L${t.level}: inner edge too tight (${minRadius})`);
    // Both sides of the starting seam are straight: no kink at lap/spawn.
    assert.ok(Math.abs(cross(p[N-2],p[0],p[2]))<1e-6);
    assert.ok(t.startStraight>100);
    signatures.add(JSON.stringify(p));
  }
  assert.equal(signatures.size,20);
});

test('challenge grows in distance, corner count and linked reversals across five stages',()=>{
  for(let i=1;i<20;i++){
    assert.ok(tracks[i].length>tracks[i-1].length);
    assert.ok(tracks[i].corners>=tracks[i-1].corners);
  }
  const stages=Array.from({length:5},(_,i)=>tracks.slice(i*4,i*4+4));
  const average=(s,k)=>s.reduce((sum,t)=>sum+t[k],0)/s.length;
  for(let i=1;i<5;i++){
    assert.ok(average(stages[i],'corners')>average(stages[i-1],'corners'));
    assert.ok(average(stages[i],'transitions')>=average(stages[i-1],'transitions'));
  }
  assert.ok(average(stages[4],'transitions')>=6);
  // Aspect ratios are deliberately varied, rather than adding radial lobes.
  const aspect=t=>{const xs=t.points.map(p=>p.x),ys=t.points.map(p=>p.y);return (Math.max(...xs)-Math.min(...xs))/(Math.max(...ys)-Math.min(...ys));};
  assert.ok(tracks.some(t=>aspect(t)<.8));assert.ok(tracks.some(t=>aspect(t)>2.3));
});

test('preset copies, thumbnails and track IDs use the same deterministic circuits without altering saved progress',()=>{
  const r=harness();
  r("localStorage.setItem('challenge:unlocked','12');localStorage.setItem('challenge:best:7','100000');loadChallengeProgress();");
  for(let n=1;n<=20;n++){
    const expected=r(`encodeSharedTrack(presetTrack(${n}))`);
    assert.equal(r(`encodeSharedTrack(presetTrack(${n}))`),expected);
    assert.equal(r(`Math.abs(decodeTrack(encodeSharedTrack(presetTrack(${n}))).roadHalf-presetTrack(${n}).roadHalf)`),0);
    assert.deepEqual(r(`presetTrack(${n}).points`),tracks[n-1].points);
  }
  r('const changedPreset=presetTrack(3);changedPreset.points[0].x=999999;');
  assert.notEqual(r('presetTrack(3).points[0].x'),999999);
  assert.equal(r('unlockedLevel'),12);assert.equal(r('getChallengeBest(7)'),100000);
});
