// Reuse the actual game's classes at startup. Never evaluate network data.
// Browser and server execute the same force-based vehicle model.
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);if(a<0||b<a)throw new Error('Game engine markers changed');return html.slice(a,b);}
const scope={Math,console,camera:{shake(){}},PH2:[''],PH3:[''],isTouchDevice:false};scope.window=scope;
const context=vm.createContext(scope);
for(const name of ['game-options','road-expeditions','touring-legacy','nfs-summit-data','nfs-rocky-data','nfs-redrock-data','glen-data','nfs-track','summit-track','touring-circuits','circuit-layouts','vehicle-fit','road-contact','yugo-physics','vehicle-dynamics','tire-smoke','wheel-particles','online-rules'])vm.runInContext(fs.readFileSync(new URL(`js/${name}.js`,root),'utf8'),context);
vm.runInContext(`const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,S=Math.sin,C=Math.cos,A=Math.atan2,H=Math.hypot,PI=Math.PI;\n${between('class Track{','/* ===== Share')}${between('class Car{','class GhostCar{')}${between('const CAR_DATA = [','let carIdx=')}\nglobalThis.engine={Track,Car,CAR_DATA};`,context);
export const {Track,Car,CAR_DATA}=scope.engine;
export const Net=scope.DriftNet;
export const Options=scope.DriftOptions;
export function createTrack(level){const data=scope.CircuitLayouts.build(level),track=new Track(data.points);track.roadHalf=data.roadHalf;return track;}
export function createCar(track,skin,auto,slot,conditions={}){const data=CAR_DATA.find(c=>c.sprite===skin)||CAR_DATA[0],car=new Car(track);Net.configure(car,data,auto,conditions);Net.grid(car,track,slot);return car;}
