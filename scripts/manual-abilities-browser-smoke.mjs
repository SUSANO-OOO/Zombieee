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
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
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
    kinds: [...document.querySelectorAll(".manual-ability-ready")]
      .map((button) => button.getAttribute("data-ability-kind")),
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
  invariant(readiness.count === expectedCount,
    `${JSON.stringify(kind)}: expected ${expectedCount} ready icons ${JSON.stringify(readiness)}`);
  return proof;
}

async function rosterLayoutProof(page, engine, viewport) {
  const batches = [];
  for (let index = 0; index < kinds.length; index += 7) {
    batches.push(kinds.slice(index, index + 7));
  }
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
          `${engine}/${viewport.height}/${button.kind}: icon overlaps HUD`);
      }
      for (const other of layout.buttons.slice(index + 1)) {
        invariant(!overlaps(button.rect, other.rect),
          `${engine}/${viewport.height}/${button.kind}/${other.kind}: icons overlap`);
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
      };
    }, ownerId);
    invariant(immediate.owner?.manualAbility?.phase !== "ready",
      `${engine}/${kind}: one-tap activation did not start`);
    invariant(immediate.iconCount === 0, `${engine}/${kind}: ready icon remained after use`);
    invariant(immediate.vfx.some(({ kind: effectKind }) => effectKind === kind),
      `${engine}/${kind}: dedicated VFX did not start`);

    const screenshotDelay = kind === "mrs-chiha"
      ? 1350
      : sustainedKinds.has(kind) || kind === "mayo-chan"
        ? 520
        : Math.max(110, Math.round((immediate.owner.manualAbility.windupRemaining || .2) * 1000 + 80));
    await page.waitForTimeout(screenshotDelay);
    if (engine === "chromium" && !["zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan"].includes(kind)) {
      await page.screenshot({ path: path.join(evidenceDir, `chromium-844x390-${kind}-vfx.png`) });
    }
    await waitForAbilitySettlement(page, kind, ownerId);
    let after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
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
      const layout = await rosterLayoutProof(page, engine, viewport);
      let activations = null;
      let duplicateInstances = null;
      let lifecycle = null;
      let checkpointReload = null;
      if (viewport.width === 844 && viewport.height === 390) {
        activations = await abilityActivationProof(page, engine);
        duplicateInstances = await duplicateInstanceProof(page, engine);
        lifecycle = await speedPauseVisibilityProof(page, engine);
        checkpointReload = await checkpointReloadProof(page, engine);
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
        readyIcons: layout.buttons.map(({ kind, rect, iconBackground }) => ({ kind, rect, iconBackground })),
        activations,
        duplicateInstances,
        lifecycle,
        checkpointReload,
        offFloorCount: layout.offFloorCount,
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
  cases: results.length,
  activationCases: results.reduce((sum, result) => sum + (result.activations?.length ?? 0), 0),
  evidenceDir,
}, null, 2));
