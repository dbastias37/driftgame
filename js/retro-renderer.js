import * as T from '../vendor/three.module.min.js';
import './game-options.js?v=1.0.0-prealpha.12';

// GPU geometry effects: screen-space fixed-point rounding and affine UVs.
// Clip-space Z/W stay intact, preserving the depth buffer and road overlays.
export const retroVertex=`
uniform vec2 retroResolution;
uniform float retroJitter;
varying float vRetroW;
varying vec2 vRetroMap;
`;
export const retroProject=`
#include <project_vertex>
if (retroJitter > 0.001 && gl_Position.w > 0.01) {
  vec2 grid = retroResolution / retroJitter;
  vec2 screen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  gl_Position.xy = (floor(screen * grid + 0.5) / grid * 2.0 - 1.0) * gl_Position.w;
}
vRetroW = gl_Position.w;
#ifdef USE_MAP
  vRetroMap = vMapUv * gl_Position.w;
#else
  vRetroMap = vec2(0.0);
#endif
`;
export const DITHER=[-4,0,-3,1,2,-2,3,-1,-3,1,-4,0,3,-1,2,-2];
export const levelsFor=bits=>bits===8?[7,7,3]:bits===16?[31,63,31]:bits===15?[31,31,31]:[255,255,255];
export function patchRetroShader(shader,uniforms){
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=retroVertex+shader.vertexShader.replace('#include <project_vertex>',retroProject);
  shader.fragmentShader='uniform float retroAffine; varying float vRetroW; varying vec2 vRetroMap;\n'+shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace(/vMapUv/g,'mix(vMapUv, vRetroMap / max(vRetroW, 0.0001), retroAffine)'));
}
export const postVertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
export const postFragment=`
uniform sampler2D sourceImage;
uniform vec2 sourceSize;
uniform vec3 colorLevels;
uniform float ditherAmount;
uniform float crtAmount;
uniform float toneMappingExposure;
varying vec2 vUv;
${T.ShaderChunk.tonemapping_pars_fragment.replace('uniform float toneMappingExposure;','')}
float pattern(vec2 p){
  float x=mod(floor(p.x),4.0),y=mod(floor(p.y),4.0);
  if(y<1.0)return x<1.0?-4.0:x<2.0?0.0:x<3.0?-3.0:1.0;
  if(y<2.0)return x<1.0?2.0:x<2.0?-2.0:x<3.0?3.0:-1.0;
  if(y<3.0)return x<1.0?-3.0:x<2.0?1.0:x<3.0?-4.0:0.0;
  return x<1.0?3.0:x<2.0?-1.0:x<3.0?2.0:-2.0;
}
void main(){
  vec2 centered=vUv*2.0-1.0;
  vec2 uv=(centered*(1.0+crtAmount*0.035*dot(centered,centered))+1.0)*0.5;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))){gl_FragColor=vec4(0.015,0.02,0.025,1.0);return;}
  vec3 color=ACESFilmicToneMapping(texture2D(sourceImage,uv).rgb);
  color=mix(color*12.92,1.055*pow(max(color,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),color));
  vec3 noise=vec3(pattern(uv*sourceSize)/8.0*ditherAmount)/colorLevels;
  color=floor(clamp(color+noise,0.0,1.0)*colorLevels+0.5)/colorLevels;
  gl_FragColor=vec4(color,1.0);
}`;

// Cache color tables and CRT sampling offsets; do not redo nonlinear math per pixel.
const pixelTables=new Map(),crtMaps=new Map();
export function processRetroPixels(data,w,h,options,scratch){
  const {bits,dither,crt}=options;if(bits===24&&!crt)return;
  const key=bits+':'+dither;let tables=pixelTables.get(key);
  if(!tables){const levels=levelsFor(bits);tables=Array.from({length:16},(_,p)=>levels.map(level=>Uint8Array.from({length:256},(_,v)=>Math.round(Math.max(0,Math.min(level,Math.floor(v/255*level+(bits===24?0:DITHER[p]/8*dither)+.5)))/level*255))));pixelTables.set(key,tables);if(pixelTables.size>12)pixelTables.delete(pixelTables.keys().next().value);}
  let map=null;if(crt){const key=w+':'+h+':'+crt;map=crtMaps.get(key);if(!map){map=new Int32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=(x+.5)/w*2-1,ny=(y+.5)/h*2-1,k=1+crt*.035*(nx*nx+ny*ny),sx=Math.floor((nx*k+1)*w*.5),sy=Math.floor((ny*k+1)*h*.5);map[y*w+x]=sx<0||sy<0||sx>=w||sy>=h?-1:(sy*w+sx)*4;}crtMaps.set(key,map);if(crtMaps.size>4)crtMaps.delete(crtMaps.keys().next().value);}scratch.set(data);}
  const source=crt?scratch:data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const pixel=y*w+x,i=pixel*4,from=map?map[pixel]:i;if(from<0){data[i]=4;data[i+1]=5;data[i+2]=6;continue;}const table=tables[(y%4)*4+x%4];data[i]=table[0][source[from]];data[i+1]=table[1][source[from+1]];data[i+2]=table[2][source[from+2]];}
}

export class RetroRenderer{
  constructor(renderer){
    this.renderer=renderer;this.materials=new WeakMap();this.options=DriftOptions.retro(DriftOptions.presets.clean);
    this.uniforms={retroResolution:{value:new T.Vector2(640,480)},retroJitter:{value:0},retroAffine:{value:0}};
    if(renderer.software)return;
    this.target=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
    this.post=new T.ShaderMaterial({vertexShader:postVertex,fragmentShader:postFragment,uniforms:{sourceImage:{value:this.target.texture},sourceSize:{value:new T.Vector2(1,1)},colorLevels:{value:new T.Vector3(255,255,255)},ditherAmount:{value:0},crtAmount:{value:0},toneMappingExposure:{value:1.25}},depthTest:false,depthWrite:false,toneMapped:false});
    this.scene=new T.Scene();this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.post);this.quad.frustumCulled=false;this.scene.add(this.quad);this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  }
  set(raw){if(raw===this.source)return;this.source=raw;this.options=DriftOptions.retro(raw||DriftOptions.presets.clean);this.renderer.setRetro?.(this.options);}
  setScale(scale){this.scale=scale;this.renderer.setRenderScale?.(scale);}
  prepare(scene){
    const o=this.options;
    scene.traverse(object=>{if(!object.isMesh||object.userData.retroSkip)return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material.isMeshBasicMaterial&&!material.isMeshStandardMaterial&&!material.isMeshPhongMaterial)continue;
        let state=this.materials.get(material);
        if(!state){state={flat:material.flatShading};this.materials.set(material,state);const previous=material.onBeforeCompile;material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);patchRetroShader(shader,this.uniforms);};material.customProgramCacheKey=()=> 'drift-retro-v1';material.needsUpdate=true;}
        const flat=o.flat||state.flat;if(material.flatShading!==flat){material.flatShading=flat;material.needsUpdate=true;}
      }
    });
  }
  render(scene,camera,width,height){
    const r=this.renderer,o=this.options;
    if(r.software){r.render(scene,camera);return;}
    const enabled=o.resolution||o.jitter||o.affine||o.bits!==24||o.crt||o.flat;
    const h=Math.max(1,Math.round((o.resolution?Math.min(o.resolution,height*(r.getPixelRatio?.()||1)):height*(r.getPixelRatio?.()||1))*(this.scale||1))),w=Math.max(1,Math.round(h*width/height));
    this.uniforms.retroResolution.value.set(w,h);this.uniforms.retroJitter.value=o.jitter;this.uniforms.retroAffine.value=o.affine;this.prepare(scene);
    if(!enabled){r.render(scene,camera);return;}
    if(this.target.width!==w||this.target.height!==h)this.target.setSize(w,h);
    this.post.uniforms.sourceSize.value.set(w,h);this.post.uniforms.colorLevels.value.set(...levelsFor(o.bits));this.post.uniforms.ditherAmount.value=o.bits===24?0:o.dither;this.post.uniforms.crtAmount.value=o.crt;this.post.uniforms.toneMappingExposure.value=r.toneMappingExposure;
    const target=r.getRenderTarget();r.setRenderTarget(this.target);r.render(scene,camera);r.setRenderTarget(target);r.render(this.scene,this.camera);
  }
  dispose(){this.target?.dispose();this.post?.dispose();this.quad?.geometry.dispose();}
}
