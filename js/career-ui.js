/* Workshop is part of car selection. This layer never advances the simulation. */
let workshopPart='engine',garageCosmetics=DriftCareer.cosmetics(DriftCareer.load().cars[chosen.sprite]);
const creditsNumber=n=>Math.round(n).toLocaleString('es-CL');
function missionText(m){return m.id==='clean'?m.label:`${m.label} ${creditsNumber(m.target)} puntos${m.id==='longest'?' sin perder la racha':''}`;}
function campaignMissionHTML(level,earned=DriftCareer.load().missions[level]){return DriftCareer.objectives(level).map((m,i)=>`<li class="${earned[i]?'complete':''}"><span aria-label="${earned[i]?'Cumplido':'Pendiente'}">${earned[i]?'✓':'○'}</span><span>${missionText(m)}</span></li>`).join('');}
function syncCareerWallet(){const p=DriftCareer.load(),text=`${creditsNumber(p.cash)} CR · ${DriftCareer.stars(p)}/60 OBJETIVOS`;for(const id of ['homeWallet','garageWallet','workshopWallet'])$('#'+id).textContent=text;}
function careerReward(won){const result=careerRun?.finish({valid:true,won});syncCareerWallet();return result?.error?'<br>'+result.error:result?.reward?`<br><strong class="reward">+${creditsNumber(result.reward)} CR</strong> · Guardados en tu taller`:'';}
function finishCampaign(){
  careerRun?.observe(player,0);const result=careerRun?.finish({valid:true});
  if(result?.ok){unlockedLevel=result.profile.unlocked;saveChallengeProgress();}
  saveChallengeBest(activeChallengeLevel,careerRun?.bestScore||player.score);challengeCompletedThisRun=!!result?.complete;state=result?.complete?'challengeWon':'finished';
  syncCareerWallet();
  showOverlay({title:result?.complete?'ETAPA COMPLETADA':'UNA VUELTA MÁS',msg:`<span class="result-caption">ETAPA ${activeChallengeLevel} · Los objetivos conseguidos se conservan.</span><ol class="campaign-objectives result-objectives">${campaignMissionHTML(activeChallengeLevel)}</ol><strong class="reward">+${creditsNumber(result?.reward||0)} CR</strong>${result?.error?'<br>'+result.error:''}${result?.complete?'<br>La siguiente etapa está disponible.':'<br>Vuelve a intentarlo para completar los objetivos pendientes.'}`});
}
const partPaths={engine:'M3 8h4V5h8v3h4v3h2v7h-4l-2 2H7l-3-3H3z M9 2h5 M11 2v3',gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',tire:'M18 12a6 9 0 1 1-12 0 6 9 0 0 1 12 0 M14 12a2 5 0 1 1-4 0 2 5 0 0 1 4 0 M7 6h10 M7 18h10',brake:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M17 5h4v10h-4',spring:'M8 2h8 M12 2v3l-5 2 10 3-10 3 10 3-5 3v3 M8 22h8',chassis:'M5 3h14v18H5z M5 3l14 18 M19 3L5 21 M3 6h2 M19 6h2 M3 18h2 M19 18h2',steer:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 11h6l3 4 3-4h6 M12 15v6',chip:'M6 6h12v12H6z M9 1v5 M15 1v5 M9 18v5 M15 18v5 M1 9h5 M18 9h5 M1 15h5 M18 15h5',bolt:'M13 2L4 14h7l-1 8 10-13h-8z',light:'M5 17h14 M7 13h10 M3 21h18 M8 9V4h8v5',smoke:'M4 19c-4-4 1-9 4-6-3-6 5-10 7-4 5-3 9 5 4 8 M8 21h9'};
function partIcon(icon){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${partPaths[icon]||partPaths.engine}"/></svg>`;}
function workshopCar(config){const c=configureSelectedCar(new Car(preparedTrack||presetTrack(1)),chosen);if(config)DriftCareer.apply(c,chosen.sprite,config);return c;}
function updateGaragePerformance(){
  const config=DriftCareer.load().cars[chosen.sprite],base=DriftCareer.metrics(workshopCar()),now=DriftCareer.metrics(workshopCar(mode==='online'?null:config));
  const ratios={barAcc:now.acceleration/base.acceleration,barTrq:now.acceleration*now.mass/(base.acceleration*base.mass),barVmax:now.speed/base.speed,barMass:now.mass/base.mass};
  for(const [id,key]of [['barAcc','acc'],['barTrq','trq'],['barVmax','vmax'],['barMass','mass']])$('#'+id).style.width=Math.min(100,chosen.stats[key]*ratios[id]*100)+'%';
}
function performanceChart(current,preview){
  const stock=DriftCareer.metrics(workshopCar()),now=DriftCareer.metrics(workshopCar(current)),next=DriftCareer.metrics(workshopCar(preview));
  const rows=[['acceleration','Aceleración',' m/s²'],['speed','Velocidad máxima',' km/h'],['handling','Agarre lateral',''],['braking','Frenado',' m/s²'],['mass','Masa',' kg']];
  const detail={flywheel:['throttle','Respuesta del acelerador',''],clutch:['shift','Tiempo de cambio',' s'],springs:['spring','Firmeza',' ×'],dampers:['damping','Control de rebote',' ×'],steering:['steering','Respuesta de dirección',' rad/s'],driftControl:['driftGrip','Agarre en derrape',''],differential:['driftGrip','Agarre en derrape',''],driftBoost:['boost','Empuje durante el derrape',' ×']}[workshopPart];if(detail)rows.push(detail);
  $('#performanceChart').innerHTML=rows.map(([key,label,unit])=>{const scale=Math.max(stock[key],now[key],next[key])*1.15;return `<div class="performance-row"><div><b>${label}</b><span>${stock[key].toFixed(key==='mass'||key==='speed'?0:2)} / ${now[key].toFixed(key==='mass'||key==='speed'?0:2)} / <strong>${next[key].toFixed(key==='mass'||key==='speed'?0:2)}${unit}</strong></span></div><div class="compare-bars"><i style="width:${stock[key]/scale*100}%"></i><i style="width:${now[key]/scale*100}%"></i><i style="width:${next[key]/scale*100}%"></i></div></div>`;}).join('');
}
function syncWorkshop(){
  const p=DriftCareer.load(),skin=chosen.sprite,c=p.cars[skin],item=DriftCareer.part(skin,workshopPart),owned=c.owned[item.id],tier=Math.min(item.max,owned+1),cost=DriftCareer.price(skin,item.id,tier),required=DriftCareer.tierStars(tier),all=owned>=item.max;
  garageCosmetics=mode==='online'?{paint:c.paintColor}:DriftCareer.cosmetics(c);syncCareerWallet();syncPaint();$('#paintStatus').textContent='';
  $('#workshopCar').textContent=chosen.name;$('#workshopProfile').textContent=DriftCareer.profiles[skin].name;
  const projected=JSON.parse(JSON.stringify(c));projected.active[item.id]=all?c.active[item.id]:tier;
  performanceChart(c,projected);
  $('#partCategories').innerHTML=DriftCareer.catalog.map(x=>`<button data-part="${x.id}" aria-pressed="${x.id===item.id}" title="${DriftCareer.part(skin,x.id).name}">${partIcon(x.icon)}<span>${DriftCareer.part(skin,x.id).name}</span><small>${c.owned[x.id]}/${x.max}</small></button>`).join('');
  $('#partCategories').querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>{workshopPart=b.dataset.part;syncWorkshop();$('#workshopStatus').textContent='';}));
  const cosmetic=item.id==='neon'||item.id==='smoke',paintEnabled=item.id==='neon'?owned>0:owned===3,colorKey=item.id==='neon'?'neonColor':'smokeColor';
  $('#partDetails').innerHTML=`<div class="part-title">${partIcon(item.icon)}<div><h4>${item.name}</h4><span>${all?'DESARROLLO COMPLETO':'VISTA PREVIA · NIVEL '+tier}</span></div></div><p>${item.description}</p><label class="equip-level">Nivel instalado <b>${c.active[item.id]===0?'Serie / apagado':c.active[item.id]}</b><input id="equipLevel" type="range" min="0" max="${owned}" value="${c.active[item.id]}" step="1" aria-label="Nivel instalado de ${item.name}" ${owned===0?'disabled':''}></label>${cosmetic?`<div class="color-options" aria-label="Color de ${item.name}">${DriftCareer.colors.map((color,i)=>`<button data-color="${color}" style="--swatch:${color}" aria-label="${['Cian','Naranja','Violeta','Verde','Amarillo','Blanco'][i]}" aria-pressed="${c[colorKey]===color}" ${paintEnabled?'':'disabled'}></button>`).join('')}</div>`:''}<div class="purchase-row"><span>${all?'Comprado':creditsNumber(cost)+' CR'}<small>${all?'Puedes volver a montar cualquier nivel comprado.':required>DriftCareer.stars(p)?'Se abre con '+required+' objetivos':p.cash<cost?'Gana carreras para reunir créditos':'Disponible para este auto'}</small></span><button id="buyPart" ${all||required>DriftCareer.stars(p)||p.cash<cost?'disabled':''}>${all?'COMPLETO':'COMPRAR ↗'}</button></div>`;
  $('#buyPart').addEventListener('click',()=>{const result=DriftCareer.purchase(chosen.sprite,workshopPart);syncWorkshop();$('#workshopStatus').textContent=result.ok?'Pieza comprada e instalada. Se aplicará en tu próxima carrera.':result.error;});
  $('#equipLevel').addEventListener('input',e=>{const ok=DriftCareer.equip(chosen.sprite,workshopPart,Number(e.target.value));syncWorkshop();$('#workshopStatus').textContent=ok?'Preparación guardada.':'No se pudo guardar.';});
  $('#partDetails').querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{if(DriftCareer.color(skin,colorKey,b.dataset.color))syncWorkshop();}));
}
$('#btnWorkshop').addEventListener('click',()=>{$('#garageOverview').classList.add('hidden');$('#workshop').classList.remove('hidden');$('#carPanel').classList.add('workshop-open');$('#carPanel .preparation-header h2').textContent='PREPARA TU AUTO';syncWorkshop();$('#btnWorkshopBack').focus();});
function closeWorkshop(){updateGaragePerformance();$('#workshop').classList.add('hidden');$('#garageOverview').classList.remove('hidden');$('#carPanel').classList.remove('workshop-open');$('#carPanel .preparation-header h2').textContent='ELIGE TU MÁQUINA';$('#btnWorkshop').focus();}
$('#btnWorkshopBack').addEventListener('click',closeWorkshop);
$('#btnCredits').addEventListener('click',()=>{hidePanels();$('#creditsMenu').classList.remove('hidden');$('#btnCreditsBack').focus();});
$('#btnCreditsBack').addEventListener('click',()=>{showMainMenu();$('#btnCredits').focus();});

$('#modelCredits').innerHTML=`<article><h3>Pudim Abestado</h3><p><a href="https://sketchfab.com/3d-models/rx7-fd-redsuns-keisuke-takahashi-b76c1a819fd34cd6b139dceb705d2e8e" target="_blank" rel="noopener">RX7 FD “RedSuns” Keisuke Takahashi ↗</a></p><p><a href="https://sketchfab.com/3d-models/ae86-low-poly-fujiwara-tofu-shop-version-2-9ec1194ab2d1441bb8f8bae8d83fb204" target="_blank" rel="noopener">AE86 Low Poly Fujiwara Tofu Shop (Version 2) ↗</a></p><small>Modelos adaptados a escala y pivotes del juego. Licencia declarada en los archivos originales: <a href="https://sketchfab.com/licenses" target="_blank" rel="noopener">Sketchfab Standard</a>.</small></article><article><h3>3DDomino</h3><p><a href="https://sketchfab.com/3d-models/yugo-koral-55-1e2dcf759a4f47f9b2832af5e3c9b85d" target="_blank" rel="noopener">Yugo Koral 55 ↗</a></p><small><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Adaptación para DR1FT: retopología, ruedas, atlas pixelado, UV y pivotes nuevos a partir del modelo de 3DDomino.</small></article><article><h3>Chevrolet Nova SS · Nissan Skyline R34</h3><p>Modelos y texturas aportados por Diego Bastias A.</p><small>Adaptación para DR1FT: conversión a GLB, pivotes de ruedas y conexión de luces y efectos. Autor original no indicado en los archivos recibidos.</small></article>`;
$('#modelCredits').insertAdjacentHTML('beforeend', `<article><h3>Plymouth Barracuda · 1970</h3><p>Modelo y texturas del archivo 1970-plymouth-barracuda-gen-iii.zip aportado por Diego Bastias A.</p><small>Adaptación para DR1FT: escala, ruedas, luces y conducción V8. Autor original no identificado en el archivo recibido.</small></article><article><h3>GT Racing 2 · Glen Canyon Dam</h3><p>Escenario de GT Racing 2 (Gameloft), publicado por <a href="https://sketchfab.com/amogusstrikesback2" target="_blank" rel="noopener">amogusstrikesback2</a>.</p><small><a href="https://sketchfab.com/3d-models/gt-racing-2-glen-canyon-dam-194f8a8c465f4e578ef45e3a4cc3932a" target="_blank" rel="noopener">Modelo original</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, según sus metadatos. Adaptación para DR1FT: trazado, superficies transitables, colisiones y compresión de texturas.</small></article><article><h3>Vegetación low poly</h3><p>Low Poly Pine Tree y Trees Low Poly, archivos aportados por Diego Bastias A.</p><small>Adaptación para DR1FT: instancias y niveles de detalle. Autor original no identificado en los archivos recibidos.</small></article>`);
syncCareerWallet();


function syncPaint(){
  const selected=DriftCareer.load().cars[chosen.sprite].paintColor;
  $('#paintName').textContent=DriftCareer.paints.find(p=>p.color===selected)?.name||'Personalizado';
  $('#paintCustom').value=selected||chosen.color;
  $('#paintOptions').innerHTML=DriftCareer.paints.map(p=>`<button type="button" data-paint="${p.color||'original'}" style="--swatch:${p.color||chosen.color}" aria-label="Pintura ${p.name}" title="${p.name}" aria-pressed="${selected===p.color}">${p.color?'':'↺'}</button>`).join('');
  $('#paintOptions').querySelectorAll('[data-paint]').forEach(b=>b.addEventListener('click',()=>choosePaint(b.dataset.paint==='original'?null:b.dataset.paint)));
}
function choosePaint(color){
  if(!DriftCareer.setPaint(chosen.sprite,color)){$('#paintStatus').textContent='No se pudo guardar el color.';return;}
  const config=DriftCareer.load().cars[chosen.sprite];garageCosmetics=mode==='online'?{paint:config.paintColor}:DriftCareer.cosmetics(config);
  syncPaint();drawCarPreview();$('#paintStatus').textContent='Pintura guardada para este auto.';
}
$('#paintCustom').addEventListener('change',e=>choosePaint(e.target.value));

$('#modelCredits').innerHTML+=`<article><h3>NFS III Especial</h3><p>Summit · Rocky Pass · Redrock Ridge</p><small>Modelos aportados por Diego Bastias A. Summit: amogusstrikesback2 · CC BY 4.0 declarada en el archivo. <a href="assets/SCENERY-CREDITS.md" target="_blank" rel="noopener">Procedencia, atribución y adaptaciones</a>.</small></article>`;

$('#modelCredits').insertAdjacentHTML('beforeend', `<article><h3>Subaru Impreza WRX STI S206 NBR · BMW M3 GTR E46 Straßenversion · Ford Shelby GT500 2013 · Ford Mustang GT Fastback</h3><p>Modelos y texturas de los cuatro archivos aportados por Diego Bastias A.</p><small>Adaptación para DR1FT: escala, ruedas independientes, iluminación, pintura y perfiles de conducción. Autor original no identificado en los archivos recibidos.</small></article>`);
