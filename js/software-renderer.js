import * as T from '../vendor/three.module.min.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// A depth-buffered CPU fallback for devices without WebGL. It projects exactly
// the same scene and camera; it has no access to the driving simulation.
export class SoftwareRenderer{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas rendering unavailable');this.software=true;this.textureCache=new WeakMap();this.sun=new T.Vector3(-.5,.8,.3).normalize();}
  setPixelRatio(){}
  setSize(w,h){const s=Math.min(1,640/w,420/h);this.w=Math.round(w*s);this.h=Math.round(h*s);this.canvas.width=this.w;this.canvas.height=this.h;this.frame=this.ctx.createImageData(this.w,this.h);this.depth=new Float32Array(this.w*this.h);}
  dispose(){this.frame=null;this.depth=null;}
  render(scene,camera){
    scene.updateMatrixWorld();camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const w=this.w,h=this.h,pixels=this.frame.data,zbuffer=this.depth;zbuffer.fill(0);
    const background=scene.background?.isColor?scene.background.clone().convertLinearToSRGB():null;
    for(let i=0;i<pixels.length;i+=4){pixels[i]=background?Math.round(background.r*255):0;pixels[i+1]=background?Math.round(background.g*255):0;pixels[i+2]=background?Math.round(background.b*255):0;pixels[i+3]=background?255:0;}
    const projectionView=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),frustum=new T.Frustum().setFromProjectionMatrix(projectionView),sphere=new T.Sphere();
    const transparent=[],view=new T.Matrix4(),instance=new T.Matrix4(),model=new T.Matrix4(),normalMatrix=new T.Matrix3();
    const project=v=>{const p=v.clone().applyMatrix4(camera.projectionMatrix);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,z:1/-v.z,u:(v.u||0)/-v.z,v:(v.v||0)/-v.z};};
    const clip=vertices=>{const out=[];for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],ina=a.z<=-.2,inb=b.z<=-.2;if(ina)out.push(a);if(ina!==inb){const t=(-.2-a.z)/(b.z-a.z),p=a.clone().lerp(b,t);p.u=a.u+(b.u-a.u)*t;p.v=a.v+(b.v-a.v)*t;out.push(p);}}return out;};
    const raster=(a,b,c,rgb,alpha,write,tex,alphaTest)=>{
      const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<.02)return;
      const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      const ax=(b.y-c.y)/area,ay=(c.x-b.x)/area,bx=(c.y-a.y)/area,by=(a.x-c.x)/area;
      const ac=((b.x*c.y-c.x*b.y)/area),bc=((c.x*a.y-a.x*c.y)/area),opaque=alpha>=.999;
      for(let y=minY;y<=maxY;y++){
        const sy=y+.5,xs=[];for(const [p,q] of [[a,b],[b,c],[c,a]]){if(sy>=Math.min(p.y,q.y)&&sy<Math.max(p.y,q.y))xs.push(p.x+(sy-p.y)*(q.x-p.x)/(q.y-p.y));}
        if(xs.length<2)continue;const rowMin=Math.max(minX,Math.floor(Math.min(...xs))),rowMax=Math.min(maxX,Math.ceil(Math.max(...xs)));
        let wa=ax*(rowMin+.5)+ay*sy+ac,wb=bx*(rowMin+.5)+by*sy+bc;
        for(let x=rowMin;x<=rowMax;x++,wa+=ax,wb+=bx){const wc=1-wa-wb;if(wa<-.00001||wb<-.00001||wc<-.00001)continue;const z=wa*a.z+wb*b.z+wc*c.z,index=y*w+x;if(z<zbuffer[index]-1e-7)continue;const k=index*4;
          let red=rgb[0],green=rgb[1],blue=rgb[2],opacity=alpha;
          if(tex){
            let u=(wa*a.u+wb*b.u+wc*c.u)/z,v=(wa*a.v+wb*b.v+wc*c.v)/z;
            u=tex.repeat?((u%1)+1)%1:clamp(u,0,.9999);v=tex.repeat?((v%1)+1)%1:clamp(v,0,.9999);
            const row=tex.flipY?1-v:v,ti=(Math.min(tex.h-1,Math.floor(row*tex.h))*tex.w+Math.min(tex.w-1,Math.floor(u*tex.w)))*4;
            const mask=tex.data[ti+3]/255;if(mask*alpha<alphaTest||mask===0)continue;
            red*=tex.data[ti]/255;green*=tex.data[ti+1]/255;blue*=tex.data[ti+2]/255;
            if(!opaque)opacity*=mask;
          }
          pixels[k]=pixels[k]*(1-opacity)+red*opacity;pixels[k+1]=pixels[k+1]*(1-opacity)+green*opacity;pixels[k+2]=pixels[k+2]*(1-opacity)+blue*opacity;pixels[k+3]=Math.round(pixels[k+3]+(255-pixels[k+3])*opacity);
          if(write)zbuffer[index]=z;
        }
      }
    };
    const drawMesh=(obj,matrix)=>{
      const geo=obj.geometry,pos=geo.attributes.position,idx=geo.index,material=Array.isArray(obj.material)?obj.material[0]:obj.material;if(!pos||!material||material.opacity===0)return;
      if(!geo.boundingSphere)geo.computeBoundingSphere();sphere.copy(geo.boundingSphere).applyMatrix4(matrix);if(!frustum.intersectsSphere(sphere))return;
      view.multiplyMatrices(camera.matrixWorldInverse,matrix);normalMatrix.getNormalMatrix(matrix);
      const count=Math.min(idx?idx.count:pos.count,geo.drawRange.count),start=geo.drawRange.start||0,col=material.color.clone().convertLinearToSRGB();
      const uv=geo.attributes.uv;let tex=null;if(material.map?.image?.getContext){if(!this.textureCache.has(material.map)){const image=material.map.image;this.textureCache.set(material.map,{w:image.width,h:image.height,data:image.getContext('2d').getImageData(0,0,image.width,image.height).data,repeat:material.map.wrapS===T.RepeatWrapping,flipY:material.map.flipY!==false});}tex=this.textureCache.get(material.map);}
      const vertices=Array.from({length:pos.count},(_,i)=>{const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(view);v.u=uv?uv.getX(i):0;v.v=uv?uv.getY(i):0;return v;});
      for(let k=start;k<start+count;k+=3){
        const vi=[0,1,2].map(n=>idx?idx.getX(k+n):k+n);if(vi.some(i=>i>=pos.count))break;
        let v=vi.map(i=>vertices[i]);if(v.every(p=>p.z>-.2)||v.every(p=>p.z< -camera.far))continue;
        const normal=new T.Vector3().fromBufferAttribute(pos,vi[1]).sub(new T.Vector3().fromBufferAttribute(pos,vi[0])).cross(new T.Vector3().fromBufferAttribute(pos,vi[2]).sub(new T.Vector3().fromBufferAttribute(pos,vi[0]))).normalize().applyMatrix3(normalMatrix).normalize();
        const depth=-(v[0].z+v[1].z+v[2].z)/3;v=clip(v);if(v.length<3)continue;const pts=v.map(project);
        if(pts.every(p=>p.x<0)||pts.every(p=>p.x>w)||pts.every(p=>p.y<0)||pts.every(p=>p.y>h))continue;
        const area=(pts[1].x-pts[0].x)*(pts[2].y-pts[0].y)-(pts[1].y-pts[0].y)*(pts[2].x-pts[0].x);if(material.side!==T.DoubleSide&&area>0)continue;
        let light=material.isMeshBasicMaterial?1:.72+.32*Math.max(0,normal.dot(this.sun));if(material.emissive)light+=material.emissiveIntensity*.12;
        const fog=scene.fog?clamp((depth-scene.fog.near)/(scene.fog.far-scene.fog.near),0,1):0,fogColor=scene.fog?.color.clone().convertLinearToSRGB();
        const rgb=[col.r,col.g,col.b].map((c,i)=>Math.round(255*(clamp(c*light,0,1)*(1-fog)+(fogColor?[fogColor.r,fogColor.g,fogColor.b][i]:0)*fog)));
        for(let i=1;i<pts.length-1;i++){const args=[pts[0],pts[i],pts[i+1],rgb,material.opacity,material.depthWrite,tex,material.alphaTest||0];if(material.transparent)transparent.push({args,depth});else raster(...args);}
      }
    };
    scene.traverseVisible(obj=>{if(!obj.isMesh)return;if(obj.isInstancedMesh){for(let i=0;i<obj.count;i++){obj.getMatrixAt(i,instance);model.multiplyMatrices(obj.matrixWorld,instance);drawMesh(obj,model);}}else drawMesh(obj,obj.matrixWorld);});
    transparent.sort((a,b)=>b.depth-a.depth).forEach(f=>raster(...f.args));this.ctx.putImageData(this.frame,0,0);
  }
}
