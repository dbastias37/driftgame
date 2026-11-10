/* Original, short console-style cues. No downloads and no per-frame audio work. */
globalThis.DriftMenuFeedback=(()=>{
  const cues={move:[[0,760,980,.045]],confirm:[[0,660,880,.08],[.07,990,1100,.09]],back:[[0,520,260,.14]],start:[[0,440,440,.1],[.09,660,660,.1],[.18,880,1320,.2]]};
  class Sound{
    constructor(create=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()){this.create=create;this.volume=.4;this.context=null;}
    unlock(){try{this.context ||= this.create();if(this.context.state==='suspended')this.context.resume()?.catch(()=>{});}catch{}return this.context;}
    play(name){if(!this.volume||!cues[name])return;const ctx=this.unlock();if(!ctx||ctx.state!=='running')return;for(const [delay,from,to,duration] of cues[name]){const t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=name==='move'?'square':'triangle';osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(this.volume*.1,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.01);}}
  }
  return {Sound,cues};
})();
