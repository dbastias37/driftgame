import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8'};
export async function serveGame(req,res){
  if(!['GET','HEAD'].includes(req.method))return false;
  let path;try{path=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{return false;}
  if(path==='/')path='/index.html';
  if(path!=='/index.html'&&!/^\/(js|css|assets|vendor)\/[\w./-]+$/.test(path))return false;
  if(path.includes('..')||path.includes('//')||!types[extname(path)])return false;
  const file=resolve(root,'.'+path);if(!file.startsWith(root))return false;
  let s;try{s=await stat(file);}catch{return false;}if(!s.isFile())return false;
  res.setHeader('Content-Type',types[extname(path)]);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control',path.endsWith('.html')?'no-store':'no-cache');res.setHeader('Content-Length',s.size);
  res.writeHead(200);if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);return true;
}
