import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { RELEASE_TITLE, RELEASE_LABEL, RELEASE_VERSION } from "../app/releaseIdentity.js";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_BOSSES } from "../app/v100Registry.js";
import { beginV100Survival, checkpointV100Survival } from "../app/v100SurvivalTransactions.js";
import { beginSurvivalWave, completeSurvivalWave, SURVIVAL_UPGRADE_BY_ID } from "../app/survival.js";
import { survivalWaveReward } from "../app/survivalBattleRuntime.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL); assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const out = path.resolve(process.env.V100_RELEASE_METADATA_EVIDENCE_DIR ?? "outputs/v100-release-metadata"); await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const report = { host: process.platform, node: process.version, build: await productionBuildIdentity(), fullAcceptance: false,
  scope: "Synthetic paid Survival checkpoint for Japanese upgrade/result labels and V1 metadata only. Audio disabled. Not actual wave completion, natural progression, native audio, official root-entry or public release acceptance.", cases: [] };
report.sources = await Promise.all(["app/releaseIdentity.js", "app/layout.tsx", "app/AshfallGame.tsx", "app/V100Campaign.tsx", "public/manifest.webmanifest", "public/asset-manifest.json", "scripts/v100-release-metadata-browser-smoke.mjs"].map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
let seed = createDefaultV100Save({ playerName: "表示監査", settings: { bgmEnabled: false, sfxEnabled: false } });
seed.campaignStarted = true; seed.flowState.phase = "map"; seed.caps = 2000; seed.receipts = [V100_BOSSES[0].firstDefeatReceipt]; seed.formationSlots = Array(7).fill("unit-paisen");
seed = beginV100Survival(seed, { runId: "v100-survival:912b0c95-57bf-4dab-89fa-266ea4de89e2" }).save;
let run = seed.survival.active.run;
for (let wave = 1; wave <= 5; wave++) { run = beginSurvivalWave(run); if (wave === 5) run = { ...run, lastBossKind: "takuya" }; run = completeSurvivalWave(run, { kills: 3, bossKills: wave === 5 ? 1 : 0, crawlerHp: 570, battleSeconds: 10, enemyDefeatsByKind: wave === 5 ? { takuya: 1 } : { walker: 3 }, reward: survivalWaveReward(wave) }); }
seed = checkpointV100Survival(seed, run).save;
assert.ok(seed.survival.active.run.pendingUpgradeChoices.some(id => SURVIVAL_UPGRADE_BY_ID[id].category === "crawler-repair"));
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
async function action(page, fn) { await ready(page); const before = (await saved(page)).revision; await fn(); await page.waitForFunction(({ key, before }) => JSON.parse(localStorage.getItem(key)).revision > before && document.documentElement.dataset.pwaSaveMutationPending === "false", { key, before }); }
async function shot(page, record, label) { const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, animations: "disabled", timeout: 45000 }); record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
try {
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch();
    try {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }]) {
        const record = { name: `${engine}-${viewport.width}x${viewport.height}`, engine, version: browser.version(), viewport, status: "running", images: [], errors: [] }; report.cases.push(record);
        const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
        await context.addInitScript(({ key, seed, origin }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, seed); }, { key, seed: serializeV100Save(seed), origin: origin.origin });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        page.on("console", m => { if (m.type() === "error") record.errors.push({ type: "console", message: m.text() }); });
        page.on("pageerror", e => record.errors.push({ type: "page", message: String(e) }));
        page.on("requestfailed", r => record.errors.push({ type: "request", url: r.url(), failure: r.failure() }));
        page.on("response", r => { if (r.status() >= 400) record.errors.push({ type: "http", url: r.url(), status: r.status() }); });
        try {
          await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector('[role=dialog][aria-label="ゲームデータの準備"] button'));
          const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click(); await ready(page);
          assert.equal(await page.title(), RELEASE_TITLE);
          record.metadata = await page.evaluate(async () => ({ app: await (await fetch("/manifest.webmanifest")).json(), assets: await (await fetch("/asset-manifest.json")).json() }));
          assert.equal(record.metadata.assets.version, RELEASE_VERSION); assert.equal(record.metadata.assets.assets.length, 459);
          assert.match(record.metadata.app.description, /装甲車両/u); assert.doesNotMatch(record.metadata.app.description, /CRAWLER|移動拠点/u);
          await page.getByRole("dialog", { name: "ボス撃破強化選択", exact: true }).waitFor();
          const repair = page.locator(".survival-upgrade-choices button").filter({ hasText: "装甲車両応急修理" }); await repair.waitFor();
          assert.equal(await repair.locator("small").innerText(), "装甲車両の修理");
          record.upgradeCopy = await page.locator(".survival-upgrade-choices").innerText(); assert.doesNotMatch(record.upgradeCopy, /移動拠点|CRAWLER-REPAIR|BOSS-DAMAGE/u);
          await shot(page, record, "upgrade"); await action(page, () => repair.click());
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot().paused === false);
          await page.getByRole("button", { name: "一時停止", exact: true }).click(); await page.getByRole("button", { name: "エリアマップへ撤退", exact: true }).click();
          await action(page, () => page.getByRole("button", { name: "実行する", exact: true }).click());
          await page.getByRole("region", { name: "防衛継続作戦の戦果", exact: true }).waitFor();
          assert.equal(await page.locator(".v100-topbar h1").innerText(), "戦果"); assert.ok((await page.locator(".v100-save-meta").innerText()).includes(RELEASE_LABEL));
          assert.equal(await page.title(), RELEASE_TITLE); record.result = (await saved(page)).survival.lastResult;
          await shot(page, record, "result"); assert.deepEqual(record.errors, []); record.status = "passed-metadata-and-copy-audio-disabled";
          console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
        } catch (error) { record.status = "failed"; record.error = String(error); record.stack = error.stack; await shot(page, record, "failure").catch(() => {}); throw error; }
        finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
} finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
