/* 1.0 local career. Stock physics and online authority remain independent. */
globalThis.DriftCareer=(()=>{
  'use strict';
  const KEY='drift:career:v1',skins=['blue','red','yellow','gray','yugo','fujiwara'];
  const colors=['#66e0ff','#ff7544','#c58bff','#82ed9b','#ffe27d','#f0f4ef'];
  const finite=(n,d=0)=>Number.isFinite(n)?n:d,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),money=n=>Math.floor(clamp(finite(n),0,999999999));
  const rows=[
    ['engine','Motor','engine',1800,'Más fuerza disponible en todo el régimen.',{engineForce:.07}],
    ['induction','Admisión','engine',1500,'Mejora el llenado; exige más precisión al acelerar.',{engineForce:.05,handLatFriction:-.015}],
    ['fuel','Alimentación','engine',1100,'Entrega de combustible y respuesta progresiva.',{engineForce:.025,throttleRate:.07}],
    ['ignition','Encendido','chip',1300,'Ajusta la respuesta del motor.',{engineForce:.025,throttleRate:.06}],
    ['exhaust','Escape','engine',1100,'Reduce pérdidas del conjunto motor.',{engineForce:.025}],
    ['flywheel','Volante motor','gear',1000,'El motor responde antes al acelerador.',{throttleRate:.12}],
    ['gearing','Relación final','gear',1900,'Más velocidad por marcha; menor empuje a baja velocidad.',{gearMax:.035,shiftUp:.035,engineForce:-.008}],
    ['clutch','Embrague','gear',1300,'Acorta la interrupción de fuerza al cambiar.',{shiftDur:-.12}],
    ['differential','Diferencial','gear',2000,'Tracción más controlable durante el derrape.',{handLatFriction:.07,steerRate:.02}],
    ['tires','Neumáticos','tire',2100,'Más agarre lateral, también al iniciar un drift.',{baseLatFriction:.08,handLatFriction:.04}],
    ['brakes','Frenos','brake',1400,'Más fuerza de frenado y mejores entradas de curva.',{brakeForce:.1}],
    ['chassis','Refuerzos','chassis',1500,'Gana rigidez y agarre con un pequeño aumento de masa.',{baseLatFriction:.04,mass:.008}],
    ['weight','Aligeramiento','chassis',2400,'Reduce masa sin cambiar la carrocería visible.',{mass:-.035}],
    ['springs','Muelles','spring',1300,'Más firmeza al pisar bordes y desniveles.',{spring:.12}],
    ['dampers','Amortiguadores','spring',1500,'Controla el rebote de la suspensión.',{damping:.15}],
    ['steering','Dirección','steer',1200,'Respuesta más rápida al girar el volante.',{steerRate:.09,maxSteer:.015}],
    ['driftControl','Control de drift','steer',1900,'Facilita deslizar la parte trasera; requiere contravolante.',{handLatFriction:-.05,throttleRate:.04}],
    ['driftBoost','Impulso de drift','bolt',2500,'Fuerza adicional gradual al acelerar en drift. Sin saltos de cámara.',{boost:.035}],
    ['neon','Neón','light',1000,'Luz bajo el auto. Elige color o apágala.',{}],
    ['smoke','Humo','smoke',900,'Nivel 1: volumen ×2. Nivel 2: ×3. Nivel 3: color.',{}]
  ];
  const catalog=rows.map(([id,name,icon,cost,description,effects])=>Object.freeze({id,name,icon,cost,description,effects,max:id==='neon'?1:3}));
  const profiles={blue:{name:'GTI · respuesta equilibrada',factor:1,price:1,engine:'Motor bóxer GTI',induction:'Admisión de alto flujo',ignition:'Gestión electrónica'},red:{name:'V8 · par y masa',factor:.88,price:1.15,engine:'Preparación V8',induction:'Admisión V8',weight:'Aligeramiento del V8'},yellow:{name:'Rotativo · potencia progresiva',factor:.93,price:1.25,engine:'Preparación rotativa',induction:'Presión del turbo',ignition:'Gestión del rotativo'},gray:{name:'Sedán · control y respuesta',factor:1.08,price:.85,engine:'Preparación de cuatro cilindros',fuel:'Alimentación del sedán'},yugo:{name:'1.1 · ligereza y carburación',factor:1.18,price:.65,engine:'Preparación del 1.1',induction:'Admisión del carburador',fuel:'Carburación',ignition:'Encendido electrónico',gearing:'Relaciones de cinco marchas'},fujiwara:{name:'4A · enlace de curvas',factor:1.04,price:1.05,engine:'Preparación 4A',induction:'Admisión del 4A',ignition:'Gestión del 4A'}};
  function fresh(){return {version:1,cash:0,unlocked:1,missions:{},cars:{},wins:0,receipts:[]};}
  function clean(raw){
    const p=fresh();if(!raw||typeof raw!=='object')return p;
    p.receipts=Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string'&&x.length<100).slice(-100):[];
    p.cash=money(raw.cash);p.wins=money(raw.wins);p.unlocked=clamp(Math.floor(finite(raw.unlocked,1)),1,20);
    for(let i=1;i<=20;i++)p.missions[i]=[0,1,2].map(j=>raw.missions?.[i]?.[j]===true);
    for(const skin of skins){const src=raw.cars?.[skin],car={owned:{},active:{},neonColor:colors[0],smokeColor:colors[5]};
      for(const part of catalog){car.owned[part.id]=clamp(Math.floor(finite(src?.owned?.[part.id])),0,part.max);car.active[part.id]=clamp(Math.floor(finite(src?.active?.[part.id],car.owned[part.id])),0,car.owned[part.id]);}
      for(const key of ['neonColor','smokeColor'])if(colors.includes(src?.[key]))car[key]=src[key];p.cars[skin]=car;
    }return p;
  }
  function load(storage=globalThis.localStorage){try{const raw=storage.getItem(KEY);if(raw)return clean(JSON.parse(raw));const p=clean(fresh());p.unlocked=clamp(parseInt(storage.getItem('challenge:unlocked')||'1',10)||1,1,20);return p;}catch{return clean(fresh());}}
  function save(p,storage=globalThis.localStorage){try{storage.setItem(KEY,JSON.stringify(clean(p)));return true;}catch{return false;}}
  function stars(p){return Object.values(p.missions).reduce((n,a)=>n+a.filter(Boolean).length,0);}
  function tierStars(tier){return [0,0,6,18][tier]??99;}
  function objectives(level){const l=clamp(level,1,20);return [{id:'score',target:Math.round(11000+1800*l+60*l*l),label:'Alcanza'},{id:'clean',target:1,label:'Completa una vuelta sin salir de la carretera, chocar ni recuperar'},{id:'longest',target:1800+450*l,label:'Enlaza un drift de'}];}
  function part(skin,id){const base=catalog.find(x=>x.id===id);return base?{...base,name:profiles[skin]?.[id]||base.name}:null;}
  function price(skin,id,tier){const x=part(skin,id);return x?Math.round(x.cost*(profiles[skin]?.price||1)*(1+(tier-1)*.85)/50)*50:Infinity;}
  function purchase(skin,id,storage=globalThis.localStorage){
    const p=load(storage),x=part(skin,id),car=p.cars[skin];if(!x||!car)return {ok:false,error:'Pieza no válida'};
    const tier=car.owned[id]+1,cost=price(skin,id,tier);
    if(tier>x.max)return {ok:false,error:'Pieza completada'};
    if(stars(p)<tierStars(tier))return {ok:false,error:`Necesitas ${tierStars(tier)} objetivos de campaña`};
    if(p.cash<cost)return {ok:false,error:'Créditos insuficientes'};
    p.cash-=cost;car.owned[id]=car.active[id]=tier;
    if(!save(p,storage))return {ok:false,error:'No se pudo guardar. La compra no se aplicó.'};
    return {ok:true,profile:p,tier,cost};
  }
  function equip(skin,id,level,storage=globalThis.localStorage){const p=load(storage),c=p.cars[skin];if(!c||!part(skin,id)||!Number.isInteger(level)||level<0||level>c.owned[id])return false;c.active[id]=level;return save(p,storage);}
  function color(skin,key,value,storage=globalThis.localStorage){const p=load(storage),c=p.cars[skin];if(!c||!['neonColor','smokeColor'].includes(key)||!colors.includes(value))return false;c[key]=value;return save(p,storage);}
  function onlineReward({key,place,finished,players},storage=globalThis.localStorage){
    if(typeof key!=='string'||key.length>99||place!==1||finished<8000||players<2)return {ok:false,reward:0};
    const p=load(storage);if(p.receipts.includes(key))return {ok:true,reward:0};
    p.cash=money(p.cash+1500);p.wins++;p.receipts.push(key);p.receipts=p.receipts.slice(-100);
    return save(p,storage)?{ok:true,reward:1500}:{ok:false,reward:0};
  }
  function cosmetics(config){return {neon:config?.active.neon?config.neonColor:null,smokeVolume:config?.active.smoke>=2?3:config?.active.smoke===1?2:1,smokeColor:config?.active.smoke>=3?config.smokeColor:'#dde8e8'};}
  const scalarKeys=['engineForce','throttleRate','handLatFriction','baseLatFriction','shiftDur','brakeForce','mass','steerRate','maxSteer'];
  function apply(car,skin,config){
    if(!config)return car;
    if(!car._careerBase){car._careerBase={};for(const k of [...scalarKeys,'gearMax','shiftUp'])car._careerBase[k]=Array.isArray(car[k])?car[k].slice():car[k];}
    for(const [k,v]of Object.entries(car._careerBase))car[k]=Array.isArray(v)?v.slice():v;
    const sums={},factor=profiles[skin]?.factor||1;
    for(const item of catalog){const tier=clamp(config.active[item.id]||0,0,item.max);for(const [key,value]of Object.entries(item.effects))sums[key]=(sums[key]||0)+value*tier*factor;}
    for(const k of scalarKeys)car[k]*=1+(sums[k]||0);
    for(const k of ['gearMax','shiftUp'])car[k]=car[k].map(n=>n*(1+(sums[k]||0)));
    car.suspensionTune={stiffness:1+(sums.spring||0),damping:1+(sums.damping||0)};
    car.driftEngineBonus=sums.boost||0;
    if(car.driftEngineBonus&&!car._careerPhysStep){
      car._careerPhysStep=car._physStep;
      car._physStep=function(dt,steer,thr,br){
        const target=this.handbrake&&this.driftTime>0&&this.driftBreakTimer<.1&&!this.offTrack&&thr>0&&br===0?this.driftEngineBonus:0;
        this._driftPower=(this._driftPower||0)+(target-(this._driftPower||0))*(1-Math.exp(-dt*3));
        const force=this.engineForce;this.engineForce=force*(1+this._driftPower);
        try{return this._careerPhysStep(dt,steer,thr,br);}finally{this.engineForce=force;}
      };
    }
    if(!car.driftEngineBonus&&car._careerPhysStep){car._physStep=car._careerPhysStep;delete car._careerPhysStep;car._driftPower=0;}
car.cosmetics=cosmetics(config);car.upgradeSignature=catalog.map(x=>config.active[x.id]||0).join('');return car;
  }
  function metrics(car){const last=car.gearPower.at(-1),force=car.engineForce*last,v=(-car.dragLinear+Math.sqrt(car.dragLinear**2+4*car.dragQuad*force))/(2*car.dragQuad);return {acceleration:car.engineForce/car.mass,speed:Math.min(car.gearMax.at(-1),v*3.6),handling:car.baseLatFriction/car.mass,braking:car.brakeForce/car.mass,mass:car.mass,throttle:car.throttleRate,shift:car.shiftDur,driftGrip:car.handLatFriction/car.mass,spring:car.suspensionTune?.stiffness||1,damping:car.suspensionTune?.damping||1,steering:car.steerRate,boost:1+(car.driftEngineBonus||0)};}
  class Run{
    constructor(mode,level=1){this.mode=mode;this.level=clamp(level,1,20);this.bestScore=0;this.longest=0;this.clean=true;this.elapsed=0;this.settled=false;this.lastLives=null;this.lastHits=0;}
    observe(car,dt){this.elapsed+=Math.max(0,finite(dt));this.bestScore=Math.max(this.bestScore,finite(car.score));this.longest=Math.max(this.longest,finite(car.comboPoints));if(car.offTrack||car.descent?.motion==='falling'||(this.lastLives!==null&&car.lives<this.lastLives)||finite(car.impactCount)>this.lastHits)this.clean=false;this.lastLives=car.lives;this.lastHits=finite(car.impactCount);}
    recover(){this.clean=false;}
    finish({valid=false,won=false}={},storage=globalThis.localStorage){
      if(this.settled)return {ok:true,reward:0,duplicate:true,complete:this.complete,profile:load(storage)};
      if(!valid||this.elapsed<8)return {ok:false,reward:0};
      const p=load(storage);let reward=0,newMissions=[],complete=false;
      if(this.mode==='challenge'){
        const o=objectives(this.level),earned=[this.bestScore>=o[0].target,this.clean,this.longest>=o[2].target],old=p.missions[this.level];
        newMissions=earned.map((yes,i)=>yes&&!old[i]);reward=newMissions.filter(Boolean).length*(650+this.level*100);
        p.missions[this.level]=old.map((yes,i)=>yes||earned[i]);complete=p.missions[this.level].every(Boolean);
        if(complete&&!old.every(Boolean))reward+=1200+this.level*150;
        if(complete)p.unlocked=Math.max(p.unlocked,Math.min(20,this.level+1));
        won=earned[0];
      }
      if(won){reward+=this.mode==='challenge'?450+this.level*40:this.mode==='downhill'?1200+this.level*90:900;p.wins++;}
      p.cash=money(p.cash+reward);
      if(!save(p,storage))return {ok:false,reward:0,error:'No se pudo guardar el progreso.'};
      this.settled=true;this.complete=complete;return {ok:true,reward,complete,newMissions,profile:p};
    }
  }
  return Object.freeze({KEY,catalog,profiles,skins,colors,load,save,stars,tierStars,objectives,part,price,purchase,equip,color,onlineReward,cosmetics,apply,metrics,Run});
})();
