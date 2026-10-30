/* Preloaded exhibition replay: three authored racing lines, sampled once.
 * No live Car, score, saved preference or online connection is touched. */
globalThis.DriftAttract=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=(v,n)=>(v%n+n)%n;
  const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const cubic=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  class Demo{
    constructor(track,{day=0}={}){
      this.track=track;this.day=day;this.time=0;this.paused=false;this.effectTime=-Infinity;
      const points=track.points,N=points.length,dist=[0],times=[0];
      for(let i=0;i<N;i++){const a=points[i],b=points[(i+1)%N];dist.push(dist.at(-1)+Math.hypot(b.x-a.x,b.y-a.y));}
      this.length=dist.at(-1);
      const segment=(table,value)=>{let lo=0,hi=N-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(table[mid]<=value)lo=mid;else hi=mid-1;}return lo;};
      const path=s=>{s=wrap(s,this.length);const i=segment(dist,s),t=(s-dist[i])/(dist[i+1]-dist[i]),p=[-1,0,1,2].map(j=>points[wrap(i+j,N)]);return {x:cubic(...p.map(q=>q.x),t),y:cubic(...p.map(q=>q.y),t)};};
      const heading=s=>{const a=path(s-.6),b=path(s+.6);return Math.atan2(b.y-a.y,b.x-a.x);};
      let best=1,bend=0;
      for(let i=0;i<N;i++){
        const curve=angle(heading(dist[i]-8),heading(dist[i]+8))/16,speed=clamp(35-Math.abs(curve)*260,20,35);
        times.push(times.at(-1)+(dist[i+1]-dist[i])/speed);
        if(i>N*.15&&i<N*.8&&Math.abs(curve)>bend){best=i;bend=Math.abs(curve);}
      }
      this.duration=times.at(-1);const start=times[best],phase=[0,.28,.58],skins=['fujiwara','yellow','blue'];
      const pose=(t,k)=>{
        const u=wrap(start+t-phase[k],this.duration),i=segment(times,u),fraction=(u-times[i])/(times[i+1]-times[i]),s=dist[i]+(dist[i+1]-dist[i])*fraction;
        const direction=heading(s),curve=angle(heading(s-10),heading(s+10))/20,speed=(dist[i+1]-dist[i])/(times[i+1]-times[i]);
        const slip=clamp(curve*14,-.52,.52)*(1+Math.sin(s*.025+k)*.08),lateral=(k-1)*2.3+Math.sin(s*.018+k)*.5;
        const p=path(s),car={id:k?'demo-'+k:'self',name:['FUJIWARA','RX-7','GTI'][k],skin:skins[k],color:['#e8e8da','#e6b52b','#276bdb'][k],pos:{x:p.x-Math.sin(direction)*lateral,y:p.y+Math.cos(direction)*lateral},angle:direction+slip,vel:{x:Math.cos(direction)*speed,y:Math.sin(direction)*speed},steerAngle:clamp(curve*2.5-slip*.55,-.38,.38),omega:curve*speed,gear:speed>30?4:3,handbrake:Math.abs(slip)>.25,trailOn:Math.abs(slip)>.12,score:0,mult:1};
        car.ride=DriftRoadContact.contacts(track,car,car.skin);return car;
      };
      this.recording=new DriftReplay.Recorder(Math.ceil(this.duration)+1);this.recording.reset({track,skin:skins[0],timeOfDay:day});
      const count=Math.floor(this.duration*20);
      for(let i=0;i<=count;i++){const t=i/count*this.duration;this.recording.capture(t,pose(t,0),[pose(t,1),pose(t,2)]);}
    }
    frame(dt=0){
      if(!this.paused)this.time+=clamp(dt,0,.25);
      const t=wrap(this.time,this.duration),result=this.recording.sample(t),laps=Math.floor(this.time/this.duration);
      // Keep wheel rotation continuous when the exhibition loops.
      if(laps){const end=this.recording.sample(this.duration);[result.player,...result.rivals].forEach((car,k)=>{car.wheelTravel+=laps*[end.player,...end.rivals][k].wheelTravel;});}
      const shotStart=Math.floor(this.time/7)*7;
      result.anchor=this.recording.sample(wrap(shotStart,this.duration)).player;
      result.time=this.time;result.day=this.day;result.track=this.track;
      if(Math.abs(this.time-this.effectTime)>.075){
        this.effectTime=this.time;this.effects=[0,1,2].map(()=>({trails:[],smoke:[]}));
        for(let age=1.6;age>=0;age-=.1){
          const old=this.recording.sample(wrap(t-age,this.duration));
          [old.player,...old.rivals].forEach((p,k)=>{
            if(!p.trailOn)return;const wheel=DriftRoadContact.wheelOffsets(p.skin)[0],c=Math.cos(p.angle),s=Math.sin(p.angle),x=p.pos.x+c*wheel.x,y=p.pos.y+s*wheel.x,w=Math.abs(wheel.z);
            this.effects[k].trails.push({x1:x+s*w,y1:y-c*w,x2:x-s*w,y2:y+c*w,a:.35});
            if(age<.8)for(const sign of [-1,1])this.effects[k].smoke.push({x:x+s*w*sign,y:y-c*w*sign,life:age,a:.3*(1-age),r:.5+age});
          });
        }
      }
      [result.player,...result.rivals].forEach((car,k)=>{car.tireTrails=this.effects?.[k].trails||[];car.smoke=this.effects?.[k].smoke||[];});
      return result;
    }
  }
  return {Demo};
})();
