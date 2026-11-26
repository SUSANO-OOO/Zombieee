import { deepFreeze } from "./freeze.js";

export const UNIT_CONTENT_SCHEMA_VERSION = 1;

export const UNIT_CONTENT = deepFreeze([
  { id: "scout", kind: "scout", displayName: "ハチ", name: "ハチ", aliases: ["unit-hachi"], aiProfile: "skirmisher", cost: 25, key: "1", desc: "バールを手に敵を追う", deployCooldown: 8, hp: 80, speed: 27, damage: 11, range: 28, attackEvery: .62, bodyRadius: 11, laneSpeed: 78 },
  { id: "ranger", kind: "ranger", displayName: "ミズチ", name: "ミズチ", aliases: ["unit-mizuchi"], aiProfile: "marksman", cost: 45, key: "2", desc: "ライフルで遠くの敵を狙う", deployCooldown: 11, hp: 70, speed: 20, damage: 20, range: 145, attackEvery: .82, bodyRadius: 11, laneSpeed: 60 },
  { id: "brute", kind: "brute", displayName: "タタラ", name: "タタラ", aliases: ["unit-tatara"], aiProfile: "heavy", cost: 70, key: "3", desc: "装甲の厚い敵に大槌を振るう", deployCooldown: 18, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05, bodyRadius: 16, laneSpeed: 42 },
  { id: "brawler", kind: "brawler", displayName: "パイセン", name: "パイセン", aliases: ["unit-paisen"], aiProfile: "frontline", cost: 55, key: "4", desc: "間合いを詰め、拳を叩き込む", deployCooldown: 13, hp: 135, speed: 23, damage: 26, range: 30, attackEvery: .72, bodyRadius: 11, laneSpeed: 68 },
  { id: "gunner", kind: "gunner", displayName: "レイダー", name: "レイダー", aliases: ["unit-raider"], aiProfile: "suppression", cost: 60, key: "5", desc: "並んだ敵をまとめて撃つ", deployCooldown: 15, hp: 90, speed: 18, damage: 13, range: 112, attackEvery: .34, bodyRadius: 11, laneSpeed: 54 },
  { id: "medic", kind: "medic", displayName: "ナオ", name: "ナオ", aliases: ["unit-nao"], aiProfile: "support", cost: 35, key: "6", desc: "傷ついた仲間を一人ずつ手当てする", deployCooldown: 12, hp: 68, speed: 20, damage: 7, range: 118, attackEvery: 1.05, bodyRadius: 11, laneSpeed: 60 },
  { id: "crazy-king", kind: "crazy-king", displayName: "クレイジーキング", name: "クレイジーキング", aliases: ["unit-crazy-king"], aiProfile: "frontline", cost: 65, key: "7", desc: "連撃が続くと攻撃が速くなる", deployCooldown: 17, hp: 124, speed: 20, damage: 20, range: 34, attackEvery: .82, bodyRadius: 14, laneSpeed: 58 },
  { id: "kumaverson", kind: "kumaverson", displayName: "クマバーソン", name: "クマバーソン", aliases: ["unit-kumaverson"], aiProfile: "heavy", cost: 62, key: "8", desc: "最前線で踏ん張り、敵を食い止める", deployCooldown: 17, hp: 152, speed: 17, damage: 27, range: 31, attackEvery: 1.02, bodyRadius: 16, laneSpeed: 48 },
  { id: "babayaga", kind: "babayaga", displayName: "ババヤガ", name: "ババヤガ", aliases: ["unit-babayaga"], aiProfile: "marksman", cost: 58, key: "9", desc: "危険な敵を拳銃で狙い撃つ", deployCooldown: 16, hp: 76, speed: 19, damage: 31, range: 158, attackEvery: 1.04, bodyRadius: 11, laneSpeed: 62 },
  { id: "guardian", kind: "guardian", displayName: "ガンテツ", name: "ガンテツ", aliases: ["unit-gantetsu"], aiProfile: "heavy", cost: 48, key: "0", desc: "盾を構えて仲間をかばう", deployCooldown: 16, hp: 240, speed: 11, damage: 12, range: 32, attackEvery: 1.25, bodyRadius: 18, laneSpeed: 36 },
  { id: "engineer", kind: "engineer", displayName: "モンキー", name: "モンキー", aliases: ["unit-monkey"], aiProfile: "engineer", cost: 42, key: "-", desc: "罠を仕掛けて敵の足を止める", deployCooldown: 13, hp: 88, speed: 17, damage: 14, range: 104, attackEvery: .9, bodyRadius: 11, laneSpeed: 56 },
  { id: "zakimiya", kind: "zakimiya", displayName: "ザキミヤ", name: "ザキミヤ", aliases: ["unit-zakimiya"], aiProfile: "frontline", cost: 52, key: "^", desc: "火酒を投げて敵の群れを焼く", deployCooldown: 14, hp: 105, speed: 18, damage: 21, range: 30, attackEvery: .9, bodyRadius: 12, laneSpeed: 54 },
  { id: "tky", kind: "tky", displayName: "TKY", name: "TKY", aliases: ["unit-tky"], aiProfile: "skirmisher", cost: 64, key: "Q", desc: "ピンクの光刃で正面の敵を薙ぎ払う", deployCooldown: 15, hp: 92, speed: 24, damage: 24, range: 48, attackEvery: .58, bodyRadius: 11, laneSpeed: 72 },
  { id: "mrs-chiha", kind: "mrs-chiha", displayName: "Mrs.チハ", name: "Mrs.チハ", aliases: ["unit-mrs-chiha"], aiProfile: "suppression", cost: 68, key: "W", desc: "榴弾を撃ち、爆風で敵を巻き込む", deployCooldown: 17, hp: 80, speed: 17, damage: 18, range: 155, attackEvery: 1.18, bodyRadius: 11, laneSpeed: 52 },
  { id: "miyamoto-musashi", kind: "miyamoto-musashi", displayName: "宮本武蔵", name: "宮本武蔵", aliases: ["unit-miyamoto-musashi"], aiProfile: "frontline", cost: 72, key: "E", desc: "敵の一撃を受け流し、二刀で斬り返す", deployCooldown: 18, hp: 135, speed: 21, damage: 31, range: 38, attackEvery: .72, bodyRadius: 13, laneSpeed: 60 },
  { id: "mayo-chan", kind: "mayo-chan", displayName: "マヨちゃん", name: "マヨちゃん", aliases: ["unit-mayo-chan"], aiProfile: "skirmisher", cost: 46, key: "R", desc: "小型の感染者に飛びついて足を止める", deployCooldown: 24, hp: 64, speed: 33, damage: 13, range: 22, attackEvery: .48, bodyRadius: 7, laneSpeed: 96 },
]);

export const UNIT_CONTENT_BY_ID = deepFreeze(Object.fromEntries(
  UNIT_CONTENT.map((unit) => [unit.id, unit]),
));

export function unitContentFor(id) {
  return UNIT_CONTENT_BY_ID[id] ?? null;
}
