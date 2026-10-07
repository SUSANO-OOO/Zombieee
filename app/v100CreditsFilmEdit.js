// Shot choices are editorial: keep the 11 saved scene IDs, vary framing within them.
const camera = (from, to, x = 40, y = 45, positionX = 35, positionY = 42) =>
  Object.freeze({ from, to, x, y, positionX, positionY });
const choices = {
  "street-community": camera(1.10, 1.02, 25, 50),
  "street-shutter": camera(1.02, 1.09, 43, 45),
  "street-doorstep": camera(1.04, 1.12, 36, 39),
  "street-paisen-broom": camera(1.09, 1.02, 48, 35),
  "street-paisen-flirt": camera(1.02, 1.08, 47, 45),
  "ward-radio": camera(1.04, 1.08, 33, 48),
  "ward-supplies": camera(1.12, 1.02, 38, 45),
  "ward-king-fan": camera(1.03, 1.10, 58, 38),
  "station-repair": camera(1.04, 1.12, 34, 58),
  "station-bench": camera(1.10, 1.02, 47, 50),
  "station-cart-parade": camera(1.04, 1.09, 43, 48),
  "hospital-bandage": camera(1.03, 1.10, 43, 45),
  "hospital-serum": camera(1.10, 1.04, 52, 48),
  "floodgate-rations": camera(1.12, 1.02, 46, 42),
  "floodgate-king-riceball": camera(1.02, 1.09, 40, 41),
  "floodgate-watch": camera(1.03, 1.08, 38, 46),
  "facility-power": camera(1.05, 1.11, 39, 47),
  "facility-linen": camera(1.09, 1.02, 33, 48),
  "facility-chiha-baba-tender": camera(1.03, 1.11, 37, 40),
  "armory-evidence": camera(1.09, 1.03, 42, 48),
  "armory-shelves": camera(1.02, 1.10, 33, 48),
  "armory-couple-dance": camera(1.13, 1.02, 43, 44),
  "zakimiya-family": camera(1.03, 1.09, 35, 43),
  "zakimiya-bottles": camera(1.08, 1.02, 42, 48),
  "vehicle-patch": camera(1.02, 1.10, 43, 48),
  "vehicle-mayo-splash": camera(1.12, 1.03, 43, 50),
  "vehicle-map": camera(1.04, 1.10, 45, 50),
  "defense-watch": camera(1.02, 1.08, 50, 45),
  "defense-bench": camera(1.10, 1.02, 44, 48),
  "defense-paisen-kuma-kiss": camera(1.03, 1.08, 40, 40),
  "kumaya-cooking": camera(1.08, 1.02, 43, 48),
  "kumaya-dog": camera(1.03, 1.10, 44, 68),
  "kumaya-omelet-chaos": camera(1.08, 1.02, 43, 41),
  "kumaya-mayo-selfie": camera(1.04, 1.09, 44, 45),
  "kumaya-table": camera(1.09, 1.02, 44, 45),
};
const inserts = {
  "ward-radio": { id: "ward-radio-hands", description: "いくらちゃんの手が、何度も直した無線のつまみを回す。", camera: camera(1.34, 1.40, 30, 58), durationWeight: .55 },
  "station-repair": { id: "station-repair-lamp", description: "工具と手元の向こうで、小さな改札の灯りが戻る。", camera: camera(1.30, 1.36, 32, 63), durationWeight: .55 },
  "hospital-bandage": { id: "hospital-bandage-expression", description: "包帯を巻かれるハチが顔をしかめる。ナオの表情も少し緩む。", camera: camera(1.28, 1.36, 57, 35), durationWeight: .55 },
  "hospital-serum": { id: "hospital-serum-vials", description: "ナオの手と、貴重な三本の血清。翌日の治療へ慎重に備える。", camera: camera(1.30, 1.36, 49, 48, 48, 48), durationWeight: .5 },
  "floodgate-king-riceball": { id: "floodgate-king-riceball-detail", description: "バケツの目に押しつけられたおにぎりを見て、モンキーが吹き出す。", camera: camera(1.29, 1.34, 37, 40), durationWeight: .55 },
  "facility-chiha-baba-tender": { id: "chiha-baba-hands", description: "Mrs.チハとババヤガの手が重なる。二人の距離が近づく。", camera: camera(1.28, 1.36, 36, 47), durationWeight: .65 },
  "zakimiya-family": { id: "zakimiya-daughter", description: "ザキミヤの腕の中で、娘が眠る。彼は動かず、その顔を見守る。", camera: camera(1.32, 1.39, 32, 49), durationWeight: .65 },
  "zakimiya-bottles": { id: "zakimiya-washing-hands", description: "戦いで荒れたザキミヤの手が、小さな哺乳瓶を洗う。", camera: camera(1.28, 1.34, 48, 60), durationWeight: .55 },
  "vehicle-map": { id: "vehicle-map-road", description: "修理した車両の地図に、街の外へ向かう道が残されている。", camera: camera(1.26, 1.33, 43, 55, 43, 45), durationWeight: .55 },
  "kumaya-cooking": { id: "kumaya-cooking-pan", description: "油のはねる鍋と、料理を仕上げるクマバーソンの手元。", camera: camera(1.28, 1.34, 45, 63), durationWeight: .45 },
  "kumaya-mayo-selfie": { id: "kumaya-mayo-nose", description: "集合写真のど真ん中を、マヨちゃんの鼻が占領する。", camera: camera(1.24, 1.30, 52, 68, 45, 55), durationWeight: .4 },
};
const newShots = {
  "hospital-serum": { id: "hospital-courtyard", sceneIndex: 3, sceneLabel: "大学病院", actors: ["unit-hachi","unit-nao","unit-mayo-chan"], src: "/art/v100/credits/hospital-courtyard-r3.webp", description: "翌朝の病院。仲間と職員が窓や花壇を直す中、マヨちゃんが包帯を引っ張り、ハチとナオに笑いが戻る。", durationWeight: 1.2, camera: camera(1.11, 1.02, 39, 48) },
  "armory-evidence": { id: "segawa-record", sceneIndex: 6, sceneLabel: "RED PANTHER装備庫", actors: ["segawa"], src: "/art/v100/credits/segawa-record-r2.webp", description: "回収された研究記録の中で、セガワが暴走したプリンターの紙に埋もれ、呆れた顔でコーヒーを持っている。", durationWeight: 1.15, transition: "cut", camera: camera(1.03, 1.10, 38, 43) },
  "zakimiya-bottles": { id: "zakimiya-family-morning", sceneIndex: 7, sceneLabel: "ザキミヤ", actors: ["unit-zakimiya"], src: "/art/v100/credits/zakimiya-family-morning-r2.webp", description: "翌朝、ザキミヤの妻が夫と娘を抱き寄せる。疲れた顔に、涙と笑みが戻る。", durationWeight: 1.3, camera: camera(1.02, 1.10, 35, 41) },
};
const hardCuts = new Set(["street-paisen-broom","street-paisen-flirt","ward-king-fan","station-cart-parade","floodgate-king-riceball","defense-bench","kumaya-omelet-chaos","kumaya-mayo-selfie"]);
export function v100EditedCreditsFilm(shots) {
  return Object.freeze(shots.flatMap(shot => {
    const wide = { ...shot, camera: choices[shot.id], transition: hardCuts.has(shot.id) ? "cut" : "dissolve" };
    if (shot.id === "kumaya-table") wide.durationWeight = 2.3;
    const edit = [wide];
    if (inserts[shot.id]) edit.push({ ...shot, ...inserts[shot.id], transition: "cut" });
    if (newShots[shot.id]) edit.push(newShots[shot.id]);
    return edit.map(frame => Object.freeze({ ...frame, actors: Object.freeze(frame.actors) }));
  }));
}
export function v100CreditsCameraStyle(camera, progress, reducedMotion = false) {
  if (!camera) return { transform: "none", origin: "50% 50%", position: "50% 50%" };
  const time = Math.max(0, Math.min(1, Number(progress) || 0));
  const eased = time * time * (3 - 2 * time);
  const scale = reducedMotion ? camera.from : camera.from + (camera.to - camera.from) * eased;
  return { transform: `scale(${scale})`, origin: `${camera.x}% ${camera.y}%`, position: `${camera.positionX}% ${camera.positionY}%` };
}
