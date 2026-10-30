const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,generateKeyPairSync,sign}=require('node:crypto'),{mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path');
async function fixture(t,opts={}){
 const {createAccounts}=await import('../server/accounts/api.js'),{createServer}=await import('../server/index.js');
 const dir=mkdtempSync(join(tmpdir(),'drift-accounts-')),mail=[];let clock=Date.now();
 const accounts=createAccounts({path:join(dir,'accounts.sqlite'),origin:'http://localhost',now:()=>clock,sendMail:async(...args)=>mail.push(args),...opts});
 const app=createServer({accounts,serveStatic:true,origins:['http://localhost']});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await app.close();accounts.close();rmSync(dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+app.server.address().port;
 function client(){let cookie='';return {get cookie(){return cookie;},async call(path,data,headers={}){const r=await fetch(url+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost','content-type':'application/json','x-drift-request':'1',...headers},body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});const sc=r.headers.getSetCookie();if(sc.length)cookie=sc.map(c=>c.split(';')[0]).join('; ');const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=text;}return {status:r.status,body,headers:r.headers};}};}
 async function registered(address='alice@example.com'){const c=client();assert.equal((await c.call('auth/register',{email:address,name:'Piloto',password:'correct-horse-battery'})).status,200);const token=mail.findLast(x=>x[0]===address)[2];assert.equal((await c.call('auth/verify',{token,password:'correct-horse-battery'})).status,200);const r=await c.call('auth/login',{email:address,password:'correct-horse-battery'});assert.equal(r.status,200);return {c,id:r.body.user.id};}
 return {accounts,app,mail,client,registered,url,advance:ms=>clock+=ms};
}
test('email lifecycle verifies ownership, hashes credentials, uses HttpOnly sessions, and rejects forged/cross-origin access',async t=>{
 const f=await fixture(t),c=f.client();assert.equal((await c.call('profile')).status,401);
 assert.equal((await c.call('auth/register',{email:'a@example.com',name:'A driver',password:'short'})).status,400);
 await c.call('auth/register',{email:'A@example.com',name:'A driver',password:'correct-horse-battery'});
 assert.equal((await c.call('auth/login',{email:'a@example.com',password:'correct-horse-battery'})).status,403);
 const token=f.mail.at(-1)[2];assert.equal((await c.call('auth/verify',{token,password:'correct-horse-battery'})).status,200);assert.equal((await c.call('auth/verify',{token,password:'correct-horse-battery'})).status,400);
 assert.equal((await c.call('auth/login',{email:'a@example.com',password:'wrong-password-long'})).status,401);
 const login=await c.call('auth/login',{email:'a@example.com',password:'correct-horse-battery'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/);
 assert(!JSON.stringify(login.body).includes('password'));const stored=f.accounts.db.user(login.body.user.id);assert(stored.password.startsWith('scrypt:'));assert(!stored.password.includes('correct-horse'));
 assert.equal((await c.call('profile/name',{name:'Stolen'},{origin:'https://evil.example'})).status,403);
 assert.equal((await c.call('profile/name',{name:'Stolen'},{'x-drift-request':''})).status,403);
 assert.equal((await f.client().call('profile',undefined,{cookie:'drift-session=forged'})).status,401);
});
test('reset tokens expire, are single use, and revoke every session; logout stays revoked',async t=>{
 const f=await fixture(t),{c}=await f.registered();const second=f.client();await second.call('auth/login',{email:'alice@example.com',password:'correct-horse-battery'});
 await c.call('auth/forgot',{email:'alice@example.com'});const expired=f.mail.at(-1)[2];f.advance(31*60e3);assert.equal((await c.call('auth/reset',{token:expired,password:'new-correct-password'})).status,400);
 await c.call('auth/forgot',{email:'alice@example.com'});const token=f.mail.at(-1)[2];assert.equal((await c.call('auth/reset',{token,password:'new-correct-password'})).status,200);
 assert.equal((await second.call('profile')).status,401);assert.equal((await c.call('auth/reset',{token,password:'another-new-password'})).status,400);
 await c.call('auth/login',{email:'alice@example.com',password:'new-correct-password'});const old=c.cookie;await c.call('logout',{});assert.equal((await f.client().call('profile',undefined,{cookie:old})).status,401);
});
test('campaign results are isolated, idempotent, bounded, unlock stages and retain rewards after restart',async t=>{
 const f=await fixture(t),a=await f.registered(),b=await f.registered('bob@example.com');
 assert.equal((await a.c.call('runs/start',{mode:'challenge',level:20,operationId:randomUUID()})).status,403);
 const start=await a.c.call('runs/start',{mode:'challenge',level:1,operationId:randomUUID()});assert.equal(start.status,200);
 const result={id:start.body.id,elapsed:20,score:20000,longest:3000,clean:true,valid:true};
 assert.equal((await b.c.call('runs/finish',result)).status,404);assert.equal((await a.c.call('runs/finish',result)).status,400);f.advance(25000);
 const done=await a.c.call('runs/finish',result);assert.equal(done.status,200);assert.equal(done.body.profile.unlocked,2);assert.equal(done.body.reward,4090);
 const duplicate=await a.c.call('runs/finish',result);assert.equal(duplicate.body.profile.cash,4090);assert.equal(duplicate.body.duplicate,true);assert.equal(f.accounts.db.all('SELECT * FROM ledger').length,1);
 assert.equal((await b.c.call('profile')).body.profile.cash,0);assert(done.body.achievements.some(x=>x.id==='first_objective'&&x.unlocked));
 const restart=await a.c.call('runs/start',{mode:'race',level:1,operationId:randomUUID()});f.advance(10000);assert.equal((await a.c.call('runs/finish',{...result,id:restart.body.id,elapsed:100000})).status,400);
 assert.equal((await a.c.call('profile',{cash:999999})).status,404);
});
test('purchases are transactional, price is server-owned, retries cannot double charge, equipment stays within ownership',async t=>{
 const f=await fixture(t),a=await f.registered();const p=f.accounts.db.profile(a.id).profile;p.cash=2000;f.accounts.db.save(a.id,p);
 const buy={skin:'blue',part:'engine',tier:1,operationId:randomUUID(),cost:0,cash:999999};
 const [one,two]=await Promise.all([a.c.call('purchase',buy),a.c.call('purchase',buy)]);assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(two.body.profile.cash,200);assert.equal(two.body.profile.cars.blue.owned.engine,1);
 assert.equal((await a.c.call('purchase',{...buy,part:'brakes'})).status,409);
 assert.equal((await a.c.call('purchase',{skin:'blue',part:'brakes',tier:1,operationId:randomUUID()})).status,400);
 assert.equal((await a.c.call('equip',{skin:'red',part:'engine',level:1,operationId:randomUUID()})).status,400);
 assert.equal((await a.c.call('equip',{skin:'blue',part:'engine',level:0,operationId:randomUUID()})).body.profile.cars.blue.active.engine,0);
 assert.equal(f.accounts.db.all('SELECT * FROM ledger').length,1);
});
test('account records reject stale writes and never leak between users; server never serves database or source internals',async t=>{
 const f=await fixture(t),a=await f.registered(),b=await f.registered('bob@example.com');
 assert.equal((await a.c.call('records',{key:'challenge:best:1',value:25000,revision:0})).status,200);
 assert.equal((await a.c.call('records',{key:'challenge:best:1',value:1,revision:0})).status,409);
 assert.equal((await b.c.call('records')).body.records.length,0);
 assert.equal((await a.c.call('records',{key:'cash',value:100000,revision:0})).status,400);
 for(const path of ['/server/accounts/api.js','/data/drift.sqlite','/.env','/index_patched.html'])assert.equal((await fetch(f.url+path)).status,404,path);
 assert.equal((await fetch(f.url+'/')).status,200);
});
test('server online rewards use permanent receipts and existing authenticated accounts',async t=>{
 const f=await fixture(t),a=await f.registered();const win={userId:a.id,key:'room:123:1',place:1,finished:20000,players:2};
 f.accounts.onlineReward(win);f.accounts.onlineReward(win);assert.equal(f.accounts.db.profile(a.id).profile.cash,1500);assert.equal(f.accounts.db.profile(a.id).profile.wins,1);
 f.accounts.onlineReward({...win,key:'other',place:2});assert.equal(f.accounts.db.profile(a.id).profile.cash,1500);
 assert.equal((await a.c.call('online/reward',win)).status,404);
});
test('Google flow requires browser-bound single-use state, creates account and rejects implicit email linking',async t=>{
 const f=await fixture(t,{clientId:'test-client',clientSecret:'test-secret',google:async()=>({sub:'google-1',email:'google@example.com',name:'Google Driver'})}),c=f.client();
 const start=await c.call('auth/google');assert.equal(start.status,302);const state=new URL(start.headers.get('location')).searchParams.get('state');assert(state);
 assert.match((await f.client().call('auth/google/callback?state='+state+'&code=mock')).headers.get('location'),/#account=error/);
 const done=await c.call('auth/google/callback?state='+state+'&code=mock');assert.equal(done.headers.get('location'),'/#account=welcome');assert.equal((await c.call('profile')).body.user.email,'google@example.com');
 assert.match((await c.call('auth/google/callback?state='+state+'&code=mock')).headers.get('location'),/#account=error/);
});
test('Google ID tokens validate signature, audience, issuer, nonce, verified email and expiry',async()=>{
 const {googleIdentity}=await import('../server/accounts/identity.js');const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'key',use:'sig'};
 const clock=Date.now(),base={iss:'https://accounts.google.com',aud:'client',sub:'123',email:'test@example.com',email_verified:true,nonce:'nonce',exp:clock/1000+3600,iat:clock/1000};
 async function check(change={},badSig=false){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'key'})).toString('base64url'),payload=Buffer.from(JSON.stringify({...base,...change})).toString('base64url'),signature=sign('RSA-SHA256',Buffer.from(header+'.'+payload),privateKey).toString('base64url');const jwt=header+'.'+payload+'.'+(badSig?'fake':signature);return googleIdentity({code:'code',verifier:'verifier',nonce:'nonce',origin:'https://game.example',clientId:'client',clientSecret:'secret',now:clock,fetcher:async url=>({ok:true,json:async()=>url.includes('/certs')?{keys:[jwk]}:{id_token:jwt}})});}
 assert.equal((await check()).email,'test@example.com');for(const change of [{aud:'other'},{iss:'https://evil.example'},{nonce:'wrong'},{exp:0},{email_verified:false},{iat:clock/1000+9999}])await assert.rejects(check(change));await assert.rejects(check({},true));
});
test('SQLite persistence survives close/reopen and online backup restores profile and history',async()=>{
 const {AccountStore}=await import('../server/accounts/store.js');const dir=mkdtempSync(join(tmpdir(),'drift-save-'));try{let db=new AccountStore(join(dir,'live.sqlite'));const u=db.transaction(()=>db.create({email:'persist@example.com',name:'Persist'}));const p=db.profile(u.id).profile;p.cash=12345;db.save(u.id,p);await db.backup(join(dir,'backup.sqlite'));db.close();db=new AccountStore(join(dir,'backup.sqlite'));assert.equal(db.profile(u.id).profile.cash,12345);db.close();}finally{rmSync(dir,{recursive:true,force:true});}
});

test('verification replaces any pre-registered password with the mailbox owner choice',async t=>{
 const f=await fixture(t),c=f.client();await c.call('auth/register',{email:'owner@example.com',name:'Pre-registered',password:'attacker-known-password'});const token=f.mail.at(-1)[2];
 assert.equal((await c.call('auth/verify',{token,password:'mailbox-owner-password'})).status,200);
 assert.equal((await c.call('auth/login',{email:'owner@example.com',password:'attacker-known-password'})).status,401);
 assert.equal((await c.call('auth/login',{email:'owner@example.com',password:'mailbox-owner-password'})).status,200);
});
test('a stale tab identity cannot mutate another account after its browser cookie changes',async t=>{
 const f=await fixture(t),a=await f.registered(),b=await f.registered('bob@example.com');const r=await b.c.call('profile/name',{name:'Wrong name'},{'x-drift-user':a.id});assert.equal(r.status,409);assert.equal(r.body.code,'session_changed');assert.equal(f.accounts.db.user(b.id).name,'Piloto');
});

test('WebSocket requires a verified session, uses profile identity and disconnects revoked sessions',async t=>{
 const f=await fixture(t),{WebSocket}=await import('ws'),{once}=require('node:events');
 const denied=new WebSocket(f.url.replace('http:','ws:')+'/rooms',{origin:'http://localhost'});const [error]=await once(denied,'error');assert.match(error.message,/401/);
 const {c}=await f.registered();const socket=new WebSocket(f.url.replace('http:','ws:')+'/rooms',{origin:'http://localhost',headers:{cookie:c.cookie}});socket.on('error',()=>{});await once(socket,'open');t.after(()=>socket.terminate());
 let next=once(socket,'message');socket.send(JSON.stringify({type:'hello',version:1}));await next;
 next=once(socket,'message');socket.send(JSON.stringify({type:'create',name:'Impersonated name',skin:'blue'}));const [raw]=await next;const welcome=JSON.parse(raw);assert.equal(welcome.room.players[0].name,'Piloto');assert.equal(welcome.room.players[0].userId,undefined);
 const closed=once(socket,'close');await c.call('logout',{all:true});for(const ws of f.app.wss.clients)ws.checkAlive();const [code]=await closed;assert.equal(code,1008);
});
