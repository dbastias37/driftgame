import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),paths=['music/playlist.json'];
for(const dir of ['assets/models','assets/bonus','assets/scenery','assets/cars']){
  for(const name of await readdir(path.join(root,dir)))if(/\.(glb|png|jpe?g)$/i.test(name))paths.push(dir+'/'+name);
}
const playlist=JSON.parse(await readFile(path.join(root,'music/playlist.json'),'utf8'));
for(const track of playlist.tracks){if(!/^[a-zA-Z0-9_-]+\.mp3$/i.test(track.file))throw Error('Invalid music filename');paths.push('music/'+track.file);}
const assets=[];
for(const file of [...new Set(paths)].sort()){
  const bytes=await readFile(path.join(root,file));
  assets.push({path:file,bytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex').slice(0,20)});
}
const output=JSON.stringify({version:1,assets},null,2)+'\n',target=path.join(root,'assets/preload-manifest.json');
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==output)throw Error('Preload manifest is stale. Run npm run assets:manifest.');}
else await writeFile(target,output);
console.log(`${assets.length} preload resources · ${Math.ceil(assets.reduce((n,a)=>n+a.bytes,0)/1048576)} MiB`);
