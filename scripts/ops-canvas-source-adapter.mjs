// Diagnostic only: never produces video or supplies timestamps. Both modes
// suppress the native encoder; B additionally omits the real canvas source.
export function omitEncoderAndSelectCanvasSource(mode){
  if(!['canvas-source','no-canvas-source','canvas-source-light','no-canvas-source-light'].includes(mode))throw Error('Unknown source control');
  const sourceOmitted=mode.startsWith('no-'),lightObserver=mode.endsWith('-light');
  const Native=window.MediaRecorder,canvas=document.querySelector('.game-shell canvas'),original=canvas.captureStream;
  const receipt=window.__OPS_ENCODER_CONTROL__={encoderCreated:false,sourceOmitted,lightObserver,
    constructorCalls:0,startCalls:0,stopCalls:0,realCanvasSourceCalls:0};
  canvas.captureStream=function(...args){
    if(!sourceOmitted){receipt.realCanvasSourceCalls++;return original.apply(this,args);}
    // A labelled interface placeholder is required by the existing observer.
    // It is not a MediaStream/VideoTrack and cannot reach any real encoder.
    const diagnosticVideo={kind:'diagnostic-omitted-canvas-source',stop(){},getSettings:()=>({diagnosticCanvasSourceOmitted:true})};
    const audio=[];
    return {addTrack:track=>audio.push(track),getVideoTracks:()=>[diagnosticVideo],getAudioTracks:()=>audio,
      getTracks:()=>[diagnosticVideo,...audio]};
  };
  if(lightObserver){
    const qa=window.__ASHFALL_BATTLE_QA__,readAudit=qa.getV105CorrectionAudit.bind(qa);
    qa.getV105CorrectionAudit=(ids=[])=>{
      const owned=window.__V105_RECORDING__;
      // Start, real release and final snapshots still read the original game.
      // Only per-frame diagnostic snapshots are omitted: no fabricated time,
      // fighter, draw or ability receipt is returned in their place.
      if(ids.length&&owned?.state?.stopAt===null)return {diagnosticFrameSnapshotOmitted:true};
      return readAudit(ids);
    };
  }
  window.MediaRecorder=class NoEncoderDiagnostic {
    static isTypeSupported(type){return Native.isTypeSupported(type);}
    constructor(stream,options){receipt.constructorCalls++;receipt.tracks=stream.getTracks().map(t=>t.kind);this.mimeType=options.mimeType;this.state='inactive';}
    start(){receipt.startCalls++;this.state='recording';queueMicrotask(()=>this.onstart?.());}
    stop(){receipt.stopCalls++;this.state='inactive';queueMicrotask(()=>this.onstop?.());}
  };
}
