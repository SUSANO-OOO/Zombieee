// Browser-serializable: inspect approved portraits in the actual marked HUD layout.
// The supplied source map comes from the canonical character registry.
export async function inspectApprovedBattleCardPortraits(cards,{expectedByKind,baseUrl,mobileCamera}){
 const fail=message=>{throw new Error(message);};
 if(typeof mobileCamera!=='boolean')fail('Explicit production HUD layout marker required');
 const seen=new Set();
 return Promise.all(cards.map(async card=>{
  const kind=card.dataset?.kind;
  if(card.tagName!=='BUTTON'||!card.classList.contains('unit-card')||!card.classList.contains('v100-deploy-card')||card.dataset.portrait!=='approved')fail('Expected approved external battle card');
  if(!Object.prototype.hasOwnProperty.call(expectedByKind,kind)||seen.has(kind))fail('Unexpected or duplicate approved portrait kind: '+kind);seen.add(kind);
  const frames=[...card.children].filter(el=>el.classList.contains('portrait'));
  if(frames.length!==1)fail('Approved card must have exactly one direct portrait frame: '+kind);
  const frame=frames[0],children=[...frame.children],cameras=children.filter(el=>el.classList.contains('v100-deploy-camera'));
  const ImageElement=card.ownerDocument?.defaultView?.HTMLImageElement;let img;
  if(mobileCamera){
   if(cameras.length!==1||children.some(el=>el!==cameras[0]&&el.tagName!=='I'))fail('Approved card must use its direct current camera: '+kind);
   const cameraChildren=[...cameras[0].children];
   if(cameraChildren.length!==1||typeof ImageElement!=='function'||!(cameraChildren[0] instanceof ImageElement))fail('Approved camera must contain exactly its portrait img: '+kind);
   img=cameraChildren[0];
  }else{
   const direct=children.filter(el=>typeof ImageElement==='function'&&el instanceof ImageElement);
   if(cameras.length||direct.length!==1||children.some(el=>el!==direct[0]&&el.tagName!=='I'))fail('Expected exactly one direct approved portrait for unmarked HUD: '+kind);
   img=direct[0];
  }
  const expected=new URL(expectedByKind[kind].replace(/^\//,''),baseUrl),src=img.getAttribute('src');
  if(src!==expected.pathname)fail('Unapproved portrait source for '+kind);
  await img.decode();
  if(img.currentSrc!==expected.href)fail('Decoded portrait source differs for '+kind);
  const rect=img.getBoundingClientRect();
  return {kind,state:card.dataset.state,src,currentSrc:img.currentSrc,complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:rect.width,height:rect.height,decoded:true};
 }));
}
