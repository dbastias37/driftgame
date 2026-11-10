/* Shared speed-vector envelope and camera impulse; no vehicle state is written here. */
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

  }
  return {Effect};
})();
