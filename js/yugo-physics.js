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
    globalThis.DriftRoadContact.alignWheelEffects(car,'yugo');
    return car;
  }
  return {specs,configure};
})();
