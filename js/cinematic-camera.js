// Camera directions depend only on the recorded pose/time and the road.
// Drone arcs are bounded; trackside cameras keep their world position per shot.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Use a continuous road chord, not the nearest vertex tangent. The latter
// jumps at every segment boundary and becomes visible as drone yaw vibration.
const paths=new WeakMap();
function roadHeading(track,p,sample){
  let data=paths.get(track);
  if(!data){const points=track.points,ends=[],lengths=[];let total=0;for(let i=0;i<points.length-(track.open?1:0);i++){ends.push(total);const b=points[(i+1)%points.length],a=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);lengths.push(len);total+=len;}data={points,ends,lengths,total};paths.set(track,data);}
  const {points,ends,lengths,total}=data;let best=Infinity,s=0;
  for(let offset=-2;offset<=2;offset++){const raw=sample.i+offset,i=track.open?clamp(raw,0,lengths.length-1):(raw+lengths.length)%lengths.length,a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(lengths[i]**2||1),0,1),dist=(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;if(dist<best){best=dist;s=ends[i]+lengths[i]*t;}}
  function at(distance){distance=track.open?clamp(distance,0,total):((distance%total)+total)%total;let lo=0,hi=ends.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(ends[mid]<=distance)lo=mid;else hi=mid-1;}const a=points[lo],b=points[(lo+1)%points.length],t=clamp((distance-ends[lo])/(lengths[lo]||1),0,1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  const a=at(s-12),b=at(s+20);return Math.atan2(b.y-a.y,b.x-a.x);
}
export class CinematicDirector{
  reset(){this.key=null;this.fixed=null;}
  constructor(){this.reset();}
  update({track,player,time=0,mode='drone',anchor=player,reduced=false}){
    const shot=Math.floor(time/7),sequence=['drone','trackside','isometric','drone','trackside','drone'];
    let kind=reduced?'isometric':mode==='cinematic'?sequence[shot%sequence.length]:mode;
    let key=kind==='trackside'?kind+':'+shot:kind;
    const p=player.pos,speed=player.worldSpeed(),q=track.sample(p.x,p.y),yaw=roadHeading(track,p,q);
    const h=player.descent?.motion==='falling'?player.descent.y:(player.ride?.height||0),f={x:Math.cos(yaw),z:Math.sin(yaw)},n={x:-f.z,z:f.x};
    let position,target={x:p.x,y:h+.7,z:p.y},fov=48;
    if(kind==='trackside'){
      if(this.fixed?.key!==key){
        const start=track.sample(anchor.pos.x,anchor.pos.y).i,limit=Math.min(track.points.length-1,Math.ceil(75/3));let best=start,bend=0,turn=0;
        for(let j=4;j<=limit;j+=2){const idx=track.open?Math.min(track.points.length-2,start+j):(start+j)%track.points.length,a=track.tangentAt(idx-3),b=track.tangentAt(idx+3),v=Math.atan2(Math.sin(b-a),Math.cos(b-a));if(Math.abs(v)>bend){bend=Math.abs(v);best=idx;turn=v;}}
        const point=track.point(best),normal=track.normalAt(best),side=turn>=0?-1:1,offset=(track.roadHalf+14)*side,x=point.x+normal.x*offset,z=point.y+normal.y*offset;
        this.fixed={key,position:{x,y:Math.max(point.h||0,track.downhill?track.terrainHeight(x,z):0)+4.8,z}};
      }
      position={...this.fixed.position};const distance=Math.hypot(position.x-p.x,position.z-p.y);fov=clamp(35+distance*.17,38,66);
      // A fixed camera holds its position, then hands off before the car is
      // swallowed by distance fog on fast straights.
      if(distance>125){kind='isometric';key='isometric:handoff:'+shot;position={x:p.x-25,y:h+34,z:p.y+27};fov=48;}
    }else if(kind==='isometric'){
      position={x:p.x-25,y:h+34,z:p.y+27};target={x:p.x+f.x*3,y:h+.6,z:p.y+f.z*3};fov=48;
    }else{
      const arc=Math.sin(time*.19)*.68,back=27+Math.min(12,speed*.25),side=Math.sin(time*.11+.7)*19;
      position={x:p.x-f.x*back*Math.cos(arc)+n.x*side,y:h+21+Math.sin(time*.15)*4+Math.min(5,speed*.1),z:p.y-f.z*back*Math.cos(arc)+n.z*side};
      target={x:p.x+f.x*(6+speed*.12),y:h+1,z:p.y+f.z*(6+speed*.12)};fov=49;
    }
    if(track.downhill)position.y=Math.max(position.y,track.terrainHeight(position.x,position.z)+3);
    const cut=this.key!==null&&key!==this.key;this.key=key;
    return {position,target,fov,kind,key,cut};
  }
}
