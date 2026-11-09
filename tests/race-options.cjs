const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
const ready=(async()=>{for(const name of ['game-options','vehicle-fit','road-contact','vehicle-dynamics','ai-race'])await import('../js/'+name+'.js');return import('../server/engine.js');})();
test('settings sanitize old saves, persist every control and keep current race conditions fixed',()=>{
 const r=harness();assert.deepEqual(r(`DriftOptions.conditions({weather:'bad',difficulty:'impossible'})`),{difficulty:'standard',weather:'clear'});const options=r(`DriftOptions.retro({resolution:999,jitter:100,affine:-1,bits:128,crt:NaN})`);assert.equal(options.resolution,480);assert.equal(options.jitter,2);assert.equal(options.affine,0);assert.equal(options.bits,15);
 r(`renderPrefs.weather='rain';renderPrefs.difficulty='expert';renderPrefs.rivals=3;renderPrefs.collisions=true;setRetro(DriftOptions.presets.classic);saveRenderPrefs();startWithTrack(presetTrack(1),'race');renderPrefs.weather='fog';renderPrefs.difficulty='assisted';`);
 assert.deepEqual(r('player.conditions'),{weather:'rain',difficulty:'expert'});assert.equal(r('offlineRivals.length'),3);assert(r('offlineRivals.every(c=>c.conditions.weather===\'rain\'&&c.conditions.difficulty===\'expert\')'));
 const saved=r(`JSON.parse(localStorage.getItem(PREF_KEY))`);assert.equal(saved.rivals,3);assert.equal(saved.collisions,true);assert.equal(saved.retro.resolution,240);r(`restartRaceSameTrack()`);assert.deepEqual(r('player.conditions'),{weather:'fog',difficulty:'assisted'});assert(r(`currentTrackId.endsWith(':assisted:fog')`));
});
test('cinematic grid presentation is read-only, locks controls and hands off after 3, 2, 1',()=>{
 const r=harness();r(`renderPrefs.rivals=3;startWithTrack(presetTrack(1),'race');keys.add('w');`);const before=r(`DriftNet.capture(player)`);const views=r(`[0,1.2,2.4].map(t=>DriftRace.presentation([player,...offlineRivals],t).map(c=>c.pos))`);assert.notDeepEqual(views[0],views[1]);assert.deepEqual(views[2],r(`[player,...offlineRivals].map(c=>c.pos)`));assert.deepEqual(r('DriftNet.capture(player)'),before);
 r('for(let i=0;i<143;i++)simulate(SIM_DT)');assert.equal(r('countdown'),3);assert.equal(r('raceTime'),0);assert.deepEqual(r('DriftNet.capture(player)'),before);
 r('for(let i=0;i<61;i++)simulate(SIM_DT)');assert.equal(r('countdown'),2);r('for(let i=0;i<60;i++)simulate(SIM_DT)');assert.equal(r('countdown'),1);r('for(let i=0;i<61;i++)simulate(SIM_DT)');assert.equal(r('state'),'running');assert(r('raceTime<.04'));
});
test('three physical opponents complete dry and wet laps on short, medium and long circuits',async()=>{
 const {createTrack,createCar}=await ready;
 for(const weather of ['clear','rain'])for(const level of [1,8,20]){const track=createTrack(level),player=createCar(track,'blue',true,0,{weather}),cars=['gray','yellow','fujiwara'].map((skin,i)=>createCar(track,skin,true,i+1,{weather}));const race=new DriftRace.Race(track,player,cars,{laps:1});
  for(let frame=0;frame<220*60&&!cars.every(c=>race.entries.get(c).finished);frame++)race.step(1/60);
  assert(cars.every(c=>race.entries.get(c).finished>25),`L${level} ${weather}: full lap`);assert(cars.every(c=>Number.isFinite(c.angle)&&c.worldSpeed()<40));assert.equal(new Set(cars.map(c=>race.entries.get(c).finished)).size,3);
 }
});
test('collisions conserve linear momentum, dissipate impact energy, separate bodies and switch off',async()=>{
 const {createTrack,createCar}=await ready,t=createTrack(1),a=createCar(t,'gray',true,0),b=createCar(t,'yellow',true,1);a.pos={x:0,y:0};b.pos={x:4,y:0};a.angle=b.angle=0;a.vel={x:20,y:0};b.vel={x:2,y:0};
 const momentum=()=>a.mass*a.vel.x+b.mass*b.vel.x,energy=()=>.5*a.mass*a.worldSpeed()**2+.5*b.mass*b.worldSpeed()**2,p=momentum(),e=energy();assert(DriftRace.collide(a,b));assert(Math.abs(momentum()-p)<1e-7);assert(energy()<e);assert(b.pos.x-a.pos.x>4);assert(a.hitTimer>0);
 const r=harness();r(`renderPrefs.rivals=1;renderPrefs.collisions=false;startWithTrack(presetTrack(1),'race');const enemy=offlineRivals[0];enemy.pos={...player.pos};enemy.vel={x:10,y:0};state='running';offlineRace.step(SIM_DT);`);assert.equal(r('player.hitTimer||0'),0);assert.equal(r('player.worldSpeed()'),0);
});
test('opponents finish a race with collisions enabled and a stopped player on the grid',async()=>{
 const {createTrack,createCar}=await ready,track=createTrack(1),player=createCar(track,'gray',true,0),cars=['blue','yellow','yugo'].map((skin,i)=>createCar(track,skin,true,i+1)),race=new DriftRace.Race(track,player,cars,{laps:1,collisions:true});
 for(let frame=0;frame<180*60&&!cars.every(c=>race.entries.get(c).finished);frame++){player.update(1/60,{accel:false,brake:true,steerAxis:0,handbrake:false},track);race.step(1/60);}
 assert(cars.every(c=>race.entries.get(c).finished>25));assert.equal(race.place(),4);assert.equal(race.entries.get(player).lap,0);
});
test('weather and all three difficulties produce identical client/server forces',async()=>{
 const {createTrack,createCar,Net}=await ready,r=harness(),commands=Array.from({length:120},(_,i)=>[i+1,i<90?1:2,Math.sin(i*.04)*.5,i%31===0?1:0]);
 for(const difficulty of Object.keys(DriftOptions.difficulties))for(const weather of Object.keys(DriftOptions.weathers)){const conditions={difficulty,weather};const t=createTrack(1),server=createCar(t,'gray',true,1,conditions);r(`carIdx=2;chosen=CAR_DATA[2];startWithTrack(presetTrack(1),'tt',${JSON.stringify(conditions)});DriftNet.grid(player,track,1);`);for(const c of commands)Net.step(server,c,t,false);const local=r(`(()=>{for(const cmd of ${JSON.stringify(commands)})DriftNet.step(player,cmd,track,false);return DriftNet.capture(player)})()`);assert.deepEqual(local,Array.from(Net.capture(server)));}
});
test('rain increases stopping distance; assisted handling damps yaw; a brief drift tap ramps grip smoothly',async()=>{
 const {createTrack,createCar}=await ready,t=createTrack(1),stop=weather=>{const c=createCar(t,'yugo',true,1,{weather});c.pos={x:0,y:0};c.angle=0;c.vel={x:25,y:0};for(let n=0;n<600&&c.worldSpeed()>.1;n++)c._physStep(1/60,0,0,1);return c.pos.x;};assert(stop('storm')>stop('clear')*1.01);
 const c=createCar(t,'blue',true,1);c.handbrake=true;c._physStep(1/60,.3,1,0);assert(c.handbrakeMix>0&&c.handbrakeMix<.15);for(let i=0;i<20;i++)c._physStep(1/60,.3,1,0);assert.equal(c.handbrakeMix,1);c.handbrake=false;for(let i=0;i<8;i++)c._physStep(1/60,0,0,0);assert.equal(c.handbrakeMix,0);
 const yaw=difficulty=>{const c=createCar(t,'blue',true,1,{difficulty});c.vel={x:20,y:3};c.angle=0;c.omega=1;let total=0;for(let n=0;n<120;n++){c._physStep(1/60,0,0,0);total+=Math.abs(c.omega)/60;}return total;};assert(yaw('assisted')<yaw('standard'));
});
test('authoritative lobby applies only host weather/difficulty to every seat and rejects old protocol',async()=>{
 const {Rooms}=await import('../server/rooms.js');const rooms=new Rooms(),peer=()=>({open:true,messages:[],send(m){this.messages.push(m)}}),a=peer(),b=peer(),old=peer();rooms.handle(old,{type:'hello',version:2});assert.match(old.messages[0].message,/Actualiza/);
 for(const p of [a,b])rooms.handle(p,{type:'hello',version:3});rooms.handle(a,{type:'create',name:'Host',weather:'rain',difficulty:'expert'});const room=rooms.roomFor(a);rooms.handle(b,{type:'join',code:room.code});rooms.handle(b,{type:'settings',level:2,laps:1,day:0,weather:'clear',difficulty:'assisted'});assert.equal(room.weather,'rain');for(const p of [a,b])rooms.handle(p,{type:'ready',ready:true});rooms.handle(a,{type:'start'});assert([...room.players.values()].every(p=>p.car.conditions.weather==='rain'&&p.car.conditions.difficulty==='expert'));assert.equal(rooms.view(room).weather,'rain');
});
