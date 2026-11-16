// Full objects from the accepted 1280x1024 equipment sheet.
// SHA256 a426198839b80b54d42923e6e0a9d1e4e719611c84524fa2e81ff6c6753ce766.
// Keep each full silhouette and clip the source rectangle before letterboxing.
// Several objects cross atlas-cell boundaries; square overflow alone includes neighbors.
export const V100_EQUIPMENT_ART_CROPS = Object.freeze({
  "field-machete":Object.freeze([20,15,210,235]),
  "reinforced-vest":Object.freeze([267,14,211,229]),
  "quick-loader":Object.freeze([528,39,218,202]),
  "rescue-pouch":Object.freeze([785,38,207,195]),
  "survey-scope":Object.freeze([1041,47,226,174]),
  "anti-slip-boots":Object.freeze([15,279,228,202]),
  "recoil-brace":Object.freeze([278,261,211,235]),
  "contamination-filter":Object.freeze([520,275,239,201]),
  "survival-field-kit":Object.freeze([792,260,212,227]),
  "survival-reinforced-plate":Object.freeze([1070,266,182,215]),
  "tactical-field-radio":Object.freeze([36,494,197,243]),
  "tactical-supply-cache":Object.freeze([261,517,243,211]),
  "tactical-trauma-station":Object.freeze([516,547,252,173]),
  "tactical-flare-controller":Object.freeze([778,515,237,222]),
  "boss-muscle-fiber":Object.freeze([1086,518,141,220]),
  "boss-rail-spine":Object.freeze([61,746,147,257]),
  "boss-resonance-gland":Object.freeze([289,744,173,260]),
  "boss-mimic-larynx":Object.freeze([539,747,200,248]),
  "boss-ossified-core":Object.freeze([795,752,208,248]),
});
export function v100EquipmentArtworkImgStyle(item) {
  if(!item)return {};
  const crop=Object.hasOwn(V100_EQUIPMENT_ART_CROPS,item.id) ? V100_EQUIPMENT_ART_CROPS[item.id] : null;
  if(!crop)return {left:(-(item.artCell%5)*100)+'%',top:(-Math.floor(item.artCell/5)*100)+'%'};
  const [x,y,width,height]=crop,extent=Math.max(width,height);
  return {width:(1280/extent*100)+'%',height:(1024/extent*100)+'%',
    left:(((extent-width)/2-x)/extent*100)+'%',top:(((extent-height)/2-y)/extent*100)+'%',
    clipPath:`inset(${y/1024*100}% ${(1280-x-width)/1280*100}% ${(1024-y-height)/1024*100}% ${x/1280*100}%)`};
}
