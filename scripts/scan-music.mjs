import {readdir,readFile,writeFile} from 'node:fs/promises';
const directory=new URL('../music/',import.meta.url),manifest=new URL('playlist.json',directory);
const previous=JSON.parse(await readFile(manifest,'utf8'));
const metadata=new Map((previous.tracks||[]).map(t=>[t.file,t]));
const files=(await readdir(directory)).filter(f=>/^[a-zA-Z0-9_-]+\.mp3$/i.test(f)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
const tracks=files.map(file=>({file,title:metadata.get(file)?.title||'',artist:metadata.get(file)?.artist||''}));
await writeFile(manifest,JSON.stringify({tracks},null,2)+'\n');console.log(`${tracks.length} MP3 registrados en music/playlist.json. Los títulos existentes se conservan.`);
