import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8787);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff':'font/woff','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403);return res.end();}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);return res.end('No encontrado');}
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','no-cache');
    let start=0,end=stat.size-1,status=200;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
      if(!match[1])start=Math.max(0,stat.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
      if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
      status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
    }
    res.writeHead(status,{'Content-Length':end-start+1});if(req.method==='HEAD'||!stat.size)return res.end();
    const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`El puerto ${port} ya está en uso. Cierra la otra vista de DriftGame.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`DR1FT listo: http://127.0.0.1:${port}\nMantén esta ventana abierta mientras juegas. Ctrl+C para cerrar.`));
