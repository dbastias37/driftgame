import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual,createPublicKey,verify} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function fault(status,message){return Object.assign(new Error(message),{status});}
export const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())?value.trim().toLowerCase():null;
export function name(value){const s=typeof value==='string'?value.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,24):'';if(s.length<2)throw fault(400,'El nombre debe tener entre 2 y 24 caracteres.');return s;}
let hashing=0;
export async function passwordHash(value,salt=token()){
  if(typeof value!=='string'||value.length<12||value.length>128)throw fault(400,'Usa una contraseña de 12 a 128 caracteres.');
  if(hashing>=4)throw fault(429,'Espera unos segundos e inténtalo de nuevo.');
  hashing++;try{const hash=await scrypt(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt:${salt}:${hash.toString('hex')}`;}finally{hashing--;}
}
export async function passwordMatches(value,stored){
  const [,salt,expected]=(stored||'scrypt:drift-constant-dummy-salt:'+ '0'.repeat(128)).split(':');
  const actual=await passwordHash(typeof value==='string'&&value.length>=12&&value.length<=128?value:'invalid-password-value',salt);
  return typeof value==='string'&&value.length>=12&&value.length<=128&&!!stored&&timingSafeEqual(Buffer.from(actual.split(':')[2],'hex'),Buffer.from(expected,'hex'));
}
export function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split(/=(.*)/s)).filter(x=>x.length>=2).map(x=>[x[0],x[1]]));}
export function cookie(res,key,value,seconds,secure){const previous=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...previous,`${key}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`]);}
export async function googleIdentity({code,verifier,nonce,origin,clientId,clientSecret,fetcher=fetch,now=Date.now()}){
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:origin+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fault(400,'Google no pudo confirmar el acceso. Inténtalo nuevamente.');
  const {id_token}=await response.json();if(typeof id_token!=='string'||id_token.length>12000)throw fault(400,'Respuesta de Google inválida.');
  const parts=id_token.split('.');if(parts.length!==3)throw fault(400,'Identidad inválida.');
  let head,claims;try{head=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw fault(400,'Identidad inválida.');}
  const keysResponse=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(15000)});if(!keysResponse.ok)throw fault(503,'No pudimos verificar Google.');
  const {keys}=await keysResponse.json(),jwk=keys.find(k=>k.kid===head.kid&&k.kty==='RSA'&&k.use==='sig');
  if(head.alg!=='RS256'||!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'))||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||!Number.isFinite(claims.exp)||claims.exp<=now/1000||!Number.isFinite(claims.iat)||claims.iat>now/1000+60||claims.nonce!==nonce||typeof claims.sub!=='string'||claims.sub.length>255||!claims.sub||claims.email_verified!==true||!email(claims.email))throw fault(400,'No pudimos validar tu identidad de Google.');
  return {sub:claims.sub,email:email(claims.email),name:claims.name};
}
export function mailer({key,from,origin,fetcher=fetch}){
  return async(to,kind,secret)=>{
    if(!key||!from)throw fault(503,'El envío de correos aún no está configurado.');
    const link=origin+'/#account='+kind+'&token='+secret;
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':'drift-'+digest(secret)},body:JSON.stringify({from,to:[to],subject:kind==='verify'?'Verifica tu cuenta de Drift Racer':'Recupera tu cuenta de Drift Racer',text:`${kind==='verify'?'Confirma tu correo':'Crea una nueva contraseña'} en este enlace de un solo uso:\n\n${link}\n\nVence en 30 minutos. Si no lo solicitaste, ignora este correo.`}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw fault(503,'No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.');
  };
}
