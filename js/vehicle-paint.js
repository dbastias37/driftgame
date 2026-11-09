import * as T from '../vendor/three.module.min.js';

// Masks follow the supplied atlases. Wheels, glass, badges, lights and decals
// retain their source pixels; black paint needs replacement, not multiplication.
export function paintPixel(skin,name,u,v,r,g,b){
  if(skin==='gray')return name==='Material_Nova'&&u<.512&&v<.395;
  if(skin==='blue')return ['Chassis','Hood','Trunkl','Right Door','Left Door','Front Bumper','Back Bumper','Stock Spoiler'].includes(name)&&b>45&&b>r*1.2&&b>g*1.08;
  if(skin==='yellow')return name==='material_1'&&r>130&&g>95&&b<g*.65;
  if(skin==='yugo')return ((u<.5&&v<.4375)||(u>=.5&&u<.75&&v<.25))&&r>90&&r>g*1.6&&r>b*1.6;
  if(skin==='fujiwara')return name==='material_1'&&v<.51&&((u<.14&&v<.33)||(u>.28&&u<.64&&v<.12)||(u>.28&&u<.64&&v>.28&&v<.41))&&Math.min(r,g,b)>150&&Math.max(r,g,b)-Math.min(r,g,b)<38;
  return false;
}
export function recolorPixels(data,skin,name,color,width,height){
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));let changed=0;
  for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],pixel=i/4;
    if(!paintPixel(skin,name,(pixel%width)/width,Math.floor(pixel/width)/height,r,g,b))continue;
    const value=Math.max(r,g,b),shade=skin==='gray'?.78+value/255*.22:clamp(value/(skin==='blue'?180:240),.35,1.1);
    for(let c=0;c<3;c++)data[i+c]=Math.min(255,Math.round(rgb[c]*shade));changed++;
  }
  return changed;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function applyVehiclePaint(model,skin,color){
  color=/^#[0-9a-f]{6}$/i.test(color||'')?color.toLowerCase():null;
  if(model.paintColor===undefined&&color===null){model.paintColor=null;return;}
  if(model.paintColor===color)return;model.paintColor=color;
  if(!model.paintSlots){
    model.paintSlots=[];const copies=new Map();
    model.body.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const original=mesh.material;
      if(!copies.has(original)){
        const material=original.clone();
        // Three clones userData through JSON: Color.toJSON becomes a number.
        // Atmosphere needs an actual Color to preserve the atlas modulation.
        material.userData.originalColor=(original.userData.originalColor?.isColor?original.userData.originalColor:original.color).clone();copies.set(original,material);
        model.paintSlots.push({material,original,source:original.map,generated:null});
      }
      mesh.material=copies.get(original);
    });
    // Keep lamp references synchronized with the independently owned body material.
    if(model.lampMaterials)for(const role of ['front','rear'])model.lampMaterials[role]=model.lampMaterials[role].map(m=>copies.get(m)||m);
  }
  for(const slot of model.paintSlots){
    slot.generated?.dispose();slot.generated=null;slot.material.map=slot.source;slot.material.color.copy(slot.original.userData.originalColor?.isColor?slot.original.userData.originalColor:slot.original.color);
    if(color){
      if(!slot.source){if(slot.material.name==='body-paint')slot.material.color.set(color);}
      else{
        const image=slot.source.image;
        if(image?.getContext){
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
          if(recolorPixels(pixels.data,skin,slot.material.name,color,canvas.width,canvas.height)){
            ctx.putImageData(pixels,0,0);slot.generated=slot.source.clone();slot.generated.image=canvas;slot.generated.needsUpdate=true;slot.material.map=slot.generated;
          }
        }
      }
    }
    slot.material.userData.originalColor.copy(slot.material.color);slot.material.needsUpdate=true;
  }
}
export function disposePaint(model){
  if(!model?.paintSlots)return;
  for(const s of model.paintSlots){s.generated?.dispose();s.material.dispose();}
  model.body.traverse(mesh=>{if(mesh.isMesh){const slot=model.paintSlots.find(s=>s.material===mesh.material);if(slot)mesh.material=slot.original;}});
  model.paintSlots=null;
}
