function finitePoint(point) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

// Renderers provide the socket resolved from the actual authored body draw.
// This module deliberately has no fallback coordinates.
export function resolveV100AbilityOrigin(socket) {
  return finitePoint(socket) ? { x: socket.x, y: socket.y } : null;
}

export function finiteV100AbilityPoint(point) {
  return finitePoint(point);
}

export function v100AbilityOriginSourcePixel(kind, state, direction) {
  const point = ORIGIN_PIXELS[kind]?.states?.[state]?.[direction === "left" ? "left" : "right"];
  return point ? { x: point[0], y: point[1] } : null;
}

const ORIGIN_PIXELS = Object.freeze({
  tky: { path: "/art/v090/characters/tky-battle-r1.png", states: { "attack-a": { right: [311, 125], left: [169, 125] }, "attack-b": { right: [305, 121], left: [175, 121] } } },
  "mrs-chiha": { path: "/art/v090/characters/mrs-chiha-battle-r1.png", states: { "attack-a": { right: [324, 192], left: [156, 192] }, "attack-b": { right: [332, 70], left: [148, 70] } } },
  zakimiya: { path: "/art/v090/characters/zakimiya-battle-r1.png", states: { "attack-a": { right: [177, 56], left: [303, 56] }, "attack-b": { right: [319, 99], left: [161, 99] } } },
});

export function v100RenderedAbilityOriginSocket({ kind, frame, state, direction, size, pose, x, y, bob = 0, depthScale = 1 } = {}) {
  const definition = ORIGIN_PIXELS[kind];
  const allowed = kind === "tky" ? ["attack-a"] : kind === "mrs-chiha" ? ["attack-b"] : kind === "zakimiya" ? ["attack-b"] : [];
  if (!definition || !allowed.includes(state) || !definition.states?.[state] || frame?.path !== definition.path || !frame?.sourceRect || !finitePoint({ x, y })) return null;
  const stateDefinition = definition.states[state]; const point = direction === "left" ? stateDefinition.left : stateDefinition.right; const facing = direction === "left" ? -1 : 1;
  const localX = (point[0] / frame.sourceRect.w - frame.anchorX) * size.w * (frame.flipX ? -1 : 1) * pose.scaleX;
  const localY = (point[1] / frame.sourceRect.h - frame.anchorY) * size.h * pose.scaleY;
  const angle = pose.rotationRadians * facing; const c = Math.cos(angle); const s = Math.sin(angle);
  return { x: x + pose.offsetX * depthScale * facing + localX * c - localY * s, y: y - bob + pose.offsetY * depthScale + localX * s + localY * c };
}
