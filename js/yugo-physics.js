/* Yugo Koral 55: isolated setup for the existing fixed-step Car model.
 * Reference: Koral 1.1 carburettor technical sheet (55 PS, 790 kg, 145 km/h).
 * This remains the game's drift model, not a full front-wheel-drive simulator. */
globalThis.DriftYugo=(()=>{
  const specs=Object.freeze({mass:790,powerPS:55,torqueNm:77.4,topSpeed:145,wheelbase:2.15,length:3.49,width:1.548,height:1.335,wheelRadius:.281,frontX:1.06,rearX:-1.09,halfTrack:.654});
  function configure(car){
    car.mass=specs.mass;car.length=specs.wheelbase;car.maxSteer=.75;
    car.engineForce=4034;car.brakeForce=5500;car.dragLinear=3;car.dragQuad=.45;
    car.baseLatFriction=1500;car.handLatFriction=210;
    car.gearCount=5;car.gearMax=[42,77,118,166,200];car.gearPower=[1,2.235/4.091,1.469/4.091,1.043/4.091,.863/4.091];
    car.tractionMin=[.22,.7,.85,1,1];car.tractionRamp=[45,45,65,90,110];car.shiftUp=[33,60,91,125];
    car.bodyDimensions={length:specs.length,width:specs.width,height:specs.height,cgHeight:.61};
    // Existing effects are authored for a wider car. Move only newly emitted
    // samples to this car's actual rear contact patches; keep their lifetimes.
    const spawn=car.spawnTrails,smoke=car.updateSmoke;
    function align(f,r,side){const dx=specs.rearX+car.length*.5,dz=side*(specs.halfTrack-.9);return{x:f.x*dx+r.x*dz,y:f.y*dx+r.y*dz};}
    car.spawnTrails=function(f,r,dt,int){spawn.call(this,f,r,dt,int);const t=this.tireTrails.at(-1);if(t)for(const [side,n]of[[-1,1],[1,2]]){const d=align(f,r,side);t['x'+n]+=d.x;t['y'+n]+=d.y;}};
    car.updateSmoke=function(dt,f,r,...rest){const old=new Set(this.smoke);smoke.call(this,dt,f,r,...rest);let n=0;for(const p of this.smoke)if(!old.has(p)){const d=align(f,r,n++%2?1:-1);p.x+=d.x;p.y+=d.y;}};
    return car;
  }
  return {specs,configure};
})();
