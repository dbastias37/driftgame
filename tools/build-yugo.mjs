// Offline model authoring. Same unlit + nearest-neighbour pixel-atlas technique
// as the supplied Fujiwara/RX-7; original Yugo geometry and newly drawn pixels.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as T from '../vendor/three.module.min.js';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.YUGO_CANVAS_MODULE||'@napi-rs/canvas');

const canvas=createCanvas(512,512),g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
const rect=(c,x,y,w,h)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
rect('#171b22',0,0,512,512);
// Side paint: hard two-tone plastic sill, pressed door seam, pixel edge highlights.
rect('#ce362b',0,0,256,96);rect('#ee5241',0,0,256,23);rect('#dd4032',0,23,256,20);rect('#b32725',0,69,256,27);
rect('#252930',0,68,256,8);rect('#f0644b',0,67,256,1);rect('#922326',0,77,256,1);
for(const x of [79,171]){rect('#a72b29',x,31,1,44);rect('#e94837',x+1,32,1,34);}
rect('#e25540',86,63,80,1);
// Roof and bonnet use a brighter paint field with square, restrained reflections.
rect('#e44835',0,96,256,128);rect('#f1664b',4,100,248,2);rect('#b62d28',0,220,256,4);
rect('#ee5140',20,108,210,92);rect('#f15b43',28,110,190,3);
for(let j=0;j<11;j++)rect('#36333a',168+j*2,112,1,24);
rect('#c9312a',165,110,1,103);
// Front/back paint panels.
rect('#be2c26',256,0,128,64);rect('#ee4b38',256,0,128,8);
rect('#cb3329',256,64,128,64);rect('#e14b37',256,64,128,5);
rect('#252930',384,0,64,64);rect('#3c4046',384,0,64,3);rect('#1a1e25',384,53,64,11);
// Grille, lenses and brushed trim: geometry carries shape, pixels carry detail.
rect('#20242b',448,0,64,64);for(let y=2;y<64;y+=5)rect('#42434a',448,y,64,1);
rect('#d5d8c5',384,64,32,32);for(let x=386;x<416;x+=4)rect('#f1edce',x,66,1,27);for(let y=68;y<96;y+=5)rect('#9faeaa',384,y,32,1);
rect('#f1a344',416,64,32,32);for(let x=417;x<448;x+=4)rect('#c66b32',x,64,1,32);
rect('#c52c27',448,64,32,32);for(let y=66;y<96;y+=4)rect('#f05539',448,y,32,1);
rect('#b5b9ad',480,64,32,32);rect('#e0dfc6',480,65,32,2);rect('#7d8791',480,89,32,7);
// Opaque blue glass, in the same stepped palette as the two reference models.
for(const x0 of [256,384]){
 rect('#172a48',x0,128,128,64);
 for(let y=0;y<64;y++){const colors=['#36516b','#2e4763','#263e5c','#203652','#1b2e4a'];rect(colors[Math.min(4,Math.floor(y/13))],x0,128+y,128,1);}
 for(let y=0;y<40;y++){rect('#526980',x0+18+Math.floor(y*.65),130+y,3,1);rect('#435c75',x0+24+Math.floor(y*.65),130+y,1,1);}
 rect('#13243e',x0,189,128,3);
}
// Eight-bit steel hubcap, ventilation holes and four fasteners.
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const dx=x-63.5,dy=y-63.5,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);let c='#1b2028';
 if(r<57)c='#343944';if(r<51)c='#c0c3b9';if(r<46)c='#9da7a9';if(r<39)c='#b5beb9';
 if(r>40&&r<46&&Math.cos(a*16)>.15)c='#3e4853';
 if(r<21)c='#d7d8c9';if(r<13)c='#9ba9ad';if(r<9)c='#d5d7c9';
 for(const t of [0,Math.PI/2,Math.PI,Math.PI*1.5])if(Math.hypot(dx-26*Math.cos(t),dy-26*Math.sin(t))<3)c='#465462';
 rect(c,x,256+y,1,1);
}
rect('#1d222a',128,256,64,64);for(let x=128;x<192;x+=8){rect('#2e333b',x,256,3,64);rect('#171c23',x+4,256,2,64);}
// Small original badge / plate, rendered with a fixed bitmap alphabet.
const letters={Y:['101','101','010','010','010'],U:['101','101','101','101','111'],G:['111','100','101','101','111'],O:['111','101','101','101','111'],K:['101','110','100','110','101'],R:['110','101','110','101','101'],A:['010','101','111','101','101'],L:['100','100','100','100','111'],'5':['111','100','111','001','111'],' ':['000','000','000','000','000']};
function pixelText(text,x,y,scale,color){for(const ch of text){(letters[ch]||letters[' ']).forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='1')rect(color,x+xx*scale,y+yy*scale,scale,scale)}));x+=4*scale;}}
rect('#e3e1c9',256,256,64,24);pixelText('YUGO',271,263,2,'#223747');
rect('#202631',320,256,64,24);pixelText('KORAL 55',322,265,1,'#d3d5c3');
rect('#222730',384,256,64,24);pixelText('YUGO',399,263,2,'#e7d8c0');
// Output atlas is retained for inspecting/re-authoring the exact pixels.
fs.writeFileSync(new URL('../assets/models/yugo-pixel-atlas.png',import.meta.url),canvas.toBuffer('image/png'));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const batches=[];
function batch(name){const b={name,position:[],normal:[],uv:[]};batches.push(b);return b;}
const body=batch('Yugo-body');
function triangle(b,points,uvs){const normal=new T.Vector3().subVectors(points[1],points[0]).cross(new T.Vector3().subVectors(points[2],points[0])).normalize();points.forEach((p,i)=>{b.position.push(...p.toArray());b.normal.push(...normal.toArray());b.uv.push(uvs[i][0]/512,uvs[i][1]/512);});}
function mappedUV(p,n,material){
 const u=clamp((p.x+1.745)/3.49),v=clamp(1-p.y/1.335),side=clamp((p.z+.88)/1.76);
 if(material==='02_-_Default'){
  if(Math.abs(n.y)>.72)return[2+u*252,98+side*124];
  if(Math.abs(n.x)>.8)return[258+side*124,(p.x>0?2:66)+v*60];
  return[2+u*252,2+v*92];
 }
 if(material==='01_-_Default'){const x0=Math.abs(n.x)>.5?384:256;return[x0+2+(Math.abs(n.x)>.5?side:u)*124,130+clamp((1.29-p.y)/.48)*60];}
 const tile=material==='Glass_cubes_white'?[384,64,32,32]:material==='Glass_Cubes_Orange'?[416,64,32,32]:material==='Glass_Cubes_Red'?[448,64,32,32]:material==='Glass_Cubes_Grey_1'||material==='Chrome_Polished'?[480,64,32,32]:p.x>1.52&&p.y>.49?[448,0,64,64]:[384,0,64,64];
 return[tile[0]+1+side*(tile[2]-2),tile[1]+1+v*(tile[3]-2)];
}
// Hand-retopologized shell traced from the supplied Yugo CAD model. Shared
// panel boundaries avoid the cracks produced by decimating its 285 CAD parts.
function quad(b,p,tile,reverse=false){const uv=[[tile[0],tile[1]+tile[3]],[tile[0]+tile[2],tile[1]+tile[3]],[tile[0]+tile[2],tile[1]],[tile[0],tile[1]]];for(const ids of reverse?[[2,1,0],[3,2,0]]:[[0,1,2],[0,2,3]])triangle(b,ids.map(i=>new T.Vector3(...p[i])),ids.map(i=>uv[i]));}
function pane(points,tile,axis='x'){const ps=points.map(p=>new T.Vector3(...p)),lo=Math.min(...ps.map(p=>p[axis])),hi=Math.max(...ps.map(p=>p[axis])),low=Math.min(...ps.map(p=>p.y)),high=Math.max(...ps.map(p=>p.y)),uv=ps.map(p=>[tile[0]+(p[axis]-lo)/(hi-lo)*tile[2],tile[1]+(high-p.y)/(high-low)*tile[3]]);for(const ids of [[0,1,2],[0,2,3]])triangle(body,ids.map(i=>ps[i]),ids.map(i=>uv[i]));}
function poly(points,material){const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],p[1]))),geo=new T.ShapeGeometry(shape);const pos=geo.attributes.position,ix=geo.index;for(let i=0;i<ix.count;i+=3){const pts=[0,1,2].map(k=>{const j=ix.getX(i+k);return new T.Vector3(pos.getX(j),pos.getY(j),points[0][2]);}),n=new T.Vector3(0,0,1);triangle(body,pts,pts.map(p=>mappedUV(p,n,material)));}}
function cuboid(x,y,z,l,h,w,tile){const x0=x-l/2,x1=x+l/2,y0=y-h/2,y1=y+h/2,z0=z-w/2,z1=z+w/2;for(const pts of [[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[[x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1]],[[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]],[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],[[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]],[[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[x1,y0,z0]]])quad(body,pts,tile);}
const black=[386,4,58,54],chrome=[482,66,28,27],red=[30,110,80,80];
for(const side of [-1,1]){
 const z=side*.774,outline=[[-1.66,.28,z],[-1.69,.73,z],[-1.60,.86,z],[.75,.86,z],[1.66,.77,z],[1.69,.28,z]];
 for(const x of [1.06,-1.09]){outline.push([x+.345,.28,z]);for(let i=0;i<=10;i++){const a=i/10*Math.PI;outline.push([x+Math.cos(a)*.345,.294+Math.sin(a)*.345,z]);}outline.push([x-.345,.28,z]);}
 poly(outline,'02_-_Default');
 // Deep wheel wells and 12-sided painted lips keep tires clear at full steering.
 for(const x of [-1.09,1.06])for(let i=0;i<10;i++){
  const a=i/10*Math.PI,b=(i+1)/10*Math.PI;
  quad(body,[[x+Math.cos(a)*.346,.294+Math.sin(a)*.346,z],[x+Math.cos(b)*.346,.294+Math.sin(b)*.346,z],[x+Math.cos(b)*.346,.294+Math.sin(b)*.346,z-side*.19],[x+Math.cos(a)*.346,.294+Math.sin(a)*.346,z-side*.19]],black);
  quad(body,[[x+Math.cos(a)*.347,.294+Math.sin(a)*.347,z+side*.004],[x+Math.cos(b)*.347,.294+Math.sin(b)*.347,z+side*.004],[x+Math.cos(b)*.367,.294+Math.sin(b)*.367,z],[x+Math.cos(a)*.367,.294+Math.sin(a)*.367,z]],[34,14,30,2]);
 }
 // Cabin is a closed trapezoid; windows are inset in its painted silhouette.
 const cabin=[[-1.60,.86,side*.738],[-1.20,1.335,side*.57],[.17,1.335,side*.57],[.75,.86,side*.738]];
 quad(body,cabin,[0,0,220,36],side<0);
 function glass(points){pane(points.map(([x,y])=>[x,y,side*(.738-(y-.86)/.475*.168+.013)]),[258,131,123,57]);}
 glass([[-1.43,.91],[-1.14,1.255],[-.49,1.272],[-.49,.91]]);
 glass([[-.40,.91],[-.40,1.274],[.13,1.288],[.64,.91]]);
 // Dark seals are narrow strips; no duplicate coplanar CAD skins.
 for(const [a,b]of[[[-1.43,.91],[-1.14,1.255]],[[-1.14,1.255],[-.49,1.272]],[[-.49,1.272],[-.49,.91]],[[-.40,.91],[-.40,1.274]],[[-.40,1.274],[.13,1.288]],[[.13,1.288],[.64,.91]]]){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*.009,ny=dx/len*.009;
  quad(body,[[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny],[a[0]+nx,a[1]+ny]].map(([x,y])=>[x,y,side*(.738-(y-.86)/.475*.168+.015)]),black);
 }
 cuboid(-.34,.80,side*.783,.145,.035,.018,black);
 cuboid(.60,.94,side*.80,.12,.04,.17,black);cuboid(.58,.98,side*.86,.17,.10,.07,black);
 cuboid(.62,.98,side*.898,.09,.065,.005,chrome);
 cuboid(1.42,.52,side*.779,.085,.045,.009,[416,64,32,32]);
 // Visible sill sits between wheel openings, not through the tires.
 cuboid(-.015,.32,side*.742,1.42,.12,.055,black);
}
// Complete closed bonnet, roof, tailgate and underbody; all meet the side shell.
quad(body,[[.75,.86,-.774],[1.66,.77,-.774],[1.66,.77,.774],[.75,.86,.774]],[150,98,102,124]);
quad(body,[[-1.20,1.335,-.57],[.17,1.335,-.57],[.17,1.335,.57],[-1.20,1.335,.57]],[10,98,140,124]);
quad(body,[[.17,1.335,-.57],[.75,.86,-.738],[.75,.86,.738],[.17,1.335,.57]],black);
pane([[.220,1.300,-.545],[.708,.900,-.674],[.708,.900,.674],[.220,1.300,.545]],[386,131,124,57],'z');
quad(body,[[-1.60,.86,.738],[-1.20,1.335,.57],[-1.20,1.335,-.57],[-1.60,.86,-.738]],red);
pane([[-1.562,.914,.668],[-1.25,1.285,.535],[-1.25,1.285,-.535],[-1.562,.914,-.668]],[386,131,124,57],'z');
quad(body,[[-1.69,.73,.774],[-1.60,.86,.738],[-1.60,.86,-.738],[-1.69,.73,-.774]],red);
quad(body,[[-1.69,.28,.774],[-1.69,.73,.774],[-1.69,.73,-.774],[-1.69,.28,-.774]],[256,64,128,64]);
quad(body,[[1.69,.28,-.774],[1.66,.77,-.774],[1.66,.77,.774],[1.69,.28,.774]],[256,0,128,64]);
cuboid(0,.23,0,2.85,.12,1.15,black);
// Square bumpers, rectangular headlights and the Yugo's separate centre grille.
for(const x of [-1.70,1.70])cuboid(x,.36,0,.09,.17,1.59,black);
cuboid(1.690,.626,0,.022,.212,1.38,[448,0,64,64]);
quad(body,[[1.716,.55,-.39],[1.716,.55,.39],[1.716,.71,.39],[1.716,.71,-.39]],[448,0,64,64]);
for(const z of [-.53,.53]){cuboid(1.709,.637,z,.024,.17,.23,chrome);quad(body,[[1.724,.565,z-.105],[1.724,.565,z+.105],[1.724,.705,z+.105],[1.724,.705,z-.105]],[384,64,32,32]);}
for(const z of [-.58,.58]){cuboid(-1.702,.60,z,.024,.18,.32,black);quad(body,[[-1.716,.523,z+.14],[-1.716,.523,z-.14],[-1.716,.675,z-.14],[-1.716,.675,z+.14]],[448,64,32,32]);quad(body,[[-1.720,.596,z+.14],[-1.720,.596,z-.14],[-1.720,.674,z-.14],[-1.720,.674,z+.14]],[416,64,32,32]);}
// Exhaust tip and windshield wipers.
cuboid(-1.67,.20,.47,.14,.06,.07,black);
for(const z of [-.33,.33])cuboid(.688,.912,z,.035,.015,.38,black);
// Small badges follow the actual front and rear panels, with no pasted photo.
quad(body,[[1.711,.40,-.19],[1.711,.40,.19],[1.711,.54,.19],[1.711,.54,-.19]],[256,256,64,24]);
quad(body,[[-1.719,.51,.20],[-1.719,.51,-.20],[-1.719,.66,-.20],[-1.719,.66,.20]],[256,256,64,24]);
quad(body,[[1.720,.605,-.07],[1.720,.605,.07],[1.720,.665,.07],[1.720,.665,-.07]],[384,256,64,24]);
quad(body,[[-1.719,.69,-.39],[-1.719,.69,-.70],[-1.719,.73,-.70],[-1.719,.73,-.39]],[320,256,64,24]);
const pivots=[];
for(const x of [-1.09,1.06])for(const z of [-.654,.654]){
 const b=batch(`wheel-${x>0?'front':'rear'}-${z>0?'right':'left'}`);pivots.push([x,.294,z]);
 const segments=12,r=.281,half=.0725;
 // Faceted tread + inset steel caps, independent wheel pivots.
 for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,aa=(i+1)/segments*Math.PI*2,p=(t,zz,rr=r)=>[Math.cos(t)*rr,Math.sin(t)*rr,zz];
  quad(b,[p(a,-half),p(aa,-half),p(aa,half),p(a,half)],[128+i*4,256,4,64]);
  for(const sign of [-1,1]){const pts=[new T.Vector3(0,0,sign*half),new T.Vector3(...p(a,sign*half)),new T.Vector3(...p(aa,sign*half))],uv=pts.map(q=>[64+q.x/r*63,320-q.y/r*63]);if(sign<0){pts.reverse();uv.reverse();}triangle(b,pts,uv);}
 }
}
// Minimal, embedded GLB with one unlit nearest-filtered material and 5 meshes.
const chunks=[],views=[],accessors=[];let offset=0;
function put(data,target){const b=Buffer.from(data.buffer??data,data.byteOffset||0,data.byteLength??data.length),id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,...(target?{target}:{})});chunks.push(b);const pad=(4-b.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));offset+=b.length+pad;return id;}
function attribute(data,type){const a=new Float32Array(data),size=type==='VEC3'?3:2,count=a.length/size,lo=Array(size).fill(Infinity),hi=Array(size).fill(-Infinity);a.forEach((v,i)=>{lo[i%size]=Math.min(lo[i%size],v);hi[i%size]=Math.max(hi[i%size],v);});const id=accessors.length;accessors.push({bufferView:put(a,34962),componentType:5126,count,type,min:lo,max:hi});return id;}
const meshes=batches.map(b=>({name:b.name,primitives:[{attributes:{POSITION:attribute(b.position,'VEC3'),NORMAL:attribute(b.normal,'VEC3'),TEXCOORD_0:attribute(b.uv,'VEC2')},material:0}]}));
const png=canvas.toBuffer('image/png'),imageView=put(png);
const doc={asset:{version:'2.0',generator:'Drift Racer Yugo pixel conversion',extras:{author:'3DDomino; low-poly conversion and original pixel atlas for Drift Racer',license:'CC-BY-4.0',source:'https://sketchfab.com/3d-models/yugo-koral-55-1e2dcf759a4f47f9b2832af5e3c9b85d',changes:'Hand-retopologized body, remade 12-sided wheels, metric pivots and new pixel atlas; style reference: user-supplied Fujiwara and RX7 by Pudim Abestado.'}},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Yugo Koral 55',children:batches.map((_,i)=>i+1)},...batches.map((b,i)=>({name:b.name,mesh:i,...(i?{translation:pivots[i-1]}:{})}))],meshes,materials:[{name:'Yugo pixel atlas',doubleSided:true,extensions:{KHR_materials_unlit:{}},pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0}}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9728,minFilter:9728,wrapS:33071,wrapT:33071}],images:[{bufferView:imageView,mimeType:'image/png'}],accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binhead=Buffer.alloc(8);binhead.writeUInt32LE(bin.length,0);binhead.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(new URL('../assets/models/yugo-koral-55-pixel.glb',import.meta.url),Buffer.concat([header,json,binhead,bin]));console.log('Yugo triangles',batches.reduce((n,b)=>n+b.position.length/9,0),'GLB bytes',28+json.length+bin.length);
