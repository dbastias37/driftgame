/* Presentation-only instruments: RPM follows road speed, current gearing and clutch slip. */
globalThis.DriftInstruments=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),limits={barracuda:6200,gray:6200,yugo:6500,blue:8000,yellow:8500,fujiwara:7600};
  function telemetry(car){const speed=car.worldSpeed()*3.6,redline=limits[car.skin]||8000,idle=['gray','barracuda'].includes(car.skin)?750:850,ratio=speed/Math.max(1,car.gearMax?.[car.gear-1]||198),free=idle+(car.throttleSm||0)*(car.handbrake?redline*.32:1400)*Math.max(0,1-speed/15);if(car.launchHold)return {speed,redline,rpm:idle+(redline*.82-idle)*(car.launchThrottle||0)};return {speed,redline,rpm:clamp(Math.max(idle,ratio*redline,free)+(car.driveSlip||0)*450,idle,redline*1.04)};}
  const angle=(v,max)=>Math.PI*(.75+1.5*clamp(v/max,0,1));
  class Cluster{
    constructor(canvas){this.canvas=canvas;this.g=canvas.getContext('2d');this.face=null;this.rpm=0;this.speed=0;}
    paintFace(redline){const c=document.createElement('canvas');c.width=320;c.height=150;const g=c.getContext('2d');g.fillStyle='#10191e';g.fillRect(0,0,320,150);
      const dial=(x,max,step,label,red)=>{g.lineWidth=2;g.strokeStyle='#6a7c80';g.beginPath();g.arc(x,78,66,Math.PI*.75,Math.PI*2.25);g.stroke();for(let v=0;v<=max;v+=step/2){const a=angle(v,max),major=v%step===0,r=major?53:59;g.strokeStyle=v>=red?'#ff6a46':'#e6e9d6';g.beginPath();g.moveTo(x+Math.cos(a)*64,78+Math.sin(a)*64);g.lineTo(x+Math.cos(a)*r,78+Math.sin(a)*r);g.stroke();if(major){g.font='12px DriftDisplay, Impact, sans-serif';g.textAlign='center';g.fillStyle=v>=red?'#ff6a46':'#e6e9d6';g.fillText(String(v),x+Math.cos(a)*43,82+Math.sin(a)*43);}}g.font='10px DriftDisplay, Impact, sans-serif';g.textAlign='center';g.fillStyle='#9aafaf';g.fillText(label,x,120);};
      dial(80,9,1,'RPM × 1000',redline/1000);dial(240,240,40,'KM/H',Infinity);this.face=c;this.redline=redline;
    }
    draw(car,dt=1/60){const t=telemetry(car);if(!this.face||this.redline!==t.redline)this.paintFace(t.redline);const k=1-Math.exp(-Math.min(.1,dt)*18);this.rpm+=(t.rpm-this.rpm)*k;this.speed+=(t.speed-this.speed)*k;const g=this.g;g.clearRect(0,0,320,150);g.drawImage(this.face,0,0);for(const [x,v,max] of [[80,this.rpm,9000],[240,this.speed,240]]){const a=angle(v,max);g.strokeStyle='#ff9a42';g.lineWidth=3;g.beginPath();g.moveTo(x-Math.cos(a)*9,78-Math.sin(a)*9);g.lineTo(x+Math.cos(a)*52,78+Math.sin(a)*52);g.stroke();g.fillStyle='#ececd7';g.fillRect(x-3,75,6,6);}return t;}
  }
  return {telemetry,angle,Cluster};
})();
