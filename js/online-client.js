/* Room UI and prediction adapter. Offline races never enter this module's simulation. */
online=(()=>{
  const Net=DriftNet,$id=id=>document.getElementById(id),SESSION='drift:online:session:v1';
  let socket=null,room=null,selfId='',token='',intent=null,enabled=false,connecting=false,retry=0,retryTimer=0,connectTimer=0;
  let offset=0,bestPing=Infinity,ping=0,lastSnapshot=0,lastPing=0,lastRoomKey='',seq=0,ack=0,epoch=0,pending=[],outbox=[],gear=0,waiting=false;
  let raceActive=false,finished=false,rivalFrames=new Map(),remoteCars=new Map(),visibleRivals=[],hudAcc=0,oldDay=null,notice='',savedSession=null;
  let chatMessages=[];
  const now=()=>Date.now()+offset,me=()=>room?.players.find(p=>p.id===selfId),host=()=>room?.host===selfId;
  try{savedSession=JSON.parse(sessionStorage.getItem(SESSION)||'null');$id('onlineName').value=localStorage.getItem('drift:online:name')||'Piloto';}catch{}
  const requested=new URLSearchParams(location.search).get('sala');if(requested)$id('onlineCodeInput').value=requested.slice(0,6).toUpperCase();
  for(let i=1;i<=20;i++){const o=document.createElement('option');o.value=i;o.textContent=String(i).padStart(2,'0')+' · '+CircuitLayouts.build(i).name;$id('onlineTrack').appendChild(o);}
  function status(message){$id('onlineStatus').textContent=message;}
  function send(m){if(socket?.readyState===WebSocket.OPEN&&socket.bufferedAmount<32768){socket.send(JSON.stringify(m));return true;}return false;}
  function storeSession(){try{sessionStorage.setItem(SESSION,JSON.stringify({code:room.code,token}));}catch{}}
  function clearSession(){savedSession=null;try{sessionStorage.removeItem(SESSION);}catch{}}
  function renderChat(){
    $id('onlineChat').classList.toggle('hidden',!room);
    const list=$id('onlineChatMessages'),stick=list.scrollHeight-list.scrollTop-list.clientHeight<40;
    list.replaceChildren();
    for(const entry of chatMessages){const li=document.createElement('li'),name=document.createElement('b'),text=document.createElement('span');li.className=entry.player===selfId?'mine':'';name.textContent=entry.name; text.textContent=entry.text;li.append(name,text);list.appendChild(li);}
    if(!chatMessages.length){const li=document.createElement('li');li.className='chat-empty';li.textContent='Coordina la salida y comenta la carrera.';list.appendChild(li);}
    if(stick||chatMessages.at(-1)?.player===selfId)list.scrollTop=list.scrollHeight;
  }
  function connectingUI(value){connecting=value;$id('onlineCreate').disabled=$id('onlineJoin').disabled=value;}
  function open(){
    hidePanels();mode='online';$id('onlineMenu').classList.remove('hidden');$id('onlineHud').classList.add('hidden');
    $id('onlineEntry').classList.toggle('hidden',!!room);$id('onlineLobby').classList.toggle('hidden',!room);$id('onlineResults').classList.add('hidden');$id('onlineStart').classList.add('hidden');
    renderChat();$id('onlineBack').textContent=room?'← Salir de la sala':'← Menú principal';status('');enabled=true;
    if(room){showLobby();return;}
    $id('onlineName').focus();
    if(savedSession){intent={type:'resume',...savedSession};connect();}
  }
  function connect(){
    if(!enabled||socket?.readyState===0||socket?.readyState===1)return;
    if(!window.DRIFT_ONLINE_URL){status('El servidor online todavía no está configurado.');connectingUI(false);return;}
    connectingUI(true);status(retry?'Reconectando… tu plaza se conserva durante 20 segundos.':'Conectando… Si el servidor está dormido, el primer acceso puede tardar cerca de un minuto.');
    $id('onlineConnection').textContent='CONECTANDO…';
    const ws=new WebSocket(window.DRIFT_ONLINE_URL);socket=ws;
    clearTimeout(connectTimer);connectTimer=setTimeout(()=>{if(ws.readyState===0)ws.close();},25000);
    ws.onopen=()=>{if(socket!==ws)return;clearTimeout(connectTimer);send({type:'hello',version:Net.VERSION});lastPing=Date.now();send({type:'ping',client:lastPing});};
    ws.onmessage=e=>{if(socket!==ws)return;let m;try{m=JSON.parse(e.data);}catch{return;}receive(m);};
    ws.onerror=()=>{};
    ws.onclose=()=>{
      if(socket!==ws)return;socket=null;clearTimeout(connectTimer);connectingUI(false);
      if(!enabled)return;
      notice='Conexión interrumpida. Reconectando…';$id('onlineConnection').textContent='RECONECTANDO';
      if(room){intent={type:'resume',code:room.code,token};waiting=true;outbox=[];}
      if(++retry>12){status('No pudimos conectar. Revisa tu conexión e inténtalo otra vez.');enabled=false;return;}
      const delay=Math.min(8000,1000*2**Math.min(3,retry-1));status(notice);clearTimeout(retryTimer);retryTimer=setTimeout(connect,delay);
    };
  }
  function request(type){
    const code=$id('onlineCodeInput').value.trim().toUpperCase();
    if(type==='join'&&!/^[A-Z2-9]{6}$/.test(code)){status('Escribe el código de 6 caracteres de la sala.');$id('onlineCodeInput').focus();return;}
    const name=$id('onlineName').value.trim()||'Piloto';try{localStorage.setItem('drift:online:name',name);}catch{}
    intent={type,name,code,skin:chosen.sprite,auto:selectedTx()==='auto'};enabled=true;retry=0;connectingUI(true);
    if(socket?.readyState===1){send(intent);intent=null;}else connect();
  }
  function receive(m){
    if(m.type==='hello'){offset=m.now-Date.now();retry=0;if(intent){send(intent);intent=null;}return;}
    if(m.type==='pong'){
      const rtt=Date.now()-m.client;if(rtt<0||rtt>10000)return;ping=Math.round(rtt);
      if(rtt<bestPing+20){bestPing=Math.min(bestPing,rtt);offset=m.now-(m.client+Date.now())/2;}
      $id('onlineConnection').textContent=`CONECTADO · ${ping} ms`;$id('onlinePing').textContent=`${ping} ms`;return;
    }
    if(m.type==='chatError'){$id('onlineChatStatus').textContent=m.message;return;}
    if(m.type==='chat'&&room){if(!chatMessages.some(e=>e.id===m.entry.id)){chatMessages.push(m.entry);chatMessages=chatMessages.slice(-40);renderChat();}return;}
    if(m.type==='error'){status(m.message);connectingUI(false);return;}
    if(m.type==='expired'){const message=m.message;leave();open();status(message);return;}
    if(m.type==='welcome'){
      connectingUI(false);selfId=m.id;token=m.token;room=m.room;chatMessages=(m.chat||[]).slice(-40);renderChat();storeSession();notice='';status('');updateRoom(m.room);
      if(raceActive){waiting=true;rivalFrames.clear();send({type:'resync'});}return;
    }
    if(m.type==='room'){updateRoom(m);return;}
    if(m.type==='resync'){requestResync();return;}
    if(m.type==='reset'&&m.race===room?.race){
      epoch=m.epoch;ack=seq=m.ack;pending=[];outbox=[];Net.restore(player,m.state);DriftRoadContact.reset(track,player,chosen.sprite);waiting=false;lastSnapshot=Date.now();return;
    }
    if(m.type==='snapshot'&&m.race===room?.race&&raceActive){
      lastSnapshot=Date.now();notice='';
      if(m.epoch!==epoch){epoch=m.epoch;seq=m.ack;pending=[];outbox=[];}
      ack=m.ack;pending=pending.filter(c=>c[0]>ack);Net.restore(player,m.state);
      for(const c of pending)Net.step(player,c,track,false);
      if(waiting){seq=Math.max(seq,ack);waiting=false;}
      for(const p of m.players){
        const info=room.players.find(q=>q.id===p.id);if(info)Object.assign(info,{gates:p.gates,finished:p.finished,place:p.place,connected:p.connected,progress:p.progress});
        if(p.id===selfId){finished=!!p.finished;continue;}
        if(!rivalFrames.has(p.id))rivalFrames.set(p.id,[]);const frames=rivalFrames.get(p.id);frames.push({t:m.now,p:p.pose});while(frames.length>30)frames.shift();
      }
    }
  }
  function showLobby(){
    if(!room)return;hidePanels();mode='online';$id('onlineMenu').classList.remove('hidden');$id('onlineEntry').classList.add('hidden');$id('onlineLobby').classList.toggle('hidden',room.phase==='results');$id('onlineResults').classList.toggle('hidden',room.phase!=='results');$id('onlineBack').textContent='← Salir de la sala';
    if(raceActive){ // Menus cannot restart or pause the shared race.
      state='paused';document.body.classList.add('in-game');$id('onlineMenu').classList.add('hidden');$id('pauseMenu').classList.remove('hidden');pausedState='running';$id('pauseTitle').textContent='La carrera sigue en línea';return;
    }
    renderLobby();
  }
  function updateRoom(next){
    // Preserve snapshot progress between small lobby/connection updates.
    for(const p of next.players){const old=room?.players.find(q=>q.id===p.id);if(old?.gates!==undefined)p.gates=old.gates;}
    room=next;
    if(room.phase==='race'){
      const key=room.code+':'+room.race;if(key!==lastRoomKey){lastRoomKey=key;beginRace();}return;
    }
    if(room.phase==='results'){raceActive=false;controlsLocked=true;showResults();return;}
    if(replayUI?.active)replayUI.close();
    if(raceActive){raceActive=false;lastRoomKey='';}
    if(!$id('carPanel').classList.contains('hidden')){preparedTrack=presetTrack(room.level);$id('garageTrackName').textContent=preparedTrack.layout.name;renderLobby();return;}
    showLobby();
  }
  function renderLobby(){
    if(!room)return;const own=me(),isHost=host();$id('onlineRoomCode').textContent=room.code;$id('onlineRoomCount').textContent=`${room.players.length} / 3 pilotos`;
    const container=$id('onlinePlayers');container.replaceChildren();
    for(let i=0;i<3;i++){
      const p=room.players[i],card=document.createElement('section');card.className='online-player'+(!p?' empty':p.ready?' is-ready':'')+(p?.id===selfId?' is-you':'');
      const slot=document.createElement('span');slot.className='slot';slot.textContent=`0${i+1} / ${p?.id===room.host?'ANFITRIÓN':p?'PILOTO':'PLAZA LIBRE'}`;card.appendChild(slot);
      const title=document.createElement('h3');title.textContent=p?p.name+(p.id===selfId?' · tú':''):'Esperando…';card.appendChild(title);
      const car=document.createElement('p');car.textContent=p?CAR_DATA.find(c=>c.sprite===p.skin)?.name:'Invita con el código de arriba.';card.appendChild(car);
      const state=document.createElement('span');state.className='ready-state';state.textContent=p?!p.connected?'RECONECTANDO…':p.ready?'✓ LISTO':'ELIGIENDO AUTO':'—';card.appendChild(state);container.appendChild(card);
    }
    for(const id of ['onlineTrack','onlineLaps','onlineDay'])$id(id).disabled=!isHost||room.phase!=='lobby';
    $id('onlineTrack').value=room.level;$id('onlineLaps').value=room.laps;$id('onlineDay').value=room.day;
    $id('onlineReady').textContent=own?.ready?'CANCELAR LISTO':'ESTOY LISTO ✓';$id('onlineReady').disabled=room.phase!=='lobby';
    $id('onlineStart').classList.toggle('hidden',!isHost||room.phase!=='lobby');$id('onlineStart').disabled=room.players.length<2||!room.players.every(p=>p.ready&&p.connected);
    $id('onlineLobbyHint').textContent=room.players.length<2?'Comparte el código. Hace falta otro piloto para salir.':!room.players.every(p=>p.ready&&p.connected)?'Cada piloto elige su auto y marca «Estoy listo». Cambiar la pista cancela los estados listos.':isHost?'Todos listos. Tú das la salida.':'Todos listos. Esperando la salida del anfitrión.';
    const tr=presetTrack(room.level),c=$id('onlineTrackMap'),g=c.getContext('2d'),b=tr.bounds,s=Math.min(310/b.w,140/b.h);g.clearRect(0,0,c.width,c.height);g.save();g.translate(180-(b.minX+b.w/2)*s,90-(b.minY+b.h/2)*s);g.scale(s,s);g.lineWidth=3/s;g.strokeStyle='#d9e3dd';g.lineJoin='round';g.beginPath();tr.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.stroke();g.fillStyle='#ff7544';g.beginPath();g.arc(tr.points[0].x,tr.points[0].y,4/s,0,Math.PI*2);g.fill();g.restore();
  }
  function garage(){if(room?.phase!=='lobby')return;send({type:'ready',ready:false});mode='online';garageOrigin='online';preparedTrack=presetTrack(room.level);pendingTrackFactory=()=>preparedTrack;openCarPanel();}
  function confirmCar(){send({type:'choose',skin:chosen.sprite,auto:selectedTx()==='auto'});saveRenderPrefs();showLobby();}
  function beginRace(){
    const own=me();if(!own)return;
    hidePanels();carIdx=CAR_DATA.findIndex(c=>c.sprite===own.skin);chosen=CAR_DATA[carIdx];document.querySelector(`input[name="tx"][value="${own.auto?'auto':'manual'}"]`).checked=true;
    oldDay??=renderPrefs.timeOfDay;renderPrefs.timeOfDay=room.day;syncDaytimeUI();startWithTrack(presetTrack(room.level),'online');TOTAL_LAPS=room.laps;
    Net.grid(player,track,room.players.findIndex(p=>p.id===selfId));DriftRoadContact.reset(track,player,chosen.sprite);camera.tx=-player.pos.x*camera.s+view.width*.5;camera.ty=-player.pos.y*camera.s+view.height*.6;
    seq=ack=epoch=gear=0;pending=[];outbox=[];rivalFrames.clear();remoteCars.clear();visibleRivals=[];raceActive=true;finished=false;waiting=false;lastSnapshot=Date.now();notice='';
    document.body.classList.add('online-race');$id('onlineHud').classList.remove('hidden');$id('onlineMenu').classList.add('hidden');$id('pauseTitle').textContent='La carrera sigue en línea';$id('btnPause').textContent='Menú';$id('btnPause').setAttribute('aria-label','Abrir menú de carrera');
    countdown=Math.max(1,Math.ceil((room.startAt-now())/1000));controlsLocked=false;
  }
  function requestResync(){if(!waiting){waiting=true;outbox=[];send({type:'resync'});}}
  function simulate(step){
    if(!raceActive||!player)return;
    const remain=room.startAt-now();raceTime=Math.max(0,(now()-room.startAt)/1000);lapTime=raceTime;
    if(remain>0){countdown=Math.ceil(remain/1000);return;}
    if(state==='countdown'){state='running';syncTouchHUD();}if(state==='paused')pausedState='running';
    if(finished){controlsLocked=true;return;}
    if(!socket||socket.readyState!==1||waiting||Date.now()-lastSnapshot>1500){notice='Esperando conexión…';return;}
    if(pending.length>120){requestResync();return;}
    const inp=state==='running'?input():{brake:true,steerAxis:0};const c=Net.encode(inp,++seq,gear);gear=0;
    Net.step(player,c,track,true);DriftRoadContact.update(track,player,step,chosen.sprite);pending.push(c);outbox.push(c);
  }
  function frame(dt){
    if(!raceActive)return;visibleRivals=[];
    for(const info of room.players){if(info.id===selfId)continue;const pose=Net.interpolate(rivalFrames.get(info.id)||[],now()-100);if(!pose)continue;
      let car=remoteCars.get(info.id);if(!car){car=new Car(track);car.id=info.id;car.skin=info.skin;car.sprite=CAR_IMG[info.skin];car.color=CAR_DATA.find(c=>c.sprite===info.skin).color;remoteCars.set(info.id,car);}
      car.pos.x=pose[0];car.pos.y=pose[1];car.angle=pose[2];car.vel.x=pose[3];car.vel.y=pose[4];car.steerAngle=pose[5];car.name=info.name;car.connected=info.connected;DriftRoadContact.update(track,car,Math.min(dt,.05),info.skin);visibleRivals.push(car);
    }
    hudAcc+=dt;if(hudAcc<.1)return;hudAcc=0;
    const list=$id('onlineStandings');list.replaceChildren();
    const ranked=[...room.players].sort((a,b)=>(a.place||99)-(b.place||99)||(b.progress??b.gates??0)-(a.progress??a.gates??0));
    ranked.forEach((p,i)=>{const li=document.createElement('li');li.className=p.id===selfId?'you':'';const name=document.createElement('span'),progress=document.createElement('span');name.textContent=`${i+1}. ${p.name}${p.id===selfId?' · tú':''}`;progress.textContent=p.finished?'META':!p.connected?'…':`V ${Math.min(room.laps,1+Math.floor((p.gates||0)/16))}/${room.laps}`;li.append(name,progress);list.appendChild(li);});
    lap=Math.min(room.laps,1+Math.floor((me()?.gates||0)/16));
    $id('onlineRaceNotice').textContent=notice|| (finished?'¡Meta! Esperando a los demás…':state==='paused'?'La carrera continúa. Vuelve con «Seguir».':ping>220?'Latencia alta · Busca una conexión más estable.':'Shift: derrape · Espacio: freno');
  }
  function showResults(){
    if(!replayUI?.active)hidePanels();mode='online';if(!replayUI?.active)state='menu';$id('onlineHud').classList.add('hidden');$id('onlineMenu').classList.remove('hidden');$id('onlineEntry').classList.add('hidden');$id('onlineLobby').classList.add('hidden');$id('onlineResults').classList.remove('hidden');$id('onlineStart').classList.add('hidden');$id('onlineBack').textContent='← Salir de la sala';
    replayUI?.syncButtons();renderChat();const list=$id('onlineResultList');list.replaceChildren();
    [...room.players].sort((a,b)=>(a.place||99)-(b.place||99)).forEach(p=>{const li=document.createElement('li'),place=document.createElement('b'),name=document.createElement('span'),time=document.createElement('span');place.textContent=p.place?String(p.place).padStart(2,'0'):'—';name.className='online-result-name';name.textContent=p.name+(p.id===selfId?' · tú':'');time.textContent=p.finished?formatTime(p.finished/1000):'Sin terminar';li.append(place,name,time);list.appendChild(li);});
    $id('onlineRematch').disabled=!host();$id('onlineRematch').textContent=host()?'OTRA CARRERA ↗':'ESPERANDO AL ANFITRIÓN';status('');
  }
  function recover(){if(raceActive&&!finished){send({type:'recover'});toast('Volviendo al último control validado.');}}
  function leave(){
    replayUI?.close();
    if(!enabled&&!room)return;send({type:'leave'});enabled=false;intent=null;clearTimeout(retryTimer);clearTimeout(connectTimer);const ws=socket;socket=null;ws?.close();connectingUI(false);room=null;chatMessages=[];$id('onlineChatInput').value='';$id('onlineChatStatus').textContent='';renderChat();selfId=token='';raceActive=finished=waiting=false;lastRoomKey='';rivalFrames.clear();remoteCars.clear();visibleRivals=[];pending=[];outbox=[];clearSession();
    document.body.classList.remove('online-race');$id('onlineHud').classList.add('hidden');$id('onlineMenu').classList.add('hidden');$id('onlineConnection').textContent='HASTA 3 PILOTOS';TOTAL_LAPS=5;controlsLocked=false;$id('btnPause').textContent='Pausa';$id('btnPause').setAttribute('aria-label','Pausar');
    if(oldDay!==null){renderPrefs.timeOfDay=oldDay;oldDay=null;syncDaytimeUI();saveRenderPrefs();}
  }
  setInterval(()=>{
    if(!enabled||socket?.readyState!==1)return;
    if(Date.now()-lastPing>3000){lastPing=Date.now();send({type:'ping',client:lastPing});}
    if(raceActive&&outbox.length){const commands=outbox.slice(0,12);if(send({type:'inputs',race:room.race,epoch,commands}))outbox.splice(0,commands.length);}
  },50);
  $id('onlineChatForm').addEventListener('submit',e=>{e.preventDefault();const text=$id('onlineChatInput').value.trim();if(!text||!room)return;if(send({type:'chat',text})){$id('onlineChatInput').value='';$id('onlineChatStatus').textContent='';}else $id('onlineChatStatus').textContent='Reconectando. Tu mensaje sigue aquí para reenviarlo.';});
  $id('btnModeOnline').addEventListener('click',open);$id('onlineCreate').addEventListener('click',()=>request('create'));$id('onlineJoin').addEventListener('click',()=>request('join'));$id('onlineCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();request('join');}});
  $id('onlineBack').addEventListener('click',showMainMenu);$id('onlineGarage').addEventListener('click',garage);$id('onlineReady').addEventListener('click',()=>send({type:'ready',ready:!me()?.ready}));$id('onlineStart').addEventListener('click',()=>send({type:'start'}));$id('onlineRematch').addEventListener('click',()=>send({type:'rematch'}));
  for(const id of ['onlineTrack','onlineLaps','onlineDay'])$id(id).addEventListener('change',()=>send({type:'settings',level:Number($id('onlineTrack').value),laps:Number($id('onlineLaps').value),day:Number($id('onlineDay').value)}));
  $id('onlineCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(room.code);status('Código copiado. Compártelo con tus amigos.');}catch{status('Código de sala: '+room.code);}});
  addEventListener('beforeunload',()=>socket?.close());
  return {open,showLobby,confirmCar,leave,recover,simulate,frame,shift:d=>gear=d,rivals:()=>visibleRivals,draw2D(g,cam){for(const car of visibleRivals){car.draw(g,cam);g.save();g.font='11px system-ui';g.textAlign='center';g.fillStyle='#e5ffff';g.fillText(car.name,car.pos.x*cam.s+cam.tx,car.pos.y*cam.s+cam.ty-35);g.restore();}},get inRoom(){return !!room;},get racing(){return raceActive;}};
})();
