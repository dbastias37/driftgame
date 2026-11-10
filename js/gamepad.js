/* Gamepad API input. Device profiles stay on this browser; no driver is required by the game. */
globalThis.DriftGamepad=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),unit=v=>clamp(Number(v)||0,0,1),neutral=()=>({steerAxis:0,accel:0,brake:0,reverse:0,handbrake:false});
  const bindings={accel:'b7',brake:'b6',reverse:'b1',handbrake:'b0',camera:'b3',recover:'b2',pause:'b9',up:'b5',down:'b4',confirm:'b0',cancel:'b1'};
  function sanitize(p={}){p=p&&typeof p==='object'?p:{};const bind={...bindings};for(const k in bind)if(typeof p.bind?.[k]==='string'&&/^(b\d{1,2}|a\d{1,2}[+\-><]|none)$/.test(p.bind[k]))bind[k]=p.bind[k];return {enabled:p.enabled!==false,axis:clamp(Math.trunc(p.axis)||0,0,31),center:clamp(Number(p.center)||0,-.35,.35),deadzone:clamp(Number.isFinite(p.deadzone)?p.deadzone:.12,0,.4),sensitivity:clamp(Number(p.sensitivity)||1,.5,2),invert:!!p.invert,bind};}
  function read(pad,token){if(!pad||token==='none')return 0;if(token?.[0]==='b')return unit(pad.buttons?.[Number(token.slice(1))]?.value);const m=/^a(\d+)([+\-><])$/.exec(token||'');if(!m)return 0;const raw=pad.axes?.[+m[1]];if(!Number.isFinite(raw))return 0;return unit(m[2]==='>'?(raw+1)/2:m[2]==='<'?(1-raw)/2:m[2]==='-'?-raw:raw);}
  function steering(raw,p){const v=clamp(((Number(raw)||0)-p.center)/(raw<p.center?1+p.center:1-p.center),-1,1),m=Math.abs(v);return m<=p.deadzone?0:Math.sign(v)*Math.pow((m-p.deadzone)/(1-p.deadzone),1/p.sensitivity)*(p.invert?-1:1);}
  class Controller{
    constructor({getPads,storage}={}){this.getPads=getPads||(()=>navigator.getGamepads?.()||[]);this.storage=storage;this.profiles={};try{const parsed=JSON.parse(storage?.getItem('drift-gamepad-v1')||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))this.profiles=parsed;}catch{}this.profile=sanitize();this.index=null;this.pad=null;this.state=neutral();this.edges={};this.previous={};this.armed=false;this.suspended=false;this.devices=[];this.error='';}
    save(){if(this.pad){this.profiles[this.pad.id]=this.profile;try{this.storage?.setItem('drift-gamepad-v1',JSON.stringify(this.profiles));}catch{this.error='No se pudo guardar la configuración del mando.';}}}
    configure(patch){this.profile=sanitize({...this.profile,...patch,bind:{...this.profile.bind,...patch.bind}});this.armed=false;this.previous={};this.save();}
    reset(){this.profile=sanitize();this.armed=false;this.save();}
    center(){if(!this.pad)return false;const raw=this.pad.axes[this.profile.axis];if(!Number.isFinite(raw)||Math.abs(raw)>.35)return false;this.configure({center:raw});return true;}
    select(index){this.index=Number(index);this.pad=null;this.armed=false;this.previous={};}
    poll({active=true,menu=false,now=performance.now()/1000}={}){
      let pads=[];try{pads=Array.from(this.getPads()||[]).filter(p=>p&&p.connected!==false);this.error='';}catch{this.error='El navegador no permite acceder al mando.';}
      this.devices=pads;const pad=pads.find(p=>p.index===this.index)||(!this.pad?pads[0]:null);this.disconnected=!!this.pad&&!pad;
      if(!pad){this.pad=null;this.state=neutral();this.edges={};this.previous={};this.armed=false;return this.state;}
      if(this.pad?.id!==pad.id||this.pad?.index!==pad.index){this.profile=sanitize(this.profiles[pad.id]);this.armed=false;this.previous={};this.index=pad.index;}
      this.pad=pad;const p=this.profile,values={};for(const k in p.bind)values[k]=read(pad,p.bind[k]);
      values.navUp=read(pad,'b12');values.navDown=read(pad,'b13');values.navLeft=read(pad,'b14');values.navRight=read(pad,'b15');
      if(menu){const x=Number(pad.axes[0])||0,y=Number(pad.axes[1])||0;values.navLeft=Math.max(values.navLeft,x<-.55?1:0);values.navRight=Math.max(values.navRight,x>.55?1:0);values.navUp=Math.max(values.navUp,y<-.55?1:0);values.navDown=Math.max(values.navDown,y>.55?1:0);}
      const axis=steering(pad.axes[p.axis],p),released=Math.abs(axis)<.02&&Object.values(values).every(v=>v<.12);
      this.edges={};if(!active||!p.enabled){this.armed=false;this.state=neutral();this.previous=values;return this.state;}
      if(!this.armed){if(released)this.armed=true;this.previous=values;this.state=neutral();return this.state;}
      for(const k in values)this.edges[k]=values[k]>.5&&!(this.previous[k]>.5);this.repeatAt ||= {};for(const k of ['navUp','navDown','navLeft','navRight']){if(!menu||values[k]<=.5)delete this.repeatAt[k];else if(this.edges[k])this.repeatAt[k]=now+.4;else if(this.repeatAt[k]!==undefined&&now>=this.repeatAt[k]){this.edges[k]=true;this.repeatAt[k]=now+.14;}}this.previous=values;
      this.state={steerAxis:axis,accel:values.accel,brake:values.brake,reverse:menu?0:values.reverse,handbrake:values.handbrake>.5};return this.state;
    }
  }
  return {Controller,sanitize,read,steering,neutral};
})();
