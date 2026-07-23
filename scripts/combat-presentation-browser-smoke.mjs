import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.COMBAT_PRESENTATION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Combat presentation QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.COMBAT_PRESENTATION_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = engines.filter((engine) => !browserTypes[engine]);
if (unknownEngines.length > 0) {
  throw new Error(`Unknown COMBAT_PRESENTATION_QA_ENGINES: ${unknownEngines.join(", ")}`);
}

const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(
  process.env.COMBAT_PRESENTATION_QA_EVIDENCE_DIR ?? "outputs/combat-presentation-browser-smoke",
);
const timeout = Math.max(8_000, Number(process.env.COMBAT_PRESENTATION_QA_TIMEOUT_MS) || 24_000);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl(stage = 3) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: String(stage),
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
    warnings: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    if (message.type() === "warning") diagnostics.warnings.push(message.text());
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

function normalizedDiagnostics(diagnostics) {
  return {
    ...diagnostics,
    warnings: diagnostics.warnings.filter(
      (warning) => !warning.includes("was preloaded using link preload but not used"),
    ),
  };
}

async function runBurstProof(page, targetKind, proofTimeout) {
  return page.evaluate(async ({ targetKind: proofTargetKind, proofTimeout: timeoutMs }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const prepared = bridge?.prepareMachineGunBurstProof?.(proofTargetKind);
    if (!prepared) throw new Error(`machine-gun ${proofTargetKind} proof fixture unavailable`);
    const shotIndexes = new Set();
    const shotTimings = {};
    const pendingIndexes = new Set();
    const hpSamples = [{ at: 0, hp: prepared.initialTargetHp }];
    const startedAt = performance.now();
    let lastHp = prepared.initialTargetHp;
    let peakConcurrentShots = 0;
    let finalSnapshot = null;

    await new Promise((resolve, reject) => {
      const sample = () => {
        const snapshot = bridge.getSnapshot();
        const elapsed = performance.now() - startedAt;
        const attacks = snapshot.attackIdentity.filter(
          (attack) => attack.sourceId === prepared.gunnerId && attack.weapon === "gunner",
        );
        peakConcurrentShots = Math.max(peakConcurrentShots, attacks.length);
        for (const attack of attacks) {
          if (Number.isInteger(attack.shotIndex)) {
            shotIndexes.add(attack.shotIndex);
            shotTimings[attack.shotIndex] ??= elapsed;
          }
          if (!attack.casing || !(attack.recoil > 0) || !(attack.hitStopSeconds > 0)) {
            reject(new Error(`unsynchronized shot metadata: ${JSON.stringify(attack)}`));
            return;
          }
        }
        for (const pending of snapshot.pendingWeaponHits.filter(
          (hit) => hit.sourceId === prepared.gunnerId
            && hit.targetKind === prepared.targetKind
            && hit.targetId === prepared.targetId,
        )) {
          pendingIndexes.add(pending.shotIndex);
        }
        const target = prepared.targetKind === "enemy-base"
          ? null
          : snapshot.fighters.find((fighter) => fighter.id === prepared.targetId);
        if (prepared.targetKind === "fighter" && !target) {
          reject(new Error("machine-gun target disappeared"));
          return;
        }
        const currentHp = target?.hp ?? snapshot.barricadeHp;
        if (currentHp !== lastHp) {
          hpSamples.push({ at: elapsed, hp: currentHp, damage: lastHp - currentHp });
          lastHp = currentHp;
        }
        finalSnapshot = snapshot;
        if (shotIndexes.size === 3 && hpSamples.length >= 4) {
          resolve();
          return;
        }
        if (elapsed >= timeoutMs) {
          reject(new Error(`burst proof timed out: ${JSON.stringify({
            targetKind: prepared.targetKind,
            shotIndexes: [...shotIndexes],
            pendingIndexes: [...pendingIndexes],
            hpSamples,
          })}`));
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    return {
      ...prepared,
      shotIndexes: [...shotIndexes].sort((left, right) => left - right),
      shotTimings,
      pendingIndexes: [...pendingIndexes].sort((left, right) => left - right),
      hpSamples,
      totalDamage: prepared.initialTargetHp - lastHp,
      peakConcurrentShots,
      pendingAfterProof: finalSnapshot.pendingWeaponHits.filter(
        (hit) => hit.sourceId === prepared.gunnerId,
      ).length,
      viewportId: finalSnapshot.geometry.viewportId,
    };
  }, { targetKind, proofTimeout });
}

function assertBurstProof(proof, viewport) {
  invariant(JSON.stringify(proof.shotIndexes) === "[0,1,2]", `shot indexes: ${JSON.stringify(proof.shotIndexes)}`);
  invariant(proof.pendingIndexes.includes(1) && proof.pendingIndexes.includes(2),
    `pending rounds not observed: ${JSON.stringify(proof.pendingIndexes)}`);
  invariant(proof.hpSamples.length >= 4, `damage was not split into three events: ${JSON.stringify(proof.hpSamples)}`);
  invariant(Math.abs(proof.totalDamage - proof.expectedDamage) < .001,
    `damage total ${proof.totalDamage} did not equal ${proof.expectedDamage}`);
  invariant(proof.peakConcurrentShots >= 3, `burst never rendered three concurrent projectiles: ${proof.peakConcurrentShots}`);
  for (let index = 0; index < 3; index += 1) {
    invariant(
      proof.hpSamples[index + 1].at - proof.shotTimings[index] >= 20,
      `round ${index} applied before visible travel: ${JSON.stringify({
        muzzleAt: proof.shotTimings[index],
        damageAt: proof.hpSamples[index + 1].at,
      })}`,
    );
  }
  invariant(proof.viewportId === `${viewport.width}x${viewport.height}`,
    `viewport geometry mismatch: ${proof.viewportId}`);
}

for (const engine of engines) {
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }

  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = {
        engine,
        viewport,
        url: caseUrl(),
        status: "failed",
      };
      try {
        const response = await page.goto(result.url, { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
            return snapshot?.screen === "battle"
              && snapshot.running === true;
          },
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => {
            const root = document.documentElement;
            return root.dataset.assetResidentScope === "all-local-qa"
              && Number(root.dataset.assetResidentSprites) >= 25
              && Number(root.dataset.assetResidentBackgrounds) >= 1;
          },
          null,
          { timeout },
        );
        const assetEvidence = await page.evaluate(() => ({
          scope: document.documentElement.dataset.assetResidentScope,
          sprites: Number(document.documentElement.dataset.assetResidentSprites),
          backgrounds: Number(document.documentElement.dataset.assetResidentBackgrounds),
        }));
        const fighterProof = await runBurstProof(page, "fighter", Math.min(timeout, 8_000));
        assertBurstProof(fighterProof, viewport);
        await page.screenshot({ path: path.join(evidenceDir, `${name}-fighter.png`) });
        const baseProof = await runBurstProof(page, "enemy-base", Math.min(timeout, 8_000));
        assertBurstProof(baseProof, viewport);
        const pierceProof = await runBurstProof(page, "pierce", Math.min(timeout, 8_000));
        assertBurstProof(pierceProof, viewport);
        await page.screenshot({ path: path.join(evidenceDir, `${name}-pierce.png`) });

        const stageSixResponse = await page.goto(caseUrl(6), { waitUntil: "domcontentloaded", timeout });
        invariant(stageSixResponse?.ok(), `Stage 6 navigation failed: HTTP ${stageSixResponse?.status()}`);
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
            return snapshot?.screen === "battle"
              && snapshot.running === true
              && snapshot.stageId === "stage-nishijin-station-tunnel-seal";
          },
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => {
            const root = document.documentElement;
            return root.dataset.assetResidentScope === "all-local-qa"
              && Number(root.dataset.assetResidentSprites) >= 25
              && Number(root.dataset.assetResidentBackgrounds) >= 1;
          },
          null,
          { timeout },
        );
        const gateEaterProof = await runBurstProof(page, "gate-eater", Math.min(timeout, 8_000));
        assertBurstProof(gateEaterProof, viewport);
        const canvasEvidence = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const context = canvas?.getContext("2d", { willReadFrequently: true });
          if (!canvas || !context) return null;
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = new Set();
          let nonDark = 0;
          let sampled = 0;
          for (let index = 0; index < pixels.length; index += 320) {
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const alpha = pixels[index + 3];
            colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 4}`);
            if (alpha > 0 && red + green + blue > 45) nonDark += 1;
            sampled += 1;
          }
          return { sampled, uniqueColorBins: colors.size, nonDarkRatio: nonDark / sampled };
        });
        // WebKit quantizes the 844x340 canvas more aggressively than Chromium.
        // Eighty bins still rejects the prior blank/diagnostic frame while the
        // independent non-dark and resident-asset gates verify real battle art.
        invariant(canvasEvidence?.uniqueColorBins > 80, `production art color diversity missing: ${JSON.stringify(canvasEvidence)}`);
        invariant(canvasEvidence.nonDarkRatio > .18, `battle canvas remained blank/dark: ${JSON.stringify(canvasEvidence)}`);
        const cleanDiagnostics = normalizedDiagnostics(diagnostics);
        for (const [kind, entries] of Object.entries(cleanDiagnostics)) {
          invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
        }
        await page.screenshot({ path: path.join(evidenceDir, `${name}-enemy-base.png`) });
        Object.assign(result, {
          status: "passed",
          fighterProof,
          baseProof,
          pierceProof,
          gateEaterProof,
          assetEvidence,
          canvasEvidence,
          diagnostics: cleanDiagnostics,
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = normalizedDiagnostics(diagnostics);
        try {
          result.failureSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
          );
        } catch {
          // Navigation can fail before the local QA bridge exists.
        }
        try {
          await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
        } catch {
          // The page may fail before rendering.
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
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  throw new Error(
    `Combat presentation browser smoke failed ${summary.failed}/${results.length}; see ${path.join(evidenceDir, "summary.json")}`,
  );
}
