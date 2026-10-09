import assert from "node:assert/strict";

export async function installCreditTransitionAudit(page, { rootSelector = ".v100-staff-roll", proofKey = "__creditTransitionProof" } = {}) {
  await page.addInitScript(({ rootSelector, proofKey }) => {
    const proof = window[proofKey] = { started: false, frames: 0, elementIds: [], shots: [], cuts: [], violations: [] };
    const ids = new WeakMap();
    let nextId = 1, previous = null;
    const idFor = element => { if (!ids.has(element)) ids.set(element, nextId++); return ids.get(element); };
    const violation = (kind, row) => { if (proof.violations.length < 100) proof.violations.push({ kind, ...row }); };
    const tick = () => {
      const root = document.querySelector(rootSelector), movie = root?.querySelector(".v100-credit-landscape");
      const current = movie?.querySelector(".v100-credit-shot:not(.v100-credit-shot-next)"), incoming = movie?.querySelector(".v100-credit-shot-next");
      if (current && incoming) {
        const images = [...movie.querySelectorAll(".v100-credit-shot")];
        const loaded = current instanceof HTMLImageElement ? current.complete && current.naturalWidth > 0 && current.dataset.creditDecoded === "true" : true;
        const row = { time: root.querySelector("audio")?.currentTime ?? 0, shot: Number(movie.dataset.creditRenderedShotIndex ?? current.dataset.creditShotIndex),
          currentId: idFor(current), nextId: idFor(incoming), currentOpacity: Number(getComputedStyle(current).opacity), nextOpacity: Number(getComputedStyle(incoming).opacity), loaded,
          src: current instanceof HTMLImageElement ? current.currentSrc : getComputedStyle(current).backgroundImage };
        if (!proof.started && loaded && row.currentOpacity >= .99) proof.started = true;
        if (proof.started) {
          proof.frames += 1;
          for (const element of images) if (!proof.elementIds.includes(idFor(element))) proof.elementIds.push(idFor(element));
          if (!proof.shots.includes(row.shot)) proof.shots.push(row.shot);
          if (images.length !== 2) violation("image-layer-count", row);
          if (!loaded || row.currentOpacity < .99) violation("displayed-image-not-ready", row);
          if (previous && row.shot === previous.shot && previous.nextOpacity > .85 && row.nextOpacity < .05) violation("dissolve-returned-to-outgoing-image", row);
          if (previous && row.shot !== previous.shot) {
            const cut = { before: previous, after: row, promotedIncoming: row.currentId === previous.nextId };
            proof.cuts.push(cut);
            if (!cut.promotedIncoming) violation("decoded-incoming-element-replaced", row);
          }
          previous = row;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { rootSelector, proofKey });
}

export function assertCreditTransitionProof(proof, { cuts, shots }) {
  assert.ok(Number.isInteger(shots) && shots > 0 && cuts === shots - 1, "Expected film coverage must be explicit");
  assert.equal(proof.started, true, "No displayed film image was observed");
  assert.ok(proof.frames > 0);
  assert.deepEqual(proof.violations, [], "A dissolve reverted, replaced its incoming image, or displayed an unready image");
  assert.equal(proof.elementIds.length, 2, "Film must retain exactly two image elements throughout playback");
  assert.equal(proof.shots.length, shots, "Not all film shots were observed");
  assert.equal(proof.cuts.length, cuts, "Not all film cuts were observed");
  assert.ok(proof.cuts.every(cut => cut.promotedIncoming));
  return proof;
}
