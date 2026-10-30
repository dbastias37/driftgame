import http from 'node:http';
import {WebSocketServer} from 'ws';
import {pathToFileURL} from 'node:url';
import {createAccounts} from './accounts/api.js';
import {serveGame} from './static.js';
import {Rooms} from './rooms.js';
export function createServer({origins=(process.env.ALLOWED_ORIGINS||'https://driftgame.onrender.com').split(','),accounts=null,serveStatic=false,...options}={}){
  const rooms=new Rooms({...options,onReward:accounts?.onlineReward}),byIP=new Map();
  const server=http.createServer(async(req,res)=>{
    try{
    if(accounts&&await accounts.handle(req,res))return;
    if(serveStatic&&await serveGame(req,res))return;
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    if(origins.includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    if(req.url==='/'||req.url==='/health'){res.writeHead(200);res.end(JSON.stringify({ok:true,protocol:1,rooms:rooms.rooms.size}));}
    else{res.writeHead(404);res.end('{}');}
    }catch{if(!res.headersSent)res.writeHead(500);res.end('{}');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    const user=accounts?.authenticate(req);
    if(accounts&&!user){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}
    const ip=req.socket.remoteAddress; // Do not trust caller-supplied forwarding headers.
    if(req.url!=='/rooms'||!origins.includes(req.headers.origin)||wss.clients.size>=240||(byIP.get(ip)||0)>=120){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,ip,user,req));
  });
  wss.on('connection',(ws,ip,user,request)=>{
    byIP.set(ip,(byIP.get(ip)||0)+1);let alive=true,windowAt=Date.now(),messages=0,actions=0;
    const peer={userId:user?.id,name:user?.name,get open(){return ws.readyState===1;},send(data){if(ws.readyState===1&&ws.bufferedAmount<65536)ws.send(JSON.stringify(data));else if(ws.bufferedAmount>=65536)ws.close(1013,'Conexion lenta');},close(){ws.close(1000);}};
    ws.on('pong',()=>alive=true);
    ws.on('message',(raw,binary)=>{
      if(binary){ws.close(1003);return;}if(Date.now()-windowAt>1000){windowAt=Date.now();messages=actions=0;}
      if(++messages>80){ws.close(1008,'Demasiados mensajes');return;}
      let m;try{m=JSON.parse(raw);}catch{ws.close(1007);return;}
      if(!['inputs','ping'].includes(m?.type)&&++actions>12){ws.close(1008);return;}
      rooms.handle(peer,m);
    });
    ws.on('error',()=>{});ws.on('close',()=>{byIP.set(ip,Math.max(0,(byIP.get(ip)||1)-1));if(!byIP.get(ip))byIP.delete(ip);rooms.disconnect(peer);});
    ws.checkAlive=()=>{if(accounts&&!accounts.authenticate(request)){ws.close(1008,'Sesion expirada');return;}if(!alive){ws.terminate();return;}alive=false;ws.ping();};
  });
  const tick=setInterval(()=>rooms.tick(),1000/60),snap=setInterval(()=>rooms.snapshots(),50),heartbeat=setInterval(()=>{for(const ws of wss.clients)ws.checkAlive();},15000);
  async function close(){clearInterval(tick);clearInterval(snap);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Servidor reiniciando');await new Promise(resolve=>server.close(resolve));wss.close();}
  return {server,wss,rooms,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const portFlag=process.argv.indexOf('--port');
  const port=Number(process.env.PORT||(portFlag>=0?process.argv[portFlag+1]:10000));
  const production=process.env.NODE_ENV==='production';
  if(production&&(!process.env.ACCOUNT_DB||!process.env.APP_ORIGIN))throw Error('Configure ACCOUNT_DB on a persistent disk and APP_ORIGIN before enabling accounts.');
  const origin=process.env.APP_ORIGIN||'http://localhost:'+ port;
  const accounts=createAccounts({path:process.env.ACCOUNT_DB||'./data/drift.sqlite',origin,clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,mailKey:process.env.RESEND_API_KEY,mailFrom:process.env.MAIL_FROM});
  const app=createServer({accounts,serveStatic:true,origins:[origin]});app.server.listen(port,'0.0.0.0',()=>console.log('Drift rooms ready'));
  process.once('SIGTERM',()=>{app.close().finally(()=>{accounts.close();process.exit(0);});setTimeout(()=>process.exit(0),5000).unref();});
}

