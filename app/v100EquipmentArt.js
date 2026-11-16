// Full objects from the accepted 1280x1024 equipment sheet.
// SHA256 a426198839b80b54d42923e6e0a9d1e4e719611c84524fa2e81ff6c6753ce766.
// Unreviewed objects keep their original atlas cells. No asset or gameplay change.
export const V100_EQUIPMENT_ART_CROPS = Object.freeze({
  "recoil-brace":Object.freeze([278,261,211,235]),
  "reinforced-vest":Object.freeze([267,14,211,229]),
  "rescue-pouch":Object.freeze([785,38,207,195]),
  "survey-scope":Object.freeze([1041,47,226,174]),
  "tactical-field-radio":Object.freeze([36,494,197,243]),
  "tactical-supply-cache":Object.freeze([261,517,243,211]),
  "quick-loader":Object.freeze([528,39,218,202]),
});
export function v100EquipmentArtworkImgStyle(item) {
  if(!item)return {};
  const crop=Object.hasOwn(V100_EQUIPMENT_ART_CROPS,item.id) ? V100_EQUIPMENT_ART_CROPS[item.id] : null;
  if(!crop)return {left:(-(item.artCell%5)*100)+'%',top:(-Math.floor(item.artCell/5)*100)+'%'};
  const [x,y,width,height]=crop,extent=Math.max(width,height);
  return {width:(1280/extent*100)+'%',height:(1024/extent*100)+'%',
    left:(((extent-width)/2-x)/extent*100)+'%',top:(((extent-height)/2-y)/extent*100)+'%'};
}
