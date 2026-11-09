/* Serializable settings shared by browser, replay and authoritative races. */
globalThis.DriftOptions ||= (()=>{
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const difficulties={assisted:{name:'Asistido',grip:1.10,counter:.42,stability:1.8,description:'Contravolante y estabilidad ayudan a recuperar el auto.'},standard:{name:'Estándar',grip:1,counter:0,stability:0,description:'El manejo actual: peso, inercia y control directo del derrape.'},expert:{name:'Experto',grip:.92,counter:0,stability:0,description:'Menor margen de agarre. Exige dosificar freno, volante y acelerador.'}};
  const weathers={clear:{name:'Despejado',cloud:0,rain:0,wet:0,grip:1,near:1,far:1},cloudy:{name:'Nublado',cloud:.85,rain:0,wet:0,grip:1,near:.8,far:.85},fog:{name:'Niebla',cloud:.65,rain:0,wet:0,grip:1,near:.09,far:.30},rain:{name:'Lluvia',cloud:1,rain:.65,wet:.75,grip:.83,near:.40,far:.63},storm:{name:'Lluvia intensa',cloud:1,rain:1,wet:1,grip:.72,near:.25,far:.46}};
  const cameras={chase:'Seguimiento',aerial:'Aérea',hood:'Capó',fender:'Tapabarro izquierdo',fenderRight:'Tapabarro derecho',bumper:'Parachoques',rear:'Mirada trasera',drone:'Dron',trackside:'TV · curva',cinematic:'TV · realización'};
  const presets={clean:{resolution:0,jitter:0,affine:0,bits:24,dither:0,crt:0,flat:false},psx:{resolution:480,jitter:.6,affine:.65,bits:15,dither:.65,crt:.25,flat:true},classic:{resolution:240,jitter:1,affine:1,bits:15,dither:1,crt:.45,flat:true}};
  function retro(raw={}){return {resolution:[0,240,360,480,720].includes(Number(raw.resolution))?Number(raw.resolution):480,jitter:clamp(raw.jitter??.6,0,2),affine:clamp(raw.affine??.65,0,1),bits:[8,15,16,24].includes(Number(raw.bits))?Number(raw.bits):15,dither:clamp(raw.dither??.65,0,1),crt:clamp(raw.crt??.25,0,1),flat:raw.flat!==false};}
  function conditions(raw={}){return {difficulty:Object.hasOwn(difficulties,raw.difficulty)?raw.difficulty:'standard',weather:Object.hasOwn(weathers,raw.weather)?raw.weather:'clear'};}
  function apply(car,raw){car.conditions=conditions(raw);return car;}
  function recordKey(raw){const c=conditions(raw);return c.difficulty==='standard'&&c.weather==='clear'?'':':'+c.difficulty+':'+c.weather;}
  return Object.freeze({difficulties,weathers,cameras,presets,retro,conditions,apply,recordKey});
})();
