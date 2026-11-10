import * as T from '../vendor/three.module.min.js';
export function buildTrackProps(track,world){
  const props=track.trackProps?.props||[];if(!props.length)return null;
  const geo=new T.TorusGeometry(.30,.12,6,16);geo.rotateX(Math.PI/2);
  const material=new T.MeshStandardMaterial({color:0x3a4142,roughness:.97,flatShading:true});
  const mesh=new T.InstancedMesh(geo,material,props.length);mesh.name='loose-track-tyres';mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);world.add(mesh);
  const stripes=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0x7c8071,roughness:.9,flatShading:true}),props.length);stripes.name='tyre-sidewall';stripes.frustumCulled=false;stripes.instanceMatrix.setUsage(T.DynamicDrawUsage);world.add(stripes);
  const pose=new T.Object3D();
  function update(recorded=null){const values=recorded||track.trackProps.props;
    for(let i=0;i<props.length;i++){const p=values[i];if(!p)continue;const tilt=Math.hypot(p.tiltX,p.tiltY),support=.12*Math.abs(Math.cos(tilt))+.42*Math.abs(Math.sin(tilt));pose.position.set(p.x,p.ground+p.z+support,p.y);pose.rotation.set(p.tiltX,p.heading||0,p.tiltY);pose.scale.set(1,1,1);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);pose.scale.set(.91,.83,.91);pose.updateMatrix();stripes.setMatrixAt(i,pose.matrix);}
    mesh.instanceMatrix.needsUpdate=true;stripes.instanceMatrix.needsUpdate=true;
  }
  update();return {mesh,stripes,update};
}
