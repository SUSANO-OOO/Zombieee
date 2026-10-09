import { manualAbilityDefinitionFor } from "./manualAbilities.js";

export const TATARA_GROUND_ART = Object.freeze({
  id: "v100-tatara-ground-strike",
  path: "/art/v100/characters/tatara-ground-strike-r1.webp",
  sourceRect: Object.freeze({ x: 0, y: 0, w: 640, h: 512 }),
  sourceCell: Object.freeze({ w: 640, h: 512 }),
  anchorX: 0.557152,
  anchorY: 496 / 512,
});

// Authored anchor and hammer-bottom calibration are pinned to the reviewed asset provenance.
export const TATARA_GROUND_HAMMER_SOCKET = Object.freeze({
  sourcePath: TATARA_GROUND_ART.path,
  sourcePixel: Object.freeze({ x: 81.89, y: 491.909 }),
});

export function v100TataraDisplaySize(originalIdleSize) {
  if (!Number.isFinite(originalIdleSize?.w) || !(originalIdleSize.w > 0)) return null;
  const scale = originalIdleSize.w / 480;
  return { w: 640 * scale, h: 512 * scale };
}

export function v100TataraGroundPose(runtime, { hp = 1 } = {}) {
  const definition = manualAbilityDefinitionFor("brute");
  if (!(hp > 0) || runtime?.kind !== "brute" || runtime.phase !== "recovery"
    || !Number.isFinite(runtime.windupRemaining) || !definition
    || !(definition.recoverySeconds - runtime.windupRemaining >= 0)
    || definition.recoverySeconds - runtime.windupRemaining >= .14) return null;
  return { ...TATARA_GROUND_ART, spriteState: "tatara-ground-strike", direction: runtime.target?.direction,
    offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1 };
}

export function v100RenderedTataraGroundSocket({ frame, size, pose, x, y, bob = 0, depthScale = 1, direction, sourcePixel = TATARA_GROUND_HAMMER_SOCKET.sourcePixel } = {}) {
  const pixel = sourcePixel;
  if (!pixel || frame?.path !== TATARA_GROUND_ART.path || !frame?.sourceRect
    || !Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)
    || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const facing = direction === "left" ? -1 : 1;
  const localX = (pixel.x / frame.sourceRect.w - frame.anchorX) * size.w * (frame.flipX ? -1 : 1) * (pose.scaleX ?? 1);
  const localY = (pixel.y / frame.sourceRect.h - frame.anchorY) * size.h * (pose.scaleY ?? 1);
  const angle = (pose.rotationRadians ?? 0) * facing;
  const c = Math.cos(angle); const s = Math.sin(angle);
  return {
    x: x + (pose.offsetX ?? 0) * depthScale * facing + localX * c - localY * s,
    y: y - bob + (pose.offsetY ?? 0) * depthScale + localX * s + localY * c,
    sourcePath: frame.path,
    sourcePixel: { ...pixel },
    kind: "brute-ground-hammer",
  };
}
