/* Vector speed lines and a camera impulse; no vehicle state is written here. */
globalThis.DriftEffects=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class Effect{
    constructor(){this.reset();}
    reset(){this.held=false;this.pulse=0;this.boost=0;this.velocity=0;this.lines=0;this.time=0;this.focus=null;}
    step(dt,{pressed=false,speed=0,active=true,reduced=false,impulse=true,lines='car'}={}){
      if(!active)return;
      dt=clamp(dt,0,.1);this.time+=dt;
      if(pressed&&!this.held)this.pulse=1;
      this.held=pressed;
      // Critically damped camera spring: position and velocity stay continuous
      // across presses. A small optical pullback never changes vehicle speed.
      const omega=5,offset=this.boost-this.pulse,term=this.velocity+omega*offset,decay=Math.exp(-omega*dt);
      this.boost=this.pulse+(offset+term*dt)*decay;
      this.velocity=(this.velocity-omega*term*dt)*decay;
      this.pulse*=Math.exp(-dt*2);
      const target=lines==='off'||reduced?0:clamp((speed*3.6-22)/85,0,.85)+this.boost*.3;
      this.lines+=(target-this.lines)*(1-Math.exp(-dt*7));
      if(reduced||!impulse){this.boost=0;this.velocity=0;}
      if(reduced||lines==='off')this.lines=0;
    }
    draw(g,w,h,{mode='car',focus=null,night=0,intensity=1.5}={}){
      intensity=clamp(Number.isFinite(intensity)?intensity:1.5,0,3);
      if(this.lines<.015||mode==='off'||intensity===0)return;
      const target=mode==='car'&&focus?focus:{x:w/2,y:h/2};
      if(!this.focus)this.focus={...target};this.focus.x+=(target.x-this.focus.x)*.25;this.focus.y+=(target.y-this.focus.y)*.25;
      const x=clamp(this.focus.x,w*.15,w*.85),y=clamp(this.focus.y,h*.18,h*.8),compact=w<700||h<500,count=Math.round((compact?30:48)+intensity*(compact?8:14)),R=Math.hypot(w,h)*.8;
      g.save();
      for(let i=0;i<count;i++){
        const seed=((i*16807+17)%997)/997,a=(i/count+Math.sin(i*13.9)*.006)*Math.PI*2,phase=(this.time*(.7+seed*.6)+seed*7)%1;
        const outer=R*(.8+seed*.2),inner=R*(.18+seed*.2+phase*.07),width=(1.8+seed*7.2)*(compact?.75:1)*(.6+intensity*.45),dx=Math.cos(a),dy=Math.sin(a);
        // A large untouched center keeps the road and the car legible.
        g.globalAlpha=Math.min(.8,this.lines*intensity*(.25+seed*.36)*(1-phase*.5));
        g.fillStyle=i%5===0&&night<.7?'#101a21':'#f6f5e9';
        g.beginPath();g.moveTo(x+dx*inner,y+dy*inner);g.lineTo(x+dx*outer-dy*width,y+dy*outer+dx*width);g.lineTo(x+dx*outer+dy*width,y+dy*outer-dx*width);g.closePath();g.fill();
      }
      g.restore();
    }
  }
  return {Effect};
})();
