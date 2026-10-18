// Output-only proposal. Actual processor API; no synthetic signal or second audible output.
import {createPcmPacketFramer} from './v177-graph-pcm-framer.mjs';
import {GRAPH_LIMITS as L} from './v177-native-aac-graph-contract.mjs';
class V177GraphPcmProcessor extends AudioWorkletProcessor {
  constructor(options={}){
    super();const p=options.processorOptions??{};this.generation=p.generation??1;this.stopping=false;this.done=false;this.reported=false;
    this.maxPackets=Math.floor(sampleRate*8/1024);this.packets=0;
    this.framer=createPcmPacketFramer({sampleRate,channels:2,poolPackets:L.pcmPoolPackets,generation:this.generation,
      emitPacket:(packet,transfer)=>{this.packets++;this.port.postMessage(packet,transfer);}});
    this.port.onmessage=({data:m})=>{if(m?.generation!==this.generation)return;if(m.type==='recycle')this.framer.recycle(m);else if(m.type==='finish')this.stopping=true;this.checkFailure();};
    this.port.postMessage({type:'pcm-processor-ready',sampleRate,channels:2,generation:this.generation,currentFrame});
  }
  fault(code){if(!this.reported){this.reported=true;this.port.postMessage({type:'pcm-framing-error',generation:this.generation,code,snapshot:this.framer.snapshot()});}this.done=true;return false;}
  checkFailure(){const f=this.framer.snapshot().failure;if(f)return this.fault(f.code);return true;}
  process(inputs){
    if(this.done)return false;
    if(!this.framer.push(inputs[0],currentFrame))return this.fault(this.framer.snapshot().failure?.code??'input-rejected');
    const state=this.framer.snapshot();
    if(this.stopping&&state.partialFrames===0){this.done=true;this.port.postMessage({type:'pcm-finished',generation:this.generation,...this.framer.finish()});return false;}
    if(this.packets>=this.maxPackets)return this.fault('eight-second-capture-cap');
    return true;
  }
}
registerProcessor('v177-graph-pcm-framer',V177GraphPcmProcessor);