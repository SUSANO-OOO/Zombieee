import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const PCM_STREAM = Object.freeze({ sampleRate:48000, channels:2, frames:192000, blockFrames:480,
  headerBytes:44, pcmBytes:768000, bgmGain:.18, effectGain:.5, budgetMs:150 });
export const PCM_ASSETS = Object.freeze([
  {id:'music-v100-score-normal',source:'/audio/v100/score/normal.mp3',bytes:1536879,
    sha256:'71fe28ebf9c2b02844b38b0526ef45a31143e02c021c40533c623bcd8cd324fe'},
  {id:'weapon-rifle-01',source:'/audio/v100/foley/rifle.mp3',bytes:6225,
    sha256:'805eacd7367c72d2e96628d8bc8d539f8401d225164c8def9caaad9eb726e96f'},
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function pcmWaveHeader(frames=PCM_STREAM.frames) {
  assert.ok(Number.isSafeInteger(frames)&&frames>0&&frames<=PCM_STREAM.frames);
  const b=Buffer.alloc(44),size=frames*4;
  b.write('RIFF');b.writeUInt32LE(36+size,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(192000,28);
  b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}

// Single HTTP byte range, including AVFoundation's initial two-byte probe.
// Future ranges wait for the real producer; they never cause future mixing.
export function pcmByteRange(value,total) {
  if(value===undefined)return {start:0,end:total-1,status:200};
  const m=/^bytes=(\d*)-(\d*)$/u.exec(value);assert.ok(m&&(m[1]||m[2]),'Invalid single byte range');
  const first=m[1]?Number(m[1]):Math.max(0,total-Number(m[2]));
  const last=m[1]?(m[2]?Math.min(Number(m[2]),total-1):total-1):total-1;
  assert.ok(Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&first>=0&&first<=last&&first<total,'Unsatisfiable byte range');
  assert.ok(m[1]||Number(m[2])>0,'Empty suffix range');return {start:first,end:last,status:206};
}

export function createPcmStream({music,effect,variant='live',mix='bgm',now=()=>performance.now()}={}) {
  assert.ok(['static','live'].includes(variant)&&['bgm','bgm-se'].includes(mix));
  assert.ok(music instanceof Float32Array&&music.length===PCM_STREAM.frames*2,'Incomplete BGM PCM');
  assert.ok(effect instanceof Float32Array&&effect.length>0&&effect.length%2===0&&effect.length<=music.length,'Invalid effect PCM');
  for(const pcm of [music,effect])for(const value of pcm)assert.ok(Number.isFinite(value)&&Math.abs(value)<=1,'Invalid decoded PCM');
  const wav=Buffer.alloc(PCM_STREAM.headerBytes+PCM_STREAM.pcmBytes);pcmWaveHeader().copy(wav);
  const rows=[],effects=[],pcmSources=[music,effect].map(pcm=>({bytes:pcm.byteLength,sha256:sha(Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength))}));
  let startedAt=null,nextFrame=0,effectFrame=null,closed=false,peak=0;
  const tick=()=>{
    assert.ok(startedAt!==null&&!closed&&nextFrame<PCM_STREAM.frames,'Inactive producer');
    const end=Math.min(PCM_STREAM.frames,nextFrame+PCM_STREAM.blockFrames);
    for(let frame=nextFrame;frame<end;frame++)for(let c=0;c<2;c++){
      const i=frame*2+c,j=effectFrame===null?-1:(frame-effectFrame)*2+c;
      const value=music[i]*PCM_STREAM.bgmGain+(j>=0?(effect[j]??0)*PCM_STREAM.effectGain:0);
      assert.ok(Number.isFinite(value)&&Math.abs(value)<1,'Mixed PCM clipped');peak=Math.max(peak,Math.abs(value));
      wav.writeInt16LE(Math.round(value*32767),44+i*2);
    }
    nextFrame=end;rows.push({ms:now()-startedAt,inputFrames:nextFrame});return nextFrame;
  };
  return {tick,
    start(){assert.ok(startedAt===null&&!closed,'Producer already started or closed');startedAt=now();
      if(variant==='static')while(nextFrame<PCM_STREAM.frames)tick();else tick();},
    effect(){assert.ok(mix==='bgm-se'&&startedAt!==null&&!closed&&nextFrame<PCM_STREAM.frames&&effectFrame===null,'Effect is not eligible');
      effectFrame=nextFrame;effects.push({ms:now()-startedAt,firstInputFrame:effectFrame});return effects[0];},
    snapshot(){return {variant,mix,started:startedAt!==null,closed,inputFrames:nextFrame,
      producedBytes:44+nextFrame*4,inputDuration:4,sampleRate:48000,channels:2,peak,rows:[...rows],effects:[...effects],
      complete:nextFrame===PCM_STREAM.frames,pcmSources};},
    frames:()=>nextFrame,nextDelayMs:()=>nextFrame/48000*1000-(now()-startedAt),
    available:()=>44+nextFrame*4,bytes:()=>wav,close(){closed=true;},
  };
}

// This bounded four-second diagnostic is not a game server or production SW.
// The complete retained WAV is evidence storage, not an unbounded live queue.
export async function startNativePcmOrigin({sources,variant,mix}) {
  assert.equal(sources.length,2);sources.forEach((b,i)=>{assert.equal(b.length,PCM_ASSETS[i].bytes);assert.equal(sha(b),PCM_ASSETS[i].sha256);});
  const decoded=[],requests=[],errors=[],writers=new Set();let stream=null,timer=null,closing=false;
  const startedAt=performance.now();
  const flush=writer=>{
    if(writer.blocked||writer.response.destroyed)return;
    const end=Math.min(writer.end+1,stream?.available()??44);
    if(writer.offset<end){const bytes=(stream?.bytes()??pcmWaveHeader()).subarray(writer.offset,end);
      writer.offset=end;writer.hash.update(bytes);writer.row.queuedBytes+=bytes.length;writer.blocked=!writer.response.write(bytes);}
    if(writer.offset>writer.end){writer.row.endIssued=true;writer.response.end();writers.delete(writer);}
  };
  const produce=()=>{
    if(closing||!stream)return;
    try {if(stream.frames()<PCM_STREAM.frames)stream.tick();for(const writer of writers)flush(writer);
      if(stream.frames()<PCM_STREAM.frames)timer=setTimeout(produce,Math.max(0,stream.nextDelayMs()));
    }catch(error){errors.push(String(error));for(const writer of writers)writer.response.destroy(error);}
  };
  const body=async request=>{let size=0;const pieces=[];for await(const chunk of request){size+=chunk.length;assert.ok(size<=PCM_STREAM.frames*2*4,'PCM upload exceeds bounded input');pieces.push(chunk);}return Buffer.concat(pieces);};
  const json=(response,status,value)=>{const b=Buffer.from(JSON.stringify(value));response.writeHead(status,{'content-type':'application/json','content-length':b.length,'cache-control':'no-store'});response.end(b);};
  const server=createServer(async(request,response)=>{
    const url=new URL(request.url,'http://127.0.0.1'),row={path:url.pathname,method:request.method,range:request.headers.range??null,atMs:performance.now()-startedAt,complete:false,closed:false};requests.push(row);
    response.on('finish',()=>{row.complete=true;row.nodeFinishedAtMs=performance.now()-startedAt;});
    response.on('error',error=>{row.responseError=String(error);if(!closing)errors.push(row.responseError);});
    response.on('close',()=>{row.closed=true;row.closeAtMs=performance.now()-startedAt;row.cleanup=closing;for(const writer of writers)if(writer.response===response)writers.delete(writer);});
    try {
      if(request.method==='GET'&&url.pathname==='/'){
        response.writeHead(200,{'content-type':'text/html','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'; media-src 'self'; img-src data:"});
        response.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Native PCM diagnostic</title><button id="start-probe">Start native PCM probe</button><button id="weapon-probe">Fire existing rifle effect</button>');row.complete=true;return;
      }
      const asset=/^\/asset\/([01])\.mp3$/u.exec(url.pathname),pcm=/^\/pcm\/([01])$/u.exec(url.pathname);
      if(request.method==='GET'&&asset){const b=sources[Number(asset[1])];response.writeHead(200,{'content-type':'audio/mpeg','content-length':b.length,'cache-control':'no-store'});response.end(b);row.complete=true;return;}
      if(request.method==='POST'&&pcm){const index=Number(pcm[1]);assert.ok(!decoded[index]&&!stream,'Duplicate or late PCM input');const b=await body(request);assert.equal(b.length%8,0);decoded[index]=new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));json(response,200,{bytes:b.length,sha256:sha(b)});row.complete=true;return;}
      if(request.method==='POST'&&url.pathname==='/start'){
        assert.ok(!stream&&decoded.length===2&&decoded.every(Boolean),'Unprepared or repeated start');stream=createPcmStream({music:decoded[0],effect:decoded[1],variant,mix});stream.start();
        for(const writer of writers)flush(writer);if(variant==='live')timer=setTimeout(produce,10);json(response,200,stream.snapshot());row.complete=true;return;
      }
      if(request.method==='POST'&&url.pathname==='/effect'){assert.ok(stream,'No active stream');json(response,200,stream.effect());row.complete=true;return;}
      if(['GET','HEAD'].includes(request.method)&&url.pathname==='/stream.wav'){
        const total=44+PCM_STREAM.pcmBytes;let range;
        try{range=pcmByteRange(request.method==='HEAD'?undefined:request.headers.range,total);}catch{response.writeHead(416,{'content-range':`bytes */${total}`,'content-length':0});response.end();row.endIssued=true;return;}
        const headers={'content-type':'audio/wav','content-length':range.end-range.start+1,'accept-ranges':'bytes','cache-control':'no-store'};
        if(range.status===206)headers['content-range']=`bytes ${range.start}-${range.end}/${total}`;
        Object.assign(row,{status:range.status,start:range.start,end:range.end,declaredBytes:range.end-range.start+1});response.writeHead(range.status,headers);response.flushHeaders();
        if(request.method==='HEAD'){response.end();row.endIssued=true;return;}
        const writer={response,row,offset:range.start,end:range.end,blocked:false,hash:createHash('sha256')};row.queuedBytes=0;
        row.outboundScope='Bytes queued to Node HTTP response; finish is OS handoff, not a native-consumption receipt';
        response.on('close',()=>{row.outboundSha256=writer.hash.digest('hex');});
        writers.add(writer);response.on('drain',()=>{writer.blocked=false;flush(writer);});flush(writer);return;
      }
      json(response,404,{error:'Unexpected diagnostic route'});errors.push('Unexpected diagnostic route '+request.method+' '+url.pathname);
    }catch(error){row.error=String(error);errors.push(row.error);if(!response.headersSent)json(response,409,{error:row.error});else response.destroy(error);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {origin:`http://127.0.0.1:${server.address().port}`,
    snapshot:()=>({variant,mix,stream:stream?.snapshot()??null,requests:requests.map(r=>({...r})),errors:[...errors],closing}),
    wav:()=>stream?Buffer.from(stream.bytes().subarray(0,stream.available())):Buffer.alloc(0),
    pcmSources:()=>decoded.map(pcm=>Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength)),
    async close(){if(closing)return;closing=true;clearTimeout(timer);stream?.close();const closed=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await closed;},
  };
}
