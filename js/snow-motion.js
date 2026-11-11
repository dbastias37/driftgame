/* Continuous visual response; this module never changes vehicle grip/forces. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SNOW_STATES=Object.freeze(['reposo','avance','crucero','alta-velocidad','aceleracion','frenada','derrape','reversa']);
export function snowResponse({speed=0,acceleration=0,lateral=0,forward=speed,reduced=false}={}){
  speed=clamp(Math.abs(Number(speed)||0),0,100);acceleration=clamp(Number(acceleration)||0,-14,14);lateral=clamp(Math.abs(Number(lateral)||0),0,50);
  const surge=clamp(acceleration/6,0,1),braking=clamp(-acceleration/8,0,1),slip=clamp(lateral/12,0,1);
  const state=forward<-1?'reversa':slip>.3&&speed>5?'derrape':braking>.22&&speed>2?'frenada':surge>.22&&speed>1?'aceleracion':speed>28?'alta-velocidad':speed>12?'crucero':speed>1?'avance':'reposo';
  return {state,speed,surge,braking,slip,exposure:(reduced?.004:.009)+Math.min(speed,50)*.00016+(reduced?0:surge*.004),width:.045-Math.min(speed,55)*.00023,density:clamp(.66+speed*.005+surge*.09,.66,1),flutter:(reduced?.24:.55)*(1-Math.min(speed/70,.7)),settle:1.8+braking*1.2};
}
export class SnowMotion{
  constructor(){this.reset();}
  reset(){this.previousSpeed=null;this.speed=0;this.acceleration=0;this.vx=0;this.vz=0;this.lateral=0;this.forward=0;}
  update(player,dt,reset=false,reduced=false){
    const vx=Number(player?.vel?.x)||0,vz=Number(player?.vel?.y)||0,speed=Math.hypot(vx,vz),angle=Number(player?.angle)||0;
    if(reset||this.previousSpeed===null){this.speed=speed;this.vx=vx;this.vz=vz;this.acceleration=0;this.previousSpeed=speed;}
    if(dt>0){
      const a=1-Math.exp(-Math.min(dt,.1)*7),accel=clamp((speed-this.previousSpeed)/dt,-14,14);
      this.acceleration+=(accel-this.acceleration)*a;this.speed+=(speed-this.speed)*a;
      this.vx+=(vx-this.vx)*a;this.vz+=(vz-this.vz)*a;this.previousSpeed=speed;
    }
    this.forward=vx*Math.cos(angle)+vz*Math.sin(angle);this.lateral=-vx*Math.sin(angle)+vz*Math.cos(angle);
    return snowResponse({...this,reduced});
  }
}
