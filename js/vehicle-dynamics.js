/* Force-based handling, metres / seconds / newtons. See docs/vehicle-dynamics.md.
 * Shared by offline play and the authoritative server; never driven by rendering. */
globalThis.DriftDynamics=(()=>{
  'use strict';
  const SPEED_SCALE=1.10,G=9.81,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const profiles={
    blue:{front:.55,drive:.25,cg:.55,yaw:1.10,steer:.92,roll:.075,pitch:.055,spring:62,damp:10},
    gray:{front:.54,drive:0,cg:.64,yaw:1.32,steer:.72,roll:.11,pitch:.075,spring:44,damp:8.4},
    yellow:{front:.50,drive:0,cg:.46,yaw:.96,steer:1,roll:.055,pitch:.045,spring:78,damp:12},
    yugo:{front:.61,drive:1,cg:.61,yaw:1,steer:.88,roll:.095,pitch:.065,spring:52,damp:9},
    fujiwara:{front:.53,drive:0,cg:.52,yaw:1.02,steer:.96,roll:.075,pitch:.055,spring:64,damp:10}
  };
  function configure(car,skin){
    car.handling=profiles[skin]||profiles.blue;
    const points=globalThis.DriftRoadContact.wheelOffsets(skin),rear=points[0],front=points[2];
    car.length=front.x-rear.x;car.trackWidth=Math.abs(rear.z)*2;
    if(skin==='fujiwara')car.bodyDimensions={length:4.215,width:1.7,height:1.335,cgHeight:.52};
    car.bodyDimensions||={length:skin==='yellow'?4.45:4.215,width:car.trackWidth+.18,height:1.335,cgHeight:car.handling.cg};
    car.bodyDimensions.cgHeight=car.handling.cg;
    car._stockGrip=car.baseLatFriction;
    // Pace changes physical speed, gearing and engine/drag equilibrium together.
    // Race clocks, input rate, suspension time and gravity remain in real seconds.
    if(!car._paceApplied){
      car.engineForce*=SPEED_SCALE;car.dragQuad/=SPEED_SCALE;
      for(const key of ['gearMax','shiftUp','tractionRamp'])car[key]=car[key].map(v=>v*SPEED_SCALE);
      car._paceApplied=true;
    }
    reset(car);return car;
  }
  function reset(car){car.accelLong=car.accelLat=car.frontSlip=car.rearSlip=car.driveSlip=0;car.frontLoad=car.mass*G*(car.handling?.front||.54);car.rearLoad=car.mass*G-car.frontLoad;}
  function step(car,dt,steer,thr,br){
    if(!(dt>0))return;
    const count=Math.max(1,Math.ceil(Math.min(dt,.1)*120)),h=Math.min(dt,.1)/count;
    for(let i=0;i<count;i++)integrate(car,h,steer,thr,br);
  }
  function integrate(c,dt,steer,thr,br){
    const p=c.handling||profiles.blue,m=c.mass,weight=m*G,L=c.length;
    c.shiftTimer=Math.max(0,c.shiftTimer-dt);
    c.throttleSm+=clamp(thr-c.throttleSm,-c.throttleRate*dt,c.throttleRate*dt);
    const speed=c.worldSpeed(),sf=clamp(1/(1+speed*.065),.18,1);
    c.steerTarget=steer*c.maxSteer*sf;
    const before=c.steerAngle,rate=c.steerRate*p.steer/(1+speed*.012);
    c.steerAngle+=clamp(c.steerTarget-c.steerAngle,-rate*dt,rate*dt);c.steerVel=(c.steerAngle-before)/dt;
    const cos=Math.cos(c.angle),sin=Math.sin(c.angle),vx=c.vel.x*cos+c.vel.y*sin,vy=-c.vel.x*sin+c.vel.y*cos;
    const kmh=speed*3.6,gear=c.gear-1,maxK=c.gearMax[gear]||9999;
    const shift=c.shiftTimer>0?.45+.55*(1-c.shiftTimer/c.shiftDur):1,bog=c.gear>1&&kmh<maxK*.38?clamp(kmh/(maxK*.38),0,1):1;
    const traction=clamp(kmh/(c.tractionRamp[gear]||40),c.tractionMin[gear]||.85,1);
    let engine=c.throttleSm*c.engineForce*(c.gearPower[gear]||1)*shift*bog*traction;
    const roadLoad=Math.max(0,vx*c.dragLinear+vx*Math.abs(vx)*c.dragQuad);
    engine=Math.min(engine,Math.max(0,roadLoad+m*(maxK/3.6-vx)/dt));
    const a=L*(1-p.front),b=L*p.front,loadShift=p.cg*(m*(c.accelLong||0)+vx*c.dragLinear+Math.sign(vx)*vx*vx*c.dragQuad)/L;
    const fzF=clamp(weight*p.front-loadShift,weight*.12,weight*.88),fzR=weight-fzF;
    const grip=Math.sqrt(clamp(c.baseLatFriction/(c._stockGrip||2200),.55,1.8));
    const mu=1.16*grip*(c.offTrack?.63:1),transfer=m*p.cg*(c.accelLat||0)/Math.max(1.2,c.trackWidth||1.5);
    function capacity(load,bias){
      const left=clamp(load*.5-transfer*bias,load*.06,load*.94),right=load-left;
      // Tyre load sensitivity: transferring load reduces the pair's total grip.
      return mu*load*(Math.pow(left/(load*.5),.9)+Math.pow(right/(load*.5),.9))*.5;
    }
    const capF=capacity(fzF,p.front),capR=capacity(fzR,1-p.front);
    const brake=Math.min(br*c.brakeForce,m*Math.abs(vx)/dt),brakeSign=Math.sign(vx);
    const frontDemand=engine*p.drive-brake*.65*brakeSign;
    const rearDemand=engine*(1-p.drive)-brake*.35*brakeSign-(c.handbrake?Math.min(weight*.25,m*Math.abs(vx)/dt*.3)*brakeSign:0);
    const cs=Math.cos(c.steerAngle),ss=Math.sin(c.steerAngle),frontY=vy+a*c.omega;
    const alphaF=Math.atan2(frontY*cs-vx*ss,Math.max(3,Math.abs(vx*cs+frontY*ss)));
    const alphaR=Math.atan2(vy-b*c.omega,Math.max(3,Math.abs(vx)));
    const handGrip=c.handbrake?clamp(.18+.5*c.handLatFriction/c.baseLatFriction,.2,.5):1;
    function tyre(alpha,cap,demand,stiffness,slide){
      const fy=-cap*Math.tanh(stiffness*alpha/Math.max(1,cap))*slide;
      const fx=clamp(demand,-cap*1.15,cap*1.15),scale=Math.min(1,cap/Math.max(1,Math.hypot(fx,fy)));
      return {x:fx*scale,y:fy*scale};
    }
    const front=tyre(alphaF,capF,frontDemand,c.baseLatFriction*15,1-.08*clamp((Math.abs(alphaF)-.18)/.6,0,1));
    const rear=tyre(alphaR,capR,rearDemand,c.baseLatFriction*20,handGrip*(1-.10*clamp((Math.abs(alphaR)-.18)/.6,0,1)));
    const fxF=front.x,fxR=rear.x,fyF=front.y,fyR=rear.y;
    const frontX=fxF*cs-fyF*ss,frontForceY=fxF*ss+fyF*cs;
    const drag=-vx*c.dragLinear-Math.sign(vx)*vx*vx*c.dragQuad;
    const ax=(frontX+fxR+drag)/m,ay=(frontForceY+fyR)/m;
    const inertia=m*((c.bodyDimensions?.length||4.3)**2+(c.bodyDimensions?.width||1.8)**2)/12*p.yaw;
    c.omega+=((a*frontForceY-b*fyR)/inertia-c.omega*.12)*dt;
    c.vel.x+=(ax*cos-ay*sin)*dt;c.vel.y+=(ax*sin+ay*cos)*dt;
    c.angle+=c.omega*dt;c.yawRate=c.omega;c.pos.x+=c.vel.x*dt;c.pos.y+=c.vel.y*dt;
    // Smooth acceleration is also the physical load-transfer state, sent in snapshots.
    const smooth=1-Math.exp(-dt*14);
    c.accelLong=(c.accelLong||0)+(ax-(c.accelLong||0))*smooth;
    c.accelLat=(c.accelLat||0)+(ay-(c.accelLat||0))*smooth;
    c.frontLoad=fzF;c.rearLoad=fzR;c.frontSlip=alphaF;c.rearSlip=alphaR;
    c.driveSlip=clamp((Math.abs(frontDemand-fxF)+Math.abs(rearDemand-fxR))/Math.max(1,weight),0,2);
    if(speed<.18&&thr===0&&!c.descent){const k=Math.exp(-dt*18);c.vel.x*=k;c.vel.y*=k;c.omega*=k;}
  }
  return Object.freeze({SPEED_SCALE,profiles,configure,reset,step});
})();
