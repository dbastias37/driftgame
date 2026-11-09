import * as T from '../vendor/three.module.min.js';
import {patchRetroShader,postFragment} from '../js/retro-renderer.js';
import fs from 'node:fs';
const dir=process.argv[2];if(!dir)throw new Error('Specify an output directory');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/retro-post.frag','#version 330\n#define varying in\n#define texture2D texture\nout vec4 fragColor;\n#define gl_FragColor fragColor\n'+postFragment);
const expand=s=>s.replace(/#include <(\w+)>/g,(_,name)=>expand(T.ShaderChunk[name]));
for(const kind of ['basic','standard'])for(const mode of ['plain','map','instanced','fog']){
 const shader={...T.ShaderLib[kind],uniforms:{}};patchRetroShader(shader,{});
 let defines=`\n#define SHADER_TYPE Mesh${kind}\n#define HIGH_PRECISION\n#define OPAQUE\n#define NUM_CLIPPING_PLANES 0\n#define UNION_CLIPPING_PLANES 0\n#define NUM_DIR_LIGHTS 0\n#define NUM_SPOT_LIGHTS 0\n#define NUM_RECT_AREA_LIGHTS 0\n#define NUM_POINT_LIGHTS 0\n#define NUM_HEMI_LIGHTS 0\n#define NUM_DIR_LIGHT_SHADOWS 0\n#define NUM_SPOT_LIGHT_SHADOWS 0\n#define NUM_POINT_LIGHT_SHADOWS 0\n#define NUM_SPOT_LIGHT_MAPS 0\n#define NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS 0\n`;
 if(mode!=='plain')defines+='\n#define USE_MAP\n#define MAP_UV uv\n';
 if(mode==='fog')defines+='\n#define USE_FOG\n';
 if(mode==='instanced')defines+='\n#define USE_INSTANCING\n#define FLAT_SHADED\n';
 const v='#version 330\n#define attribute in\n#define varying out\n'+defines+'uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;in vec3 position,normal;in vec2 uv;\n'+(mode==='instanced'?'in mat4 instanceMatrix;\n':'')+expand(shader.vertexShader);
 const f='#version 330\n#define varying in\n#define texture2D texture\n#define textureCube texture\nout vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n'+defines+'uniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;\nvec4 linearToOutputTexel(vec4 value){return value;}\n'+expand(shader.fragmentShader);
 fs.writeFileSync(`${dir}/retro-${kind}-${mode}.vert`,v);fs.writeFileSync(`${dir}/retro-${kind}-${mode}.frag`,f);
}
