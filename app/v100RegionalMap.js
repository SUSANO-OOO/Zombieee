import { v100StageDiscovered } from "./v100MapDisclosure.js";

const chapterMaps = Object.freeze({
  "chapter-1": Object.freeze({
    region: "西新市街",
    subregion: "商店街から西新駅へ",
    assetPath: "/assets/v100/maps/chapter-1-nishijin.webp",
    positions: Object.freeze([[28, 50], [46, 30], [55, 56], [66, 45], [76, 27], [91, 17]]),
  }),
  "chapter-2": Object.freeze({
    region: "大学病院",
    subregion: "救急搬入口から地下機械室へ",
    assetPath: "/assets/v100/maps/chapter-2-hospital.webp",
    positions: Object.freeze([[16, 64], [27, 64], [40, 61], [55, 41], [68, 55], [86, 62]]),
  }),
  "chapter-3": Object.freeze({
    region: "沿岸連絡区",
    subregion: "物流線から河口防潮門へ",
    assetPath: "/assets/v100/maps/chapter-3-coast.webp",
    positions: Object.freeze([[13, 70], [30, 47], [38, 20], [55, 23], [63, 40], [54, 60], [80, 57], [91, 29]]),
  }),
  "chapter-4": Object.freeze({
    region: "ムガリアン社屋群",
    subregion: "物流本部から役員研究所へ",
    assetPath: "/assets/v100/maps/chapter-4-corporate.webp",
    positions: Object.freeze([[20, 57], [36, 28], [47, 57], [65, 33], [85, 53]]),
  }),
  "chapter-5": Object.freeze({
    region: "湾岸撤収区",
    subregion: "ヤードから散布管制網を追う",
    assetPath: "/assets/v100/maps/chapter-5-bay.webp",
    positions: Object.freeze([[25, 66], [40, 25], [60, 52], [76, 26]]),
  }),
  "chapter-final": Object.freeze({
    region: "西新防衛線",
    subregion: "避難路を背に最終防衛",
    assetPath: "/assets/v100/maps/chapter-6-defense.webp",
    positions: Object.freeze([[50, 52]]),
  }),
});

export function v100RegionalMapForChapter(chapterId) {
  return chapterMaps[chapterId] ?? chapterMaps["chapter-1"];
}

export function v100RegionalMapDisclosure(region, chapterStageIds, save) {
  const firstStageId = chapterStageIds[0] ?? null;
  const endpointStageId = chapterStageIds.at(-1) ?? null;
  const firstDiscovered = v100StageDiscovered(save, firstStageId);
  const endpointDiscovered = v100StageDiscovered(save, endpointStageId);
  return {
    regionLabel: firstDiscovered ? region.region : "未到達区域",
    subregionLabel: endpointDiscovered ? region.subregion : firstDiscovered ? "区域内を調査中" : "未到達区域",
    firstDiscovered,
    endpointDiscovered,
  };
}

export function v100RegionalMapPoints(chapterId, total) {
  const { positions } = v100RegionalMapForChapter(chapterId);
  if (total <= positions.length) return positions.slice(0, total);
  const last = positions.at(-1) ?? [50, 50];
  return Array.from({ length: total }, (_, index) => positions[index] ?? [last[0], Math.max(12, last[1] - (index - positions.length + 1) * 5)]);
}

export function v100RegionalMapPinPoints(chapterId, total) {
  const points = v100RegionalMapPoints(chapterId, total);
  if (chapterId !== "chapter-3") return points;
  // On the narrow coastal map, S16/S17/S18 sit close enough for 48px touch
  // targets to overlap. Nudge the three pins around their real route anchors;
  // the SVG draws short leader marks back to the authored facility coordinates.
  return points.map(([x, y], index) => {
    if (index === 3) return [x - 3, y];
    if (index === 4) return [x + 3, y];
    if (index === 5) return [x - 3, y];
    return [x, y];
  });
}

export function v100RegionalMapPaths() {
  return Object.fromEntries(Object.entries(chapterMaps).map(([id, entry]) => [id, entry.assetPath]));
}
