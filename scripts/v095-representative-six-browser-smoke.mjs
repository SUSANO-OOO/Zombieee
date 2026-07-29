import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, webkit } from "playwright";
import { MANUAL_ABILITY_REGISTRY } from "../app/manualAbilities.js";

const baseUrl = new URL(process.env.V095_REPRESENTATIVE_SIX_QA_BASE_URL ?? "http://127.0.0.1:4173/");
const timeout = Number(process.env.V095_REPRESENTATIVE_SIX_QA_TIMEOUT_MS ?? 45_000);
const proofScope = process.env.V095_REPRESENTATIVE_SIX_QA_SCOPE ?? "representative-six";
const evidenceDir = path.resolve(
  proofScope === "remaining-ten" ? "outputs/v095-remaining-ten" : "outputs/v095-representative-six",
);
const engines = (process.env.V095_REPRESENTATIVE_SIX_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = (process.env.V095_REPRESENTATIVE_SIX_QA_VIEWPORTS ?? "844x390,844x340")
  .split(",")
  .map((value) => {
    const [width, height] = value.split("x").map(Number);
    return { width, height };
  });
const browserTypes = { chromium, webkit };
const representativeKinds = proofScope === "remaining-ten"
  ? [
      "brawler",
      "ranger",
      "medic",
      "brute",
      "kumaverson",
      "babayaga",
      "guardian",
      "engineer",
      "zakimiya",
      "miyamoto-musashi",
    ]
  : [
      "scout",
      "gunner",
      "crazy-king",
      "tky",
      "mrs-chiha",
      "mayo-chan",
    ];
const expectedWeapons = {
  brawler: "unarmed",
  scout: "crowbar",
  ranger: "rifle",
  medic: "heal-support",
  brute: "blunt",
  gunner: "machine-gun",
  "crazy-king": "chainsaw",
  kumaverson: "blunt",
  babayaga: "sniper",
  guardian: "blunt",
  engineer: "suppressed-carbine",
  zakimiya: "blunt",
  tky: "plasma-blade",
  "mrs-chiha": "grenade",
  "miyamoto-musashi": "dual-katana",
  "mayo-chan": "bite",
};
const qualityModes = ["auto", "high", "power-save"];
const specialCaptureDelay = {
  brawler: 70,
  scout: 110,
  ranger: 150,
  medic: 100,
  brute: 180,
  gunner: 280,
  "crazy-king": 260,
  kumaverson: 100,
  babayaga: 130,
  guardian: 140,
  engineer: 100,
  zakimiya: 180,
  tky: 340,
  "mrs-chiha": 1_020,
  "miyamoto-musashi": 80,
  "mayo-chan": 170,
};

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "3",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function captureCanvas(page, caseName, label, ownerId, extra = {}) {
  await nextPaint(page);
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const owner = snapshot.fighters.find(({ id }) => id === ownerId);
  invariant(owner, `${label}: representative fighter disappeared`);
  invariant(snapshot.geometry.offFloorCount === 0, `${label}: logical off-floor fighter`);
  invariant(snapshot.geometry.visuallyOffFloorCount === 0, `${label}: visual off-floor fighter`);
  invariant(owner.animationPresentation.groundAnchor === 1, `${label}: ground anchor changed`);
  invariant(owner.animationPresentation.pose.offsetY === 0, `${label}: procedural pose lifted the fighter`);
  const screenshotPath = path.join(evidenceDir, `${caseName}-${label}.png`);
  const buffer = await page.locator("canvas.battlefield").screenshot({ path: screenshotPath });
  return {
    label,
    ownerId,
    kind: owner.kind,
    x: owner.x,
    y: owner.y,
    animationState: owner.animationPresentation.state,
    animationDirection: owner.animationPresentation.direction,
    animationSpriteState: owner.animationPresentation.sampledSpriteState,
    animationPose: owner.animationPresentation.pose,
    attackSequence: owner.attackSequence,
    manualPhase: owner.manualAbility?.phase ?? null,
    manualReceipts: snapshot.manualAbilityReceipts
      .filter(({ ownerId: receiptOwnerId }) => receiptOwnerId === ownerId)
      .map(({ eventType, salvoIndex, mode }) => ({
        eventType,
        salvoIndex: salvoIndex ?? null,
        mode: mode ?? null,
      })),
    manualVfx: snapshot.manualAbilityVfx
      .filter(({ ownerId: effectOwnerId }) => effectOwnerId === ownerId)
      .map(({ kind, originX, originY, targetX, targetY, elapsed, duration }) => ({
        kind, originX, originY, targetX, targetY, elapsed, duration,
      })),
    shots: snapshot.attackIdentity
      .filter(({ sourceId }) => sourceId === ownerId)
      .map(({ weapon, targetId, shotIndex, recoil, casing, hitStopSeconds }) => ({
        weapon, targetId, shotIndex, recoil, casing, hitStopSeconds,
      })),
    quality: documentQuality(snapshot),
    canvasSha256: createHash("sha256").update(buffer).digest("hex"),
    screenshot: path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/"),
    ...extra,
  };
}

function documentQuality(snapshot) {
  return {
    requested: snapshot.settings.graphicsQuality,
  };
}

async function prepareRepresentative(page, kind) {
  const prepared = await page.evaluate(
    (requestedKind) => window.__ASHFALL_BATTLE_QA__.prepareRepresentativeSixProof(requestedKind),
    kind,
  );
  invariant(prepared?.kind === kind, `${kind}: representative fixture failed`);
  invariant(prepared.weaponProfile === expectedWeapons[kind],
    `${kind}: weapon profile mismatch ${JSON.stringify(prepared)}`);
  invariant(Math.abs(prepared.anchor.x - prepared.owner.x) >= 12,
    `${kind}: weapon anchor stayed at sprite center`);
  invariant(prepared.anchor.y < prepared.owner.y - 15,
    `${kind}: weapon anchor stayed at the waist or feet`);
  await page.waitForFunction(
    ({ ownerId, requestedKind }) => {
      const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ id }) => id === ownerId);
      return owner?.kind === requestedKind
        && document.querySelector(`.manual-ability-ready[data-fighter-id='${ownerId}']`);
    },
    { ownerId: prepared.ownerId, requestedKind: kind },
    { timeout },
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
  return prepared;
}

async function stepMotion(page, ownerId, action, seconds) {
  const result = await page.evaluate(
    ({ id, requestedAction, elapsed }) => (
      window.__ASHFALL_BATTLE_QA__.stepAnimationFoundationProof(id, requestedAction, elapsed)
    ),
    { id: ownerId, requestedAction: action, elapsed: seconds },
  );
  invariant(result, `${action}: representative motion step failed`);
  return result;
}

async function pauseAtRuntimeAttackPhase(page, ownerId, requestedPhase, {
  initialAttackSequence,
  expectedAudioCueIds = [],
} = {}) {
  await page.evaluate(
    ({ id, phase, initialSequence, cueIds, timeoutMs }) => new Promise((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const poll = () => {
        const proof = window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixRuntimeAttackProof(id);
        const requestedCueIds = proof?.audioCueRequests?.map(({ cueId }) => cueId) ?? [];
        const sequenceReady = initialSequence === undefined
          || (phase === "wind-up"
            ? proof?.attackSequence === initialSequence
            : proof?.attackSequence > initialSequence);
        const audioReady = cueIds.length === 0
          || cueIds.some((cueId) => requestedCueIds.includes(cueId));
        if (proof?.phase === phase && sequenceReady && audioReady) {
          window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
          resolve(true);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error(
            `${proof?.ownerId ?? id}: timed out waiting for runtime attack ${phase}; `
            + `last=${proof?.phase ?? "missing"} sequence=${proof?.attackSequence ?? "missing"}`,
          ));
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }),
    {
      id: ownerId,
      phase: requestedPhase,
      initialSequence: initialAttackSequence,
      cueIds: expectedAudioCueIds,
      timeoutMs: timeout,
    },
  );
}

async function exerciseRuntimeAttack(page, caseName, quality, kind, prepared) {
  const armed = await page.evaluate(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.armRepresentativeSixRuntimeAttackProof(ownerId),
    prepared.ownerId,
  );
  invariant(armed?.weaponProfile === expectedWeapons[kind],
    `${quality}/${kind}: runtime attack fixture weapon mismatch`);
  invariant(armed.expectedAudioCueIds.length > 0,
    `${quality}/${kind}: runtime attack has no expected production audio cue`);
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await pauseAtRuntimeAttackPhase(page, prepared.ownerId, "wind-up", {
    initialAttackSequence: armed.initialAttackSequence,
  });

  const frames = [];
  if (quality === "auto") {
    const windup = await page.evaluate(
      (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixRuntimeAttackProof(ownerId),
      prepared.ownerId,
    );
    invariant(windup?.sample?.state === "wind-up", `${kind}: production wind-up pose missing`);
    frames.push(await captureCanvas(
      page,
      caseName,
      `${quality}-${kind}-04-attack-wind-up`,
      prepared.ownerId,
      { attackSample: windup.sample, runtimeAttackProof: windup },
    ));
  }
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));

  await pauseAtRuntimeAttackPhase(page, prepared.ownerId, "active", {
    initialAttackSequence: armed.initialAttackSequence,
    expectedAudioCueIds: armed.expectedAudioCueIds,
  });
  const active = await page.evaluate(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixRuntimeAttackProof(ownerId),
    prepared.ownerId,
  );
  invariant(active?.sample?.state === "active", `${quality}/${kind}: runtime active pose missing`);
  invariant(active.weaponProfile === expectedWeapons[kind], `${quality}/${kind}: active weapon mismatch`);
  invariant(Math.abs(active.anchor.x - prepared.owner.x) >= 12,
    `${quality}/${kind}: runtime active anchor at center`);
  invariant(active.targetHp < armed.initialTargetHp
      || active.pendingHits.some(({ applyDamage }) => applyDamage),
  `${quality}/${kind}: production attack produced neither damage nor a pending damage event`);
  const requestedCueIds = active.audioCueRequests.map(({ cueId }) => cueId);
  invariant(armed.expectedAudioCueIds.some((cueId) => requestedCueIds.includes(cueId)),
    `${quality}/${kind}: production weapon SE was not requested`);
  frames.push(await captureCanvas(
    page,
    caseName,
    `${quality}-${kind}-${quality === "auto" ? "05" : "04"}-attack-active`,
    prepared.ownerId,
    { attackSample: active.sample, runtimeAttackProof: active },
  ));

  if (quality === "auto") {
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    await pauseAtRuntimeAttackPhase(page, prepared.ownerId, "recovery", {
      initialAttackSequence: armed.initialAttackSequence,
    });
    const recovery = await page.evaluate(
      (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixRuntimeAttackProof(ownerId),
      prepared.ownerId,
    );
    invariant(recovery?.sample?.state === "recovery", `${kind}: runtime recovery pose missing`);
    frames.push(await captureCanvas(
      page,
      caseName,
      `${quality}-${kind}-06-attack-recovery`,
      prepared.ownerId,
      { attackSample: recovery.sample, runtimeAttackProof: recovery },
    ));
  }

  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction(
    ({ ownerId, initialAttackSequence, initialTargetHp }) => {
      const proof = window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixRuntimeAttackProof(ownerId);
      return proof?.attackSequence > initialAttackSequence
        && proof.targetHp < initialTargetHp
        && proof.phase === "idle";
    },
    {
      ownerId: prepared.ownerId,
      initialAttackSequence: armed.initialAttackSequence,
      initialTargetHp: armed.initialTargetHp,
    },
    { timeout },
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
  return { armed, frames };
}

async function exerciseStaticVisuals(page, caseName) {
  const qualityProofs = [];
  for (const quality of qualityModes) {
    await page.evaluate(
      (requestedQuality) => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality(requestedQuality),
      quality,
    );
    await page.waitForFunction(
      (requestedQuality) => document.documentElement.dataset.graphicsQualityRequested === requestedQuality,
      quality,
      { timeout },
    );
    const units = [];
    for (const kind of representativeKinds) {
      const prepared = await prepareRepresentative(page, kind);
      const frames = [];
      if (quality === "auto") {
        frames.push(await captureCanvas(page, caseName, `${quality}-${kind}-01-idle`, prepared.ownerId));
        await stepMotion(page, prepared.ownerId, "move-right", .05);
        await stepMotion(page, prepared.ownerId, "move-right", .13);
        frames.push(await captureCanvas(page, caseName, `${quality}-${kind}-02-move-right`, prepared.ownerId));
        await stepMotion(page, prepared.ownerId, "move-left", .02);
        await stepMotion(page, prepared.ownerId, "move-left", .07);
        frames.push(await captureCanvas(page, caseName, `${quality}-${kind}-03-turn-left`, prepared.ownerId));
      }
      const runtimeAttack = await exerciseRuntimeAttack(page, caseName, quality, kind, prepared);
      frames.push(...runtimeAttack.frames);
      if (quality === "auto") {
        invariant(new Set(frames.map(({ canvasSha256 }) => canvasSha256)).size >= 5,
          `${kind}: player-facing phases collapsed to the same Canvas image`);
        invariant(frames[1].animationDirection === "right", `${kind}: move-right facing failed`);
        invariant(frames[2].animationDirection === "left", `${kind}: turn-left facing failed`);
      }
      units.push({
        kind,
        weaponProfile: prepared.weaponProfile,
        anchor: prepared.anchor,
        runtimeAttack: runtimeAttack.armed,
        frames,
      });
    }
    qualityProofs.push({
      quality,
      dataset: await page.evaluate(() => ({
        requested: document.documentElement.dataset.graphicsQualityRequested,
        resolved: document.documentElement.dataset.graphicsQualityResolved,
        renderHz: Number(document.documentElement.dataset.graphicsRenderHz),
        dprCap: Number(document.documentElement.dataset.graphicsDprCap),
      })),
      units,
    });
    const dataset = qualityProofs.at(-1).dataset;
    invariant(dataset.requested === quality, `${quality}: requested graphics dataset mismatch`);
    invariant(dataset.resolved, `${quality}: resolved graphics dataset missing`);
    invariant(Number.isFinite(dataset.renderHz) && dataset.renderHz > 0,
      `${quality}: render Hz dataset missing`);
    invariant(Number.isFinite(dataset.dprCap) && dataset.dprCap > 0,
      `${quality}: DPR cap dataset missing`);
  }
  return qualityProofs;
}

async function waitForSpecialSettlement(page, kind, ownerId) {
  await page.waitForFunction(
    ({ requestedKind, id }) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
      if (!owner) return false;
      const receipts = snapshot.manualAbilityReceipts.filter(({ ownerId }) => ownerId === id);
      if (requestedKind === "mayo-chan") {
        return owner.manualAbility?.phase === "feral"
          && receipts.some(({ eventType }) => eventType === "feral-start");
      }
      if (
        requestedKind === "crazy-king"
        || requestedKind === "kumaverson"
        || requestedKind === "guardian"
      ) {
        return owner.manualAbility?.phase === "cooldown"
          && receipts.some(({ eventType }) => eventType === "active-start")
          && receipts.some(({ eventType }) => eventType === "active-end");
      }
      if (requestedKind === "mrs-chiha") {
        return owner.manualAbility?.phase === "cooldown"
          && receipts.filter(({ eventType }) => eventType === "impact").length === 4;
      }
      if (requestedKind === "gunner") {
        return owner.manualAbility?.phase === "cooldown"
          && receipts.filter(({ eventType }) => eventType === "impact").length === 5;
      }
      return owner.manualAbility?.phase === "cooldown"
        && receipts.some(({ eventType }) => eventType === "impact");
    },
    { requestedKind: kind, id: ownerId },
    { timeout },
  );
}

async function pauseAtManualPhase(page, ownerId, requestedPhase) {
  await page.evaluate(
    ({ id, phase, timeoutMs }) => new Promise((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const poll = () => {
        const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot()
          .fighters.find(({ id: candidateId }) => candidateId === id);
        if (owner?.manualAbility?.phase === phase) {
          window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
          resolve(true);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error(`${owner?.kind ?? id}: timed out waiting for manual phase ${phase}`));
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }),
    { id: ownerId, phase: requestedPhase, timeoutMs: timeout },
  );
}

async function activateSpecial(page, caseName, kind, speed) {
  let prepared;
  if (speed === 1) {
    prepared = await prepareRepresentative(page, kind);
  } else {
    prepared = await page.evaluate(
      (requestedKind) => window.__ASHFALL_BATTLE_QA__.prepareManualAbilitySurvivalProof(requestedKind),
      kind,
    );
    invariant(prepared?.ownerIds?.length === 1, `${kind}/2x: Survival fixture failed`);
    prepared = { ...prepared, ownerId: prepared.ownerIds[0] };
    await page.waitForFunction(
      (ownerId) => document.querySelector(`.manual-ability-ready[data-fighter-id='${ownerId}']`),
      prepared.ownerId,
      { timeout },
    );
    const speed2 = page.getByRole("button", { name: "2倍", exact: true });
    await speed2.waitFor({ state: "visible", timeout });
    await speed2.click();
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun?.speed === 2,
      null,
      { timeout },
    );
  }
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  const phasePauseArmed = await page.evaluate(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.armRepresentativeSixPhasePause(ownerId, "recovery"),
    prepared.ownerId,
  );
  invariant(phasePauseArmed, `${kind}/${speed}x: recovery phase pause could not be armed`);
  await page.locator(`.manual-ability-ready[data-fighter-id='${prepared.ownerId}']`).click();
  await page.waitForFunction(
    (ownerId) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      const owner = snapshot.fighters.find(({ id }) => id === ownerId);
      return owner?.manualAbility?.phase !== "ready"
        && snapshot.manualAbilityVfx.some(({ ownerId: effectOwnerId }) => effectOwnerId === ownerId);
    },
    prepared.ownerId,
    { timeout },
  );
  await page.waitForTimeout(Math.max(70, Math.round(specialCaptureDelay[kind] / speed)));
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
  const specialSample = await page.evaluate(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixSpecialProof(ownerId),
    prepared.ownerId,
  );
  invariant(specialSample?.sample?.state === "special",
    `${kind}/${speed}x: rendered special animation sample missing`);
  invariant(specialSample.sample.groundAnchor === 1,
    `${kind}/${speed}x: special animation ground anchor changed`);
  invariant(specialSample.sample.pose.offsetY === 0,
    `${kind}/${speed}x: special animation lifted the fighter`);
  const frame = await captureCanvas(
    page,
    caseName,
    `auto-${kind}-special-${speed}x`,
    prepared.ownerId,
    { speed, specialSample },
  );
  invariant(frame.manualVfx.some(({ kind: effectKind }) => effectKind === kind),
    `${kind}/${speed}x: dedicated manual VFX missing`);
  if (specialSample.phase !== "recovery") {
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    await pauseAtManualPhase(page, prepared.ownerId, "recovery");
  }
  const recoverySample = specialSample.phase === "recovery"
    ? specialSample
    : await page.evaluate(
      (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixSpecialProof(ownerId),
      prepared.ownerId,
    );
  invariant(recoverySample?.phase === "recovery",
    `${kind}/${speed}x: special recovery phase missing`);
  invariant(recoverySample?.sample?.state === "special",
    `${kind}/${speed}x: rendered special recovery sample missing`);
  const recoveryReceipts = await page.evaluate((ownerId) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts
      .filter(({ ownerId: receiptOwnerId }) => receiptOwnerId === ownerId)
      .map(({ eventType, salvoIndex, mode }) => ({
        eventType,
        salvoIndex: salvoIndex ?? null,
        mode: mode ?? null,
      }))
  ), prepared.ownerId);
  if (["crazy-king", "kumaverson", "guardian"].includes(kind)) {
    const receiptTypes = recoveryReceipts.map(({ eventType }) => eventType);
    invariant(
      receiptTypes.indexOf("active-start") >= 0
        && receiptTypes.indexOf("active-end") > receiptTypes.indexOf("active-start"),
      `${kind}/${speed}x: recovery did not follow active-end`,
    );
  }
  if (kind === "brawler") {
    const recoveryEventTypes = recoverySample.sample.events.map(({ type }) => type);
    invariant(
      recoverySample.sample.frameIndex >= 6
        && recoveryEventTypes.some((type) => (
          type === "fist-combo-recover" || type === "fist-combo-ready"
        )),
      `${kind}/${speed}x: runtime recovery did not reach the authored body recovery frame`,
    );
    invariant(
      recoveryReceipts.filter(({ eventType }) => eventType === "impact").length === 1,
      `${kind}/${speed}x: combo damage was not resolved exactly once before body recovery`,
    );
  }
  const recoveryFrame = await captureCanvas(
    page,
    caseName,
    `auto-${kind}-special-recovery-${speed}x`,
    prepared.ownerId,
    { speed, specialSample: recoverySample },
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await waitForSpecialSettlement(page, kind, prepared.ownerId);
  const settled = await page.evaluate((ownerId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === ownerId);
    return {
      phase: owner?.manualAbility?.phase ?? null,
      speed: snapshot.survivalRun?.speed ?? 1,
      receipts: snapshot.manualAbilityReceipts
        .filter(({ ownerId: receiptOwnerId }) => receiptOwnerId === ownerId)
        .map(({ eventType, salvoIndex }) => ({ eventType, salvoIndex: salvoIndex ?? null })),
    };
  }, prepared.ownerId);
  invariant(settled.speed === speed, `${kind}: requested ${speed}x but observed ${settled.speed}x`);
  invariant(settled.receipts.filter(({ eventType }) => eventType === "start").length === 1,
    `${kind}/${speed}x: activation receipt was not singular`);
  if (kind === "gunner") {
    invariant(
      JSON.stringify(settled.receipts
        .filter(({ eventType }) => eventType === "muzzle")
        .map(({ salvoIndex }) => salvoIndex)) === JSON.stringify([0, 1, 2, 3, 4]),
      `${kind}/${speed}x: muzzle receipts were not a five-round ordered burst`,
    );
    invariant(
      JSON.stringify(settled.receipts
        .filter(({ eventType }) => eventType === "impact")
        .map(({ salvoIndex }) => salvoIndex)) === JSON.stringify([0, 1, 2, 3, 4]),
      `${kind}/${speed}x: impact receipts were not a five-round ordered burst`,
    );
  }
  return { kind, speed, frame, recoveryFrame, settled };
}

async function exerciseMusashiCounter(page, caseName) {
  const prepared = await prepareRepresentative(page, "miyamoto-musashi");
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.locator(`.manual-ability-ready[data-fighter-id='${prepared.ownerId}']`).click();
  await page.waitForFunction(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.getSnapshot()
      .fighters.find(({ id }) => id === ownerId)?.manualAbility?.phase === "guard",
    prepared.ownerId,
    { timeout },
  );
  const counter = await page.evaluate((ownerId) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const before = bridge.getSnapshot();
    const owner = before.fighters.find(({ id }) => id === ownerId);
    const targetId = owner.manualAbility.target.targetId;
    const targetBefore = before.fighters.find(({ id }) => id === targetId);
    const result = bridge.applyHumanDamage(ownerId, 35);
    const after = bridge.getSnapshot();
    const ownerAfter = after.fighters.find(({ id }) => id === ownerId);
    const targetAfter = after.fighters.find(({ id }) => id === targetId);
    return {
      result,
      ownerHpBefore: owner.hp,
      ownerHpAfter: ownerAfter.hp,
      targetId,
      targetHpBefore: targetBefore.hp,
      targetHpAfter: targetAfter.hp,
      phase: ownerAfter.manualAbility.phase,
      impactReceipts: after.manualAbilityReceipts.filter((receipt) => (
        receipt.ownerId === ownerId
        && receipt.eventType === "impact"
        && receipt.mode === "counter"
      )).length,
    };
  }, prepared.ownerId);
  invariant(
    counter.result?.preventedDamage === 35
      && counter.ownerHpAfter === counter.ownerHpBefore
      && counter.targetHpAfter < counter.targetHpBefore
      && counter.phase === "recovery"
      && counter.impactReceipts === 1,
    `miyamoto-musashi: melee counter did not prevent damage and resolve exactly once`,
  );
  const definition = MANUAL_ABILITY_REGISTRY["miyamoto-musashi"];
  const releaseStart = definition.windupSeconds + .36;
  await page.evaluate(
    ({ ownerId, releaseAt, timeoutMs }) => new Promise((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const poll = () => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        const owner = snapshot.fighters.find(({ id }) => id === ownerId);
        const effect = snapshot.manualAbilityVfx.find(({ ownerId: effectOwnerId }) => effectOwnerId === ownerId);
        if (owner?.manualAbility?.phase === "recovery" && effect?.elapsed > releaseAt + .015) {
          window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
          resolve(true);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("miyamoto-musashi: counter cross-cut VFX never reached release"));
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }),
    { ownerId: prepared.ownerId, releaseAt: releaseStart, timeoutMs: timeout },
  );
  const sample = await page.evaluate(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.sampleRepresentativeSixSpecialProof(ownerId),
    prepared.ownerId,
  );
  invariant(sample?.phase === "recovery" && sample.sample?.state === "special",
    "miyamoto-musashi: counter body recovery sample missing");
  const frame = await captureCanvas(
    page,
    caseName,
    "auto-miyamoto-musashi-counter-recovery",
    prepared.ownerId,
    { counter, specialSample: sample },
  );
  const counterVfx = frame.manualVfx.find(({ kind }) => kind === "miyamoto-musashi");
  invariant(
    counterVfx?.elapsed > releaseStart
      && counterVfx.duration >= releaseStart + definition.recoverySeconds,
    "miyamoto-musashi: counter cross-cut VFX timeline is unreachable",
  );
  invariant(
    frame.manualReceipts.filter(({ eventType, mode }) => (
      eventType === "impact" && mode === "counter"
    )).length === 1,
    "miyamoto-musashi: counter receipt was not singular",
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction(
    (ownerId) => window.__ASHFALL_BATTLE_QA__.getSnapshot()
      .fighters.find(({ id }) => id === ownerId)?.manualAbility?.phase === "cooldown",
    prepared.ownerId,
    { timeout },
  );
  return { ...counter, frame };
}

const results = [];
for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unknown browser engine: ${engine}`);
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }
  try {
    for (const viewport of viewports) {
      const caseName = `${engine}-${viewport.width}x${viewport.height}-dpr3`;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3 });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = {
        engine,
        viewport,
        deviceScaleFactor: 3,
        url: caseUrl(),
        status: "failed",
      };
      try {
        const response = await page.goto(result.url, { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `${caseName}: navigation failed ${response?.status()}`);
        await page.waitForFunction(
          () => typeof window.__ASHFALL_BATTLE_QA__?.prepareRepresentativeSixProof === "function"
            && window.__ASHFALL_BATTLE_QA__.getSnapshot()?.screen === "battle",
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
          null,
          { timeout },
        );
        const qualityProofs = await exerciseStaticVisuals(page, caseName);
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality("auto"));
        await page.waitForFunction(
          () => document.documentElement.dataset.graphicsQualityRequested === "auto",
          null,
          { timeout },
        );
        const musashiCounterProof = proofScope === "remaining-ten"
          ? await exerciseMusashiCounter(page, caseName)
          : null;
        const speedProofs = [];
        for (const kind of representativeKinds) {
          speedProofs.push(await activateSpecial(page, caseName, kind, 1));
        }
        if (viewport.height === 390) {
          for (const kind of representativeKinds) {
            speedProofs.push(await activateSpecial(page, caseName, kind, 2));
          }
        }
        for (const [diagnosticKind, entries] of Object.entries(diagnostics)) {
          invariant(entries.length === 0, `${caseName}/${diagnosticKind}: ${JSON.stringify(entries)}`);
        }
        Object.assign(result, {
          status: "passed",
          representativeKinds,
          qualityProofs,
          speedProofs,
          musashiCounterProof,
          diagnostics,
          residentSprites: await page.evaluate(
            () => Number(document.documentElement.dataset.assetResidentSprites),
          ),
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
        try {
          result.failureSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
          );
        } catch {
          // The local QA bridge may not have loaded.
        }
        try {
          await page.screenshot({ path: path.join(evidenceDir, `${caseName}-FAILED.png`) });
        } catch {
          // Preserve the original failure.
        }
      } finally {
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  proofScope,
  results,
  totals: {
    cases: results.length,
    passed: results.filter(({ status }) => status === "passed").length,
    failed: results.filter(({ status }) => status !== "passed").length,
  },
};
await writeFile(
  path.join(evidenceDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

if (summary.totals.failed > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(summary, null, 2));
}
