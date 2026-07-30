import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.MANUAL_ABILITIES_QA_BASE_URL) {
  throw new Error("MANUAL_ABILITIES_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.MANUAL_ABILITIES_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Manual ability QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.MANUAL_ABILITIES_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = (process.env.MANUAL_ABILITIES_QA_VIEWPORTS
  ?? "1280x720,844x390,844x340")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const [width, height] = value.split("x").map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error(`Invalid MANUAL_ABILITIES_QA_VIEWPORTS entry: ${value}`);
    }
    return { width, height };
  });
const qaScope = process.env.MANUAL_ABILITIES_QA_SCOPE ?? "full";
if (!["full", "p0-3-gaps"].includes(qaScope)) {
  throw new Error(`Unknown MANUAL_ABILITIES_QA_SCOPE value: ${qaScope}`);
}
if (qaScope === "p0-3-gaps"
  && !viewports.some(({ width, height }) => width === 844 && height === 390)) {
  throw new Error("MANUAL_ABILITIES_QA_SCOPE=p0-3-gaps requires the 844x390 viewport");
}
const canonicalRuntimeViewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 340 },
  { width: 844, height: 390 },
];
const timeout = Math.max(10_000, Number(process.env.MANUAL_ABILITIES_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.MANUAL_ABILITIES_QA_EVIDENCE_DIR ?? "outputs/manual-abilities-browser-smoke",
);
const kinds = [
  "brawler",
  "scout",
  "ranger",
  "medic",
  "brute",
  "crazy-king",
  "kumaverson",
  "babayaga",
  "gunner",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
];
const iconFiles = {
  brawler: "paisen-kiai-combo-ready-r1.svg",
  scout: "hachi-intercept-dash-ready-r1.svg",
  ranger: "mizuchi-precision-ready-r1.svg",
  medic: "nao-emergency-treatment-ready-r1.svg",
  brute: "tatara-ground-break-ready-r1.svg",
  "crazy-king": "crazy-king-overdrive-ready-r1.svg",
  kumaverson: "kumaverson-pan-stand-ready-r1.svg",
  babayaga: "babayaga-weakness-audit-ready-r1.svg",
  gunner: "raider-suppression-ready-r1.svg",
  guardian: "gantetsu-shield-deploy-ready-r1.svg",
  engineer: "monkey-binding-trap-ready-r1.svg",
  zakimiya: "zakimiya-fire-whiskey-ready-r1.svg",
  tky: "tky-light-blade-ready-r1.svg",
  "mrs-chiha": "mrs-chiha-full-salvo-ready-r1.svg",
  "miyamoto-musashi": "miyamoto-musashi-muku-ready-r1.svg",
  "mayo-chan": "mayo-chan-feral-ready-r1.svg",
};
const sustainedKinds = new Set(["crazy-king", "kumaverson", "guardian"]);
const damageKinds = new Set([
  "brawler",
  "scout",
  "ranger",
  "brute",
  "babayaga",
  "gunner",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
]);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") state.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

function overlaps(left, right, gap = 2) {
  return left.left < right.right + gap
    && left.right + gap > right.left
    && left.top < right.bottom + gap
    && left.bottom + gap > right.top;
}

async function enterBattle(page) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ qa: "roles", safe: "iphone-landscape" }).toString();
  await page.goto(String(url), { waitUntil: "domcontentloaded" });
  const migrationButton = page.getByRole("button", { name: "内容を確認" });
  if (await migrationButton.isVisible().catch(() => false)) await migrationButton.click();
  const start = page.locator(".formation-footer .campaign-primary");
  await start.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const button = document.querySelector(".formation-footer .campaign-primary");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await start.click();
  for (let count = 0; count < 8; count += 1) {
    await page.waitForFunction(() => (
      Boolean(document.querySelector("canvas.battlefield.active"))
      || Boolean(document.querySelector(".event-screen"))
    ));
    if (await page.locator("canvas.battlefield.active").isVisible().catch(() => false)) return;
    await page.locator(".event-screen").getByRole("button", { name: "スキップ", exact: true }).click();
    await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
  }
  throw new Error("Battlefield was not reached");
}

async function prepareProof(page, kind = "all") {
  const proof = await page.evaluate((requestedKind) => (
    window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof(requestedKind)
  ), kind);
  const expectedCount = kind === "all" ? kinds.length : Array.isArray(kind) ? kind.length : 1;
  await page.waitForTimeout(700);
  const readiness = await page.evaluate(() => ({
    count: document.querySelectorAll(".manual-ability-ready").length,
    controls: [...document.querySelectorAll(".manual-ability-ready")]
      .map((button) => ({
        fighterId: Number(button.getAttribute("data-fighter-id")),
        kind: button.getAttribute("data-ability-kind"),
        disabled: button.disabled,
        available: button.classList.contains("available"),
      })),
    layout: JSON.parse(document.documentElement.dataset.manualAbilityLayoutDebug || "null"),
    fighters: window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .filter(({ side }) => side === "human")
      .map(({ id, kind: fighterKind, hp, combatReady, gateEntering, manualAbility }) => ({
        id,
        kind: fighterKind,
        hp,
        combatReady,
        gateEntering,
        phase: manualAbility?.phase ?? null,
      })),
  }));
  const ownerIds = new Set(proof.ownerIds);
  const ownerControls = readiness.controls.filter(({ fighterId }) => ownerIds.has(fighterId));
  invariant(ownerControls.length === expectedCount,
    `${JSON.stringify(kind)}: expected ${expectedCount} owner controls ${JSON.stringify(readiness)}`);
  invariant(ownerControls.every(({ available, disabled }) => available && !disabled),
    `${JSON.stringify(kind)}: requested owner control unavailable ${JSON.stringify(ownerControls)}`);
  const auxiliaryControls = readiness.controls.filter(({ fighterId }) => !ownerIds.has(fighterId));
  invariant(auxiliaryControls.every(({ available, disabled }) => !available && disabled),
    `${JSON.stringify(kind)}: unexpected auxiliary control availability ${JSON.stringify(readiness)}`);
  invariant(readiness.count === ownerControls.length + auxiliaryControls.length,
    `${JSON.stringify(kind)}: control accounting mismatch ${JSON.stringify(readiness)}`);
  return proof;
}

async function rosterLayoutProof(page, engine, viewport) {
  const batches = [kinds];
  const batchLayouts = [];
  for (const [batchIndex, batchKinds] of batches.entries()) {
    await prepareProof(page, batchKinds);
    const layout = await page.evaluate((expectedKinds) => {
    const canvas = document.querySelector("canvas.battlefield");
    const obstacles = [
      ".top-hud", ".survival-hud", ".boss-hud", ".crawler-alert",
      ".battle-barks", ".bottom-hud", ".stats-strip",
    ].flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.getBoundingClientRect().toJSON());
    return {
      canvas: canvas?.getBoundingClientRect().toJSON() ?? null,
      snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
      layoutDebug: JSON.parse(document.documentElement.dataset.manualAbilityLayoutDebug ?? "null"),
      obstacles,
      buttons: expectedKinds.map((kind) => {
        const button = document.querySelector(`.manual-ability-ready[data-ability-kind='${kind}']`);
        const icon = button?.querySelector(".manual-ability-ready-icon");
        return {
          kind,
          rect: button?.getBoundingClientRect().toJSON() ?? null,
          visualRect: icon?.parentElement?.getBoundingClientRect().toJSON() ?? null,
          iconBackground: icon ? getComputedStyle(icon).backgroundImage : "",
        };
      }),
    };
    }, batchKinds);
    invariant(layout.canvas, `${engine}/${viewport.width}x${viewport.height}: battlefield missing`);
    invariant(layout.buttons.length === batchKinds.length,
      `${engine}/${viewport.height}: expected ${batchKinds.length} icon records`);
    invariant(layout.snapshot.geometry.offFloorCount === 0, `${engine}/${viewport.height}: grounding failure`);
    for (const [index, button] of layout.buttons.entries()) {
      invariant(button.rect, `${engine}/${viewport.height}/${button.kind}: ready icon missing`);
      invariant(button.rect.width >= 44 && button.rect.height >= 44,
        `${engine}/${viewport.height}/${button.kind}: hit target below 44px`);
      invariant(button.rect.left >= layout.canvas.left
        && button.rect.right <= layout.canvas.right
        && button.rect.top >= layout.canvas.top
        && button.rect.bottom <= layout.canvas.bottom,
      `${engine}/${viewport.height}/${button.kind}: icon outside battlefield`);
      invariant(button.iconBackground.includes(iconFiles[button.kind]),
        `${engine}/${viewport.height}/${button.kind}: dedicated icon missing`);
      for (const obstacle of layout.obstacles) {
        invariant(!overlaps(button.visualRect, obstacle),
          `${engine}/${viewport.height}/${button.kind}: icon overlaps HUD ${JSON.stringify({ visualRect: button.visualRect, obstacle, layoutDebug: layout.layoutDebug })}`);
      }
      for (const other of layout.buttons.slice(index + 1)) {
        invariant(!overlaps(button.rect, other.rect),
          `${engine}/${viewport.height}/${button.kind}/${other.kind}: icons overlap ${JSON.stringify({ button, other, layoutDebug: layout.layoutDebug })}`);
      }
    }
    const baseName = `${engine}-${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: path.join(evidenceDir, `${baseName}-ready-${batchIndex + 1}.png`) });
    batchLayouts.push(layout);
  }
  return {
    buttons: batchLayouts.flatMap(({ buttons }) => buttons),
    offFloorCount: Math.max(...batchLayouts.map(({ snapshot }) => snapshot.geometry.offFloorCount)),
  };
}

async function runtimeResizeOrientationProof(page, engine, initialViewport) {
  const prepared = await prepareProof(page, "scout");
  const ownerId = prepared.ownerIds[0];
  const transitions = [];
  for (const viewport of canonicalRuntimeViewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("orientationchange"));
    });
    await page.waitForFunction(({ fighterId, width, height }) => {
      const button = document.querySelector(
        `.manual-ability-ready[data-fighter-id='${fighterId}']`,
      );
      const debug = JSON.parse(document.documentElement.dataset.manualAbilityLayoutDebug || "null");
      return window.innerWidth === width
        && window.innerHeight === height
        && button instanceof HTMLButtonElement
        && debug?.icons?.some((icon) => Number(icon.fighterId) === fighterId);
    }, { fighterId: ownerId, ...viewport });
    await page.waitForTimeout(140);
    const evidence = await page.evaluate((fighterId) => {
      const button = document.querySelector(
        `.manual-ability-ready[data-fighter-id='${fighterId}']`,
      );
      const canvas = document.querySelector("canvas.battlefield");
      const rootStyle = getComputedStyle(document.documentElement);
      const buttonRect = button?.getBoundingClientRect().toJSON() ?? null;
      const canvasRect = canvas?.getBoundingClientRect().toJSON() ?? null;
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        cssViewport: {
          width: Number.parseFloat(rootStyle.getPropertyValue("--app-viewport-width")),
          height: Number.parseFloat(rootStyle.getPropertyValue("--app-viewport-height")),
        },
        button: button instanceof HTMLButtonElement ? {
          rect: buttonRect,
          disabled: button.disabled,
          available: button.classList.contains("available"),
        } : null,
        canvasRect,
        documentSize: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
        offFloorCount: snapshot.geometry.offFloorCount,
      };
    }, ownerId);
    invariant(evidence.button?.available && !evidence.button.disabled,
      `${engine}/resize/${viewport.width}x${viewport.height}: ready control unavailable`);
    invariant(evidence.canvasRect && evidence.button.rect,
      `${engine}/resize/${viewport.width}x${viewport.height}: battlefield/control missing`);
    invariant(evidence.button.rect.left >= evidence.canvasRect.left
      && evidence.button.rect.right <= evidence.canvasRect.right
      && evidence.button.rect.top >= evidence.canvasRect.top
      && evidence.button.rect.bottom <= evidence.canvasRect.bottom,
    `${engine}/resize/${viewport.width}x${viewport.height}: control outside battlefield`);
    invariant(Math.abs(evidence.cssViewport.width - viewport.width) <= 1
      && Math.abs(evidence.cssViewport.height - viewport.height) <= 1,
    `${engine}/resize/${viewport.width}x${viewport.height}: viewport CSS stale ${JSON.stringify(evidence.cssViewport)}`);
    invariant(evidence.documentSize.width <= viewport.width
      && evidence.documentSize.height <= viewport.height,
    `${engine}/resize/${viewport.width}x${viewport.height}: page overflow ${JSON.stringify(evidence.documentSize)}`);
    invariant(evidence.offFloorCount === 0,
      `${engine}/resize/${viewport.width}x${viewport.height}: grounding failure`);
    transitions.push(evidence);
  }
  const displaySizes = new Set(transitions.map(({ canvasRect }) => (
    `${Math.round(canvasRect.width)}x${Math.round(canvasRect.height)}`
  )));
  invariant(displaySizes.size >= 3,
    `${engine}/resize: canonical transitions did not produce three layouts ${JSON.stringify(transitions)}`);
  if (initialViewport.width !== 844 || initialViewport.height !== 390) {
    await page.setViewportSize(initialViewport);
    await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  }
  return { ownerId, transitions };
}

async function targetLossRetargetProof(page, engine) {
  const single = await prepareProof(page, "scout");
  const singleOwnerId = single.ownerIds[0];
  const singleTargetId = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ side, hp, contained }) => side === "zombie" && hp > 0 && !contained)?.id ?? null
  ));
  invariant(singleTargetId !== null, `${engine}/target-loss: fixture target missing`);
  invariant(await page.evaluate(
    (targetId) => {
      const removed = window.__ASHFALL_BATTLE_QA__.removeManualAbilityProofTarget(targetId);
      return removed?.removed === true && removed.remaining === false;
    },
    singleTargetId,
  ), `${engine}/target-loss: target could not be released`);
  await page.waitForFunction((fighterId) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return button instanceof HTMLButtonElement
      && button.disabled
      && button.classList.contains("awaiting-target");
  }, singleOwnerId);
  const targetless = await page.evaluate(({ ownerId, targetId }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${ownerId}']`,
    );
    return {
      ownerPhase: snapshot.fighters.find(({ id }) => id === ownerId)?.manualAbility?.phase ?? null,
      removedTargetPresent: snapshot.fighters.some(({ id }) => id === targetId),
      disabled: button instanceof HTMLButtonElement && button.disabled,
      awaitingTarget: button?.classList.contains("awaiting-target") ?? false,
    };
  }, { ownerId: singleOwnerId, targetId: singleTargetId });
  invariant(targetless.ownerPhase === "ready"
    && !targetless.removedTargetPresent
    && targetless.disabled
    && targetless.awaitingTarget,
  `${engine}/target-loss: targetless ready state mismatch ${JSON.stringify(targetless)}`);

  const retargetFixture = await prepareProof(page, ["scout", "scout"]);
  const ownerId = retargetFixture.ownerIds[0];
  const ranked = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    return snapshot.fighters
      .filter(({ side, hp, combatReady, contained, targetable }) => (
        side === "zombie"
        && hp > 0
        && combatReady
        && !contained
        && targetable
      ))
      .map((target) => ({
        id: target.id,
        x: target.x,
        speed: target.speed,
        distance: Math.hypot(target.x - owner.x, target.y - owner.y),
      }))
      .sort((left, right) => (
        right.speed - left.speed
        || left.x - right.x
        || left.distance - right.distance
        || left.id - right.id
      ));
  }, ownerId);
  invariant(ranked.length >= 2, `${engine}/retarget: alternate target missing`);
  const removedTargetId = ranked[0].id;
  invariant(await page.evaluate(
    (targetId) => {
      const removed = window.__ASHFALL_BATTLE_QA__.removeManualAbilityProofTarget(targetId);
      return removed?.removed === true && removed.remaining === false;
    },
    removedTargetId,
  ), `${engine}/retarget: primary target could not be released`);
  await page.waitForFunction((fighterId) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return button instanceof HTMLButtonElement
      && !button.disabled
      && button.classList.contains("available");
  }, ownerId);
  invariant(await page.evaluate(
    (fighterId) => window.__ASHFALL_BATTLE_QA__.rearmManualAbilityTarget(fighterId),
    ownerId,
  ), `${engine}/retarget: alternate target was not selectable`);
  await page.locator(`.manual-ability-ready[data-fighter-id='${ownerId}']`).click();
  await page.waitForFunction((fighterId) => {
    const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id }) => id === fighterId);
    return owner?.manualAbility?.phase !== "ready";
  }, ownerId);
  const activated = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    const targetId = owner?.manualAbility?.target?.targetId ?? null;
    return {
      phase: owner?.manualAbility?.phase ?? null,
      targetId,
      target: snapshot.fighters.find(({ id }) => id === targetId) ?? null,
      startReceipts: snapshot.manualAbilityReceipts.filter((receipt) => (
        receipt.ownerId === fighterId && receipt.eventType === "start"
      )).length,
    };
  }, ownerId);
  invariant(activated.targetId !== null
    && activated.targetId !== removedTargetId
    && activated.target?.contained === false
    && activated.startReceipts === 1,
  `${engine}/retarget: live activation did not switch targets ${JSON.stringify({ removedTargetId, activated })}`);
  return {
    targetless: {
      ownerId: singleOwnerId,
      removedTargetId: singleTargetId,
      ...targetless,
    },
    retargeted: {
      ownerId,
      removedTargetId,
      targetId: activated.targetId,
      phase: activated.phase,
      startReceipts: activated.startReceipts,
    },
  };
}

async function incapacitatedRecoveryProof(page, engine) {
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("mother"));
  await page.waitForFunction(() => {
    const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother");
    return proof?.bossId && proof.gateEntering && !proof.combatReady;
  });
  const entry = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("mother")
  ));
  invariant(await page.evaluate(
    (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId),
    entry.bossId,
  ), `${engine}/incapacitated: Mother entry could not be accelerated`);
  await page.waitForFunction(() => (
    window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.combatReady === true
  ));
  const ready = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("mother")
  ));
  const armed = await page.evaluate(({ bossId, humanId }) => (
    window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
  ), { bossId: ready.bossId, humanId: ready.humanId });
  invariant(armed?.warningSeconds > 0, `${engine}/incapacitated: real stun telegraph was not armed`);
  await page.waitForFunction((fighterId) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  }, ready.humanId);
  await page.waitForFunction((fighterId) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const owner = bridge?.getSnapshot?.().fighters.find(({ id }) => id === fighterId);
    if ((owner?.stunned ?? 0) <= 0) return false;
    bridge.setRepresentativeSixProofPaused(true);
    return true;
  }, ready.humanId, { polling: "raf" });
  await page.waitForFunction((fighterId) => (
    document.querySelector(`.manual-ability-ready[data-fighter-id='${fighterId}']`) === null
  ), ready.humanId);
  const incapacitated = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    return {
      hp: owner?.hp ?? null,
      stunned: owner?.stunned ?? null,
      phase: owner?.manualAbility?.phase ?? null,
      iconCount: document.querySelectorAll(
        `.manual-ability-ready[data-fighter-id='${fighterId}']`,
      ).length,
    };
  }, ready.humanId);
  invariant(incapacitated.hp > 0
    && incapacitated.stunned > 0
    && incapacitated.phase === "ready"
    && incapacitated.iconCount === 0,
  `${engine}/incapacitated: ready icon was not suppressed ${JSON.stringify(incapacitated)}`);
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return (owner?.stunned ?? Number.POSITIVE_INFINITY) <= 0
      && owner?.manualAbility?.phase === "ready"
      && button instanceof HTMLButtonElement
      && !button.disabled
      && button.classList.contains("available");
  }, ready.humanId);
  const recovered = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    return {
      hp: owner?.hp ?? null,
      stunned: owner?.stunned ?? null,
      phase: owner?.manualAbility?.phase ?? null,
      iconCount: document.querySelectorAll(
        `.manual-ability-ready[data-fighter-id='${fighterId}']`,
      ).length,
      startReceipts: snapshot.manualAbilityReceipts.filter((receipt) => (
        receipt.ownerId === fighterId && receipt.eventType === "start"
      )).length,
    };
  }, ready.humanId);
  invariant(recovered.iconCount === 1 && recovered.startReceipts === 0,
    `${engine}/incapacitated: recovery duplicated or lost readiness ${JSON.stringify(recovered)}`);
  return {
    ownerId: ready.humanId,
    warningSeconds: armed.warningSeconds,
    incapacitated,
    recovered,
  };
}

async function stageWaveTransitionProof(page, engine) {
  const stage = await prepareProof(page, "scout");
  const stageOwnerId = stage.ownerIds[0];
  const stageState = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return {
      stageId: snapshot.stageId,
      wave: snapshot.wave,
      survivalRun: snapshot.survivalRun,
      iconAvailable: button instanceof HTMLButtonElement
        && !button.disabled
        && button.classList.contains("available"),
    };
  }, stageOwnerId);
  invariant(stageState.survivalRun === null && stageState.iconAvailable,
    `${engine}/stage-wave: Stage ready state missing ${JSON.stringify(stageState)}`);

  const stageTransition = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.transitionManualAbilityStageProof(
      "ranger",
      "stage-nishijin-station-platform",
    )
  ));
  invariant(stageTransition.previousStageId === stageState.stageId
    && stageTransition.nextStageId !== stageTransition.previousStageId
    && stageTransition.previousKinds.includes("scout"),
  `${engine}/stage-transition: production session boundary mismatch ${JSON.stringify(stageTransition)}`);
  await page.waitForFunction(({ nextStageId, previousKind, nextKind }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    const nextButton = document.querySelector(
      `.manual-ability-ready[data-ability-kind='${nextKind}']`,
    );
    return snapshot?.stageId === nextStageId
      && snapshot.survivalRun === null
      && !snapshot.fighters.some(({ side, kind }) => side === "human" && kind === previousKind)
      && snapshot.fighters.some(({ side, kind, combatReady, gateEntering }) => (
        side === "human" && kind === nextKind && combatReady && !gateEntering
      ))
      && document.querySelectorAll(
        `.manual-ability-ready[data-ability-kind='${previousKind}']`,
      ).length === 0
      && nextButton instanceof HTMLButtonElement
      && !nextButton.disabled
      && nextButton.classList.contains("available");
  }, {
    nextStageId: stageTransition.nextStageId,
    previousKind: "scout",
    nextKind: "ranger",
  });
  const nextStage = await page.evaluate(() => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      ".manual-ability-ready[data-ability-kind='ranger']",
    );
    return {
      stageId: snapshot.stageId,
      wave: snapshot.wave,
      previousKindCount: snapshot.fighters.filter(({ kind }) => kind === "scout").length,
      nextKindCount: snapshot.fighters.filter(({ kind }) => kind === "ranger").length,
      oldIndicatorCount: document.querySelectorAll(
        ".manual-ability-ready[data-ability-kind='scout']",
      ).length,
      nextIndicator: button instanceof HTMLButtonElement ? {
        disabled: button.disabled,
        available: button.classList.contains("available"),
      } : null,
    };
  });

  const survival = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.prepareManualAbilitySurvivalProof("scout")
  ));
  const waveOwnerId = survival.ownerIds[0];
  await page.waitForFunction((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return snapshot.survivalRun?.currentWave === 1
      && button instanceof HTMLButtonElement
      && !button.disabled;
  }, waveOwnerId);
  const waveOne = await page.evaluate((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return {
      currentWave: snapshot.survivalRun?.currentWave ?? null,
      phase: snapshot.survivalRun?.phase ?? null,
      ownerPhase: snapshot.fighters.find(({ id }) => id === fighterId)?.manualAbility?.phase ?? null,
      iconAvailable: button instanceof HTMLButtonElement
        && !button.disabled
        && button.classList.contains("available"),
    };
  }, waveOwnerId);
  invariant(waveOne.currentWave === 1
    && waveOne.ownerPhase === "ready"
    && waveOne.iconAvailable,
  `${engine}/stage-wave: Survival Wave 1 ready state missing ${JSON.stringify(waveOne)}`);

  const checkpoint = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.prepareSurvivalUpgradeProof()
  ));
  invariant(checkpoint.cooldownOwnerId === waveOwnerId && checkpoint.choices.length === 3,
    `${engine}/stage-wave: upgrade transition fixture mismatch ${JSON.stringify(checkpoint)}`);
  await page.locator(".survival-upgrade-screen").waitFor({ state: "visible" });
  await page.waitForFunction((fighterId) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return !(button instanceof HTMLButtonElement) || button.disabled;
  }, waveOwnerId);
  const upgradeIndicator = await page.evaluate((fighterId) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return button instanceof HTMLButtonElement
      ? { visible: true, disabled: button.disabled }
      : { visible: false, disabled: null };
  }, waveOwnerId);
  invariant(!upgradeIndicator.visible || upgradeIndicator.disabled,
    `${engine}/stage-wave: upgrade overlay left the ready control enabled`);
  await page.locator(".survival-upgrade-choices button:not(:disabled)").first().click();
  await page.waitForFunction(() => {
    const run = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun;
    return run?.phase === "wave-ready"
      && run.currentWave === 6
      && Object.keys(run.temporaryUpgradeStacks ?? {}).length > 0;
  });
  const continuation = await page.evaluate(({ kind, ownerId }) => (
    window.__ASHFALL_BATTLE_QA__.deploySurvivalLiveContinuationProof(kind, ownerId)
  ), { kind: checkpoint.cooldownKind, ownerId: checkpoint.cooldownOwnerId });
  invariant(continuation.cooldownOwner?.phase === "cooldown"
    && continuation.cooldownOwner.cooldownRemaining > 8
    && continuation.deployed?.phase === "ready"
    && continuation.deployed.cooldownRemaining === 0,
  `${engine}/stage-wave: Wave 6 cooldown/ready state mismatch ${JSON.stringify(continuation)}`);
  await page.waitForFunction((fighterId) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id }) => id === fighterId);
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${fighterId}']`,
    );
    return owner?.combatReady
      && !owner.gateEntering
      && button instanceof HTMLButtonElement
      && button.disabled
      && button.classList.contains("awaiting-target");
  }, continuation.deployed.id);
  const waveSix = await page.evaluate(({ cooldownOwnerId, deployedId }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${deployedId}']`,
    );
    return {
      currentWave: snapshot.survivalRun?.currentWave ?? null,
      phase: snapshot.survivalRun?.phase ?? null,
      cooldownOwnerIconCount: document.querySelectorAll(
        `.manual-ability-ready[data-fighter-id='${cooldownOwnerId}']`,
      ).length,
      deployedIcon: button instanceof HTMLButtonElement ? {
        disabled: button.disabled,
        awaitingTarget: button.classList.contains("awaiting-target"),
      } : null,
    };
  }, {
    cooldownOwnerId: checkpoint.cooldownOwnerId,
    deployedId: continuation.deployed.id,
  });
  invariant(waveSix.currentWave === 6
    && waveSix.phase === "wave-ready"
    && waveSix.cooldownOwnerIconCount === 0
    && waveSix.deployedIcon?.disabled
    && waveSix.deployedIcon.awaitingTarget,
  `${engine}/stage-wave: Wave 6 indicator state mismatch ${JSON.stringify(waveSix)}`);
  return {
    stage: stageState,
    nextStage,
    waveOne,
    checkpoint: {
      cooldownOwnerId: checkpoint.cooldownOwnerId,
      cooldownSeconds: checkpoint.cooldownSeconds,
      upgradeIndicator,
    },
    continuation,
    waveSix,
  };
}

async function p03LifecycleGapsProof(page, engine, viewport) {
  return {
    runtimeResizeOrientation: await runtimeResizeOrientationProof(page, engine, viewport),
    targetLossRetarget: await targetLossRetargetProof(page, engine),
    incapacitatedRecovery: await incapacitatedRecoveryProof(page, engine),
    stageWaveTransition: await stageWaveTransitionProof(page, engine),
  };
}

async function crazyKingIndicatorContinuityProof(page, engine) {
  const prepared = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.prepareCrazyKingIndicatorContinuityProof()
  ));
  invariant(Number.isInteger(prepared?.ownerId),
    `${engine}/crazy-king: continuity fixture unavailable`);
  const ownerId = prepared.ownerId;
  await page.waitForFunction((id) => {
    const button = document.querySelector(
      `.manual-ability-ready[data-fighter-id='${id}']`,
    );
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    // The player-facing control follows a moving fighter. Invoke its real DOM
    // click atomically instead of waiting for Playwright's stationary-element
    // actionability check, which cannot settle while locomotion is active.
    button.click();
    return true;
  }, ownerId, { polling: 10 });
  await page.waitForFunction((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase === "windup"
      && snapshot.crazyKingAbilityIndicatorCount === 1;
  }, ownerId);
  const windup = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);

  await page.waitForFunction(({ id, targetId, startX }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase === "active"
      && owner.targetId === targetId
      && owner.x >= startX + 3
      && snapshot.crazyKingAbilityIndicatorCount === 1;
  }, {
    id: ownerId,
    targetId: prepared.primaryTargetId,
    startX: prepared.ownerStart.x,
  });
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
  const pauseBefore = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);
  await page.waitForTimeout(240);
  const pauseAfter = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);
  invariant(
    pauseAfter.indicatorCount === 1
      && pauseAfter.owner?.manualAbility?.phase === "active"
      && pauseAfter.time === pauseBefore.time
      && pauseAfter.owner.x === pauseBefore.owner.x,
    `${engine}/crazy-king: pause did not preserve active indicator`,
  );

  const removed = await page.evaluate(
    (targetId) => window.__ASHFALL_BATTLE_QA__.removeManualAbilityProofTarget(targetId),
    prepared.primaryTargetId,
  );
  invariant(removed?.removed === true,
    `${engine}/crazy-king: primary target could not be removed`);
  const alternateActivated = await page.evaluate(
    (targetId) => window.__ASHFALL_BATTLE_QA__.activateRepresentativeSixAlternateTarget(targetId),
    prepared.alternateTargetId,
  );
  invariant(alternateActivated === true,
    `${engine}/crazy-king: alternate target could not be activated`);
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction(({ id, alternateTargetId, turnX }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase === "active"
      && owner.targetId === alternateTargetId
      && owner.x <= turnX - 3
      && owner.animationPresentation.direction === "left"
      && snapshot.crazyKingAbilityIndicatorCount === 1;
  }, {
    id: ownerId,
    alternateTargetId: prepared.alternateTargetId,
    turnX: pauseAfter.owner.x,
  });
  const retargeted = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);

  await page.evaluate(() => {
    let syntheticVisibilityState = document.visibilityState;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => syntheticVisibilityState,
    });
    window.__CRAZY_KING_SET_VISIBILITY__ = (state) => {
      syntheticVisibilityState = state;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.__CRAZY_KING_SET_VISIBILITY__("hidden");
  });
  const hiddenBefore = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);
  await page.waitForTimeout(240);
  const hiddenAfter = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      time: snapshot.time,
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
    };
  }, ownerId);
  invariant(
    hiddenAfter.indicatorCount === 1
      && hiddenAfter.owner?.manualAbility?.phase === "active"
      && hiddenAfter.time === hiddenBefore.time
      && hiddenAfter.owner.x === hiddenBefore.owner.x,
    `${engine}/crazy-king: hidden tab changed the active indicator`,
  );
  await page.evaluate(() => {
    window.__CRAZY_KING_SET_VISIBILITY__("visible");
    delete window.__CRAZY_KING_SET_VISIBILITY__;
    delete document.visibilityState;
  });

  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
    if (owner?.manualAbility?.phase === "recovery") {
      window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
      return true;
    }
    return false;
  }, ownerId, { polling: 5 });
  const recovery = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      indicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
      activeEndReceipts: snapshot.manualAbilityReceipts.filter((receipt) => (
        receipt.ownerId === id && receipt.eventType === "active-end"
      )).length,
    };
  }, ownerId);
  invariant(
    recovery.owner?.manualAbility?.phase === "recovery"
      && recovery.indicatorCount === 0
      && recovery.activeEndReceipts === 1,
    `${engine}/crazy-king: indicator did not disappear exactly at active-end`,
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
  await page.waitForFunction((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase === "cooldown"
      && snapshot.crazyKingAbilityIndicatorCount === 0;
  }, ownerId);
  return {
    ownerId,
    primaryTargetId: prepared.primaryTargetId,
    alternateTargetId: prepared.alternateTargetId,
    windup,
    pauseBefore,
    pauseAfter,
    retargeted,
    hiddenBefore,
    hiddenAfter,
    recovery,
  };
}

async function waitForAbilitySettlement(page, kind, ownerId) {
  if (kind === "miyamoto-musashi") {
    await page.waitForFunction((id) => {
      const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ id: candidateId }) => candidateId === id);
      return owner?.manualAbility?.phase === "guard";
    }, ownerId);
    await page.evaluate((id) => window.__ASHFALL_BATTLE_QA__.applyHumanDamage(id, 35), ownerId);
  }
  if (kind === "mayo-chan") {
    await page.waitForFunction((id) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
      return owner?.manualAbility?.phase === "feral"
        && snapshot.manualAbilityReceipts.some(({ ownerId: receiptOwnerId, eventType }) => (
          receiptOwnerId === id && eventType === "feral-start"
        ));
    }, ownerId);
    return;
  }
  if (sustainedKinds.has(kind)) {
    await page.waitForFunction((id) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      const owner = snapshot.fighters.find(({ id: candidateId }) => candidateId === id);
      return owner?.manualAbility?.phase === "active"
        && snapshot.manualAbilityReceipts.some(({ ownerId: receiptOwnerId, eventType }) => (
          receiptOwnerId === id && eventType === "active-start"
        ));
    }, ownerId);
    return;
  }
  if (kind === "mrs-chiha") {
    await page.waitForFunction((id) => (
      window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts
        .filter(({ ownerId, eventType }) => ownerId === id && eventType === "impact").length === 4
    ), ownerId);
  }
  await page.waitForFunction((id) => {
    const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase === "cooldown";
  }, ownerId);
}

async function abilityActivationProof(page, engine) {
  const proofs = [];
  for (const kind of kinds) {
    const prepared = await prepareProof(page, kind);
    const ownerId = prepared.ownerIds[0];
    const before = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    const enemyHpBefore = before.fighters
      .filter(({ side }) => side === "zombie")
      .reduce((sum, fighter) => sum + fighter.hp, 0);
    const allyHpBefore = before.fighters
      .filter(({ side }) => side === "human")
      .reduce((sum, fighter) => sum + fighter.hp, 0);
    const enemyXBefore = new Map(before.fighters
      .filter(({ side }) => side === "zombie")
      .map(({ id, x }) => [id, x]));
    await page.locator(`.manual-ability-ready[data-ability-kind='${kind}']`).click();
    const immediate = await page.evaluate((id) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      return {
        owner: snapshot.fighters.find(({ id: candidateId }) => candidateId === id),
        vfx: snapshot.manualAbilityVfx.filter(({ ownerId }) => ownerId === id),
        iconCount: document.querySelectorAll(`.manual-ability-ready[data-fighter-id='${id}']`).length,
        crazyKingIndicatorCount: snapshot.crazyKingAbilityIndicatorCount,
      };
    }, ownerId);
    invariant(immediate.owner?.manualAbility?.phase !== "ready",
      `${engine}/${kind}: one-tap activation did not start`);
    invariant(immediate.iconCount === 0, `${engine}/${kind}: ready icon remained after use`);
    invariant(immediate.vfx.some(({ kind: effectKind }) => effectKind === kind),
      `${engine}/${kind}: dedicated VFX did not start`);
    invariant(immediate.crazyKingIndicatorCount === (kind === "crazy-king" ? 1 : 0),
      `${engine}/${kind}: transient indicator count ${immediate.crazyKingIndicatorCount}`);

    const screenshotDelay = kind === "mrs-chiha"
      ? 1350
      : sustainedKinds.has(kind) || kind === "mayo-chan"
        ? 520
        : Math.max(110, Math.round((immediate.owner.manualAbility.windupRemaining || .2) * 1000 + 80));
    await page.waitForTimeout(screenshotDelay);
    const indicatorDuringEffect = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.getSnapshot().crazyKingAbilityIndicatorCount
    ));
    invariant(indicatorDuringEffect === (kind === "crazy-king" ? 1 : 0),
      `${engine}/${kind}: active indicator count ${indicatorDuringEffect}`);
    if (engine === "chromium" && !["zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan"].includes(kind)) {
      await page.screenshot({ path: path.join(evidenceDir, `chromium-844x390-${kind}-vfx.png`) });
    }
    await waitForAbilitySettlement(page, kind, ownerId);
    let after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    invariant(after.crazyKingAbilityIndicatorCount === (kind === "crazy-king" ? 1 : 0),
      `${engine}/${kind}: active indicator lifecycle ended early`);
    if (kind === "engineer") {
      await page.waitForFunction(() => (
        window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
          .filter(({ side, stunned, suppressedRemaining }) => (
            side === "zombie" && (stunned > 0 || suppressedRemaining > 0)
          )).length >= 2
      ));
      after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    }
    const enemyHpAfter = after.fighters
      .filter(({ side }) => side === "zombie")
      .reduce((sum, fighter) => sum + fighter.hp, 0);
    const allyHpAfter = after.fighters
      .filter(({ side }) => side === "human")
      .reduce((sum, fighter) => sum + fighter.hp, 0);
    invariant(after.manualAbilityReceipts.some(({ ownerId: receiptOwnerId, eventType }) => (
      receiptOwnerId === ownerId && eventType === "start"
    )), `${engine}/${kind}: start receipt missing`);
    invariant(await page.locator(`.manual-ability-ready[data-ability-kind='${kind}']`).count() === 0,
      `${engine}/${kind}: cooldown/active phase rendered an overhead icon`);
    if (damageKinds.has(kind)) {
      invariant(enemyHpAfter < enemyHpBefore,
        `${engine}/${kind}: authored damage did not reach a target`);
    }
    if (kind === "brawler") {
      const displaced = after.fighters.filter(({ id, side, x }) => (
        side === "zombie"
        && enemyXBefore.has(id)
        && x > enemyXBefore.get(id) + .5
      ));
      invariant(displaced.length >= 2,
        `${engine}/brawler: final hit did not push the surrounding group`);
    }
    if (kind === "medic") {
      invariant(allyHpAfter > allyHpBefore, `${engine}/medic: emergency treatment did not heal`);
      const treated = after.fighters.find(({ side, id, damageReductionRemaining }) => (
        side === "human" && id !== ownerId && damageReductionRemaining > 0
      ));
      invariant(treated?.damageReductionMultiplier < 1,
        `${engine}/medic: emergency protection was not applied`);
    }
    if (kind === "kumaverson" || kind === "guardian") {
      invariant(after.fighters.some(({ side, targetId }) => side === "zombie" && targetId === ownerId),
        `${engine}/${kind}: taunt did not redirect a threat`);
    }
    if (kind === "engineer") {
      const trapped = after.fighters.filter(({ side, stunned, suppressedRemaining }) => (
        side === "zombie" && stunned > 0 && suppressedRemaining > 0
      ));
      invariant(trapped.length >= 2,
        `${engine}/engineer: manual binding trap did not bind and slow the group`);
    }
    invariant(await page.evaluate(
      (id) => window.__ASHFALL_BATTLE_QA__.rearmManualAbilityTarget(id),
      ownerId,
    ), `${engine}/${kind}: proof target could not be restored for cooldown completion`);
    const startReceiptCount = after.manualAbilityReceipts
      .filter(({ ownerId: receiptOwnerId, eventType }) => (
        receiptOwnerId === ownerId && eventType === "start"
      )).length;
    const primed = await page.evaluate(
      ({ id, seconds }) => window.__ASHFALL_BATTLE_QA__.primeManualAbilityCooldown(id, seconds),
      { id: ownerId, seconds: .14 },
    );
    invariant(primed?.phase === "cooldown", `${engine}/${kind}: cooldown proof could not be primed`);
    const indicatorInCooldown = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.getSnapshot().crazyKingAbilityIndicatorCount
    ));
    invariant(indicatorInCooldown === 0,
      `${engine}/${kind}: indicator survived into cooldown`);
    invariant(await page.locator(`.manual-ability-ready[data-fighter-id='${ownerId}']`).count() === 0,
      `${engine}/${kind}: cooldown proof rendered an overhead icon`);
    await page.waitForFunction((id) => (
      document.querySelector(`.manual-ability-ready[data-fighter-id='${id}']`) !== null
    ), ownerId);
    const rearmed = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    invariant(rearmed.manualAbilityReceipts
      .filter(({ ownerId: receiptOwnerId, eventType }) => (
        receiptOwnerId === ownerId && eventType === "start"
      )).length === startReceiptCount,
    `${engine}/${kind}: cooldown completion duplicated activation`);
    proofs.push({
      kind,
      ownerId,
      phase: rearmed.fighters.find(({ id }) => id === ownerId)?.manualAbility?.phase ?? null,
      enemyDamage: enemyHpBefore - enemyHpAfter,
      allyHealing: allyHpAfter - allyHpBefore,
      indicatorLifecycle: {
        immediate: immediate.crazyKingIndicatorCount,
        active: indicatorDuringEffect,
        cooldown: indicatorInCooldown,
      },
      receiptTypes: after.manualAbilityReceipts
        .filter(({ ownerId: receiptOwnerId }) => receiptOwnerId === ownerId)
        .map(({ eventType }) => eventType),
    });
  }
  return proofs;
}

async function duplicateInstanceProof(page, engine) {
  const proof = await prepareProof(page, ["brawler", "brawler"]);
  const [firstId, secondId] = proof.ownerIds;
  await page.locator(`.manual-ability-ready[data-fighter-id='${firstId}']`).click();
  await page.waitForFunction((id) => {
    const owner = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id);
    return owner?.manualAbility?.phase !== "ready";
  }, firstId);
  invariant(await page.locator(`.manual-ability-ready[data-fighter-id='${firstId}']`).count() === 0,
    `${engine}/duplicate: used instance kept its icon`);
  invariant(await page.locator(`.manual-ability-ready[data-fighter-id='${secondId}']`).count() === 1,
    `${engine}/duplicate: ready sibling lost its icon`);
  await page.locator(`.manual-ability-ready[data-fighter-id='${secondId}']`).click();
  await Promise.all([
    waitForAbilitySettlement(page, "brawler", firstId),
    waitForAbilitySettlement(page, "brawler", secondId),
  ]);
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  for (const ownerId of [firstId, secondId]) {
    invariant(snapshot.manualAbilityReceipts.filter(({ ownerId: receiptOwnerId, eventType }) => (
      receiptOwnerId === ownerId && eventType === "start"
    )).length === 1, `${engine}/duplicate/${ownerId}: activation was not independent and singular`);
  }
  return { firstId, secondId };
}

async function speedPauseVisibilityProof(page, engine) {
  const proof = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.prepareManualAbilitySurvivalProof("medic")
  ));
  const ownerId = proof.ownerIds[0];
  await page.waitForFunction(() => (
    document.querySelector(".survival-hud")
    && document.querySelector(".manual-ability-ready[data-ability-kind='medic']")
  ));
  invariant(await page.getByRole("button", { name: "1倍", exact: true }).getAttribute("class")
    .then((value) => value?.includes("active")), `${engine}/speed: Survival did not begin at 1x`);
  await page.locator(`.manual-ability-ready[data-fighter-id='${ownerId}']`).click();
  await waitForAbilitySettlement(page, "medic", ownerId);
  await page.evaluate(
    ({ id, seconds }) => window.__ASHFALL_BATTLE_QA__.primeManualAbilityCooldown(id, seconds),
    { id: ownerId, seconds: .8 },
  );
  await page.locator(".survival-pause").click();
  await page.getByRole("dialog", { name: "一時停止メニュー" }).waitFor({ state: "visible" });
  const pausedBefore = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id)?.manualAbility?.cooldownRemaining
  ), ownerId);
  await page.waitForTimeout(450);
  const pausedAfter = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id)?.manualAbility?.cooldownRemaining
  ), ownerId);
  invariant(Math.abs(pausedAfter - pausedBefore) <= .03,
    `${engine}/pause: cooldown advanced while paused (${pausedBefore} -> ${pausedAfter})`);
  await page.getByRole("button", { name: "作戦を再開", exact: true }).click();
  await page.getByRole("button", { name: "2倍", exact: true }).click();
  await page.waitForFunction(() => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun?.speed === 2
  ));
  await page.evaluate(
    ({ id, seconds }) => window.__ASHFALL_BATTLE_QA__.primeManualAbilityCooldown(id, seconds),
    { id: ownerId, seconds: .5 },
  );
  await page.waitForFunction((id) => (
    document.querySelector(`.manual-ability-ready[data-fighter-id='${id}']`) !== null
  ), ownerId);
  await page.locator(`.manual-ability-ready[data-fighter-id='${ownerId}']`).click();
  await waitForAbilitySettlement(page, "medic", ownerId);
  const receiptsAfterTwoSpeeds = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts
      .filter(({ ownerId, eventType }) => ownerId === id && eventType === "start").length
  ), ownerId);
  invariant(receiptsAfterTwoSpeeds === 2,
    `${engine}/speed: 1x/2x taps produced ${receiptsAfterTwoSpeeds} starts`);

  const targetRearmed = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.rearmManualAbilityTarget(id)
  ), ownerId);
  invariant(targetRearmed, `${engine}/visibility: no valid target after prior activations`);
  await page.evaluate(
    ({ id, seconds }) => window.__ASHFALL_BATTLE_QA__.primeManualAbilityCooldown(id, seconds),
    { id: ownerId, seconds: .7 },
  );
  await page.evaluate(() => {
    let syntheticVisibilityState = document.visibilityState;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => syntheticVisibilityState,
    });
    window.__MANUAL_ABILITY_SET_VISIBILITY__ = (state) => {
      syntheticVisibilityState = state;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.__MANUAL_ABILITY_SET_VISIBILITY__("hidden");
  });
  const hiddenBefore = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id)?.manualAbility?.cooldownRemaining
  ), ownerId);
  await page.waitForTimeout(450);
  const hiddenAfter = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id)?.manualAbility?.cooldownRemaining
  ), ownerId);
  invariant(Math.abs(hiddenAfter - hiddenBefore) <= .03,
    `${engine}/visibility: cooldown advanced while hidden (${hiddenBefore} -> ${hiddenAfter})`);
  await page.evaluate(() => {
    window.__MANUAL_ABILITY_SET_VISIBILITY__("visible");
  });
  await page.waitForFunction((id) => (
    document.querySelector(`.manual-ability-ready[data-fighter-id='${id}']`) !== null
  ), ownerId);
  await page.evaluate(() => {
    delete window.__MANUAL_ABILITY_SET_VISIBILITY__;
    delete document.visibilityState;
  });
  const finalSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(finalSnapshot.manualAbilityReceipts.filter(({ ownerId: receiptOwnerId, eventType }) => (
    receiptOwnerId === ownerId && eventType === "start"
  )).length === 2, `${engine}/visibility: foreground return duplicated activation`);
  return {
    ownerId,
    receipts: 2,
    pausedCooldownDelta: pausedAfter - pausedBefore,
    hiddenCooldownDelta: hiddenAfter - hiddenBefore,
    visibilityMode: "synthetic-headless-visibility",
  };
}

async function checkpointReloadProof(page, engine) {
  const persisted = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.persistManualAbilityCheckpointProof("brawler", 9.5)
  ));
  invariant(persisted?.durable, `${engine}/reload: checkpoint fixture was not durable`);
  const reloadUrl = new URL(baseUrl);
  reloadUrl.search = new URLSearchParams({ safe: "iphone-landscape" }).toString();
  await page.goto(String(reloadUrl), { waitUntil: "domcontentloaded" });
  const continueButton = page.locator(".title-start");
  await continueButton.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const button = document.querySelector(".title-start");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await continueButton.click();
  await page.getByRole("button", { name: /防衛継続作戦/ }).click();
  await page.getByRole("button", { name: "checkpointから再開", exact: true }).click();
  await page.waitForFunction(() => (
    Boolean(document.querySelector("canvas.battlefield.active"))
    && window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun?.phase === "upgrade-selection"
  ));
  const upgradeChoice = page.locator(".survival-upgrade-choices button:not(:disabled)").first();
  await upgradeChoice.waitFor({ state: "visible" });
  await upgradeChoice.click();
  await page.waitForFunction(() => {
    const run = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun;
    return run?.phase === "wave-ready" && run.currentWave === 6;
  });
  const deployed = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.deployManualAbilityCheckpointProof("brawler")
  ));
  invariant(deployed?.phase === "cooldown", `${engine}/reload: resumed instance was free-ready`);
  invariant(deployed.cooldownRemaining >= 9.35,
    `${engine}/reload: cooldown debt was shortened (${deployed.cooldownRemaining})`);
  invariant(await page.locator(`.manual-ability-ready[data-fighter-id='${deployed.ownerId}']`).count() === 0,
    `${engine}/reload: resumed cooldown rendered a ready icon`);
  await page.waitForTimeout(250);
  const after = await page.evaluate((id) => (
    window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
      .find(({ id: candidateId }) => candidateId === id)?.manualAbility
  ), deployed.ownerId);
  invariant(after?.phase === "cooldown" && after.cooldownRemaining > 8.5,
    `${engine}/reload: resumed cooldown did not continue normally`);
  return {
    ownerId: deployed.ownerId,
    checkpointId: persisted.checkpointId,
    restoredCooldown: deployed.cooldownRemaining,
  };
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unknown MANUAL_ABILITIES_QA_ENGINES value: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(timeout);
      const diagnostics = diagnosticsFor(page);
      await enterBattle(page);
      const layout = qaScope === "full"
        ? await rosterLayoutProof(page, engine, viewport)
        : null;
      let activations = null;
      let duplicateInstances = null;
      let lifecycle = null;
      let checkpointReload = null;
      let p03LifecycleGaps = null;
      let crazyKingIndicatorContinuity = null;
      if (viewport.width === 844 && viewport.height === 390) {
        if (qaScope === "full") {
          activations = await abilityActivationProof(page, engine);
          crazyKingIndicatorContinuity = await crazyKingIndicatorContinuityProof(page, engine);
          duplicateInstances = await duplicateInstanceProof(page, engine);
          lifecycle = await speedPauseVisibilityProof(page, engine);
        }
        p03LifecycleGaps = await p03LifecycleGapsProof(page, engine, viewport);
        if (qaScope === "full") checkpointReload = await checkpointReloadProof(page, engine);
      }
      invariant(diagnostics.consoleErrors.length === 0,
        `${engine}/${viewport.height}: console errors ${diagnostics.consoleErrors}`);
      invariant(diagnostics.pageErrors.length === 0,
        `${engine}/${viewport.height}: page errors ${diagnostics.pageErrors}`);
      invariant(diagnostics.requestFailures.length === 0,
        `${engine}/${viewport.height}: request failures ${diagnostics.requestFailures}`);
      invariant(diagnostics.httpErrors.length === 0,
        `${engine}/${viewport.height}: HTTP errors ${diagnostics.httpErrors}`);
      results.push({
        engine,
        viewport,
        scope: qaScope,
        readyIcons: layout?.buttons.map(({ kind, rect, iconBackground }) => ({
          kind,
          rect,
          iconBackground,
        })) ?? [],
        activations,
        duplicateInstances,
        lifecycle,
        crazyKingIndicatorContinuity,
        p03LifecycleGaps,
        checkpointReload,
        offFloorCount: layout?.offFloorCount
          ?? Math.max(...(p03LifecycleGaps?.runtimeResizeOrientation.transitions
            .map(({ offFloorCount }) => offFloorCount) ?? [0])),
        diagnostics,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

await writeFile(
  path.join(evidenceDir, "results.json"),
  `${JSON.stringify({ cases: results.length, results }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  message: "Manual ability browser QA passed",
  scope: qaScope,
  cases: results.length,
  activationCases: results.reduce((sum, result) => sum + (result.activations?.length ?? 0), 0),
  p03LifecycleGapCases: results.filter(({ p03LifecycleGaps }) => p03LifecycleGaps !== null).length,
  evidenceDir,
}, null, 2));
