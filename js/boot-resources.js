import {loadRX7} from './rx7-model.js?v=1.0.0-prealpha.25';
import {loadYugo} from './yugo-model.js?v=1.0.0-prealpha.25';
import {loadFujiwara} from './fujiwara-model.js?v=1.0.0-prealpha.25';
import {loadReplacement} from './replacement-model.js?v=1.0.0-prealpha.25';
import {preloadScenery} from './summit-scene.js?v=1.0.0-prealpha.26';

export async function prepareResources(progress){
  const assets=globalThis.DriftAssets;
  const jobs=[loadRX7,loadYugo,loadFujiwara,
    ...['gray','blue','barracuda','subaru','bmw','shelby','mustang'].map(skin=>()=>loadReplacement(skin)),
    ...['summit.glb','rocky-pass.glb','redrock-ridge.glb','glen-canyon-dam.glb'].map(file=>()=>preloadScenery(file)),
    ...[...assets.entries.values()].filter(a=>/\.(png|jpe?g)$/i.test(a.path)).map(a=>()=>assets.decodeImage(a.path)),
    ()=>document.fonts.load('32px DriftDisplay'),()=>document.fonts.ready];
  let done=0;
  // Decode sequentially to avoid large simultaneous GLB/image allocations on phones.
  for(const job of jobs){await job();progress(++done,jobs.length);await new Promise(resolve=>setTimeout(resolve,0));}
  for(const entry of assets.entries.values())if(entry.path.endsWith('.glb'))assets.release(entry.path);
}
