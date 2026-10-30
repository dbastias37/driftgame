import http from 'node:http';
import {WebSocketServer} from 'ws';
import {pathToFileURL} from 'node:url';
import {Rooms} from './rooms.js';
export function createServer({origins=(process.env.ALLOWED_ORIGINS||'https://driftgame.onrender.com').split(','),...options}={}){
  const rooms=new Rooms(options),byIP=new Map();
  const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    if(origins.includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    if(req.url==='/'||req.url==='/health'){res.writeHead(200);res.end(JSON.stringify({ok:true,protocol:1,rooms:rooms.rooms.size}));}
    else{res.writeHead(404);res.end('{}');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    const ip=req.socket.remoteAddress; // Do not trust caller-supplied forwarding headers.
    if(req.url!=='/rooms'||!origins.includes(req.headers.origin)||wss.clients.size>=240||(byIP.get(ip)||0)>=120){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,ip));
  });
  wss.on('connection',(ws,ip)=>{
    byIP.set(ip,(byIP.get(ip)||0)+1);let alive=true,windowAt=Date.now(),messages=0,actions=0;
    const peer={get open(){return ws.readyState===1;},send(data){if(ws.readyState===1&&ws.bufferedAmount<65536)ws.send(JSON.stringify(data));else if(ws.bufferedAmount>=65536)ws.close(1013,'Conexion lenta');},close(){ws.close(1000);}};
    ws.on('pong',()=>alive=true);
    ws.on('message',(raw,binary)=>{
      if(binary){ws.close(1003);return;}if(Date.now()-windowAt>1000){windowAt=Date.now();messages=actions=0;}
      if(++messages>80){ws.close(1008,'Demasiados mensajes');return;}
      let m;try{m=JSON.parse(raw);}catch{ws.close(1007);return;}
      if(!['inputs','ping'].includes(m?.type)&&++actions>12){ws.close(1008);return;}
      rooms.handle(peer,m);
    });
    ws.on('error',()=>{});ws.on('close',()=>{byIP.set(ip,Math.max(0,(byIP.get(ip)||1)-1));if(!byIP.get(ip))byIP.delete(ip);rooms.disconnect(peer);});
    ws.checkAlive=()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();};
  });
  const tick=setInterval(()=>rooms.tick(),1000/60),snap=setInterval(()=>rooms.snapshots(),50),heartbeat=setInterval(()=>{for(const ws of wss.clients)ws.checkAlive();},15000);
  async function close(){clearInterval(tick);clearInterval(snap);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Servidor reiniciando');await new Promise(resolve=>server.close(resolve));wss.close();}
  return {server,wss,rooms,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=createServer();app.server.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Drift rooms ready'));
  process.once('SIGTERM',()=>{app.close().finally(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
