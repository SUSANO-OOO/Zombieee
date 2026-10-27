// Recording-only diagnostic. Keep the real game canvas and every other context
// option. Install before navigation, never in a product or formal benchmark.
export function selectCanvasReadbackMode(mode){
  if(!['default','readback'].includes(mode))throw Error('Unknown canvas readback mode');
  const original=HTMLCanvasElement.prototype.getContext,owners=new WeakMap();
  const receipt=window.__OPS_CANVAS_READBACK__={mode,diagnosticOnly:true,calls:[]};
  HTMLCanvasElement.prototype.getContext=function(type,options,...rest){
    if(type!=='2d'||options?.alpha!==false||options?.desynchronized!==true)
      return original.call(this,type,options,...rest);
    // Keep the native getContext call on every original game call. Only the
    // selected options are retained; do not optimize the product's access path.
    if(owners.has(this))return original.call(this,type,owners.get(this),...rest);
    if(this!==document.querySelector('.game-shell canvas'))return original.call(this,type,options,...rest);
    const selected=mode==='readback'?{...options,willReadFrequently:true}:options;
    const context=original.call(this,type,selected,...rest);
    if(!context)throw Error('Actual game canvas context unavailable');
    const record={original:{...options},requested:{...selected},actual:context.getContextAttributes?.()??null};
    receipt.calls.push(record);owners.set(this,selected);
    // Retain the actual owner only in this page. The exported receipt below
    // proves the main canvas was selected, rather than an offscreen oracle.
    window.__OPS_CANVAS_READBACK_OWNER__=this;
    return context;
  };
}

export function readCanvasReadbackReceipt(){
  const canvas=document.querySelector('.game-shell canvas'),receipt=window.__OPS_CANVAS_READBACK__;
  if(!receipt||receipt.calls.length!==1||window.__OPS_CANVAS_READBACK_OWNER__!==canvas)
    throw Error('Exactly one actual battle canvas must own the hint');
  const call=receipt.calls[0];
  // Pinned WebKit's CanvasRenderingContext2DSettings IDL omits alpha from
  // getContextAttributes. Preserve the original request, but do not invent
  // an unsupported native alpha receipt. The compared hint must be explicit.
  if(call.original.alpha!==false||call.requested.alpha!==call.original.alpha
    ||call.requested.desynchronized!==call.original.desynchronized
    ||!call.actual||('alpha' in call.actual&&call.actual.alpha!==false)
    ||call.actual.willReadFrequently!==(receipt.mode==='readback'))
    throw Error('Native WebKit did not confirm the requested readback mode: '+JSON.stringify(call));
  return {...receipt,width:canvas.width,height:canvas.height,actualGameCanvas:true};
}
