const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function store(options={}){
  const scope={fetch,URL,Blob,Response,AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/asset-preloader.js','utf8'),scope);
  return new scope.DriftAssetStore({baseURL:'https://game.test/',cacheStorage:null,...options});
}
test('progress follows streamed bytes and concurrent callers share the same download',async()=>{
  let calls=0,release;const snapshots=[];
  const loader=store({onProgress:p=>snapshots.push(p.ratio),fetcher:async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2]));release=()=>{controller.enqueue(new Uint8Array([3,4]));controller.close();};}}));}});
  loader.configure([{path:'car.glb',bytes:4,hash:'one'}]);
  const a=loader.load('car.glb'),b=loader.load('/car.glb');
  await new Promise(r=>setImmediate(r));assert.equal(snapshots.at(-1),.5);assert.equal(calls,1);
  release();await Promise.all([a,b]);assert.equal(snapshots.at(-1),1);assert.equal((await loader.response('car.glb')).status,200);assert.equal(calls,1);
});
test('failed/incomplete files block completion and retry retains successful resources',async()=>{
  const calls=new Map();let fail=true;
  const loader=store({fetcher:async url=>{const name=new URL(url).pathname;calls.set(name,(calls.get(name)||0)+1);return name==='/bad'&&fail?new Response(new Uint8Array(1)):new Response(new Uint8Array(2));}});
  loader.configure(['ok','bad'].map(path=>({path,bytes:2,hash:'v1'})));
  await assert.rejects(loader.preload(2),/incompleta/);assert.equal(loader.bytes.get('https://game.test/bad'),0);
  fail=false;await loader.preload(2);assert.equal(calls.get('/ok'),1);assert.equal(calls.get('/bad'),2);
});
test('cache versions invalidate changed files and storage denial does not break loading',async()=>{
  const disk=new Map();let calls=0;
  const options={cacheStorage:{open:async()=>({match:async key=>disk.get(key)?.clone(),put:async(key,value)=>disk.set(key,value)})},fetcher:async()=>{calls++;return new Response(new Uint8Array(3));}};
  for(const hash of ['first','first','changed']){const loader=store(options);loader.configure([{path:'song.mp3',bytes:3,hash}]);await loader.preload();}
  assert.equal(calls,2);
  const denied=store({...options,cacheStorage:{open:async()=>{throw Error('Quota');}}});denied.configure([{path:'song.mp3',bytes:3,hash:'v2'}]);await denied.preload();assert.equal(denied.blobs.size,1);
});
test('download queue observes its concurrency limit and HTTP failures cannot reach completion',async()=>{
  let active=0,max=0;const loader=store({fetcher:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));active--;return new Response('',{status:503});}});
  loader.configure(Array.from({length:8},(_,i)=>({path:String(i),bytes:1,hash:'v1'})));
  await assert.rejects(loader.preload(3),/503/);assert.equal(max,3);assert.equal(loader.blobs.size,0);
});
