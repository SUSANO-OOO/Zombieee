import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.MAYO_QA_BASE_URL) {
  throw new Error("MAYO_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.MAYO_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Mayo QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.MAYO_QA_ENGINES ?? "chromium,webkit").split(",").map((value) => value.trim()).filter(Boolean);
const viewports = [{ width: 844, height: 390 }, { width: 844, height: 340 }];
const evidenceDir = path.resolve(process.env.MAYO_QA_EVIDENCE_DIR ?? "outputs/mayo-vertical-slice-browser-smoke");
const timeout = Math.max(15_000, Number(process.env.MAYO_QA_TIMEOUT_MS) || 35_000);
const audioCueIds = [
  "weapon-mayo-bite",
  "ability-mayo-feral-start",
  "ability-mayo-feral-rush",
  "ability-mayo-feral-end",
  "voice-mayo-deploy",
  "voice-mayo-attack",
  "voice-mayo-hurt",
  "voice-mayo-retreat",
];
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
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

async function enterBattle(page) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ qa: "mayo", safe: "iphone-landscape" }).toString();
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
    await page.waitForFunction(() => Boolean(document.querySelector("canvas.battlefield.active")) || Boolean(document.querySelector(".event-screen")));
    if (await page.locator("canvas.battlefield.active").isVisible().catch(() => false)) return;
    await page.locator(".event-screen").getByRole("button", { name: "スキップ", exact: true }).click();
    await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
  }
  throw new Error("Mayo battlefield was not reached");
}

async function decodeAudio(page) {
  return page.evaluate(async (cueIds) => {
    const bridge = window.__ASHFALL_AUDIO_QA__;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    const context = AudioContextCtor ? new AudioContextCtor() : null;
    const failures = [];
    let fetched = 0;
    let decoded = 0;
    try {
      for (const cueId of cueIds) {
        const source = bridge.assets.find(({ id }) => id === cueId)?.sources?.[0];
        if (!source) {
          failures.push(`${cueId}: missing`);
          continue;
        }
        try {
          const response = await fetch(source.src, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = new Uint8Array(await response.arrayBuffer());
          const signature = String.fromCharCode(...bytes.slice(0, 4));
          const wave = String.fromCharCode(...bytes.slice(8, 12));
          if (signature !== "RIFF" || wave !== "WAVE" || bytes.length <= 44) throw new Error("invalid WAV payload");
          fetched += 1;
          if (context) {
            const buffer = await context.decodeAudioData(bytes.buffer.slice(0));
            if (!(buffer.duration > 0) || buffer.numberOfChannels < 1) throw new Error("invalid decoded buffer");
            decoded += 1;
          }
        } catch (error) {
          failures.push(`${source.src}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      if (context) await context.close();
    }
    return { supported: Boolean(context), fetched, decoded, requested: cueIds.length, failures };
  }, audioCueIds);
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unknown MAYO_QA_ENGINES value: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(timeout);
      const diagnostics = diagnosticsFor(page);
      await enterBattle(page);
      await page.waitForFunction(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const mayo = snapshot?.fighters?.find(({ kind }) => kind === "mayo-chan");
        return mayo?.combatReady === true && mayo.attackSequence >= 1;
      });
      invariant(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.stabilizeMayoProof()), `${engine}/${viewport.height}: proof stabilization failed`);
      await page.waitForFunction(() => document.querySelectorAll(".manual-ability-ready[data-ability-kind='mayo-chan']").length === 1);

      const ready = await page.evaluate(() => {
        const button = document.querySelector(".manual-ability-ready[data-ability-kind='mayo-chan']");
        const icon = button?.querySelector(".manual-ability-ready-icon");
        const canvas = document.querySelector("canvas.battlefield");
        return {
          button: button?.getBoundingClientRect().toJSON() ?? null,
          canvas: canvas?.getBoundingClientRect().toJSON() ?? null,
          iconBackground: icon ? getComputedStyle(icon).backgroundImage : "",
          snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
        };
      });
      invariant(ready.button && ready.canvas, `${engine}/${viewport.height}: ready geometry missing`);
      invariant(ready.button.width >= 44 && ready.button.height >= 44, `${engine}/${viewport.height}: ready target below 44px`);
      invariant(ready.button.left >= ready.canvas.left + 44 && ready.button.right <= ready.canvas.right - 44, `${engine}/${viewport.height}: ready icon breached horizontal safe area`);
      invariant(ready.button.top >= ready.canvas.top && ready.button.bottom <= ready.canvas.bottom - 21, `${engine}/${viewport.height}: ready icon breached vertical safe area`);
      invariant(ready.iconBackground.includes("mayo-chan-feral-ready-r1.svg"), `${engine}/${viewport.height}: dedicated icon not connected`);
      invariant(ready.snapshot.geometry.offFloorCount === 0, `${engine}/${viewport.height}: initial grounding failed`);

      const assetProof = await page.evaluate(async () => Promise.all([
        "/art/v090/characters/mayo-chan-battle-r1.png",
        "/art/v090/characters/mayo-chan-feral-battle-r1.png",
        "/art/v090/characters/portraits/mayo-chan-event-portrait-r1.webp",
        "/art/v090/characters/cards/mayo-chan-formation-card-r1.webp",
      ].map((src) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ src, width: 0, height: 0 });
        image.src = src;
      }))));
      invariant(assetProof.every(({ width, height }) => width > 0 && height > 0), `${engine}/${viewport.height}: visual asset decode failed`);

      const baseName = `${engine}-${viewport.width}x${viewport.height}`;
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-ready.png`) });
      await page.getByRole("button", { name: "マヨちゃん：凶暴マヨ" }).click();
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
        .some(({ kind, manualAbility }) => kind === "mayo-chan" && manualAbility?.phase === "feral"));
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
        .some(({ kind, hp, maxHp }) => kind === "mayo-chan" && hp > 0 && hp < maxHp));
      const feral = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const feralMayo = feral.fighters.find(({ kind }) => kind === "mayo-chan");
      invariant(feralMayo.hp > 0 && feralMayo.hp < feralMayo.maxHp, `${engine}/${viewport.height}: feral HP drain missing`);
      invariant(feral.manualAbilityVfx.some(({ kind }) => kind === "mayo-chan"), `${engine}/${viewport.height}: feral VFX missing`);
      invariant(await page.locator(".manual-ability-ready[data-ability-kind='mayo-chan']").count() === 0, `${engine}/${viewport.height}: cooldown icon remained overhead`);
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-feral.png`) });

      await page.waitForFunction(() => !window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(({ kind }) => kind === "mayo-chan"), null, { timeout: 12_000 });
      const abilityRetreat = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      invariant(!abilityRetreat.corpses.some(({ kind }) => kind === "mayo-chan"), `${engine}/${viewport.height}: ability retreat created a corpse`);

      invariant(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.resetMayoProof()), `${engine}/${viewport.height}: injury proof reset failed`);
      invariant(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.forceMayoIncapacitation()), `${engine}/${viewport.height}: injury could not be forced`);
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
        .some(({ kind, mayoRetreat }) => kind === "mayo-chan" && mayoRetreat?.reason === "injury"));
      const retreatDamageProof = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.probeMayoRetreatDamage());
      invariant(retreatDamageProof?.beforeHp > 0, `${engine}/${viewport.height}: retreat damage proof missing`);
      invariant(retreatDamageProof.afterHp === retreatDamageProof.beforeHp, `${engine}/${viewport.height}: retreat HP changed under hazard/boss damage`);
      invariant(retreatDamageProof.targetable === false, `${engine}/${viewport.height}: retreat stayed targetable`);
      invariant(retreatDamageProof.hazardDamage === 0 && retreatDamageProof.bossAreaDamage === 0, `${engine}/${viewport.height}: retreat accepted hazard/boss damage`);
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-injury-retreat.png`) });
      await page.waitForFunction(() => !window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(({ kind }) => kind === "mayo-chan"), null, { timeout: 8_000 });
      const injuryRetreat = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      invariant(!injuryRetreat.corpses.some(({ kind }) => kind === "mayo-chan"), `${engine}/${viewport.height}: injury retreat created a corpse`);

      const audio = await decodeAudio(page);
      invariant(audio.fetched === audio.requested && audio.failures.length === 0, `${engine}/${viewport.height}: audio fetch/WAV validation failed ${JSON.stringify(audio)}`);
      invariant(!audio.supported || audio.decoded === audio.requested, `${engine}/${viewport.height}: audio decode failed ${JSON.stringify(audio)}`);
      invariant(diagnostics.consoleErrors.length === 0, `${engine}/${viewport.height}: console errors ${JSON.stringify(diagnostics.consoleErrors)}`);
      invariant(diagnostics.pageErrors.length === 0, `${engine}/${viewport.height}: page errors ${JSON.stringify(diagnostics.pageErrors)}`);
      invariant(diagnostics.requestFailures.length === 0, `${engine}/${viewport.height}: request failures ${JSON.stringify(diagnostics.requestFailures)}`);
      invariant(diagnostics.httpErrors.length === 0, `${engine}/${viewport.height}: HTTP errors ${JSON.stringify(diagnostics.httpErrors)}`);

      results.push({ engine, viewport, ready, feralMayo, abilityRetreat, retreatDamageProof, injuryRetreat, assetProof, audio, diagnostics });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
console.log(`Mayo vertical slice browser smoke passed (${results.length} viewport/engine runs)`);
