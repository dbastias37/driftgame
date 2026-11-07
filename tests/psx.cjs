const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('PSX presentation module remains independent from simulation',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../js/psx-renderer.js'),'utf8');
 assert.match(src,/export class PSXRenderer/);
 assert.match(src,/WebGLRenderTarget/);
 assert.match(src,/NearestFilter/);
 assert.match(src,/psxJitter/);
 assert.match(src,/psxAffine/);
 assert.match(src,/bayer\(/);
 assert.doesNotMatch(src,/\.velocity\s*=|\.pos\s*=|\.collision\s*=/);
});
test('PSX options and modern fallback are wired',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const experience=fs.readFileSync(path.join(__dirname,'../js/experience.js'),'utf8');
 const view=fs.readFileSync(path.join(__dirname,'../js/view3d.js'),'utf8');
 for(const id of ['psxStyle','psxResolution','psxJitter','psxAffine','psxDither','psxFog','psxFlat'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(experience,/setPSXSettings\(renderPrefs\.psx\)/);
 assert.match(view,/this\.psx\.render\(w,h\)/);
 assert.match(view,/this\.renderer\.render\(this\.scene,this\.camera\)/);
});
test('vertex snapping and affine UV implemented in shader, not on physics bodies',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../js/psx-renderer.js'),'utf8');
 assert.match(src,/gl_Position\.xy=/);
 assert.match(src,/psxAffineUV=vMapUv\*gl_Position\.w/);
 assert.match(src,/psxAffineUV \/ max\(abs\(psxAffineW\)/);
});

test('wide terrain and road materials exclude PSX vertex displacement',()=>{
 const renderer=fs.readFileSync(path.join(__dirname,'../js/psx-renderer.js'),'utf8');
 const view=fs.readFileSync(path.join(__dirname,'../js/view3d.js'),'utf8');
 const mountain=fs.readFileSync(path.join(__dirname,'../js/mountain-scene.js'),'utf8');
 assert.match(renderer,/protectedSurface\?0:self\.settings\.jitter/);
 assert.match(renderer,/stable\?0:this\.settings\.jitter/);
 assert.match(view,/ground\.material\.userData\.psxProtectedSurface=true/);
 assert.match(view,/Object\.values\(materials\)/);
 assert.match(mountain,/material\.userData\.psxProtectedSurface=true/);
});
test('retro output gains 15 percent resolution without changing original/HUD',()=>{
 const renderer=fs.readFileSync(path.join(__dirname,'../js/psx-renderer.js'),'utf8');
 assert.match(renderer,/1\.15\*Math\.min\(rw\/w,rh\/h\)/);
 assert.match(renderer,/resolution==='original'/);
 assert.match(renderer,/this\.renderer\.render\(this\.postScene,this\.postCamera\)/);
});
