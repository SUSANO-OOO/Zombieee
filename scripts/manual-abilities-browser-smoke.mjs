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
  const batches = [kinds.slice(0, 8), kinds.slice(8)];
  const batchLayouts = [];
  for (const [batchIndex, batchKinds] of batches.entries()) {
    await prepareProof(page, batchKinds);
    const layout = await page.evaluate((expectedKinds) => {
    const canvas = document.querySelector("canvas.battlefield");
    const obstacles = [
      ".top-hud", ".survival-hud", ".boss-hud", ".crawler-alert",
      ".battle-barks", ".placement-hint", ".bottom-hud", ".stats-strip",
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
        invariant(!overlaps(button.rect, obstacle),
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
    const after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    const ownerAfter = after.fighters.find(({ id }) => id === ownerId);
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
      invariant(ownerAfter.engineerTrapReady === true && ownerAfter.engineerTrapManual === true,
        `${engine}/engineer: manual binding trap was not placed`);
    }
    proofs.push({
      kind,
      ownerId,
      phase: ownerAfter.manualAbility.phase,
      enemyDamage: enemyHpBefore - enemyHpAfter,
      allyHealing: allyHpAfter - allyHpBefore,
      receiptTypes: after.manualAbilityReceipts
        .filter(({ ownerId: receiptOwnerId }) => receiptOwnerId === ownerId)
        .map(({ eventType }) => eventType),
    });
  }
  return proofs;
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
      if (viewport.width === 844 && viewport.height === 390) {
        activations = await abilityActivationProof(page, engine);
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
