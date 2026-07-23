import { deepFreeze } from "./freeze.js";

export const UNIT_CONTENT_SCHEMA_VERSION = 1;

export const UNIT_CONTENT = deepFreeze([
  { id: "scout", kind: "scout", displayName: "ハチ", name: "ハチ", aliases: ["unit-hachi"], cost: 25, key: "1", desc: "遊撃手・高速迎撃", deployCooldown: 8, hp: 80, speed: 27, damage: 11, range: 28, attackEvery: .62, bodyRadius: 11, laneSpeed: 78 },
  { id: "ranger", kind: "ranger", displayName: "ミズチ", name: "ミズチ", aliases: ["unit-mizuchi"], cost: 45, key: "2", desc: "射撃手・遠距離射撃", deployCooldown: 11, hp: 70, speed: 20, damage: 20, range: 145, attackEvery: .82, bodyRadius: 11, laneSpeed: 60 },
  { id: "brute", kind: "brute", displayName: "タタラ", name: "タタラ", aliases: ["unit-tatara"], cost: 70, key: "3", desc: "破砕兵・装甲拠点破壊", deployCooldown: 18, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05, bodyRadius: 16, laneSpeed: 42 },
  { id: "brawler", kind: "brawler", displayName: "パイセン", name: "パイセン", aliases: ["unit-paisen"], cost: 55, key: "4", desc: "格闘家・素手近接", deployCooldown: 13, hp: 135, speed: 23, damage: 26, range: 30, attackEvery: .72, bodyRadius: 11, laneSpeed: 68 },
  { id: "gunner", kind: "gunner", displayName: "レイダー", name: "レイダー", aliases: ["unit-raider"], cost: 60, key: "5", desc: "制圧射手・直線弾幕", deployCooldown: 15, hp: 90, speed: 18, damage: 13, range: 112, attackEvery: .34, bodyRadius: 11, laneSpeed: 54 },
  { id: "medic", kind: "medic", displayName: "ナオ", name: "ナオ", aliases: ["unit-nao"], cost: 35, key: "6", desc: "救護支援・単体治療", deployCooldown: 12, hp: 68, speed: 20, damage: 7, range: 118, attackEvery: 1.05, bodyRadius: 11, laneSpeed: 60 },
  { id: "crazy-king", kind: "crazy-king", displayName: "クレイジーキング", name: "クレイジーキング", aliases: ["unit-crazy-king"], cost: 65, key: "7", desc: "狂戦士・密集殲滅", deployCooldown: 17, hp: 124, speed: 20, damage: 20, range: 34, attackEvery: .82, bodyRadius: 14, laneSpeed: 58 },
  { id: "kumaverson", kind: "kumaverson", displayName: "クマバーソン", name: "クマバーソン", aliases: ["unit-kumaverson"], cost: 62, key: "8", desc: "前衛打撃・足止め", deployCooldown: 17, hp: 152, speed: 17, damage: 27, range: 31, attackEvery: 1.02, bodyRadius: 16, laneSpeed: 48 },
  { id: "babayaga", kind: "babayaga", displayName: "ババヤガ", name: "ババヤガ", aliases: ["unit-babayaga"], cost: 58, key: "9", desc: "精密射撃・特殊排除", deployCooldown: 16, hp: 76, speed: 19, damage: 31, range: 158, attackEvery: 1.04, bodyRadius: 11, laneSpeed: 62 },
  { id: "guardian", kind: "guardian", displayName: "ガンテツ", name: "ガンテツ", aliases: ["unit-gantetsu"], cost: 48, key: "0", desc: "重装盾・被害肩代わり", deployCooldown: 16, hp: 240, speed: 11, damage: 12, range: 32, attackEvery: 1.25, bodyRadius: 18, laneSpeed: 36 },
  { id: "engineer", kind: "engineer", displayName: "モンキー", name: "モンキー", aliases: ["unit-monkey"], cost: 42, key: "-", desc: "工兵・自動足止め", deployCooldown: 13, hp: 88, speed: 17, damage: 14, range: 104, attackEvery: .9, bodyRadius: 11, laneSpeed: 56 },
]);

export const UNIT_CONTENT_BY_ID = deepFreeze(Object.fromEntries(
  UNIT_CONTENT.map((unit) => [unit.id, unit]),
));

export function unitContentFor(id) {
  return UNIT_CONTENT_BY_ID[id] ?? null;
}
