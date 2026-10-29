const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function harness(){
  const elements=new Map(),storage=new Map();
  const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:20}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});
  function el(id){if(!elements.has(id)){
    const classes=new Set(id==='mainMenu'?[]:['hidden']);
    const e={id,width:800,height:600,clientWidth:800,clientHeight:600,naturalWidth:400,naturalHeight:800,style:{},dataset:{},checked:true,value:'auto',innerHTML:'',textContent:'',classList:{add:(...cs)=>cs.forEach(c=>classes.add(c)),remove:(...cs)=>cs.forEach(c=>classes.delete(c)),contains:c=>classes.has(c),toggle(c,v){const on=v===undefined?!classes.has(c):v;on?classes.add(c):classes.delete(c);return on;}},addEventListener(){},setAttribute(){},getAttribute(){return null},querySelectorAll(){return []},getContext:()=>ctx,getBoundingClientRect:()=>({width:800,height:600,left:0,top:0}),focus(){},contains(){return false},getClientRects:()=>[{}],insertAdjacentHTML(){},pause(){},play:()=>Promise.reject(new Error('disabled')),select(){},setPointerCapture(){}};elements.set(id,e);
  }return elements.get(id);}
  const math=Object.create(Math);let seed=42;math.random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const document={body:el('body'),hidden:false,getElementById:el,querySelector:q=>q.startsWith('#')?el(q.slice(1)):el('tx'),querySelectorAll:q=>q==='input[name="tx"]'?[el('tx')]:[],createElement:()=>el('generated'+elements.size),addEventListener(){}};
  const scope={document,Math:math,console:{log(){},warn(){},error(){}},performance:{now:()=>1000},innerWidth:1366,innerHeight:768,devicePixelRatio:1,navigator:{maxTouchPoints:0},location:{hash:'',search:''},Image:class{constructor(){this.complete=true;this.width=this.naturalWidth=400;this.height=this.naturalHeight=800}},HTMLCanvasElement:class{},addEventListener(){},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),TextEncoder,TextDecoder,Uint8Array,URL,alert(){},confirm:()=>false};
  scope.window=scope;const context=vm.createContext(scope);vm.runInContext(source,context);
  const experience=fs.readFileSync(path.join(root,'js/experience.js'),'utf8').split("import('./view3d.js')")[0];vm.runInContext(experience,context);
  return code=>JSON.parse(JSON.stringify(vm.runInContext(code,context))??'null');
}

module.exports={harness};
