/* Shared, byte-counted downloads. Audio stays compressed; models decode once. */
(function(root){
  class AssetStore {
    constructor({baseURL,fetcher=root.fetch.bind(root),cacheStorage=root.caches,onProgress=()=>{},timeout=45000}={}){
      this.baseURL=baseURL||document.baseURI;this.fetcher=fetcher;this.cacheStorage=cacheStorage;
      this.onProgress=onProgress;this.timeout=timeout;this.entries=new Map();this.blobs=new Map();
      this.pending=new Map();this.bytes=new Map();this.urls=new Map();this.images=new Map();this.total=0;
    }
    key(path){const url=new URL(path,this.baseURL);url.search='';url.hash='';return url.href;}
    configure(entries){
      for(const entry of entries){const key=this.key(entry.path);if(this.entries.has(key))continue;this.entries.set(key,entry);this.total+=entry.bytes;}
    }
    report(key,bytes){this.bytes.set(key,bytes);const loaded=[...this.bytes.values()].reduce((a,b)=>a+b,0);this.onProgress({loaded,total:this.total,ratio:this.total?Math.min(1,loaded/this.total):0});}
    async cache(){if(!this.cachePromise)this.cachePromise=Promise.resolve().then(()=>this.cacheStorage?.open('dr1ft-assets-v1')).catch(()=>null);return this.cachePromise;}
    async load(path){
      const key=this.key(path);if(this.blobs.has(key))return this.blobs.get(key);if(this.pending.has(key))return this.pending.get(key);
      const entry=this.entries.get(key);if(!entry)throw Error('Recurso fuera del catálogo: '+path);
      const task=this.download(key,entry).finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
    }
    async download(key,entry){
      const requestURL=new URL(key);requestURL.searchParams.set('drift-asset',entry.hash);
      const cache=await this.cache();let cached;
      try{cached=await cache?.match(requestURL.href);}catch{}
      if(cached){const blob=await cached.blob();if(blob.size===entry.bytes){this.blobs.set(key,blob);this.report(key,entry.bytes);return blob;}}
      const controller=new AbortController();let timer;
      const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),this.timeout);};
      this.report(key,0);heartbeat();
      try{
        const response=await this.fetcher(requestURL.href,{signal:controller.signal,cache:'force-cache'});
        if(!response.ok)throw Error('HTTP '+response.status);
        const chunks=[];let received=0;
        if(response.body?.getReader){
          const reader=response.body.getReader();
          while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;heartbeat();this.report(key,Math.min(received,entry.bytes));}
        }else{const data=await response.arrayBuffer();chunks.push(data);received=data.byteLength;}
        if(received!==entry.bytes)throw Error('Descarga incompleta o versión desactualizada');
        const blob=new Blob(chunks,{type:response.headers.get('content-type')||'application/octet-stream'});
        this.blobs.set(key,blob);this.report(key,entry.bytes);
        // Quota/private-mode failures must not prevent an otherwise valid load.
        try{await cache?.put(requestURL.href,new Response(blob));}catch{}
        return blob;
      }catch(error){this.report(key,0);throw Error(entry.path+' · '+(error.name==='AbortError'?'La descarga no respondió':error.message));}
      finally{clearTimeout(timer);}
    }
    async preload(concurrency=3){
      const queue=[...this.entries.keys()];let next=0;const failures=[];
      await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{
        while(next<queue.length){const path=queue[next++];try{await this.load(path);}catch(error){failures.push(error);}}
      }));
      if(failures.length)throw failures[0];
    }
    async response(path){return new Response(await this.load(path));}
    url(path){const key=this.key(path);if(!this.blobs.has(key))return String(path);if(!this.urls.has(key))this.urls.set(key,URL.createObjectURL(this.blobs.get(key)));return this.urls.get(key);}
    async decodeImage(path){
      const key=this.key(path);if(this.images.has(key))return this.images.get(key);
      await this.load(path);const image=new Image();image.src=this.url(path);await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      canvas.getContext('2d').drawImage(image,0,0);this.images.set(key,canvas);return canvas;
    }
    image(path){return this.images.get(this.key(path));}
    release(path){const key=this.key(path);if(!this.urls.has(key))this.blobs.delete(key);}
  }
  root.DriftAssetStore=AssetStore;
})(globalThis);
