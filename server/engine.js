// Reuse the actual game's classes at startup. Never evaluate network data.
// This adapter keeps legacy offline physics byte-for-byte unchanged.
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);if(a<0||b<a)throw new Error('Game engine markers changed');return html.slice(a,b);}
const scope={Math,console,camera:{shake(){}},PH2:[''],PH3:[''],isTouchDevice:false};scope.window=scope;
const context=vm.createContext(scope);
for(const name of ['circuit-layouts','road-contact','yugo-physics','online-rules'])vm.runInContext(fs.readFileSync(new URL(`js/${name}.js`,root),'utf8'),context);
vm.runInContext(`const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,S=Math.sin,C=Math.cos,A=Math.atan2,H=Math.hypot,PI=Math.PI;\n${between('class Track{','/* ===== Share')}${between('class Car{','class GhostCar{')}${between('const CAR_DATA = [','let carIdx=')}\nglobalThis.engine={Track,Car,CAR_DATA};`,context);
export const {Track,Car,CAR_DATA}=scope.engine;
export const Net=scope.DriftNet;
export function createTrack(level){const data=scope.CircuitLayouts.build(level),track=new Track(data.points);track.roadHalf=data.roadHalf;return track;}
export function createCar(track,skin,auto,slot){const data=CAR_DATA.find(c=>c.sprite===skin)||CAR_DATA[0],car=new Car(track);Net.configure(car,data,auto);Net.grid(car,track,slot);return car;}
