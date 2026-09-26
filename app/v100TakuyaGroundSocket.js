// Source-bound socket measured from the approved attack-b cell.
// Cell-local point is the lowest opaque blade pixel before the authored
// ground-impact effect is composited: x=188, y=617.
export const TAKUYA_GROUND_BLADE_SOCKET = Object.freeze({
  sourceId: "takuya-battle-vest-v2",
  path: "/art/v100/bosses/takuya-battle-vest-v2.png",
  state: "attack-b",
  pixel: Object.freeze({ x: 188, y: 617 }),
  sourceHash: "52eb95dd58882b7165b98671aa2dfff106c69dbae9e1de35217c3d8927ee290d",
});

export function v100RenderedTakuyaGroundSocket({ frame, size, pose, x, y, bob = 0, depthScale = 1, direction }) {
  if (!frame || frame.path !== TAKUYA_GROUND_BLADE_SOCKET.path || frame.sourceRect?.w !== 512 || frame.sourceRect?.h !== 757) return null;
  const point = TAKUYA_GROUND_BLADE_SOCKET.pixel;
  const facing = direction === "left" ? -1 : 1;
  const localX = (point.x / frame.sourceRect.w - frame.anchorX) * size.w * (frame.flipX ? -1 : 1) * pose.scaleX;
  const localY = (point.y / frame.sourceRect.h - frame.anchorY) * size.h * pose.scaleY;
  const angle = pose.rotationRadians * facing;
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: x + pose.offsetX * depthScale * facing + localX * c - localY * s,
    y: y - bob + pose.offsetY * depthScale + localX * s + localY * c,
    sourceId: TAKUYA_GROUND_BLADE_SOCKET.sourceId,
    kind: "takuya-ground-blade",
    pixel: { ...point },
  };
}
