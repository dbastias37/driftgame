/* Closed circuit recipes: straights, sweepers, hairpins and linked reversals.
 * Coordinates describe an ORIGINAL layout, not a traced real circuit. Each
 * vertex carries its corner radius. The builder joins tangent cubic arcs to
 * real straight sections, then samples the entire lap by distance (including
 * the closing seam). This file does not know about cars or render materials.
 */
globalThis.CircuitLayouts=(()=>{
  'use strict';
  const stages=['Escuela','Enlaces','Técnico','Avanzado','Maestría'];
  const recipes=[
    ['Club',720,[[0,170,60],[300,170,65],[340,30,70],[200,-30,90],[0,0,60]]],
    ['Herradura',790,[[0,220,60],[330,220,60],[330,0,70],[210,0,45],[175,90,45],[0,70,65]]],
    ['Doble radio',860,[[0,200,55],[360,200,65],[390,60,65],[280,-20,75],[190,20,45],[120,90,50],[-20,50,60]]],
    ['Primera S',940,[[0,240,65],[400,240,70],[420,30,65],[280,-20,65],[210,65,50],[100,35,45],[-20,-10,60],[-70,130,70]]],
    ['Enlace norte',1040,[[0,240,65],[400,240,65],[430,30,60],[300,-10,55],[220,100,45],[145,90,40],[140,-40,45],[-20,-30,60],[-70,100,70]]],
    ['Retorno',1120,[[0,0,70],[500,0,70],[560,-100,65],[500,-200,65],[330,-170,50],[300,-80,45],[180,-100,45],[80,-270,60],[-60,-250,65],[-120,-80,75]]],
    ['Doble enlace',1200,[[0,270,70],[460,270,70],[490,120,65],[390,50,45],[370,-70,55],[230,-100,65],[180,20,45],[270,100,40],[130,150,45],[40,35,55],[-80,90,70]]],
    ['Horquilla oeste',1280,[[0,100,65],[230,100,65],[270,-40,60],[140,-140,50],[260,-240,55],[250,-380,65],[60,-410,65],[-10,-280,60],[70,-190,50],[-50,-100,55],[-60,20,60]]],
    ['Chicana',1380,[[0,280,70],[500,280,70],[500,80,55],[390,70,40],[340,-40,50],[200,-80,60],[150,20,40],[240,95,40],[160,170,40],[30,100,40],[20,-80,55],[-130,0,65]]],
    ['Lazo interior',1460,[[0,0,65],[530,0,75],[590,-140,70],[500,-250,65],[360,-220,55],[340,-90,45],[200,-90,45],[150,-280,65],[240,-410,60],[180,-530,60],[0,-550,70],[-100,-410,75],[-80,-150,65]]],
    ['Sector mixto',1540,[[0,0,65],[530,0,75],[590,-140,70],[490,-280,75],[340,-320,80],[120,-500,75],[-100,-380,70],[-80,-250,55],[50,-220,55],[180,-300,50],[290,-220,45],[150,-100,45],[-50,-100,50]]],
    ['Eses del valle',1620,[[0,0,65],[540,0,75],[610,-130,70],[520,-220,65],[260,-210,55],[160,-100,50],[30,-150,50],[70,-320,55],[420,-340,60],[490,-460,60],[350,-450,70],[30,-520,75],[-100,-340,80],[-120,-120,70]]],
    ['Doble horquilla',1740,[[0,330,65],[570,330,75],[600,150,65],[500,80,40],[510,-90,60],[340,-140,65],[250,-20,45],[360,65,40],[310,180,40],[180,200,45],[120,60,40],[150,-90,45],[0,-130,65],[-130,-20,60],[-80,150,50]]],
    ['Enlaces largos',1830,[[0,0,65],[680,0,75],[740,-140,70],[620,-250,65],[500,-170,55],[350,-160,55],[250,-280,55],[300,-420,60],[470,-430,55],[550,-570,65],[400,-690,75],[150,-650,75],[10,-510,65],[80,-360,55],[-60,-240,65],[-110,-100,65]]],
    ['Retorno técnico',1920,[[0,0,65],[580,0,75],[650,-160,75],[530,-290,65],[400,-280,55],[410,-150,55],[260,-140,50],[190,-270,55],[300,-370,65],[500,-430,60],[470,-580,65],[250,-650,80],[80,-570,65],[20,-430,55],[-130,-350,65],[-160,-160,70],[-60,-80,50]]],
    ['Triple transición',2010,[[0,0,70],[650,0,75],[740,-140,75],[680,-310,70],[550,-340,60],[500,-170,55],[360,-160,50],[300,-290,55],[400,-420,60],[360,-560,65],[160,-620,75],[-60,-530,75],[-100,-390,65],[100,-350,60],[180,-240,55],[80,-130,50],[-100,-170,60]]],
    ['Grandes eses',2150,[[0,420,70],[700,420,80],[740,240,70],[620,130,45],[660,-70,60],[490,-150,65],[340,-100,50],[290,20,40],[430,90,40],[490,230,45],[340,300,45],[220,210,40],[190,70,40],[100,30,40],[80,-120,55],[-80,-150,65],[-190,0,65],[-120,150,50],[-10,230,45]]],
    ['Laberinto fluido',2280,[[0,0,70],[650,0,80],[740,-100,75],[700,-250,65],[550,-310,60],[340,-260,55],[260,-130,50],[120,-140,50],[100,-330,55],[290,-430,60],[560,-420,65],[680,-500,60],[620,-660,70],[440,-720,70],[210,-670,60],[130,-540,50],[-80,-540,65],[-190,-380,70],[-70,-240,55],[-110,-100,55]]],
    ['Complejo de curvas',2410,[[0,0,75],[800,0,90],[900,-160,80],[850,-330,75],[680,-360,65],[600,-200,60],[440,-210,60],[400,-360,65],[530,-480,65],[730,-510,65],[760,-680,75],[600,-800,85],[400,-760,75],[280,-600,65],[150,-540,60],[100,-360,60],[220,-300,55],[170,-170,50],[20,-200,55],[-130,-350,65],[-150,-150,75]]],
    ['Gran final',2550,[[0,0,75],[860,0,90],[940,-160,85],[840,-300,75],[650,-320,70],[540,-180,60],[380,-180,60],[320,-350,65],[460,-450,65],[700,-420,65],[830,-520,75],[780,-710,75],[600,-810,85],[410,-740,75],[300,-590,65],[120,-580,60],[40,-720,60],[-130,-690,65],[-230,-500,85],[-120,-330,65],[-30,-280,50],[-90,-140,60]]],
  ];
  const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const cache=new Map();
  function levelNumber(n){return Math.max(1,Math.min(recipes.length,Math.trunc(Number(n))||1));}
  function info(n){
    n=levelNumber(n);const [name,length,vertices]=recipes[n-1];
    return {level:n,name,length,corners:vertices.length,stage:stages[Math.floor((n-1)/4)],roadHalf:n<=5?15-n:Math.max(8,16-Math.floor(n/2))};
  }
  function build(n){
    n=levelNumber(n);if(cache.has(n))return cache.get(n);
    const meta=info(n),nodes=recipes[n-1][2].map(([x,y,r])=>({x,y,r})),N=nodes.length;
    const corners=nodes.map((p,i)=>{
      const prev=nodes[(i+N-1)%N],next=nodes[(i+1)%N],la=dist(prev,p),lb=dist(p,next);
      const u={x:(p.x-prev.x)/la,y:(p.y-prev.y)/la},v={x:(next.x-p.x)/lb,y:(next.y-p.y)/lb};
      const angle=Math.acos(Math.max(-1,Math.min(1,u.x*v.x+u.y*v.y)));
      // Adjacent corners cannot consume more than 94% of a straight together.
      const trim=Math.min(p.r*Math.tan(angle/2),la*.47,lb*.47),radius=trim/Math.tan(angle/2);
      const handle=4/3*Math.tan(angle/4)*radius;
      const a={x:p.x-u.x*trim,y:p.y-u.y*trim},b={x:p.x+v.x*trim,y:p.y+v.y*trim};
      return {a,b,c:{x:a.x+u.x*handle,y:a.y+u.y*handle},d:{x:b.x-v.x*handle,y:b.y-v.y*handle},radius,angle,turn:Math.sign(u.x*v.y-u.y*v.x)};
    });
    // Start/finish sits midway along the main straight, away from turn entries.
    const start=mix(corners[0].b,corners[1].a,.5),dense=[start];
    function line(end){const a=dense.at(-1),steps=Math.ceil(dist(a,end));for(let j=1;j<=steps;j++)dense.push(mix(a,end,j/steps));}
    for(let k=1;k<=N;k++){
      const c=corners[k%N];line(c.a);
      const steps=Math.max(12,Math.ceil(c.angle*c.radius));
      for(let j=1;j<=steps;j++){
        const t=j/steps,s=1-t;
        dense.push({x:s*s*s*c.a.x+3*s*s*t*c.c.x+3*s*t*t*c.d.x+t*t*t*c.b.x,y:s*s*s*c.a.y+3*s*s*t*c.c.y+3*s*t*t*c.d.y+t*t*t*c.b.y});
      }
    }
    line(start);
    const lengths=[0];for(let i=1;i<dense.length;i++)lengths.push(lengths[i-1]+dist(dense[i-1],dense[i]));
    const total=lengths.at(-1),scale=meta.length/total,count=Math.ceil(meta.length/8)*2,points=[];
    let segment=1;
    for(let i=0;i<count;i++){
      const d=i*total/count;while(lengths[segment]<d)segment++;
      const p=mix(dense[segment-1],dense[segment],(d-lengths[segment-1])/(lengths[segment]-lengths[segment-1]));
      points.push(Object.freeze({x:(p.x-start.x)*scale,y:(p.y-start.y)*scale}));
    }
    const turns=corners.map(c=>c.turn),transitions=turns.reduce((sum,t,i)=>sum+(t!==turns[(i+1)%N]?1:0),0);
    const result=Object.freeze({...meta,points:Object.freeze(points),transitions,minRadius:Math.min(...corners.map(c=>c.radius))*scale,startStraight:dist(corners[0].b,corners[1].a)*scale});
    cache.set(n,result);return result;
  }
  return Object.freeze({count:recipes.length,info,build});
})();
