// View-only location changes, authored against Producer R9 source lines.
// Mentions of a vehicle (a train, another transport, or a radio heard outside)
// do not by themselves move the camera into the player's armored vehicle.
export const V100_STORY_LOCATION_BACKDROPS = Object.freeze({
  'rescue-vehicle': Object.freeze({path:'/art/v100/story-locations/rescue-vehicle-interior-r1.webp',label:'装甲車両・車内',alt:'救助用の座席と荷物、無線機がある装甲車両の内部。奥に運転席が見える。'}),
  'refrigerated-cargo': Object.freeze({path:'/art/v100/story-locations/refrigerated-cargo-r1.webp',label:'冷蔵車・荷室',alt:'冷蔵車の荷室。薬の保冷箱の隙間に資料箱が挟まっている。'}),
});

export const V100_STORY_LOCATION_SPANS = Object.freeze([
  ['v100:event:prologue',167,205,'rescue-vehicle'],
  ['v100:event:s01:post',253,299,'rescue-vehicle'],
  ['v100:event:s02:post',369,369,'rescue-vehicle'],
  ['v100:event:s03:pre',404,404,'rescue-vehicle'],
  ['v100:event:s03:post',447,447,'rescue-vehicle'],
  ['v100:event:s12:pre',998,1006,'rescue-vehicle'],
  ['v100:event:s12:post',1049,1053,'rescue-vehicle'],
  ['v100:event:s14:post',1207,1211,'rescue-vehicle'],
  ['v100:event:s17:post',1453,1459,'rescue-vehicle'],
  ['v100:event:s19:post',1652,1654,'rescue-vehicle'],
  ['v100:event:s20:post',1750,1762,'rescue-vehicle'],
  ['v100:event:s23:post',1944,1944,'rescue-vehicle'],
  ['v100:event:s26:post',2084,2098,'refrigerated-cargo'],
  ['v100:event:s30:post',2336,2336,'rescue-vehicle'],
].map(span=>Object.freeze(span)));

export function v100StoryLocationFor(eventId,node) {
  if(node?.sourceDocument!=='STORY_SCRIPT_V100_PRODUCER_R9.md'||node.kind==='title')return null;
  const span=V100_STORY_LOCATION_SPANS.find(([id,first,last])=>id===eventId&&node.sourceLine>=first&&node.sourceLine<=last);
  return span?V100_STORY_LOCATION_BACKDROPS[span[3]]:null;
}
