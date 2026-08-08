const freezeLandmarks = (landmarks) => Object.freeze(landmarks.map((landmark) => Object.freeze(landmark)));

export const MAP_LANDMARKS_BY_REGION = Object.freeze({
  "region-nishijin": freezeLandmarks([
    { className: "tower", label: "福岡タワー", status: "高危険区域" },
    { className: "subway", label: "西新駅地下", status: "暫定封鎖" },
    { className: "police", label: "警察署周辺", status: "調査中" },
    { className: "hospital", label: "大学病院", status: "地下信号を確認" },
  ]),
  "region-university-hospital": freezeLandmarks([
    { className: "hospital", label: "救急搬入口", status: "感染体接近" },
    { className: "shelter", label: "救急病棟", status: "中継反応あり" },
    { className: "subway", label: "地下搬送口", status: "研究区画へ接続" },
  ]),
  "region-underground-research": freezeLandmarks([
    { className: "blockade", label: "除染ゲート", status: "隔離扉停止" },
    { className: "police", label: "検体隔離環", status: "制御再起動待ち" },
    { className: "subway", label: "搬送坑道", status: "地上線へ接続" },
  ]),
  "region-logistics-line": freezeLandmarks([
    { className: "coast", label: "中継ヤード", status: "通信汚染" },
    { className: "shelter", label: "貨物退避場", status: "避難列待機" },
    { className: "shoreline", label: "湾岸搬出路", status: "高危険区域" },
  ]),
  "region-t-plan-core": freezeLandmarks([
    { className: "blockade", label: "外郭制御環", status: "指令核稼働" },
    { className: "hospital", label: "中央封鎖核", status: "感染裂孔を確認" },
    { className: "coast", label: "観測区画", status: "応答なし" },
  ]),
  "region-bay-quarantine": freezeLandmarks([
    { className: "tower", label: "湾岸タワー", status: "非常回廊封鎖" },
    { className: "shelter", label: "市民資料館", status: "搬送路確保中" },
    { className: "coast", label: "海浜連絡橋", status: "高潮警戒" },
    { className: "shoreline", label: "河口防潮門", status: "最終封鎖対象" },
  ]),
});

export const NEUTRAL_MAP_REGION_IDS = Object.freeze([]);

export function resolveMapLandmarks(regionId) {
  if (Object.hasOwn(MAP_LANDMARKS_BY_REGION, regionId)) {
    return Object.freeze({
      landmarks: MAP_LANDMARKS_BY_REGION[regionId],
      source: "explicit",
      missing: false,
    });
  }
  if (NEUTRAL_MAP_REGION_IDS.includes(regionId)) {
    return Object.freeze({ landmarks: Object.freeze([]), source: "neutral", missing: false });
  }
  return Object.freeze({ landmarks: Object.freeze([]), source: "missing", missing: true });
}
