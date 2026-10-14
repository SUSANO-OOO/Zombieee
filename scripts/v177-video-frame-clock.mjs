import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const require=createRequire(import.meta.url);
const packagePath=require.resolve('playwright-core/package.json');
const recorderPath=path.join(path.dirname(packagePath),'lib/server/chromium/videoRecorder.js');
const source=await readFile(recorderPath);
const sourceSha256=createHash('sha256').update(source).digest('hex');
const version=JSON.parse(await readFile(packagePath,'utf8')).version;
const pinnedSource='24f42a9aae3b033c3a48d079ca8e1d23b2789a9664a25fe6d816be5bd69c3576';
const fps=25;

// Read the existing in-process recorder's actual queue additions. No recorder
// methods, encoder arguments, frame ACKs, browser flags or game clocks change.
// The observer may attach after initial frames, so it never invents absolute
// video PTS. WebKit uses a separate native encoder and is explicitly unsupported.
export function createV177VideoFrameClock(page,{engine,label,maxFrames=100_000}={}){
  const frames=[],sections=[],anomalies=[];
  const frameStarts=new WeakMap();
  let serverPage,recorder,beforeListener,afterListener,closed=false,relativeQueuedFrames=0,lastNativeTimestamp=null;
  let unsupported=null;
  if(engine!=='chromium')unsupported='WebKit native recording has no measured encoder timeline in this observer';
  else if(version!=='1.56.1'||sourceSha256!==pinnedSource)unsupported='Unreviewed Playwright recorder source';
  else{
    try{
      serverPage=page._connection?.toImpl?.(page);
      recorder=serverPage?.delegate?._mainFrameSession?._videoRecorder;
      if(!serverPage?.prependListener||!recorder?._process||!Array.isArray(recorder._frameQueue))unsupported='Existing in-process video recorder unavailable';
    }catch(error){unsupported=String(error);}
  }
  const initialNativeTimestamp=Number.isFinite(recorder?._lastFrameTimestamp)&&recorder._lastFrameTimestamp>0?recorder._lastFrameTimestamp*1000:null;
  lastNativeTimestamp=initialNativeTimestamp;
  if(!unsupported){
    beforeListener=frame=>{
      if(closed)return;
      if(frames.length>=maxFrames){if(!anomalies.includes('frame-limit'))anomalies.push('frame-limit');return;}
      frameStarts.set(frame,{before:recorder._frameQueue.length,nativeEpochMs:frame.frameSwapWallTime,previous:recorder._lastFrameTimestamp,receivedEpochMs:Date.now()});
    };
    afterListener=frame=>{
        const start=frameStarts.get(frame);
        if(closed||!start)return;
        frameStarts.delete(frame);
        const {before,nativeEpochMs,previous,receivedEpochMs}=start;
        const added=recorder._frameQueue.length-before;
        const stable=Number.isFinite(nativeEpochMs)&&Number.isInteger(added)&&added>=0
          &&recorder._lastFrameTimestamp===nativeEpochMs/1000
          &&(lastNativeTimestamp===null||nativeEpochMs>=lastNativeTimestamp);
        if(!stable){if(anomalies.length<16)anomalies.push('Unstable original encoder queue or timestamp at observed frame '+frames.length);return;}
        relativeQueuedFrames+=added;
        frames.push({ordinal:frames.length,nativeEpochMs,receivedEpochMs,nativeDeltaMs:previous>0?nativeEpochMs-previous*1000:null,
          queuedDeltaFrames:added,relativeQueuedFrames});
        lastNativeTimestamp=nativeEpochMs;
    };
    // Paired synchronous listeners surround the original listener without
    // replacing it. Batched native events cannot overwrite a pending sample.
    serverPage.prependListener('screencastframe',beforeListener);
    serverPage.on('screencastframe',afterListener);
  }
  const point=()=>({observedFrames:frames.length,relativeQueuedFrames,nativeEpochMs:lastNativeTimestamp,hostEpochMs:Date.now()});
  return{
    beginSection(metadata){const section={metadata:{...metadata},start:point(),end:null};sections.push(section);return section;},
    endSection(section,{completed=true}={}){if(section&&!section.end){section.end=point();section.completed=completed;}},
    async finish({file,videoPath=null}={}){
      if(closed)throw new Error('Video clock already finalized');
      closed=true;
      if(beforeListener)serverPage.removeListener('screencastframe',beforeListener);
      if(afterListener)serverPage.removeListener('screencastframe',afterListener);
      const measuredSections=sections.map(section=>{
        const end=section.end??point(),nativeElapsedMs=section.start.nativeEpochMs===null||end.nativeEpochMs===null?null:end.nativeEpochMs-section.start.nativeEpochMs;
        const queuedFrames=end.relativeQueuedFrames-section.start.relativeQueuedFrames;
        return{...section,end,aborted:section.completed!==true,nativeElapsedMs,queuedFrames,queuedElapsedMs:queuedFrames*1000/fps,
          queuedToNativeRatio:nativeElapsedMs>0?queuedFrames*1000/fps/nativeElapsedMs:null};
      });
      const report={schema:'v177-native-video-frame-clock/v1',engine,label,version,recorderSourceSha256:sourceSha256,encoderFps:fps,
        status:unsupported?'unsupported':anomalies.length?'invalid':frames.length?'observed':'no-frames',unsupported,anomalies,
        initialNativeTimestamp,absoluteVideoPtsKnown:false,finalSyntheticFlushMeasured:false,
        mappingScope:'Measured original Chromium queue additions relative to observer attachment; unknown earlier frames and final synthetic flush are excluded.',
        originalSpeedAccepted:false,videoPath,frames,sections:measuredSections};
      if(file)await writeFile(file,JSON.stringify(report,null,2)+'\n');
      return{schema:report.schema,status:report.status,file:file??null,frameCount:frames.length,sectionCount:sections.length,
        absoluteVideoPtsKnown:false,originalSpeedAccepted:false,unsupported,anomalies};
    },
  };
}
