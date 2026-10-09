// The 106-second edit retains all eleven saved scenes and uses distinct
// drawings with enough time for the action in each one to read.
export const V100_CREDITS_SCENE_STARTS = Object.freeze([0, 9.714286, 19.238095, 28.761905, 38.285714, 47.809524, 57.333333, 66.857143, 76.380952, 85.904762, 97.333333]);
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
// Offsets are seconds inside their canonical scene; the last drawing in
// each scene holds until the next scene boundary.
const selected = [
  ["street-community", 0], ["street-shutter", 3], ["street-paisen-broom", 6],
  ["ward-supplies", 0], ["ward-king-fan", 5],
  ["station-repair", 0], ["station-cart-parade", 5],
  ["hospital-serum", 0], ["hospital-courtyard", 3.2],
  ["floodgate-rations", 0], ["floodgate-king-riceball", 4],
  ["facility-power", 0], ["facility-chiha-baba-tender", 4.2],
  ["armory-evidence", 0], ["segawa-record", 2.5], ["armory-couple-dance", 6.5],
  ["zakimiya-bottles", 0], ["zakimiya-family-morning", 3.2],
  ["vehicle-patch", 0], ["vehicle-mayo-splash", 4.2],
  ["defense-watch", 0], ["defense-bench", 2.5], ["defense-paisen-kuma-kiss", 7],
  ["kumaya-tky-receipt", 0], ["kumaya-main-table", 2.5],
];
const newShots = {
  "hospital-serum": { id: "hospital-courtyard", sceneIndex: 3, sceneLabel: "大学病院", actors: ["unit-paisen","unit-kumaverson","unit-babayaga","unit-mrs-chiha","unit-zakimiya","unit-mayo-chan"], src: "/art/v100/story-r5/cuts/ending-medical-progress.webp", description: "病院で進行の止まった腕を確かめる。仲間たちは医師の説明を聞き、次の診察を待つ。", durationWeight: 1.2, camera: camera(1.02, 1.05, 40, 43) },
  "armory-evidence": { id: "segawa-record", sceneIndex: 6, sceneLabel: "RED PANTHER装備庫", actors: ["segawa"], src: "/art/v100/credits/segawa-record-r2.webp", description: "回収された研究記録の中で、セガワが暴走したプリンターの紙に埋もれ、呆れた顔でコーヒーを持っている。", durationWeight: 1.15, transition: "cut", camera: camera(1.03, 1.10, 38, 43) },
  "zakimiya-bottles": { id: "zakimiya-family-morning", sceneIndex: 7, sceneLabel: "ザキミヤ", actors: ["unit-zakimiya"], src: "/art/v100/story-r5/cuts/ending-zakimiya-family.webp", description: "病院で再会したザキミヤの家族。妻が眠る息子を抱き、ザキミヤがそっと顔を寄せる。", durationWeight: 1.3, camera: camera(1.02, 1.05, 35, 41) },
  "kumaya-cooking": { id:"kumaya-tky-receipt",sceneIndex:10,sceneLabel:"くまや",actors:["unit-tky","unit-paisen","unit-kumaverson"],src:"/art/v100/story-r5/cuts/epilogue-tky-receipt.webp",description:"パイセンの伝票をTKYが返し、店主が皿洗いを言いつける。",camera:camera(1.02,1.05,43,44) },
  "kumaya-table": { id:"kumaya-main-table",sceneIndex:10,sceneLabel:"くまや",actors:["unit-paisen","unit-kumaverson","unit-babayaga","unit-mrs-chiha","unit-tky","unit-zakimiya","unit-mayo-chan"],src:"/art/v100/story-r5/cuts/epilogue-main-table.webp",description:"揚げたての唐揚げが届く。TKYとザキミヤにも笑いが戻り、くまやに仲間の食卓が揃う。",camera:camera(1.02,1.04,44,42) },
};
const hardCuts = new Set(["street-paisen-broom","street-paisen-flirt","ward-king-fan","station-cart-parade","floodgate-king-riceball","defense-bench","kumaya-omelet-chaos","kumaya-mayo-selfie"]);
export function v100EditedCreditsFilm(shots) {
  const available = new Map(shots.flatMap(shot => [shot, ...(newShots[shot.id] ? [newShots[shot.id]] : [])]).map(shot => [shot.id, shot]));
  return Object.freeze(selected.map(([id, sceneOffset]) => {
    const shot = available.get(id);
    if (!shot) throw new Error("Missing selected credits drawing: " + id);
    return Object.freeze({ ...shot, sceneOffset, camera: shot.camera ?? choices[id],
      transition: shot.transition ?? (hardCuts.has(id) ? "cut" : "dissolve"), actors: Object.freeze(shot.actors) });
  }));
}
export function v100CreditsCameraStyle(camera, progress, reducedMotion = false) {
  if (!camera) return { transform: "none", origin: "50% 50%", position: "50% 50%" };
  const time = Math.max(0, Math.min(1, Number(progress) || 0));
  const eased = time * time * (3 - 2 * time);
  const scale = reducedMotion ? camera.from : camera.from + (camera.to - camera.from) * eased;
  const interpolate = (from, to = from) => reducedMotion ? from : from + (to - from) * eased;
  return { transform: `scale(${scale})`, origin: `${interpolate(camera.x, camera.toX)}% ${interpolate(camera.y, camera.toY)}%`,
    position: `${interpolate(camera.positionX, camera.toPositionX)}% ${interpolate(camera.positionY, camera.toPositionY)}%` };
}
