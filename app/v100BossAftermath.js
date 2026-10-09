// Approved body atlases show the limbs and weapons. Their weight disturbs
// ground dust; an ability activation must not invent a limb or a contact hit.
const PROFILES = Object.freeze({
  ooguchi: { spread: 54, size: 52 },
  gairen: { spread: 42, size: 48 },
  futago: { spread: 46, size: 40 },
  "mugarian-president-mutated": { spread: 60, size: 60 },
  "takuya-omega": { spread: 72, size: 68 },
});

export function drawV100BossAftermath(ctx, objects, { kind, x, y, elapsed, duration, phase, direction = -1 } = {}) {
  const profile = PROFILES[kind];
  if (!profile || ![x, y, elapsed, duration, direction].every(Number.isFinite)
    || duration <= 0 || elapsed < 0 || elapsed >= duration || !["active", "recovery"].includes(phase)) return false;
  const dust = objects?.["v100-dust"];
  if (!dust?.complete || !dust.naturalWidth || !dust.naturalHeight) throw new Error("Boss ground dust must decode before battle");
  const progress = elapsed / duration;
  const rise = phase === "active" ? Math.min(1, elapsed / .12) : 1;
  const fade = phase === "active" ? 1 - progress * .6 : (1 - progress) ** 2 * .4;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  for (let index = 0; index < 3; index += 1) {
    const spread = (index - 1) * profile.spread * (.32 + progress * .6);
    const width = profile.size * (.7 + progress * .6);
    const height = width * (.29 + index * .025);
    ctx.globalAlpha = rise * fade * (.22 - index * .03);
    ctx.drawImage(dust, x + spread + direction * progress * 16 - width / 2, y - height * .6 - progress * 5, width, height);
  }
  ctx.restore();
  return true;
}
