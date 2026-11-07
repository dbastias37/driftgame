import * as T from '../vendor/three.module.min.js';

// PSX emulation: presentation only. No physics, transform or collision mutations.
const PRESETS={
  modern:{resolution:'original',jitter:0,affine:0,dither:0,colors:32,fog:1,flat:false},
  soft:{resolution:'640x480',jitter:.3,affine:.28,dither:.28,colors:32,fog:.85,flat:false},
  authentic:{resolution:'320x240',jitter:1,affine:.7,dither:.65,colors:32,fog:.65,flat:true},
  extreme:{resolution:'320x240',jitter:1.65,affine:1,dither:1,colors:16,fog:.48,flat:true}
};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const PSX_PRESETS=Object.freeze(Object.keys(PRESETS));
export function resolvePSXConfig(source={}){
  const style=Object.hasOwn(PRESETS,source.style)?source.style:'authentic';
  const p=PRESETS[style];
  return {
    style,
    resolution:['original','320x240','426x240','640x480'].includes(source.resolution)?source.resolution:p.resolution,
    jitter:clamp(Number(source.jitter??p.jitter)||0,0,2),
    affine:clamp(Number(source.affine??p.affine)||0,0,1),
    dither:clamp(Number(source.dither??p.dither)||0,0,1),
    colors:[16,32,64].includes(Number(source.colors))?Number(source.colors):p.colors,
    fog:clamp(Number(source.fog??p.fog)||0,.25,1.25),
    flat:source.flat===undefined?p.flat:!!source.flat
  };
}
const fullscreenVertex=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`;
const fullscreenFragment=`
precision mediump float;
uniform sampler2D tDiffuse;
uniform float ditherStrength;
uniform float colorLevels;
uniform vec2 outputResolution;
varying vec2 vUv;
float bayer(vec2 p) {
  vec2 q=mod(floor(p),4.0);
  float a[16];
  a[0]=0.;a[1]=8.;a[2]=2.;a[3]=10.;
  a[4]=12.;a[5]=4.;a[6]=14.;a[7]=6.;
  a[8]=3.;a[9]=11.;a[10]=1.;a[11]=9.;
  a[12]=15.;a[13]=7.;a[14]=13.;a[15]=5.;
  int index=int(q.y)*4+int(q.x);
  for(int i=0;i<16;i++){if(i==index)return a[i]/16.;}
  return 0.5;
}
void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  float threshold=bayer(gl_FragCoord.xy)-.5;
  vec3 d=vec3(threshold*ditherStrength/max(2.,colorLevels-1.));
  c.rgb=mix(c.rgb,clamp(floor(clamp(c.rgb+d,0.,1.)*(colorLevels-1.)+.5)/(colorLevels-1.),0.,1.),ditherStrength);
  gl_FragColor=c;
}
`;

// Hook into the compiled shaders rather than moving vertices on the CPU.
// The hardware rasterizer quantizes projected vertex coordinates; affine UVs
// are restored from homogeneous varyings, undoing perspective interpolation.
export class PSXRenderer{
  constructor(renderer,scene,camera,config={}){
    this.renderer=renderer;this.scene=scene;this.camera=camera;
    this.materials=new Map();this.textures=new Map();
    this.grid=new T.Vector2(320,240);
    this.settings=resolvePSXConfig(config);
    this.postScene=new T.Scene();
    this.postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.postMaterial=new T.ShaderMaterial({
      uniforms:{tDiffuse:{value:null},ditherStrength:{value:0},colorLevels:{value:32},outputResolution:{value:new T.Vector2(320,240)}},
      vertexShader:fullscreenVertex,fragmentShader:fullscreenFragment,
      depthTest:false,depthWrite:false,toneMapped:false
    });
    this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.postMaterial);
    this.postScene.add(this.quad);
    this.target=null;this.sizeKey='';
    this.originalFog=null;this.fogSnapshot=null;
  }
  setConfig(config={}){
    const old=this.settings;
    this.settings=resolvePSXConfig(config);
    if(this.settings.style==='modern')this.restoreTextures();
    if(old.style!==this.settings.style || old.flat!==this.settings.flat || old.affine!==this.settings.affine){
      this.restoreMaterials();
    }
    if(old.resolution!==this.settings.resolution)this.sizeKey='';
  }
  dimensions(w,h){
    const resolution=this.settings.resolution;
    if(resolution==='original')return [Math.max(1,Math.round(w*(this.renderer.getPixelRatio?.()||1))),Math.max(1,Math.round(h*(this.renderer.getPixelRatio?.()||1)))];
    const [rw,rh]=resolution.split('x').map(Number);
    // Respect the viewport aspect ratio, never crop the camera projection.
    const density=Math.min(rw/w,rh/h);
    return [Math.max(1,Math.round(w*density)),Math.max(1,Math.round(h*density))];
  }
  ensureTarget(w,h){
    const [rw,rh]=this.dimensions(w,h),key=rw+'x'+rh;
    this.grid.set(rw,rh);
    if(this.sizeKey===key&&this.target)return;
    this.target?.dispose();
    this.target=new T.WebGLRenderTarget(rw,rh,{
      magFilter:T.NearestFilter,minFilter:T.NearestFilter,
      format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false,samples:0
    });
    this.target.texture.generateMipmaps=false;
    this.sizeKey=key;
  }
  prepareMaterial(material){
    if(!material||this.materials.has(material)||material.isShaderMaterial||material.isRawShaderMaterial||material.isSpriteMaterial)return;
    const original={onBeforeCompile:material.onBeforeCompile,customProgramCacheKey:material.customProgramCacheKey,flatShading:material.flatShading};
    this.materials.set(material,original);
    material.flatShading=!!this.settings.flat && (material.isMeshStandardMaterial||material.isMeshLambertMaterial||material.isMeshPhongMaterial);
    const self=this;
    material.onBeforeCompile=function(shader,renderer){
      if(original.onBeforeCompile)original.onBeforeCompile.call(this,shader,renderer);
      shader.uniforms.psxGrid={value:self.grid};
      shader.uniforms.psxJitter={value:self.settings.jitter};
      shader.uniforms.psxAffine={value:self.settings.affine};
      shader.vertexShader='uniform vec2 psxGrid; uniform float psxJitter; uniform float psxAffine;\n#ifdef USE_MAP\nvarying vec2 psxAffineUV; varying float psxAffineW;\n#endif\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nif(psxJitter>0.0 && gl_Position.w>0.0){ vec2 ndc=gl_Position.xy/gl_Position.w; vec2 stepSize=vec2(2.0)/max(psxGrid,vec2(1.0)); vec2 snapped=floor(ndc/stepSize+0.5)*stepSize; gl_Position.xy=mix(ndc,snapped,min(psxJitter,1.0))*gl_Position.w; if(psxJitter>1.0)gl_Position.xy+=(snapped-ndc)*(psxJitter-1.0)*gl_Position.w;}\n#ifdef USE_MAP\npsxAffineUV=vMapUv*gl_Position.w; psxAffineW=gl_Position.w;\n#endif');
      shader.fragmentShader='uniform float psxAffine;\n#ifdef USE_MAP\nvarying vec2 psxAffineUV; varying float psxAffineW;\n#endif\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
vec2 psxWarpUV = mix(vMapUv, psxAffineUV / max(abs(psxAffineW), 0.00001), psxAffine);
vec4 sampledDiffuseColor = texture2D(map, psxWarpUV);
#ifdef DECODE_VIDEO_TEXTURE
sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
#endif
diffuseColor *= sampledDiffuseColor;
#endif`);
      this.userData.psxShader=shader;
    };
    material.customProgramCacheKey=function(){return String(original.customProgramCacheKey?.call(this)||'')+'|psx-v2';};
    material.needsUpdate=true;
  }
  prepareScene(){
    const active=new Set();
    this.scene.traverseVisible(obj=>{
      if(!obj.isMesh&&!obj.isPoints&&!obj.isLine)return;
      for(const m of Array.isArray(obj.material)?obj.material:[obj.material]){
        if(!m)continue;active.add(m);
        this.prepareMaterial(m);
        const s=m.userData?.psxShader;
        if(s){s.uniforms.psxJitter.value=this.settings.jitter;s.uniforms.psxAffine.value=this.settings.affine;}
        const map=m.map;
        if(map&&this.settings.style!=='modern'){
          if(!this.textures.has(map))this.textures.set(map,{minFilter:map.minFilter,magFilter:map.magFilter,anisotropy:map.anisotropy,generateMipmaps:map.generateMipmaps});
          map.magFilter=T.NearestFilter;
          map.minFilter=T.NearestMipmapNearestFilter;
          if(map.anisotropy!==1||map.magFilter!==T.NearestFilter||map.minFilter!==T.NearestMipmapNearestFilter){map.anisotropy=1;map.needsUpdate=true;}
        }
      }
    });
    // Dispose shader hooks of meshes removed when switching cars or tracks.
    for(const [m,orig] of this.materials)if(!active.has(m)){m.onBeforeCompile=orig.onBeforeCompile;m.customProgramCacheKey=orig.customProgramCacheKey;m.flatShading=orig.flatShading;this.materials.delete(m);}
  }
  applyFog(){
    if(this.settings.style==='modern'||!this.scene.fog)return;
    const fog=this.scene.fog;
    this.fogSnapshot={fog,near:fog.near,far:fog.far};
    const range=fog.far-fog.near;
    fog.near=Math.max(8,fog.near*this.settings.fog);
    fog.far=Math.max(fog.near+40,fog.near+range*this.settings.fog);
  }
  restoreFog(){
    if(!this.fogSnapshot)return;
    const {fog,near,far}=this.fogSnapshot;fog.near=near;fog.far=far;this.fogSnapshot=null;
  }
  render(w,h){
    if(this.settings.style==='modern'){
      this.restoreMaterials();this.restoreTextures();
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene,this.camera);
      return;
    }
    this.ensureTarget(w,h);
    this.prepareScene();
    this.applyFog();
    try{
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(this.scene,this.camera);
    }finally{
      this.restoreFog();
      this.renderer.setRenderTarget(null);
    }
    this.postMaterial.uniforms.tDiffuse.value=this.target.texture;
    this.postMaterial.uniforms.ditherStrength.value=this.settings.dither;
    this.postMaterial.uniforms.colorLevels.value=this.settings.colors;
    this.postMaterial.uniforms.outputResolution.value.copy(this.grid);
    this.renderer.render(this.postScene,this.postCamera);
  }
  restoreMaterials(){
    for(const [m,orig] of this.materials){m.onBeforeCompile=orig.onBeforeCompile;m.customProgramCacheKey=orig.customProgramCacheKey;m.flatShading=orig.flatShading;m.needsUpdate=true;delete m.userData.psxShader;}
    this.materials.clear();
  }
  restoreTextures(){
    for(const [t,p] of this.textures){Object.assign(t,p);t.needsUpdate=true;}
    this.textures.clear();
  }
  dispose(){
    this.restoreFog();this.restoreMaterials();this.restoreTextures();
    this.target?.dispose();this.quad.geometry.dispose();this.postMaterial.dispose();
  }
}
