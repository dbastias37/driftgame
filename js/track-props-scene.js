import * as T from '../vendor/three.module.min.js';
export function buildTrackProps(track,world){
  const props=track.trackProps?.props||[];if(!props.length)return null;
  // One instanced draw: the dark tread and pale sidewall belong to each ring.
  const geo=new T.TorusGeometry(.30,.12,6,12);geo.rotateX(Math.PI/2);geo.scale(1,2/Math.sqrt(3),1);
  const positions=geo.getAttribute('position'),colors=new Float32Array(positions.count*3),dark=new T.Color(0x343b3d),sidewall=new T.Color(0x737972);
  for(let i=0;i<positions.count;i++){const color=Math.abs(positions.getY(i))>.09?sidewall:dark;color.toArray(colors,i*3);}geo.setAttribute('color',new T.BufferAttribute(colors,3));
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.97,flatShading:true});
  const mesh=new T.InstancedMesh(geo,material,props.length);mesh.name='stacked-track-tyres';mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);world.add(mesh);
  const pose=new T.Object3D();
  function update(recorded=null){const values=recorded||track.trackProps.props;
    for(let i=0;i<props.length;i++){const p=values[i];if(!p)continue;const tilt=Math.hypot(p.tiltX,p.tiltY),support=.12*Math.abs(Math.cos(tilt))+.42*Math.abs(Math.sin(tilt));pose.position.set(p.x,p.ground+p.z+support,p.y);pose.rotation.set(p.tiltX,p.heading||0,p.tiltY);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);}
    mesh.instanceMatrix.needsUpdate=true;
  }
  update();return {mesh,update};
}
