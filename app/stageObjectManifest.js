/** Production overlay assets that must change independently of stage scenery. */

const STAGE_IDS = Object.freeze({
  NISHIJIN: "stage-nishijin-shopping-street",
  SAWARA: "stage-sawara-ward-office",
  TAKUYA: "stage-nishijin-defense-line-takuya",
});

export const STAGE_OBJECT_DEPTH_BANDS = Object.freeze([
  "rear-scenery",
  "objective",
  "foreground-prop",
]);

function stageObject({
  id,
  stageId,
  slot,
  state,
  path,
  x,
  y,
  width,
  z = 1,
  depthBand,
  defaultVisible = false,
  collision = null,
  interactionX = null,
  replacesRuntimeSprite = null,
}) {
  if (!STAGE_OBJECT_DEPTH_BANDS.includes(depthBand)) {
    throw new RangeError(`Unknown stage object depth band: ${String(depthBand)}`);
  }
  return Object.freeze({
    id,
    stageId,
    slot,
    state,
    visibleWhen: Object.freeze([state]),
    path,
    // Rear scenery renders before fighters, while foreground props render
    // afterward. z orders objects within the same explicit depth band.
    placement: Object.freeze({ x, y, width, anchorX: 0.5, anchorY: 1, z }),
    depthBand,
    laneCorridorPolicy: depthBand === "rear-scenery"
      ? "outside-walkable-lanes"
      : depthBand === "objective"
        ? "battlefield-objective"
        : "overlays-walkable-lanes",
    collision: collision ? Object.freeze({
      ...collision,
      lanes: Object.freeze([...(collision.lanes ?? [])]),
      purpose: "battlefield-supply-placement-exclusion",
    }) : null,
    interactionX,
    replacesRuntimeSprite,
    defaultVisible,
    productionTreatment: "generated-transparent-overlay-v1",
  });
}

function inventoryItem(id, label, treatment, evidence) {
  return Object.freeze({ id, label, treatment, evidence });
}

const NISHIJIN_INVENTORY = Object.freeze([
  inventoryItem("delivery-van", "放置された配送車", "production-background", "商店街中央奥の放置車両"),
  inventoryItem("fallen-bicycle", "倒れた自転車", "production-background", "左右店舗前の倒れた自転車"),
  inventoryItem("closed-shop-shutters", "閉鎖された店舗シャッター", "production-background", "左右アーケード店舗列"),
  inventoryItem("damaged-shop-sign", "破損した店舗看板", "production-background+dynamic-overlay", "背景看板群とarcade-sign slot"),
  inventoryItem("arcade-columns", "商店街の柱", "production-background", "アーケード支持柱列"),
  inventoryItem("streetlights", "街灯", "production-background", "店舗前の街灯列"),
  inventoryItem("hanging-lights", "吊り照明", "production-background", "アーケード天井の吊り照明列"),
  inventoryItem("product-shelves", "商品棚", "production-background", "薬局脇の破損棚"),
  inventoryItem("boxes", "箱", "production-background", "配送車・店舗前の箱"),
  inventoryItem("shopping-baskets", "買い物かご", "production-background", "薬局前の転倒かご"),
  inventoryItem("scattered-products", "散乱した商品", "production-background", "薬局前路面の散乱品"),
  inventoryItem("burned-road", "焼けた路面", "production-background", "左右火災周辺の黒化路面"),
  inventoryItem("bloodstains", "血痕", "production-background", "中央通路の暗赤色痕"),
  inventoryItem("rubble", "瓦礫", "production-background", "店舗前・前景の瓦礫"),
  inventoryItem("pharmacy", "薬局", "production-background", "薬局色・医療シンボルを持つ右側店舗"),
  inventoryItem("pharmacy-rooftop-route", "薬局屋上へ続く建物表現", "production-background", "薬局外階段と上層踊り場"),
  inventoryItem("crazy-king-trap", "クレイジーキングの罠", "dynamic-production-overlay", "wire-trap slot"),
  inventoryItem("trap-wire", "ワイヤー", "dynamic-production-overlay", "nishijin-wire-trap-intact"),
  inventoryItem("falling-sign", "落下看板", "dynamic-production-overlay", "arcade-sign slot"),
  inventoryItem("fire-door", "防火扉", "dynamic-production-overlay", "fire-shutter slot"),
  inventoryItem("infection-base", "感染拠点", "dynamic-production-overlay", "infection-node slot"),
  inventoryItem("infection-tissue", "周囲の感染組織", "dynamic-production-overlay", "infection-node active/destroyed state"),
]);

const SAWARA_INVENTORY = Object.freeze([
  inventoryItem("rescue-vehicle", "救援車両", "production-background+dynamic-overlay", "左側救援車両とrescue-van slot"),
  inventoryItem("ambulance", "救急車", "production-background", "左側救急車"),
  inventoryItem("transport-vehicle", "搬送車", "production-background", "庁舎入口脇の搬送車"),
  inventoryItem("evacuation-tent", "避難テント", "production-background", "庁舎前の大型テント"),
  inventoryItem("traffic-cones", "交通コーン", "production-background", "車両・テント周辺"),
  inventoryItem("sandbags", "土のう", "production-background", "テント入口・防護線"),
  inventoryItem("protective-fence", "防護柵", "production-background", "庁舎階段前"),
  inventoryItem("relief-supplies", "救援物資", "production-background", "中央パレット群"),
  inventoryItem("medical-boxes", "医療箱", "production-background", "救護机とテント前"),
  inventoryItem("water", "水", "production-background", "透明ボトル箱"),
  inventoryItem("lunch-boxes", "弁当箱", "production-background+dynamic-overlay", "救護机とlunch-crate slot"),
  inventoryItem("tables", "机", "production-background", "テント横の救護机"),
  inventoryItem("chairs", "椅子", "production-background", "救護机周辺"),
  inventoryItem("stretchers", "担架", "production-background", "救急車脇の担架"),
  inventoryItem("vehicle-blocking-rubble", "車両を塞ぐ瓦礫", "dynamic-production-overlay", "rubble slot"),
  inventoryItem("ward-office-entrance", "区役所入口", "production-background", "中央庁舎ガラス入口"),
  inventoryItem("windows", "窓", "production-background", "庁舎正面・上階"),
  inventoryItem("noticeboard", "掲示板", "production-background", "庁舎入口横掲示板"),
  inventoryItem("floodlights", "投光器", "production-background", "左右投光塔"),
  inventoryItem("emergency-lights", "非常灯", "production-background", "救護線の橙色灯"),
  inventoryItem("rotating-beacon", "回転灯", "production-background", "救急車上部"),
  inventoryItem("damaged-evac-route", "損傷した避難経路", "production-background", "右側破損ランプ"),
  inventoryItem("babayaga-upper-position", "ババヤガの上階射撃位置", "production-background", "上階点灯窓"),
  inventoryItem("babayaga-window", "ババヤガが使用する窓", "dynamic-production-overlay", "upper-window slot"),
  inventoryItem("kumaverson-supplies", "クマバーソンの物資・弁当配置", "dynamic-production-overlay", "lunch-crate slot"),
]);

const DEFENSE_INVENTORY = Object.freeze([
  inventoryItem("concrete-walls", "コンクリート防壁", "production-background", "全景の防壁列"),
  inventoryItem("barbed-wire", "有刺鉄線", "production-background", "前景・防壁上"),
  inventoryItem("anti-vehicle-obstacles", "対車両障害物", "production-background", "前景の鉄製障害物"),
  inventoryItem("steel-fence", "鉄柵", "production-background", "後方封鎖線"),
  inventoryItem("closure-gate", "封鎖ゲート", "production-background", "中央封鎖ゲート"),
  inventoryItem("abandoned-security-gear", "放棄された警備装備", "production-background", "監視塔下の盾・装備"),
  inventoryItem("abandoned-military-gear", "放棄された軍用装備", "production-background", "右側土のう脇の装備箱"),
  inventoryItem("sandbags", "土のう", "production-background", "中央防壁の土のう"),
  inventoryItem("surveillance", "監視設備", "production-background", "監視塔とカメラ"),
  inventoryItem("lighting", "照明", "production-background", "左右投光器"),
  inventoryItem("warning-sign", "警告看板", "production-background", "封鎖ゲートの警告板"),
  inventoryItem("quarantine-sign", "感染隔離表示", "production-background", "警告板のbiohazard表示"),
  inventoryItem("shelling-scars", "砲撃跡", "production-background", "中央防壁の破砕跡"),
  inventoryItem("craters", "クレーター", "production-background", "中央・前景路面"),
  inventoryItem("burned-ground", "焼けた地面", "production-background", "右側炎周辺"),
  inventoryItem("industrial-equipment", "工業設備", "production-background", "背景工場設備"),
  inventoryItem("pipes", "配管", "production-background", "右側配管群"),
  inventoryItem("tanks", "タンク", "production-background", "背景工業タンク"),
  inventoryItem("red-infection-smoke", "赤い感染煙", "production-background", "赤空と感染煙柱"),
  inventoryItem("infection-tissue", "感染組織", "dynamic-production-overlay", "infection-nest slot"),
  inventoryItem("false-distress-transmitter", "偽救難音声の通信設備", "dynamic-production-overlay", "transmitter slot"),
  inventoryItem("takuya-entry", "TAKUYA出現地点", "dynamic-production-overlay", "spawn-marker slot"),
  inventoryItem("exposed-infection-base", "TAKUYA撃破後の感染拠点", "dynamic-production-overlay", "infection-nest exposed/damaged/destroyed state"),
]);

export const STAGE_OBJECT_MANIFEST = Object.freeze({
  [STAGE_IDS.NISHIJIN]: Object.freeze({
    backgroundPath: "/art/v060/battle-nishijin-shopping-street-v1.webp",
    staticTreatment: "authored-in-production-background",
    productionInventory: NISHIJIN_INVENTORY,
    objects: Object.freeze([
      stageObject({ id: "nishijin-static-dressing", stageId: STAGE_IDS.NISHIJIN, slot: "static-dressing", state: "static-dressing", path: "/art/v060/stage-objects/nishijin-static-dressing-v1.png", x: 640, y: 184, width: 240, z: 0, depthBand: "rear-scenery" }),
      stageObject({ id: "nishijin-wire-trap-intact", stageId: STAGE_IDS.NISHIJIN, slot: "wire-trap", state: "trap-armed", path: "/art/v060/stage-objects/nishijin-wire-trap-intact-v1.png", x: 305, y: 438, width: 145, z: 3, depthBand: "foreground-prop", defaultVisible: true, collision: { width: 116, height: 16, lanes: [2] } }),
      stageObject({ id: "nishijin-wire-trap-sprung", stageId: STAGE_IDS.NISHIJIN, slot: "wire-trap", state: "trap-sprung", path: "/art/v060/stage-objects/nishijin-wire-trap-sprung-v1.png", x: 305, y: 438, width: 145, z: 3, depthBand: "foreground-prop" }),
      stageObject({ id: "nishijin-sign-intact", stageId: STAGE_IDS.NISHIJIN, slot: "arcade-sign", state: "sign-hanging", path: "/art/v060/stage-objects/nishijin-sign-intact-v1.png", x: 522, y: 175, width: 100, z: 1, depthBand: "rear-scenery", defaultVisible: true }),
      stageObject({ id: "nishijin-sign-fallen", stageId: STAGE_IDS.NISHIJIN, slot: "arcade-sign", state: "sign-fallen", path: "/art/v060/stage-objects/nishijin-sign-fallen-v1.png", x: 522, y: 438, width: 150, z: 3, depthBand: "foreground-prop", collision: { width: 126, height: 28, lanes: [2] } }),
      stageObject({ id: "nishijin-fire-shutter-closed", stageId: STAGE_IDS.NISHIJIN, slot: "fire-shutter", state: "shutter-closed", path: "/art/v060/stage-objects/nishijin-fire-shutter-closed-v1.png", x: 820, y: 184, width: 120, z: 1, depthBand: "rear-scenery", defaultVisible: true }),
      stageObject({ id: "nishijin-fire-shutter-open", stageId: STAGE_IDS.NISHIJIN, slot: "fire-shutter", state: "shutter-open", path: "/art/v060/stage-objects/nishijin-fire-shutter-open-v1.png", x: 820, y: 184, width: 120, z: 1, depthBand: "rear-scenery" }),
      stageObject({ id: "nishijin-infection-node-active", stageId: STAGE_IDS.NISHIJIN, slot: "infection-node", state: "base-exposed", path: "/art/v060/stage-objects/nishijin-infection-node-active-v1.png", x: 850, y: 434, width: 128, z: 3, depthBand: "objective", collision: { width: 94, height: 68, lanes: [2] }, interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
      stageObject({ id: "nishijin-infection-node-destroyed", stageId: STAGE_IDS.NISHIJIN, slot: "infection-node", state: "base-destroyed", path: "/art/v060/stage-objects/nishijin-infection-node-destroyed-v1.png", x: 850, y: 434, width: 128, z: 3, depthBand: "objective", interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
    ]),
  }),
  [STAGE_IDS.SAWARA]: Object.freeze({
    backgroundPath: "/art/v060/battle-sawara-ward-office-v1.webp",
    staticTreatment: "authored-in-production-background",
    productionInventory: SAWARA_INVENTORY,
    objects: Object.freeze([
      stageObject({ id: "sawara-static-dressing", stageId: STAGE_IDS.SAWARA, slot: "static-dressing", state: "static-dressing", path: "/art/v060/stage-objects/sawara-static-dressing-v1.png", x: 560, y: 180, width: 300, z: 0, depthBand: "rear-scenery" }),
      stageObject({ id: "sawara-rescue-van-blocked", stageId: STAGE_IDS.SAWARA, slot: "rescue-van", state: "evac-blocked", path: "/art/v060/stage-objects/sawara-rescue-van-blocked-v1.png", x: 805, y: 184, width: 150, z: 1, depthBand: "rear-scenery", defaultVisible: true }),
      stageObject({ id: "sawara-rescue-van-ready", stageId: STAGE_IDS.SAWARA, slot: "rescue-van", state: "evac-ready", path: "/art/v060/stage-objects/sawara-rescue-van-ready-v1.png", x: 805, y: 184, width: 150, z: 1, depthBand: "rear-scenery" }),
      stageObject({ id: "sawara-rubble-blocking", stageId: STAGE_IDS.SAWARA, slot: "rubble", state: "rubble-blocking", path: "/art/v060/stage-objects/sawara-rubble-blocking-v1.png", x: 654, y: 438, width: 150, z: 3, depthBand: "foreground-prop", defaultVisible: true, collision: { width: 126, height: 34, lanes: [2] } }),
      stageObject({ id: "sawara-rubble-cleared", stageId: STAGE_IDS.SAWARA, slot: "rubble", state: "rubble-cleared", path: "/art/v060/stage-objects/sawara-rubble-cleared-v1.png", x: 654, y: 438, width: 150, z: 3, depthBand: "foreground-prop" }),
      stageObject({ id: "sawara-shooting-window-lit", stageId: STAGE_IDS.SAWARA, slot: "upper-window", state: "under-fire", path: "/art/v060/stage-objects/sawara-shooting-window-lit-v1.png", x: 720, y: 116, width: 120, z: 1, depthBand: "rear-scenery", defaultVisible: true }),
      stageObject({ id: "sawara-lunch-crate-sealed", stageId: STAGE_IDS.SAWARA, slot: "lunch-crate", state: "supplies-sealed", path: "/art/v060/stage-objects/sawara-lunch-crate-sealed-v1.png", x: 523, y: 438, width: 86, z: 3, depthBand: "foreground-prop", defaultVisible: true, collision: { width: 72, height: 34, lanes: [2] } }),
      stageObject({ id: "sawara-lunch-crate-open", stageId: STAGE_IDS.SAWARA, slot: "lunch-crate", state: "supplies-open", path: "/art/v060/stage-objects/sawara-lunch-crate-open-v1.png", x: 523, y: 438, width: 86, z: 3, depthBand: "foreground-prop" }),
    ]),
  }),
  [STAGE_IDS.TAKUYA]: Object.freeze({
    backgroundPath: "/art/v060/battle-nishijin-defense-line-v1.webp",
    staticTreatment: "authored-in-production-background",
    productionInventory: DEFENSE_INVENTORY,
    objects: Object.freeze([
      stageObject({ id: "defense-static-dressing", stageId: STAGE_IDS.TAKUYA, slot: "static-dressing", state: "static-dressing", path: "/art/v060/stage-objects/defense-static-dressing-v1.png", x: 610, y: 398, width: 318, z: 0, depthBand: "rear-scenery" }),
      stageObject({ id: "defense-transmitter-active", stageId: STAGE_IDS.TAKUYA, slot: "transmitter", state: "transmitter-active", path: "/art/v060/stage-objects/defense-transmitter-active-v1.png", x: 790, y: 430, width: 98, z: 3, depthBand: "objective", defaultVisible: true, collision: { width: 70, height: 92, lanes: [2] } }),
      stageObject({ id: "defense-transmitter-damaged", stageId: STAGE_IDS.TAKUYA, slot: "transmitter", state: "transmitter-damaged", path: "/art/v060/stage-objects/defense-transmitter-damaged-v1.png", x: 790, y: 430, width: 98, z: 3, depthBand: "objective" }),
      stageObject({ id: "defense-spawn-marker", stageId: STAGE_IDS.TAKUYA, slot: "spawn-marker", state: "takuya-entry", path: "/art/v060/stage-objects/defense-spawn-marker-v1.png", x: 526, y: 442, width: 132, z: 2, depthBand: "foreground-prop" }),
      stageObject({ id: "defense-infection-nest-dormant", stageId: STAGE_IDS.TAKUYA, slot: "infection-nest", state: "nest-dormant", path: "/art/v060/stage-objects/defense-infection-nest-dormant-v1.png", x: 850, y: 436, width: 155, z: 3, depthBand: "objective", defaultVisible: true, collision: { width: 124, height: 74, lanes: [2] }, interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
      stageObject({ id: "defense-infection-nest-exposed", stageId: STAGE_IDS.TAKUYA, slot: "infection-nest", state: "nest-exposed", path: "/art/v060/stage-objects/defense-infection-nest-exposed-v1.png", x: 850, y: 436, width: 155, z: 3, depthBand: "objective", collision: { width: 124, height: 74, lanes: [2] }, interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
      stageObject({ id: "defense-infection-nest-damaged", stageId: STAGE_IDS.TAKUYA, slot: "infection-nest", state: "nest-damaged", path: "/art/v060/stage-objects/defense-infection-nest-damaged-v1.png", x: 850, y: 436, width: 155, z: 3, depthBand: "objective", collision: { width: 124, height: 62, lanes: [2] }, interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
      stageObject({ id: "defense-infection-nest-destroyed", stageId: STAGE_IDS.TAKUYA, slot: "infection-nest", state: "nest-destroyed", path: "/art/v060/stage-objects/defense-infection-nest-destroyed-v1.png", x: 850, y: 436, width: 155, z: 3, depthBand: "objective", interactionX: 875, replacesRuntimeSprite: "/infected-checkpoint-v1.png" }),
    ]),
  }),
});

export const stageObjectStageIds = Object.freeze(Object.keys(STAGE_OBJECT_MANIFEST));

/**
 * Returns defaults when state is omitted.  A string or array selects explicit
 * scene-state variants, making state transitions deterministic for game code
 * and the localhost overlay QA gallery.
 */
export function stageObjectsFor(stageId, state) {
  const stage = STAGE_OBJECT_MANIFEST[stageId];
  if (!stage) throw new RangeError(`Unknown stage object manifest: ${String(stageId)}`);
  if (state === undefined || state === null) return stage.objects.filter((entry) => entry.defaultVisible);
  const requestedStates = Array.isArray(state) ? state : [state];
  const selectedBySlot = new Map();
  for (const requestedState of requestedStates) {
    for (const entry of stage.objects) {
      if (entry.visibleWhen.includes(requestedState)) selectedBySlot.set(entry.slot, entry);
    }
  }
  return stage.objects.filter((entry) => selectedBySlot.get(entry.slot) === entry);
}
