import {createHash,randomUUID} from 'node:crypto';
import {AccountStore,Career} from './store.js';
import {token,digest,fault,email,name,passwordHash,passwordMatches,cookies,cookie,googleIdentity,mailer} from './identity.js';
import '../../js/downhill.js';
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const success={ok:true,message:'Si el correo corresponde a una cuenta, recibirás un enlace. Revisa también spam.'};
async function body(req){let n=0,parts=[];for await(const chunk of req){n+=chunk.length;if(n>262144)throw fault(413,'La solicitud es demasiado grande.');parts.push(chunk);}try{const value=JSON.parse(Buffer.concat(parts).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}catch{throw fault(400,'Solicitud inválida.');}}
export function createAccounts({path,origin,clientId='',clientSecret='',mailKey='',mailFrom='',sendMail,now=Date.now,google=googleIdentity}={}){
  if(!path||!origin)throw Error('ACCOUNT_DB and APP_ORIGIN are required.');
  const url=new URL(origin);if(url.origin!==origin||(!['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol!=='https:'))throw Error('APP_ORIGIN must be an exact HTTPS origin.');
  const secure=url.protocol==='https:',sessionName=secure?'__Host-drift-session':'drift-session',oauthName=secure?'__Host-drift-oauth':'drift-oauth';
  const db=new AccountStore(path),mail=sendMail||mailer({key:mailKey,from:mailFrom,origin}),emailReady=!!sendMail||!!(mailKey&&mailFrom),googleReady=!!(clientId&&clientSecret);
  let lastPurge=0;
  function authenticate(req){const value=cookies(req)[sessionName];if(typeof value!=='string'||value.length!==43)return null;return db.get('SELECT users.*,sessions.hash AS session_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>? AND users.verified=1',digest(value),now())||null;}
  function session(req,res,u){const old=cookies(req)[sessionName];if(old)db.run('DELETE FROM sessions WHERE hash=?',digest(old));const secret=token();db.run('INSERT INTO sessions VALUES(?,?,?)',digest(secret),u.id,now()+30*86400e3);cookie(res,sessionName,secret,30*86400,secure);}
  async function sendToken(u,kind){const secret=token();db.transaction(()=>{db.run('DELETE FROM tokens WHERE user_id=? AND kind=?',u.id,kind);db.run('INSERT INTO tokens VALUES(?,?,?,?)',digest(secret),u.id,kind,now()+30*60e3);});await mail(u.email,kind,secret);}
  function consume(secret,kind){if(typeof secret!=='string'||secret.length!==43)throw fault(400,'El enlace no es válido o ya venció.');const row=db.get('SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?',digest(secret),kind,now());if(!row)throw fault(400,'El enlace no es válido o ya venció.');db.run('DELETE FROM tokens WHERE hash=?',row.hash);return db.user(row.user_id);}
  function operation(u,b,request,fn){
    if(!UUID.test(b.operationId||''))throw fault(400,'Falta el identificador de operación.');
    return db.transaction(()=>{const stamp=JSON.stringify(request),old=db.get('SELECT * FROM operations WHERE user_id=? AND id=?',u.id,b.operationId);
      if(old){if(old.request!==stamp)throw fault(409,'Esta operación ya se utilizó.');return {...JSON.parse(old.result),...db.snapshot(u.id),duplicate:true};}
      const result=fn();db.run('INSERT INTO operations VALUES(?,?,?,?)',u.id,b.operationId,stamp,JSON.stringify(result));return {...result,...db.snapshot(u.id)};});
  }
  function settle(u,b){return db.transaction(()=>{
    const r=db.get('SELECT * FROM runs WHERE id=? AND user_id=?',b.id,u.id);if(!r)throw fault(404,'No encontramos esta carrera en tu cuenta.');
    if(r.result)return {...JSON.parse(r.result),...db.snapshot(u.id),duplicate:true};
    const age=(now()-r.started)/1000;
    if(age>7200||age<8||!Number.isFinite(b.elapsed)||b.elapsed<8||b.elapsed>age+2||!Number.isFinite(b.score)||b.score<0||b.score>Math.min(100000000,b.elapsed*100000)||!Number.isFinite(b.longest)||b.longest<0||b.longest>100000000||typeof b.clean!=='boolean'||b.valid!==true)throw fault(400,'El resultado no es válido o la carrera venció.');
    const run=new Career.Run(r.mode,r.level);run.elapsed=b.elapsed;run.bestScore=b.score;run.longest=b.longest;run.clean=b.clean;
    const won=r.mode==='race'||r.mode==='downhill'&&b.score>=globalThis.DriftDownhill.layout(r.level).goal;
    const result=run.finish({valid:true,won},db.storage(u.id));if(!result.ok)throw fault(400,'No se pudo confirmar la carrera.');
    const {profile,...receipt}=result;db.run('UPDATE runs SET result=? WHERE id=?',JSON.stringify(receipt),r.id);
    db.entry(u.id,'race',result.reward,profile,{mode:r.mode,level:r.level,run:r.id});return {...receipt,...db.snapshot(u.id)};
  });}
  function onlineReward({userId,key,place,finished,players}){if(!userId||place!==1||finished<8000||players<2)return;return db.transaction(()=>{
    const id='online:'+key,old=db.get('SELECT id FROM operations WHERE user_id=? AND id=?',userId,id);if(old)return;
    const p=db.profile(userId).profile;p.cash=Math.min(999999999,p.cash+1500);p.wins++;db.save(userId,p);db.entry(userId,'online',1500,p,{key});db.run('INSERT INTO operations VALUES(?,?,?,?)',userId,id,'online','{"ok":true,"reward":1500}');
  });}
  async function handle(req,res){
    const pathname=new URL(req.url,origin).pathname;if(!pathname.startsWith('/api/'))return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const reply=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    try{
      if(now()-lastPurge>60000){db.purge(now());lastPurge=now();}
      const ip=req.socket.remoteAddress||'unknown';
      if(!db.limit('ip:'+digest(ip),600,60000,now()))throw fault(429,'Demasiadas solicitudes. Espera un minuto.');
      if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['x-drift-request']!=='1'||!String(req.headers['content-type']||'').startsWith('application/json')))throw fault(403,'Solicitud de otro origen bloqueada.');
      if(req.method==='GET'&&pathname==='/api/config'){reply(200,{accounts:true,email:emailReady,google:googleReady,online:'/rooms'});return true;}
      if(req.method==='GET'&&pathname==='/api/auth/google'){
        if(!googleReady)throw fault(503,'Google todavía no está configurado.');
        const state=token(),binding=token(),nonce=token(),verifier=token(),u=authenticate(req);
        db.run('INSERT INTO oauth VALUES(?,?,?,?,?,?)',digest(state),digest(binding),nonce,verifier,u?.id||null,now()+10*60e3);cookie(res,oauthName,binding,600,secure);
        const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');target.search=new URLSearchParams({client_id:clientId,redirect_uri:origin+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});res.writeHead(302,{Location:target.href});res.end();return true;
      }
      if(req.method==='GET'&&pathname==='/api/auth/google/callback'){
        cookie(res,oauthName,'',0,secure);
        try{
          const q=new URL(req.url,origin).searchParams,binding=cookies(req)[oauthName],state=q.get('state');
          const flow=state&&binding&&db.transaction(()=>{const row=db.get('SELECT * FROM oauth WHERE state=? AND binding=? AND expires>?',digest(state),digest(binding),now());if(row)db.run('DELETE FROM oauth WHERE state=?',row.state);return row;});
          if(!flow||q.get('error')||!q.get('code'))throw fault(400,'Se canceló el acceso o venció la solicitud.');
          const identity=await google({code:q.get('code'),verifier:flow.verifier,nonce:flow.nonce,origin,clientId,clientSecret,now:now()});
          const active=authenticate(req);
          const u=db.transaction(()=>{
            const existing=db.get('SELECT * FROM users WHERE google_sub=?',identity.sub);
            if(flow.user_id){
              if(active?.id!==flow.user_id||active.email!==identity.email||(existing&&existing.id!==active.id))throw fault(409,'Usa la misma cuenta de correo para vincular Google.');
              db.run('UPDATE users SET google_sub=? WHERE id=?',identity.sub,active.id);return db.user(active.id);
            }
            if(existing)return existing;
            if(db.get('SELECT id FROM users WHERE email=?',identity.email))throw fault(409,'Ya existe una cuenta con ese correo. Ingresa con tu contraseña y vincula Google desde tu perfil.');
            let nickname;try{nickname=name(identity.name);}catch{nickname='Piloto';}return db.create({email:identity.email,name:nickname,google:identity.sub,now:now()});
          });session(req,res,u);res.writeHead(302,{Location:'/#account=welcome'});
        }catch(e){res.writeHead(302,{Location:'/#account=error&message='+encodeURIComponent(e.status?e.message:'Google no está disponible. Inténtalo de nuevo.')});}
        res.end();return true;
      }
      if(req.method==='GET'&&pathname==='/api/session'){const u=authenticate(req);reply(200,u?{authenticated:true,...db.snapshot(u.id)}:{authenticated:false});return true;}
      if(req.method==='POST'&&pathname.startsWith('/api/auth/')){
        const b=await body(req),mailAddress=email(b.email);
        if(!db.limit('auth-ip:'+digest(ip),60,15*60e3,now()))throw fault(429,'Espera unos minutos antes de intentarlo de nuevo.');
        if(mailAddress&&!db.limit('auth-email:'+digest(mailAddress),12,15*60e3,now()))throw fault(429,'Demasiados intentos. Espera 15 minutos.');
        if(pathname==='/api/auth/register'){
          if(!emailReady)throw fault(503,'El registro por correo todavía no está configurado.');
          if(!mailAddress)throw fault(400,'Ingresa un correo válido.');const nickname=name(b.name),hashed=await passwordHash(b.password);
          let u=db.get('SELECT * FROM users WHERE email=?',mailAddress);
          if(!u){u=db.transaction(()=>db.create({email:mailAddress,name:nickname,password:hashed,now:now()}));}
          if(!u.verified)await sendToken(u,'verify');reply(200,success);return true;
        }
        if(pathname==='/api/auth/login'){
          const u=mailAddress&&db.get('SELECT * FROM users WHERE email=?',mailAddress);
          if(!await passwordMatches(b.password,u?.password))throw fault(401,'Correo o contraseña incorrectos.');
          if(!u.verified)throw fault(403,'Verifica tu correo antes de ingresar. Puedes reenviar el enlace.');
          db.transaction(()=>{if(db.user(u.id)?.password!==u.password)throw fault(401,'Tu contraseña cambió. Inicia sesión nuevamente.');session(req,res,u);});reply(200,{authenticated:true,...db.snapshot(u.id)});return true;
        }
        if(pathname==='/api/auth/forgot'||pathname==='/api/auth/resend'){
          if(!emailReady)throw fault(503,'El envío de correos todavía no está configurado.');
          const u=mailAddress&&db.get('SELECT * FROM users WHERE email=?',mailAddress);
          if(u&&(pathname.endsWith('forgot')||!u.verified))await sendToken(u,pathname.endsWith('forgot')?'reset':'verify');reply(200,success);return true;
        }
        if(pathname==='/api/auth/verify'){
          const hashed=await passwordHash(b.password);db.transaction(()=>{const u=consume(b.token,'verify');db.run('UPDATE users SET verified=1,password=? WHERE id=?',hashed,u.id);db.run('DELETE FROM sessions WHERE user_id=?',u.id);});reply(200,{ok:true,message:'Correo verificado. Ya puedes iniciar sesión.'});return true;
        }
        if(pathname==='/api/auth/reset'){
          const hashed=await passwordHash(b.password);db.transaction(()=>{const u=consume(b.token,'reset');db.run('UPDATE users SET password=?,verified=1 WHERE id=?',hashed,u.id);db.run('DELETE FROM sessions WHERE user_id=?',u.id);db.run('DELETE FROM tokens WHERE user_id=?',u.id);});cookie(res,sessionName,'',0,secure);reply(200,{ok:true,message:'Contraseña actualizada. Inicia sesión nuevamente.'});return true;
        }
        throw fault(404,'Ruta no encontrada.');
      }
      const u=authenticate(req);if(!u)throw fault(401,'Inicia sesión para jugar.');
      if(req.headers['x-drift-user']&&req.headers['x-drift-user']!==u.id)throw Object.assign(fault(409,'Cambió la cuenta en otra pestaña. Inicia sesión nuevamente.'),{code:'session_changed'});
      if(req.method==='GET'&&pathname==='/api/profile'){reply(200,db.snapshot(u.id));return true;}
      if(req.method==='GET'&&pathname==='/api/records'){reply(200,{records:db.all('SELECT key,value,revision FROM records WHERE user_id=?',u.id).map(r=>({...r,value:JSON.parse(r.value)}))});return true;}
      if(req.method!=='POST')throw fault(405,'Método no permitido.');
      const b=await body(req);
      if(pathname==='/api/logout'){db.run('DELETE FROM sessions WHERE '+(b.all===true?'user_id':'hash')+'=?',b.all===true?u.id:u.session_hash);cookie(res,sessionName,'',0,secure);reply(200,{ok:true});return true;}
      if(pathname==='/api/profile/name'){db.run('UPDATE users SET name=? WHERE id=?',name(b.name),u.id);reply(200,db.snapshot(u.id));return true;}
      if(pathname==='/api/purchase'){
        const r=operation(u,b,['purchase',b.skin,b.part,b.tier],()=>{const p=db.profile(u.id).profile;if(!p.cars[b.skin]||!Career.part(b.skin,b.part)||b.tier!==p.cars[b.skin].owned[b.part]+1)throw fault(409,'Actualiza el taller: esta pieza cambió.');const result=Career.purchase(b.skin,b.part,db.storage(u.id));if(!result.ok)throw fault(400,result.error);db.entry(u.id,'purchase',-result.cost,result.profile,{skin:b.skin,part:b.part,tier:result.tier});return {ok:true,cost:result.cost,tier:result.tier};});reply(200,r);return true;
      }
      if(pathname==='/api/equip'||pathname==='/api/color'){
        const r=operation(u,b,[pathname,b.skin,b.part,b.level,b.key,b.value],()=>{const ok=pathname.endsWith('equip')?Career.equip(b.skin,b.part,b.level,db.storage(u.id)):Career.color(b.skin,b.key,b.value,db.storage(u.id));if(!ok)throw fault(400,'La configuración no está disponible para tu auto.');return {ok:true};});reply(200,r);return true;
      }
      if(pathname==='/api/runs/start'){
        const allowed=['race','challenge','downhill','tt'];if(!allowed.includes(b.mode)||!Number.isInteger(b.level)||b.level<1||b.level>(b.mode==='downhill'?globalThis.DriftDownhill.count:20))throw fault(400,'Carrera inválida.');
        const p=db.profile(u.id).profile;if(b.mode==='challenge'&&b.level>p.unlocked)throw fault(403,'Esta etapa aún está bloqueada.');
        const r=operation(u,b,['start',b.mode,b.level],()=>{const id=randomUUID();db.run('UPDATE runs SET result=? WHERE user_id=? AND result IS NULL',JSON.stringify({ok:false,reward:0,error:'Se inició otra carrera en tu cuenta.'}),u.id);db.run('INSERT INTO runs VALUES(?,?,?,?,?,NULL)',id,u.id,b.mode,b.level,now());return {ok:true,id};});reply(200,r);return true;
      }
      if(pathname==='/api/runs/finish'){reply(200,settle(u,b));return true;}
      if(pathname==='/api/records'){
        const valid=/^(challenge:best:\d{1,2}|downhill:v2:\d{1,2}|tt:(best|last):.{1,8000})$/;
        if(typeof b.key!=='string'||!valid.test(b.key)||b.value===undefined||JSON.stringify(b.value).length>200000||!Number.isInteger(b.revision)||b.revision<0)throw fault(400,'Registro inválido.');
        const r=db.transaction(()=>{const old=db.get('SELECT * FROM records WHERE user_id=? AND key=?',u.id,b.key);if((old?.revision||0)!==b.revision)throw fault(409,'El registro cambió en otro dispositivo.');if(!old&&db.get('SELECT COUNT(*) AS n FROM records WHERE user_id=?',u.id).n>=200)throw fault(400,'Has alcanzado el límite de registros guardados.');db.run('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,revision=excluded.revision',u.id,b.key,JSON.stringify(b.value),b.revision+1);return {ok:true,revision:b.revision+1};});reply(200,r);return true;
      }
      throw fault(404,'Ruta no encontrada.');
    }catch(e){reply(e.status||500,{ok:false,code:e.code==='session_changed'?e.code:undefined,error:e.status?e.message:'No se pudo completar la operación. Inténtalo de nuevo.'});}
    return true;
  }
  return {handle,authenticate,onlineReward,db,close:()=>db.close()};
}
