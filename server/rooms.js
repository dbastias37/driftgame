import {randomBytes,randomInt} from 'node:crypto';
import {Net,createTrack,createCar} from './engine.js';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanName=n=>typeof n==='string'?n.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,18)||'Piloto':'Piloto';
const error=message=>({type:'error',message});
export class Rooms {
  constructor({now=Date.now,countdown=4000,maxRooms=24}={}){this.rooms=new Map();this.now=now;this.countdown=countdown;this.maxRooms=maxRooms;}
  send(p,m){if(p.peer?.open)p.peer.send(m);}
  view(r){return {type:'room',code:r.code,host:r.host,phase:r.phase,level:r.level,laps:r.laps,day:r.day,race:r.race,startAt:r.startAt,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,skin:p.skin,auto:p.auto,ready:p.ready,connected:!!p.peer?.open,place:p.place||0,finished:p.finished||0,lap:Math.min(r.laps,(p.gates||0)/16|0)+1}))};}
  broadcast(r,m=this.view(r)){for(const p of r.players.values())this.send(p,m);}
  roomFor(peer){return this.rooms.get(peer.room);}
  handle(peer,m){
    if(!m||typeof m!=='object'||Array.isArray(m))return;
    if(m.type==='ping'){peer.send({type:'pong',client:m.client,now:this.now()});return;}
    if(m.type==='hello'){
      if(m.version!==Net.VERSION){peer.send(error('Actualiza el juego para entrar al online.'));return;}
      peer.version=true;peer.send({type:'hello',version:Net.VERSION,now:this.now()});return;
    }
    if(!peer.version){peer.send(error('Actualiza el juego.'));return;}
    if(m.type==='create'||m.type==='join'||m.type==='resume'){
      if(peer.room){peer.send(error('Ya estás en una sala.'));return;}
      let r,p;
      if(m.type==='resume'){
        r=this.rooms.get(String(m.code));p=r&&[...r.players.values()].find(p=>p.token===m.token&&p.until>=this.now());
        if(!p){peer.send({type:'expired',message:'La sala terminó o tu plaza ya expiró. Puedes crear otra.'});return;}
        p.peer?.close?.();p.peer=peer;p.until=Infinity;p.queue=[];p.received=p.ack;
      }else{
        if(m.type==='create'){
          if(this.rooms.size>=this.maxRooms){peer.send(error('Servidor beta lleno. Intenta en unos minutos.'));return;}
          let code;do{code=Array.from({length:6},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');}while(this.rooms.has(code));
          r={code,players:new Map(),phase:'lobby',level:1,laps:3,day:0,race:0,created:this.now(),updated:this.now()};this.rooms.set(code,r);
        }else r=this.rooms.get(String(m.code||'').trim().toUpperCase());
        if(!r){peer.send(error('No encontramos esa sala. Revisa el código.'));return;}
        if(r.phase!=='lobby'){peer.send(error('Esta carrera ya comenzó. Espera la próxima salida.'));return;}
        if(r.players.size>=3){peer.send(error('Sala llena: máximo 3 pilotos.'));return;}
        p={id:randomBytes(8).toString('hex'),token:randomBytes(24).toString('hex'),name:cleanName(m.name),skin:Net.SKINS.includes(m.skin)?m.skin:'blue',auto:m.auto!==false,ready:false,peer,until:Infinity};
        r.players.set(p.id,p);if(!r.host)r.host=p.id;
      }
      peer.room=r.code;peer.player=p.id;r.updated=this.now();
      this.send(p,{type:'welcome',id:p.id,token:p.token,room:this.view(r),now:this.now()});
      if(p.car)this.send(p,this.snapshot(r,p));this.broadcast(r);return;
    }
    const r=this.roomFor(peer),p=r?.players.get(peer.player);if(!r||!p||p.peer!==peer)return;
    r.updated=this.now();
    switch(m.type){
      case 'leave':this.remove(r,p);break;
      case 'choose':if(r.phase==='lobby'&&Net.SKINS.includes(m.skin)){p.skin=m.skin;p.auto=m.auto!==false;p.ready=false;this.broadcast(r);}break;
      case 'ready':if(r.phase==='lobby'){p.ready=m.ready===true;this.broadcast(r);}break;
      case 'settings':
        if(r.phase==='lobby'&&r.host===p.id&&Number.isInteger(m.level)&&m.level>=1&&m.level<=20&&Number.isInteger(m.laps)&&m.laps>=1&&m.laps<=5&&Number.isFinite(m.day)&&m.day>=0&&m.day<=1){
          r.level=m.level;r.laps=m.laps;r.day=m.day;for(const p of r.players.values())p.ready=false;this.broadcast(r);
        }break;
      case 'start':
        if(r.phase!=='lobby'||r.host!==p.id)return;
        if(r.players.size<2||![...r.players.values()].every(p=>p.ready&&p.peer?.open)){this.send(p,error('Se necesitan al menos 2 pilotos conectados y todos listos.'));return;}
        r.track=createTrack(r.level);r.phase='race';r.race++;r.startAt=this.now()+this.countdown;r.finishBy=0;r.order=[];
        [...r.players.values()].forEach((p,slot)=>{p.car=createCar(r.track,p.skin,p.auto,slot);p.queue=[];p.ack=p.received=p.applied=p.gates=p.finished=p.place=p.progress=0;p.lastIndex=0;p.recoveryAt=0;p.epoch=0;});
        this.broadcast(r);for(const p of r.players.values())this.send(p,this.snapshot(r,p));break;
      case 'inputs':
        if(r.phase!=='race'||p.finished||m.race!==r.race||m.epoch!==p.epoch||!Array.isArray(m.commands)||m.commands.length>12)return;
        for(const c of m.commands){
          if(!Net.validCommand(c)||c[0]<=p.received)continue;
          if(c[0]!==p.received+1||p.queue.length>=120){this.send(p,{type:'resync'});return;}
          p.queue.push(c);p.received=c[0];
        }break;
      case 'recover':if(r.phase==='race'&&!p.finished&&this.now()>=r.startAt&&this.now()>=p.recoveryAt)this.recover(r,p);break;
      case 'resync':if(p.car){p.queue=[];p.received=p.ack;this.send(p,{type:'reset',race:r.race,epoch:p.epoch,ack:p.ack,state:Net.capture(p.car)});}break;
      case 'rematch':if(r.phase==='results'&&r.host===p.id){r.phase='lobby';for(const p of r.players.values()){p.ready=false;p.car=null;p.finished=p.place=0;}this.broadcast(r);}break;
    }
  }
  recover(r,p){
    const i=Math.floor((p.gates%16)*r.track.points.length/16),a=r.track.point(i);p.car.pos={x:a.x,y:a.y};p.car.angle=r.track.tangentAt(i);p.car.vel={x:0,y:0};p.car.omega=p.car.throttleSm=p.car.offTimer=0;p.lastIndex=i;p.progress=p.gates;
    p.queue=[];p.received=p.ack;p.epoch++;p.recoveryAt=this.now()+2000;
    this.send(p,{type:'reset',race:r.race,epoch:p.epoch,ack:p.ack,state:Net.capture(p.car)});
  }
  advance(r,p,previous,current){
    const L=r.track.points.length,gate=Math.round(((p.gates+1)%16)*L/16),wrap=gate===0;
    const crossed=wrap?previous>L*.9&&current<L*.1:previous<gate&&current>=gate&&current-previous<L*.08;
    if(crossed&&Math.abs(r.track.sample(p.car.pos.x,p.car.pos.y).dist)<=r.track.roadHalf+2){
      p.gates++;if(p.gates>=r.laps*16){p.finished=Math.max(1,this.now()-r.startAt);p.place=r.order.push(p.id);p.car.vel.x=p.car.vel.y=0;p.queue=[];if(!r.finishBy)r.finishBy=this.now()+90000;this.broadcast(r);}
    }
  }
  snapshot(r,self){return {type:'snapshot',now:this.now(),race:r.race,epoch:self.epoch,ack:self.ack,state:Net.capture(self.car),players:[...r.players.values()].filter(p=>p.car).map(p=>({id:p.id,pose:Net.pose(p.car).map(n=>Math.round(n*1000)/1000),gates:p.gates,progress:p.progress,finished:p.finished,place:p.place,connected:!!p.peer?.open}))};}
  tick(){
    const now=this.now();
    for(const r of this.rooms.values()){
      for(const p of [...r.players.values()])if(p.until<now)this.remove(r,p);
      if(!this.rooms.has(r.code))continue;
      if(r.phase==='lobby'&&now-r.updated>30*60e3){this.broadcast(r,{type:'expired',message:'La sala se cerró por inactividad.'});this.rooms.delete(r.code);continue;}
      if(r.phase!=='race'||now<r.startAt)continue;
      const budget=Math.floor((now-r.startAt)*60/1000)+2;
      for(const p of r.players.values()){
        if(p.finished||!p.car)continue;
        for(let n=0;n<6&&p.queue.length&&p.applied<budget;n++){
          const c=p.queue.shift(),before=r.track.nearestIndex(p.car.pos.x,p.car.pos.y);
          Net.step(p.car,c,r.track,false);p.ack=c[0];p.applied++;const current=r.track.nearestIndex(p.car.pos.x,p.car.pos.y);this.advance(r,p,before,current);p.lastIndex=current;
          const L=r.track.points.length,base=Math.round((p.gates%16)*L/16),along=(current-base+L)%L;p.progress=p.gates+Math.max(0,Math.min(.99,along/(L/16)));
          if(p.finished)break;
          if(p.car.offTimer>=12){this.recover(r,p);break;}
        }
      }
      if([...r.players.values()].every(p=>p.finished)||r.finishBy&&now>=r.finishBy||now-r.startAt>15*60e3){r.phase='results';this.broadcast(r);}
    }
  }
  snapshots(){for(const r of this.rooms.values())if(r.phase==='race')for(const p of r.players.values())if(p.car)this.send(p,this.snapshot(r,p));}
  disconnect(peer){const r=this.roomFor(peer),p=r?.players.get(peer.player);if(!p||p.peer!==peer)return;p.peer=null;p.until=this.now()+20000;p.ready=false;if(r.host===p.id)r.host=[...r.players.values()].find(q=>q.peer?.open)?.id||p.id;this.broadcast(r);}
  remove(r,p){if(p.peer){p.peer.room=null;p.peer.player=null;}r.players.delete(p.id);if(!r.players.size){this.rooms.delete(r.code);return;}if(r.host===p.id)r.host=[...r.players.values()].find(q=>q.peer?.open)?.id||r.players.keys().next().value;this.broadcast(r);}
}
