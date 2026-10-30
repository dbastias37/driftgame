const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
let browser,server,url;
before(async()=>{
  server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    try{res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html;charset=utf-8');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async()=>{await browser?.close();await new Promise(r=>server?server.close(r):r());});
async function fixture(options={}){
  const context=await browser.newContext({viewport:{width:1366,height:768},...options});
  // Only the game's RAF is controlled. UI actionability keeps the browser RAF.
  await context.addInitScript(()=>{const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>fn.name==='loop'?0:raf.call(window,fn);});
  await context.route('https://**/*',r=>r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);return {page,context,errors};
}
test('arranque, cuatro autos, menú de 20 desafíos y marcha manual',async()=>{
  const {page:p,context:c,errors}=await fixture();
  await p.click('#btnModeChallenge');assert.equal(await p.locator('.btnPickChallenge').count(),20);
  await p.click('.btnPickChallenge[data-lvl="20"]');assert.equal(await p.locator('#btnChallengeContinue').isEnabled(),false);
  await p.click('.btnPickChallenge[data-lvl="1"]');await p.click('#btnChallengeContinue');const names=[];
  for(let i=0;i<4;i++){names.push(await p.locator('#carName').textContent());await p.click('#carNext');}
  assert.equal(new Set(names).size,4);await p.check('input[value="manual"]');await p.click('#btnChooseStart');
  const initial=await p.evaluate(()=>({sprites:Object.values(CAR_IMG).every(i=>i.naturalWidth>0),state,auto:player.auto}));
  assert.deepEqual(initial,{sprites:true,state:'countdown',auto:false});
  await p.keyboard.press('e');assert.equal(await p.evaluate(()=>player.gear),2);
  await p.keyboard.press('Control');assert.equal(await p.evaluate(()=>player.gear),1);
  assert.deepEqual(errors,[]);await c.close();
});
test('puntaje cero detenido, proporcional al tiempo y caja sin rebotes',async()=>{
  const {page:p,context:c}=await fixture();
  const r=await p.evaluate(()=>{
    const tr=presetTrack(1),idle=[],scores=[];
    for(const fps of [30,60,120]){
      const a=new Car(tr);for(let i=0;i<fps*10;i++)a.update(1/fps,{handbrake:true},tr);idle.push(a.score);
      const b=new Car(tr),f={x:C(b.angle),y:S(b.angle)},n={x:-S(b.angle),y:C(b.angle)};
      for(let i=0;i<fps*10;i++)b._updateScoreAndTrail(1/fps,tr,f,n,50,5);scores.push(b.score);
    }
    const a=new Car(tr);a.auto=true;let last=1,transitions=[];
    for(let i=0;i<600;i++){a.update(1/60,{accel:true},tr);if(a.gear!==last){transitions.push(i);last=a.gear;}}
    return {idle,scores,transitions};
  });
  assert.deepEqual(r.idle,[0,0,0]);assert.ok(r.scores[0]>0);
  assert.ok(Math.max(...r.scores)/Math.min(...r.scores)<1.02);
  assert.ok(r.transitions.length>0);assert.ok(r.transitions.slice(1).every((v,i)=>v-r.transitions[i]>=16));
  await c.close();
});
test('victoria, derrota y reintentos son terminales y conservan progreso',async()=>{
  const {page:p,context:c}=await fixture();
  await p.click('#btnModeChallenge');await p.click('.btnPickChallenge[data-lvl="1"]');await p.click('#btnChallengeContinue');await p.click('#btnChooseStart');
  await p.evaluate(()=>{state='running';player.score=activeChallengeGoal;checkChallengeProgress();});
  assert.equal(await p.evaluate(()=>state),'challengeWon');assert.equal(await p.evaluate(()=>localStorage.getItem('challenge:unlocked')),'2');
  const t=await p.evaluate(()=>raceTime);await p.evaluate(()=>{for(let i=0;i<120;i++)simulate(SIM_DT)});assert.equal(await p.evaluate(()=>raceTime),t);
  await p.click('#btnOvRetry');assert.equal(await p.evaluate(()=>challengeCompletedThisRun),false);
  await p.evaluate(()=>{state='running';player.score=activeChallengeGoal;checkChallengeProgress();});assert.equal(await p.evaluate(()=>state),'challengeWon');
  await p.click('#btnOvRetry');await p.evaluate(()=>state='running');
  for(let i=0;i<3;i++)await p.keyboard.press('r');assert.equal(await p.evaluate(()=>player.lives),0);assert.equal(await p.evaluate(()=>state),'gameover');
  await p.keyboard.press('r');assert.equal(await p.evaluate(()=>player.lives),3);assert.equal(await p.evaluate(()=>state),'countdown');
  await p.evaluate(()=>{state='running';mode='race';lap=5;onLap()});assert.equal(await p.evaluate(()=>state),'finished');assert.equal(await p.evaluate(()=>lap),5);
  await p.reload();assert.equal(await p.evaluate(()=>localStorage.getItem('challenge:unlocked')),'2');await c.close();
});
test('vueltas completas en las 20 pistas; ir y volver no suma vueltas',async()=>{
  const {page:p,context:c}=await fixture();
  const r=await p.evaluate(()=>{
    let laps=[];
    for(let k=1;k<=20;k++){
      startWithTrack(presetTrack(k),'race');state='running';const L=track.points.length;
      for(let i=0;i<L;i+=2)advanceLap(i,(i+2)%L);laps.push(lap);
    }
    startWithTrack(presetTrack(1),'race');state='running';
    for(let i=0;i<1000;i++){advanceLap(0,2);advanceLap(2,0);}const backAndForth=lap;
    advanceLap(0,Math.floor(track.points.length/2));const jump=lap;
    return {laps,backAndForth,jump};
  });
  assert.deepEqual(r.laps,Array(20).fill(2));assert.equal(r.backAndForth,1);assert.equal(r.jump,1);await c.close();
});
test('pizarra visible, cierre obligatorio, generar y compartir pista',async()=>{
  const {page:p,context:c,errors}=await fixture();await p.click('#btnModeCreative');
  assert.ok(await p.evaluate(()=>board.width>100&&board.height>100));
  const code=await p.evaluate(()=>{
    bpts=Array.from({length:70},(_,i)=>({x:300+230*Math.cos(i/69*PI*2),y:230+180*Math.sin(i/69*PI*2)}));renderBoard();
    if(!boardValid)throw Error('Closed board rejected');const tr=makeTrackFromBoard();if(!tr)throw Error('Track not built');
    return encodeSharedTrack(presetTrack(1));
  });
  await p.evaluate(()=>{bpts=Array.from({length:60},(_,i)=>({x:i*12,y:200}));renderBoard()});assert.equal(await p.evaluate(()=>boardValid),false);
  await p.goto(url+'?t='+code);assert.equal(await p.locator('#circuitMenu').isVisible(),true);await p.click('#btnCircuitContinue');assert.equal(await p.locator('#carPanel').isVisible(),true);await p.click('#btnChooseStart');assert.equal(await p.evaluate(()=>track.roadHalf),14);
  const legacy=await p.evaluate(()=>encodeTrack(presetTrack(1).points));assert.equal(await p.evaluate(code=>!!decodeTrack(code),legacy),true);
  assert.equal(await p.evaluate(()=>decodeTrack('TRK.'+b64u_enc(JSON.stringify(Array(8).fill([0,0]))))),null);
  assert.deepEqual(errors,[]);await c.close();
});
test('récord y fantasma persistentes, ocultar no detiene el reloj',async()=>{
  const {page:p,context:c}=await fixture();
  await p.evaluate(()=>{startWithTrack(presetTrack(1),'tt');lapTime=20;ghostSamples=Array.from({length:600},()=>({x:player.pos.x,y:player.pos.y,angle:player.angle}));onLap()});
  await p.reload();await p.click('#btnModeTT');await p.click('#btnCircuitContinue');await p.click('#btnChooseStart');
  const r=await p.evaluate(()=>{for(let i=0;i<182;i++)simulate(SIM_DT);const before=ghost.t;ghost.visible=false;ghost.update(1);return {best:document.getElementById('bestTT').textContent,time:ghost.data.time,advanced:ghost.t-before,samples:ghost.data.samples.length}});
  assert.equal(r.best,'0:20.000');assert.equal(r.time,20);assert.equal(r.samples,600);assert.ok(r.advanced>.99);await c.close();
});
test('pausa, pérdida de foco y entrada de texto no dejan controles activos',async()=>{
  const {page:p,context:c}=await fixture();await p.click('#btnModeTT');await p.click('#btnCircuitContinue');await p.click('#btnChooseStart');
  await p.evaluate(()=>state='running');await p.keyboard.down('w');await p.evaluate(()=>dispatchEvent(new Event('blur')));
  assert.equal(await p.evaluate(()=>state),'paused');assert.equal(await p.evaluate(()=>keys.size),0);
  const t=await p.evaluate(()=>raceTime);await p.evaluate(()=>simulate(1/60));assert.equal(await p.evaluate(()=>raceTime),t);
  await p.keyboard.up('w');await p.click('#btnQuit');await p.click('#btnImport');await p.fill('#importCode','r g h');assert.equal(await p.evaluate(()=>keys.size),0);
  assert.equal(await p.locator('#help').isVisible(),false);await c.close();
});
for(const [name,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  test('menús y controles táctiles completos: '+name,async()=>{
    const {page:p,context:c,errors}=await fixture({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2.75});
    await p.click('#btnModeChallenge');
    const x=await p.locator('#btnChallengeContinue').boundingBox();assert.ok(x.x+x.width<=viewport.width);
    await p.click('.btnPickChallenge[data-lvl="1"]');await p.click('#btnChallengeContinue');
    await p.waitForFunction(()=>MenuPreviewClass!==null);await p.evaluate(()=>renderPreparationPreview(0,performance.now()/1000));
    const previewRatio=await p.evaluate(()=>{const p=document.getElementById('carPreview');return (p.width/p.height)/(p.clientWidth/p.clientHeight)});
    assert.ok(Math.abs(previewRatio-1)<.01,'El auto mantiene su proporción al abrir el selector');
    await p.click('#btnChooseStart');assert.equal(await p.locator('#touchHUD').isVisible(),true);
    const hudOverlap=await p.evaluate(()=>document.getElementById('ui').getBoundingClientRect().bottom>document.getElementById('times').getBoundingClientRect().top);
    assert.equal(hudOverlap,false,'El cronómetro no tapa vidas ni velocidad');
    const zones=await p.evaluate(()=>{const a=stickZone.getBoundingClientRect(),b=document.getElementById('gasZone').getBoundingClientRect();return {overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),brake:!!document.getElementById('btnBrake'),hand:!!document.getElementById('btnHand')}});
    assert.equal(zones.overlap,0);assert.ok(zones.brake&&zones.hand);
    // Real browser touch dispatch: GAS finger precedes steering finger.
    const session=await c.newCDPSession(p),gas=await p.locator('#btnGas').boundingBox(),stickBox=await p.locator('#stick').boundingBox();
    const g={id:1,x:gas.x+gas.width/2,y:gas.y+gas.height/2},st={id:2,x:stickBox.x+stickBox.width/2-22,y:stickBox.y+stickBox.height/2};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[g]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[g,st]});
    assert.equal(await p.evaluate(()=>touch.accel),true);assert.ok(await p.evaluate(()=>touch.steerAxis<0));
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await p.evaluate(()=>touch.accel||touch.steerAxis!==0),false);
    await p.click('#btnPause');assert.equal(await p.evaluate(()=>state),'paused');await p.click('#btnQuit');assert.equal(await p.locator('#touchHUD').isVisible(),false);
    if(process.env.DRIFT_SCREENSHOTS){const dir=path.resolve(process.env.DRIFT_SCREENSHOTS);fs.mkdirSync(dir,{recursive:true});await p.click('#btnModeChallenge');await p.screenshot({path:path.join(dir,name+'-challenge.png')});await p.click('.btnPickChallenge[data-lvl="1"]');await p.click('#btnChallengeContinue');await p.screenshot({path:path.join(dir,name+'-car.png')});await p.click('#btnChooseStart');await p.evaluate(()=>{state='running';loop(performance.now())});await p.screenshot({path:path.join(dir,name+'-game.png')});}
    assert.deepEqual(errors,[]);await c.close();
  });
}
test('bucle real: cuenta atrás, acelerar, frenar, pausar y reanudar',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768}});
  await c.route('https://**/*',r=>r.abort());
  const p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error' && /Error in game loop|Error detected/.test(m.text()))errors.push(m.text());});
  await p.goto(url);await p.click('#btnModeTT');await p.click('#btnCircuitContinue');await p.click('#btnChooseStart');
  await p.waitForFunction(()=>state==='running',null,{timeout:12000});
  await p.keyboard.down('w');await p.waitForFunction(()=>player.worldSpeed()>3);
  await p.keyboard.up('w');const speed=await p.evaluate(()=>player.worldSpeed());
  await p.keyboard.down('s');await p.waitForFunction(v=>player.worldSpeed()<v*.7,speed);await p.keyboard.up('s');
  await p.click('#btnPause');const t=await p.evaluate(()=>raceTime);
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>raceTime),t);
  await p.keyboard.press('Escape');await p.waitForFunction(v=>raceTime>v+.1,t);
  assert.deepEqual(errors,[]);await c.close();
});
