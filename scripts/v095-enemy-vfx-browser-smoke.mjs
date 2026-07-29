import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ENEMY_CONTENT } from "../app/content/enemyCatalog.js";

const baseUrl = new URL(process.env.V095_ENEMY_VFX_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5 enemy VFX QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V095_ENEMY_VFX_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const timeout = Math.max(10_000, Number(process.env.V095_ENEMY_VFX_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.V095_ENEMY_VFX_QA_EVIDENCE_DIR ?? "outputs/v095-enemy-vfx-browser-smoke",
);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const projectileKinds = ["spitter", "ooze", "resonator", "choir-knot"];
const ordinaryEnemyKinds = ENEMY_CONTENT
  .filter(({ id, spawnClass }) => !projectileKinds.includes(id) && spawnClass !== "boss")
  .map(({ id }) => id);
const crawlerStates = ["door", "firing", "hit", "repair", "critical", "stored"];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function qaUrl() {
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
    const error = request.failure()?.errorText ?? "unknown";
    if (error !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${error}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function assertDiagnostics(diagnostics, name) {
  for (const [kind, entries] of Object.entries(diagnostics)) {
    invariant(entries.length === 0, `${name}: ${kind} ${JSON.stringify(entries)}`);
  }
}

async function renderFrameCount(page) {
  return page.evaluate(
    () => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().renderFrames,
  );
}

async function waitForNextRender(page, previousRenderFrames) {
  await page.waitForFunction(
    (previous) => (
      window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().renderFrames > previous
    ),
    previousRenderFrames,
    { timeout },
  );
}

async function captureSequence(page, prefix, frames = 1) {
  const paths = [];
  const hashes = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const screenshotPath = path.join(evidenceDir, `${prefix}-frame-${frame}.png`);
    const buffer = await page.screenshot({ path: screenshotPath, fullPage: false });
    paths.push(screenshotPath);
    hashes.push(createHash("sha256").update(buffer).digest("hex"));
    if (frame + 1 < frames) {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.advanceVfxProof(.055));
      await waitForNextRender(page, await renderFrameCount(page));
    }
  }
  return {
    paths,
    hashes,
    uniqueFrames: new Set(hashes).size,
  };
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `unsupported engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width === 844,
      });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = {
        name,
        engine,
        viewport,
        status: "failed",
        projectileProofs: [],
        ordinaryEnemyProofs: [],
        bossProofs: [],
        crawlerProofs: [],
      };
      try {
        const response = await page.goto(qaUrl(), { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `${name}: navigation HTTP ${response?.status()}`);
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
            return snapshot?.screen === "battle"
              && snapshot.running === true
              && typeof window.__ASHFALL_BATTLE_QA__?.prepareEnemyVfxProof === "function";
          },
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
          null,
          { timeout },
        );
        const quality = viewport.height === 340 ? "power-save" : "high";
        await page.evaluate((mode) => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality(mode), quality);
        await page.waitForFunction(
          (mode) => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().graphicsProfile.requestedMode === mode,
          quality,
          { timeout },
        );

        for (const kind of projectileKinds) {
          const prepared = await page.evaluate(
            (enemyKind) => window.__ASHFALL_BATTLE_QA__.prepareEnemyNormalAttackRuntimeProof(enemyKind),
            kind,
          );
          invariant(prepared.expectedAudioCueId, `${name}/${kind}: production attack SE absent`);
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(
            ({ enemyId, targetId, initialAttackSequence, initialTargetHp }) => {
              const proof = window.__ASHFALL_BATTLE_QA__
                .sampleEnemyNormalAttackRuntimeProof(enemyId, targetId);
              return proof
                && proof.visual?.phase === "warning"
                && proof.attackSequence === initialAttackSequence
                && proof.targetHp === initialTargetHp
                && proof.shots.length === 0;
            },
            prepared,
            { timeout },
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
          const warning = await page.evaluate(
            ({ enemyId, targetId }) => (
              window.__ASHFALL_BATTLE_QA__.sampleEnemyNormalAttackRuntimeProof(enemyId, targetId)
            ),
            prepared,
          );
          invariant(warning.visual?.phase === "warning", `${name}/${kind}: production warning lost`);
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(
            ({ enemyId, targetId, initialAttackSequence, initialTargetHp }) => {
              const proof = window.__ASHFALL_BATTLE_QA__
                .sampleEnemyNormalAttackRuntimeProof(enemyId, targetId);
              return proof
                && proof.attackSequence > initialAttackSequence
                && proof.targetHp === initialTargetHp
                && proof.shots.length === 1
                && proof.pendingHits.some(({ eventKind, applyDamage }) => (
                  eventKind === "impact" && applyDamage === true
                ));
            },
            prepared,
            { timeout },
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
          const proof = await page.evaluate(
            ({ enemyId, targetId }) => (
              window.__ASHFALL_BATTLE_QA__.sampleEnemyNormalAttackRuntimeProof(enemyId, targetId)
            ),
            prepared,
          );
          invariant(proof.visual?.projectile, `${name}/${kind}: projectile presentation absent`);
          invariant(proof.targetHp === prepared.initialTargetHp, `${name}/${kind}: damage preceded impact`);
          invariant(proof.shots.length === 1, `${name}/${kind}: production shot absent`);
          invariant(
            proof.audioCueRequests.some(({ cueId }) => cueId === prepared.expectedAudioCueId),
            `${name}/${kind}: production attack SE request absent`,
          );
          const [shot] = proof.shots;
          invariant(Math.abs(shot.x - proof.anchor.x) <= .01, `${name}/${kind}: muzzle X drift`);
          invariant(Math.abs(shot.y - proof.anchor.y) <= .01, `${name}/${kind}: muzzle Y drift`);
          invariant(shot.sourceId === prepared.enemyId, `${name}/${kind}: wrong projectile source`);
          invariant(shot.targetId === prepared.targetId, `${name}/${kind}: wrong projectile target`);
          invariant(shot.weapon === kind, `${name}/${kind}: wrong projectile identity`);
          const sequence = await captureSequence(
            page,
            `${name}-enemy-${kind}`,
            kind === "resonator" ? 4 : 1,
          );
          if (kind === "resonator") {
            invariant(sequence.uniqueFrames >= 3, `${name}/${kind}: continuous projectile frames collapsed`);
          }
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(
            ({ enemyId, targetId, initialTargetHp }) => {
              const impact = window.__ASHFALL_BATTLE_QA__
                .sampleEnemyNormalAttackRuntimeProof(enemyId, targetId);
              return impact
                && impact.targetHp < initialTargetHp
                && impact.pendingHits.length === 0;
            },
            prepared,
            { timeout },
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
          const impact = await page.evaluate(
            ({ enemyId, targetId }) => (
              window.__ASHFALL_BATTLE_QA__.sampleEnemyNormalAttackRuntimeProof(enemyId, targetId)
            ),
            prepared,
          );
          result.projectileProofs.push({
            kind,
            origin: proof.visual.projectile.origin,
            trail: proof.visual.projectile.trail,
            anchor: proof.anchor,
            shot,
            sequence,
            production: {
              initialTargetHp: prepared.initialTargetHp,
              inFlightTargetHp: proof.targetHp,
              impactTargetHp: impact.targetHp,
              attackSequence: proof.attackSequence,
              audioCueId: prepared.expectedAudioCueId,
            },
          });
        }

        for (const kind of ordinaryEnemyKinds) {
          const prepared = await page.evaluate(
            (enemyKind) => window.__ASHFALL_BATTLE_QA__.prepareEnemyNormalAttackRuntimeProof(
              enemyKind,
              true,
            ),
            kind,
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(
            ({ enemyId, targetId, initialAttackSequence, initialTargetHp }) => {
              const proof = window.__ASHFALL_BATTLE_QA__
                .sampleEnemyNormalAttackRuntimeProof(enemyId, targetId);
              return proof
                && proof.visual?.phase === "warning"
                && proof.visual?.lowHp === true
                && proof.attackSequence === initialAttackSequence
                && proof.targetHp === initialTargetHp;
            },
            prepared,
            { timeout },
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
          const proof = await page.evaluate(
            ({ enemyId, targetId }) => (
              window.__ASHFALL_BATTLE_QA__.sampleEnemyNormalAttackRuntimeProof(enemyId, targetId)
            ),
            prepared,
          );
          invariant(proof.visual?.boss === false, `${name}/${kind}: ordinary enemy role missing`);
          invariant(proof.visual?.projectile === null, `${name}/${kind}: wrong projectile role`);
          invariant(proof.visual?.phase === "warning", `${name}/${kind}: attack warning absent`);
          invariant(proof.visual?.lowHp === true, `${name}/${kind}: low-HP VFX state absent`);
          const sequence = await captureSequence(page, `${name}-ordinary-${kind}-warning-low-hp`, 1);
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(
            ({ enemyId, targetId, initialAttackSequence, initialTargetHp }) => {
              const impact = window.__ASHFALL_BATTLE_QA__
                .sampleEnemyNormalAttackRuntimeProof(enemyId, targetId);
              return impact
                && impact.attackSequence > initialAttackSequence
                && impact.targetHp < initialTargetHp;
            },
            prepared,
            { timeout },
          );
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
          const impact = await page.evaluate(
            ({ enemyId, targetId }) => (
              window.__ASHFALL_BATTLE_QA__.sampleEnemyNormalAttackRuntimeProof(enemyId, targetId)
            ),
            prepared,
          );
          result.ordinaryEnemyProofs.push({
            kind,
            visual: proof.visual,
            sequence,
            production: {
              initialTargetHp: prepared.initialTargetHp,
              warningTargetHp: proof.targetHp,
              impactTargetHp: impact.targetHp,
              attackSequence: impact.attackSequence,
            },
          });
        }

        for (const bossCase of [
          { kind: "mother", state: "warning" },
          { kind: "gairen", state: "low-hp" },
        ]) {
          const proof = await page.evaluate(
            (input) => window.__ASHFALL_BATTLE_QA__.prepareEnemyVfxProof(input),
            bossCase,
          );
          await waitForNextRender(page, await renderFrameCount(page));
          invariant(proof.visual?.boss === true, `${name}/${bossCase.kind}: boss visual role absent`);
          if (bossCase.state === "warning") {
            invariant(proof.visual.phase === "warning", `${name}/${bossCase.kind}: warning phase absent`);
          } else {
            invariant(proof.visual.critical === true, `${name}/${bossCase.kind}: low-HP phase absent`);
          }
          const sequence = await captureSequence(page, `${name}-boss-${bossCase.kind}-${bossCase.state}`, 3);
          invariant(sequence.uniqueFrames >= 2, `${name}/${bossCase.kind}: boss VFX frames collapsed`);
          result.bossProofs.push({ ...bossCase, visual: proof.visual, sequence });
        }

        for (const state of crawlerStates) {
          const proof = await page.evaluate(
            (crawlerState) => window.__ASHFALL_BATTLE_QA__.prepareCrawlerVfxProof(crawlerState),
            state,
          );
          await waitForNextRender(page, await renderFrameCount(page));
          if (state === "door") invariant(proof.visual.doorLit, `${name}: CRAWLER door light absent`);
          if (state === "firing") {
            invariant(proof.visual.firing, `${name}: CRAWLER firing state absent`);
            invariant(proof.shot?.weapon === "crawler", `${name}: CRAWLER shot absent`);
          }
          if (state === "hit") invariant(proof.visual.hit, `${name}: CRAWLER hit sparks absent`);
          if (state === "repair") invariant(proof.visual.repairing, `${name}: CRAWLER repair arcs absent`);
          if (state === "critical") {
            invariant(proof.visual.critical, `${name}: CRAWLER critical smoke absent`);
            invariant(proof.visual.smokePuffs >= 2, `${name}: power-save smoke became unreadable`);
          }
          if (state === "stored") invariant(proof.visual.stored, `${name}: CRAWLER weapon not stored`);
          const sequence = await captureSequence(
            page,
            `${name}-crawler-${state}`,
            state === "firing" ? 4 : 1,
          );
          if (state === "firing") {
            invariant(sequence.uniqueFrames >= 3, `${name}: CRAWLER firing frames collapsed`);
          }
          result.crawlerProofs.push({ state, visual: proof.visual, shot: proof.shot, sequence });
        }
        const crawlerRuntimePrepared = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.prepareCrawlerBarrageRuntimeProof(),
        );
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
        await page.waitForFunction(
          ({ targets }) => {
            const proof = window.__ASHFALL_BATTLE_QA__.sampleCrawlerBarrageRuntimeProof();
            const initialHp = new Map(targets.map(({ id, initialHp: hp }) => [id, hp]));
            return proof.ability.damageTriggered === true
              && proof.shots.length === targets.length
              && proof.pendingHits.length === targets.length
              && proof.targets.every(({ id, hp, flash }) => (
                hp === initialHp.get(id) && flash === 0
              ));
          },
          crawlerRuntimePrepared,
          { timeout },
        );
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
        const crawlerInFlight = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.sampleCrawlerBarrageRuntimeProof(),
        );
        invariant(
          crawlerInFlight.shots.every(({ sourceId, targetId }) => (
            sourceId === 0
              && crawlerRuntimePrepared.targets.some(({ id }) => id === targetId)
          )),
          `${name}: CRAWLER production target identity drift`,
        );
        const crawlerRuntimeSequence = await captureSequence(
          page,
          `${name}-crawler-production-in-flight`,
          1,
        );
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
        await page.waitForFunction(
          ({ targets }) => {
            const proof = window.__ASHFALL_BATTLE_QA__.sampleCrawlerBarrageRuntimeProof();
            const initialHp = new Map(targets.map(({ id, initialHp: hp }) => [id, hp]));
            return proof.pendingHits.length === 0
              && proof.targets.every(({ id, hp }) => hp < initialHp.get(id));
          },
          crawlerRuntimePrepared,
          { timeout },
        );
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));
        const crawlerImpact = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.sampleCrawlerBarrageRuntimeProof(),
        );
        result.crawlerRuntimeProof = {
          targets: crawlerRuntimePrepared.targets,
          inFlight: crawlerInFlight,
          impact: crawlerImpact,
          sequence: crawlerRuntimeSequence,
        };
        const distinctStateFrames = {
          projectiles: new Set(
            result.projectileProofs.map(({ sequence }) => sequence.hashes[0]),
          ).size,
          ordinaryEnemies: new Set(
            result.ordinaryEnemyProofs.map(({ sequence }) => sequence.hashes[0]),
          ).size,
          bosses: new Set(
            result.bossProofs.map(({ sequence }) => sequence.hashes[0]),
          ).size,
          crawler: new Set(
            result.crawlerProofs.map(({ sequence }) => sequence.hashes[0]),
          ).size,
        };
        invariant(
          distinctStateFrames.projectiles === projectileKinds.length,
          `${name}: projectile state captures collapsed`,
        );
        invariant(
          distinctStateFrames.ordinaryEnemies === ordinaryEnemyKinds.length,
          `${name}: ordinary enemy state captures collapsed`,
        );
        invariant(
          distinctStateFrames.bosses === result.bossProofs.length,
          `${name}: boss state captures collapsed`,
        );
        invariant(
          distinctStateFrames.crawler === crawlerStates.length,
          `${name}: CRAWLER state captures collapsed`,
        );

        const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        const performance = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot(),
        );
        const dimensions = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }));
        invariant(snapshot.geometry.offFloorCount === 0, `${name}: off-floor combatant`);
        invariant(snapshot.geometry.debugGeometryRendered === false, `${name}: debug geometry leaked`);
        invariant(dimensions.width <= viewport.width, `${name}: horizontal overflow`);
        invariant(dimensions.height <= viewport.height, `${name}: vertical overflow`);
        invariant(
          performance.graphicsProfile.requestedMode === quality,
          `${name}: quality mode mismatch`,
        );
        if (quality === "power-save") {
          invariant(
            performance.graphicsProfile.resolvedMode === "power-save"
              && performance.graphicsProfile.effectDensity === .48,
            `${name}: power-save profile mismatch`,
          );
        }
        assertDiagnostics(diagnostics, name);
        Object.assign(result, {
          status: "passed",
          quality: performance.graphicsProfile,
          dimensions,
          distinctStateFrames,
          debugGeometryRendered: snapshot.geometry.debugGeometryRendered,
          diagnostics,
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
        try {
          result.failureSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
          );
        } catch {
          // Navigation can fail before the local-only bridge is ready.
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
  baseUrl: String(baseUrl),
  generatedAt: new Date().toISOString(),
  engines,
  viewports,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  projectileKinds,
  ordinaryEnemyKinds,
  crawlerStates,
  productionProjectileTransactions: results.reduce(
    (total, result) => total + result.projectileProofs.length,
    0,
  ),
  productionCrawlerTransactions: results.filter(
    ({ crawlerRuntimeProof }) => Boolean(crawlerRuntimeProof),
  ).length,
  continuousSequences: results.reduce((total, result) => (
    total
    + result.projectileProofs.filter(({ sequence }) => sequence?.uniqueFrames >= 3).length
    + result.bossProofs.filter(({ sequence }) => sequence?.uniqueFrames >= 2).length
    + result.crawlerProofs.filter(({ sequence }) => sequence?.uniqueFrames >= 3).length
  ), 0),
  diagnostics: {
    consoleErrors: results.reduce((total, result) => total + (result.diagnostics?.consoleErrors.length ?? 0), 0),
    pageErrors: results.reduce((total, result) => total + (result.diagnostics?.pageErrors.length ?? 0), 0),
    requestFailures: results.reduce((total, result) => total + (result.diagnostics?.requestFailures.length ?? 0), 0),
    httpErrors: results.reduce((total, result) => total + (result.diagnostics?.httpErrors.length ?? 0), 0),
  },
  results,
};
const reportPath = path.join(evidenceDir, "summary.json");
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...summary,
  results: summary.results.map(({ name, status, quality, error }) => ({
    name,
    status,
    quality: quality?.resolvedMode,
    error,
  })),
}, null, 2));
if (summary.failed > 0) {
  throw new Error(`Version 0.9.5 enemy VFX browser smoke failed ${summary.failed}/${summary.total}; see ${reportPath}`);
}
