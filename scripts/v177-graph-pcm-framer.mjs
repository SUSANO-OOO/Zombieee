// Output-only research: no browser, encoder, muxer, media or product hookup.
// All sample payload operations copy Uint32 words, preserving Float32 bits.
export function pcmTimestampUs(frame, sampleRate) {
  if(!Number.isSafeInteger(frame)||frame<0||!Number.isSafeInteger(sampleRate)||sampleRate<=0)throw new RangeError('Invalid PCM sample clock');
  const rate=BigInt(sampleRate),time=(BigInt(frame)*1000000n+rate/2n)/rate;
  const value=Number(time);if(!Number.isSafeInteger(value))throw new RangeError('PCM timestamp exceeds safe integer');return value;
}

export function createPcmPacketFramer({sampleRate,channels=2,poolPackets=4,generation=1,maxInputFrames=2048,emitPacket}) {
  if(!Number.isSafeInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('Invalid actual sample rate');
  if(![1,2].includes(channels)||!Number.isInteger(poolPackets)||poolPackets<2||poolPackets>8||!Number.isSafeInteger(generation)||generation<1
    ||!Number.isInteger(maxInputFrames)||maxInputFrames<1||maxInputFrames>2048||typeof emitPacket!=='function')throw new RangeError('Invalid bounded framing configuration');
  const packetFrames=1024,bytesPerPacket=channels*packetFrames*4;
  const slots=Array.from({length:poolPackets},(_,id)=>{const buffer=new ArrayBuffer(bytesPerPacket);return{id,buffer,words:new Uint32Array(buffer),inFlight:false,packetIndex:null};});
  const free=slots.map(slot=>slot.id);
  let active=null,filled=0,acceptedFrames=0,packets=0,originFrame=null,nextSourceFrame=null,failure=null,finished=false,peakInFlight=0,staleRecycles=0;
  function fail(code,detail={}){failure??={code,acceptedFrames,nextSourceFrame,...detail};return false;}
  function inFlight(){return slots.reduce((n,s)=>n+Number(s.inFlight),0);}
  function snapshot(){return{sampleRate,channels,packetFrames,poolPackets,pcmPoolBytes:poolPackets*bytesPerPacket,generation,originFrame,nextSourceFrame,acceptedFrames,emittedPackets:packets,
    partialFrames:filled,inFlightPackets:inFlight(),freeBuffers:free.length,peakInFlightPackets:peakInFlight,staleRecycles,finished,failure:failure?{...failure}:null};}
  function recycle({generation:owner,id,packetIndex,buffer}) {
    if(owner!==generation){staleRecycles++;return false;}
    if(failure)return false;
    const slot=slots[id];
    if(!Number.isInteger(id)||!slot||!slot.inFlight||slot.packetIndex!==packetIndex||!(buffer instanceof ArrayBuffer)||buffer.byteLength!==bytesPerPacket)return fail('invalid-recycle',{id,packetIndex});
    slot.buffer=buffer;slot.words=new Uint32Array(buffer);slot.inFlight=false;free.push(id);return true;
  }
  function push(planes,sourceFrame) {
    if(failure||finished)return false;
    if(!Array.isArray(planes)||planes.length!==channels||!planes.every(plane=>plane instanceof Float32Array))return fail('invalid-input-channels');
    const length=planes[0].length;
    if(!Number.isInteger(length)||length<1||length>maxInputFrames||!planes.every(plane=>plane.length===length))return fail('invalid-input-length',{inputFrames:length});
    if(!Number.isSafeInteger(sourceFrame)||sourceFrame<0||!Number.isSafeInteger(sourceFrame+length))return fail('invalid-source-frame');
    if(nextSourceFrame!==null&&sourceFrame!==nextSourceFrame)return fail('source-frame-gap-or-duplicate',{observedSourceFrame:sourceFrame});
    const capacity=(active===null?0:packetFrames-filled)+free.length*packetFrames;
    if(length>capacity)return fail('pcm-backpressure',{rejectedInputFrames:length,availableFrames:capacity});
    if(originFrame===null){originFrame=sourceFrame;nextSourceFrame=sourceFrame;}
    const words=planes.map(plane=>new Uint32Array(plane.buffer,plane.byteOffset,plane.length));
    let offset=0;
    while(offset<length){
      if(active===null){active=slots[free.shift()];filled=0;}
      const take=Math.min(length-offset,packetFrames-filled);
      for(let channel=0;channel<channels;channel++)active.words.set(offset===0&&take===length?words[channel]:words[channel].subarray(offset,offset+take),channel*packetFrames+filled);
      offset+=take;filled+=take;acceptedFrames+=take;nextSourceFrame=sourceFrame+offset;
      if(filled===packetFrames){
        const slot=active,packetIndex=packets++,frame=packetIndex*packetFrames,buffer=slot.buffer;
        slot.packetIndex=packetIndex;slot.inFlight=true;slot.buffer=null;slot.words=null;active=null;filled=0;peakInFlight=Math.max(peakInFlight,inFlight());
        const packet={type:'pcm-packet',generation,id:slot.id,packetIndex,sampleRate,channels,numberOfFrames:packetFrames,firstSourceFrame:originFrame+frame,
          timestampUs:pcmTimestampUs(frame,sampleRate),durationUs:pcmTimestampUs(frame+packetFrames,sampleRate)-pcmTimestampUs(frame,sampleRate),buffer};
        try{emitPacket(packet,[buffer]);}catch(error){return fail('packet-emission-failed',{message:String(error)});}
      }
    }
    return true;
  }
  function finish() {
    if(finished)return{status:'already-finished',snapshot:snapshot()};
    finished=true;
    let tail=null;
    if(filled){
      const buffer=new ArrayBuffer(channels*filled*4),words=new Uint32Array(buffer);
      for(let channel=0;channel<channels;channel++)words.set(active.words.subarray(channel*packetFrames,channel*packetFrames+filled),channel*filled);
      const frame=packets*packetFrames;
      tail={type:'pcm-tail',generation,sampleRate,channels,numberOfFrames:filled,firstSourceFrame:originFrame+frame,timestampUs:pcmTimestampUs(frame,sampleRate),buffer};
    }
    return{status:failure?'failed':tail?'partial-tail-retained-not-encoded':'framed',tail,snapshot:snapshot(),
      aacEncoded:false,scope:'A partial tail is retained bit-exact. It is neither padded, silently dropped nor claimed as an AAC1024 packet.'};
  }
  return{push,recycle,finish,snapshot};
}