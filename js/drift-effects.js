/* Vector speed lines and a camera impulse; no vehicle state is written here. */
globalThis.DriftEffects=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class Effect{
    constructor(){this.reset();}
    reset(){this.held=false;this.pulse=0;this.boost=0;this.lines=0;this.time=0;this.focus=null;}
    step(dt,{pressed=false,speed=0,active=true,reduced=false,impulse=true,lines='car'}={}){
      if(!active)return;
      dt=clamp(dt,0,.1);this.time+=dt;
      if(pressed&&!this.held)this.pulse=1;
      this.held=pressed;
      this.boost+=(this.pulse-this.boost)*(1-Math.exp(-dt*(this.pulse>this.boost?18:7)));
      this.pulse*=Math.exp(-dt*3.5);
      const target=lines==='off'||reduced?0:clamp((speed*3.6-28)/110,0,.62)+this.boost*.5;
      this.lines+=(target-this.lines)*(1-Math.exp(-dt*7));
      if(reduced||!impulse)this.boost=0;
      if(reduced||lines==='off')this.lines=0;
    }
    draw(g,w,h,{mode='car',focus=null,night=0}={}){
      if(this.lines<.015||mode==='off')return;
      const target=mode==='car'&&focus?focus:{x:w/2,y:h/2};
      if(!this.focus)this.focus={...target};this.focus.x+=(target.x-this.focus.x)*.25;this.focus.y+=(target.y-this.focus.y)*.25;
      const x=clamp(this.focus.x,w*.15,w*.85),y=clamp(this.focus.y,h*.18,h*.8),count=w<700||h<500?26:42,R=Math.hypot(w,h)*1.1;
      g.save();
      for(let i=0;i<count;i++){
        const seed=((i*16807+17)%997)/997,a=(i/count+Math.sin(i*13.9)*.006)*Math.PI*2,phase=(this.time*(.7+seed*.6)+seed*7)%1;
        const outer=R*(.8+seed*.2),inner=R*(.20+seed*.19+phase*.09),width=(.6+seed*2.8)*(w<700?.65:1),dx=Math.cos(a),dy=Math.sin(a);
        // A large untouched center keeps the road and the car legible.
        g.globalAlpha=this.lines*(.13+seed*.32)*(1-phase*.65);
        g.fillStyle=i%5===0&&night<.7?'#101a21':'#f6f5e9';
        g.beginPath();g.moveTo(x+dx*inner,y+dy*inner);g.lineTo(x+dx*outer-dy*width,y+dy*outer+dx*width);g.lineTo(x+dx*outer+dy*width,y+dy*outer-dx*width);g.closePath();g.fill();
      }
      g.restore();
    }
  }
  return {Effect};
})();
