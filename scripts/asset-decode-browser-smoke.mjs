import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const baseUrl = new URL(process.env.ASSET_DECODE_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Asset decode QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const evidenceDir = path.resolve(process.env.ASSET_DECODE_QA_EVIDENCE_DIR ?? "outputs/asset-decode-browser-smoke");
const timeout = Math.max(30_000, Number(process.env.ASSET_DECODE_QA_TIMEOUT_MS) || 180_000);
const browser = await playwright.chromium.launch({ headless: true });
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
let result;

await mkdir(evidenceDir, { recursive: true });
const buildIdentityAtStart = await productionBuildIdentity();
try {
  // This smoke measures the game's runtime decoders, not the PWA install gate.
  // Hide the PWA capability in this isolated harness so the full-pack gate is
  // covered by qa:v096-pwa while this test can reach the decoder bridge.
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    try { Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true }); } catch {}
    try { Object.defineProperty(window, "caches", { value: undefined, configurable: true }); } catch {}
  });
  const page = await context.newPage();
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
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "16",
    state: "start",
    decode: "assets",
  }).toString();
  await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
  await page.waitForFunction(
    () => ["passed", "failed"].includes(document.documentElement.dataset.assetDecodeStatus ?? ""),
    undefined,
    { timeout },
  );
  result = await page.evaluate(async () => {
    const root = document.documentElement.dataset;
    const bridge = window.__ASHFALL_AUDIO_QA__;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const OfflineAudioContextConstructor = window.OfflineAudioContext
      || window.webkitOfflineAudioContext;
    const level = (data) => {
      let peak = 0;
      let squareSum = 0;
      let clipSamples = 0;
      for (const value of data) {
        const magnitude = Math.abs(value);
        peak = Math.max(peak, magnitude);
        squareSum += value * value;
        if (magnitude >= 1) clipSamples += 1;
      }
      return {
        peakDb: 20 * Math.log10(Math.max(peak, 1e-12)),
        rmsDb: 20 * Math.log10(Math.max(Math.sqrt(squareSum / data.length), 1e-12)),
        clipSamples,
      };
    };
    const decode = async (context, source) => {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`${response.status} ${source}`);
      return context.decodeAudioData((await response.arrayBuffer()).slice(0));
    };
    const filterLevel = async (buffer, highpassHz, lowpassHz) => {
      const offline = new OfflineAudioContextConstructor(
        1,
        buffer.length,
        buffer.sampleRate,
      );
      const source = offline.createBufferSource();
      source.buffer = buffer;
      const highpass = offline.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = highpassHz;
      const lowpass = offline.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = lowpassHz;
      source.connect(highpass).connect(lowpass).connect(offline.destination);
      source.start();
      return level((await offline.startRendering()).getChannelData(0));
    };
    const meanAmplitudeDb = (values) => 20 * Math.log10(
      values.reduce((sum, value) => sum + (10 ** (value / 20)), 0) / values.length,
    );
    const meanPowerDb = (values) => 10 * Math.log10(
      values.reduce((sum, value) => sum + (10 ** (value / 10)), 0) / values.length,
    );
    const summarizeProfile = (assets, assetGain) => {
      const gainDb = 20 * Math.log10(assetGain);
      const source = {
        peakDb: meanAmplitudeDb(assets.map(({ peakDb }) => peakDb)),
        rmsDb: meanPowerDb(assets.map(({ rmsDb }) => rmsDb)),
        phoneBandRmsDb: meanPowerDb(assets.map(({ phoneBand }) => phoneBand.rmsDb)),
        presenceBandRmsDb: meanPowerDb(assets.map(({ presenceBand }) => presenceBand.rmsDb)),
      };
      return {
        source,
        runtime: Object.fromEntries(
          Object.entries(source).map(([key, value]) => [key, value + gainDb]),
        ),
      };
    };
    const relativeDelta = (subject, reference) => Object.fromEntries(
      Object.keys(subject).map((key) => [key, subject[key] - reference[key]]),
    );
    const audioContext = new AudioContextConstructor();
    const babaSources = [
      "/audio/v060/sfx/weapon-suppressed-pistol.mp3",
      "/audio/v060/sfx/weapon-suppressed-pistol.ogg",
    ];
    const babaDecoded = [];
    for (const source of babaSources) {
      const buffer = await decode(audioContext, source);
      babaDecoded.push({
        source,
        durationSeconds: buffer.duration,
        ...level(buffer.getChannelData(0)),
        phoneBand: await filterLevel(buffer, 200, 8_000),
        presenceBand: await filterLevel(buffer, 500, 5_000),
      });
    }
    const profileContracts = [
      {
        id: "babayaga",
        assetGain: .95,
        assetIds: ["weapon-suppressed-pistol"],
        sources: ["/audio/v060/sfx/weapon-suppressed-pistol.mp3"],
      },
      {
        id: "rifle",
        assetGain: .76,
        assetIds: ["weapon-rifle-01", "weapon-rifle-02"],
        sources: [
          "/audio/v060/sfx/weapon-rifle-01.mp3",
          "/audio/v060/sfx/weapon-rifle-02.mp3",
        ],
      },
      {
        id: "gunner",
        assetGain: .76,
        assetIds: ["weapon-gunner-01", "weapon-gunner-02"],
        sources: [
          "/audio/v060/sfx/weapon-gunner-01.mp3",
          "/audio/v060/sfx/weapon-gunner-02.mp3",
        ],
      },
      {
        id: "suppressed-carbine",
        assetGain: .70,
        assetIds: ["weapon-suppressed-carbine-01", "weapon-suppressed-carbine-02"],
        sources: [
          "/audio/v080/sfx/weapon-suppressed-carbine-01.mp3",
          "/audio/v080/sfx/weapon-suppressed-carbine-02.mp3",
        ],
      },
    ];
    const weaponProfiles = {};
    for (const profile of profileContracts) {
      const assets = [];
      for (const source of profile.sources) {
        const buffer = await decode(audioContext, source);
        assets.push({
          source,
          durationSeconds: buffer.duration,
          ...level(buffer.getChannelData(0)),
          phoneBand: await filterLevel(buffer, 200, 8_000),
          presenceBand: await filterLevel(buffer, 500, 5_000),
        });
      }
      weaponProfiles[profile.id] = {
        id: profile.id,
        category: "weapons",
        assetGain: profile.assetGain,
        assetIds: profile.assetIds,
        manifestCategories: profile.assetIds.map((assetId) => (
          bridge.assets.find(({ id }) => id === assetId)?.category ?? null
        )),
        assets,
        ...summarizeProfile(assets, profile.assetGain),
      };
    }
    const babaProfile = weaponProfiles.babayaga;
    const relativeWeaponComparisons = ["rifle", "gunner", "suppressed-carbine"].map((referenceId) => {
      const reference = weaponProfiles[referenceId];
      return {
        referenceId,
        sourceDeltaDb: relativeDelta(babaProfile.source, reference.source),
        runtimeDeltaDb: relativeDelta(babaProfile.runtime, reference.runtime),
      };
    });
    const shotBuffer = await decode(audioContext, babaSources[0]);
    const hitBuffer = await decode(
      audioContext,
      "/audio/v060/sfx/weapon-suppressed-hit.mp3",
    );
    const runtimeMixes = [];
    for (const settingsGain of [.8, 1]) {
      for (const pairCount of [1, 2, 5]) {
        const length = Math.ceil(audioContext.sampleRate * .55);
        const offline = new OfflineAudioContextConstructor(
          1,
          length,
          audioContext.sampleRate,
        );
        const compressor = offline.createDynamicsCompressor();
        compressor.threshold.value = -3;
        compressor.knee.value = 12;
        compressor.ratio.value = 8;
        compressor.attack.value = .003;
        compressor.release.value = .18;
        const master = offline.createGain();
        master.gain.value = .9;
        compressor.connect(master).connect(offline.destination);
        for (let index = 0; index < pairCount; index += 1) {
          const shot = offline.createBufferSource();
          const shotGain = offline.createGain();
          shot.buffer = shotBuffer;
          shotGain.gain.value = .95 * .82 * settingsGain;
          shot.connect(shotGain).connect(compressor);
          shot.start(index * .006);
          const hit = offline.createBufferSource();
          const hitGain = offline.createGain();
          hit.buffer = hitBuffer;
          hitGain.gain.value = .66 * .82 * settingsGain;
          hit.connect(hitGain).connect(compressor);
          hit.start(.045 + index * .006);
        }
        runtimeMixes.push({
          settingsGain,
          pairCount,
          ...level((await offline.startRendering()).getChannelData(0)),
        });
      }
    }
    await audioContext.close();
    const carbineAssets = bridge.assets.filter(({ id }) => id.startsWith("weapon-suppressed-carbine-"));
    const carbinePool = bridge.pools.find(({ id }) => id === "weapon-suppressed-carbine");
    const played = await bridge.play("weapon-suppressed-carbine", {
      priority: 90,
      dedupeKey: "v080-carbine-browser-smoke",
    });
    const babaPlayed = await bridge.play("weapon-suppressed-pistol", {
      priority: 90,
      dedupeKey: "v095-baba-browser-smoke",
    });
    const babaDuplicate = await bridge.play("weapon-suppressed-pistol", {
      priority: 90,
      dedupeKey: "v095-baba-browser-smoke",
    });
    return {
      status: root.assetDecodeStatus,
      audioRequested: Number(root.assetDecodeAudioRequested),
      audioDecoded: Number(root.assetDecodeAudioDecoded),
      portraitRequested: Number(root.assetDecodePortraitRequested),
      portraitDecoded: Number(root.assetDecodePortraitDecoded),
      imageRequested: Number(root.assetDecodeImageRequested),
      imageDecoded: Number(root.assetDecodeImageDecoded),
      failures: JSON.parse(root.assetDecodeFailures ?? "[]"),
      carbineAssets,
      carbinePool,
      carbinePlayed: Boolean(played),
      babaPlayed: Boolean(babaPlayed),
      babaDedupeMatched: babaPlayed === babaDuplicate,
      babaDecoded,
      weaponProfiles,
      relativeWeaponComparisons,
      relativeComparisonContract: {
        commonCategory: "weapons",
        globalBusAdjusted: false,
        sharedWeaponsBusCancelsFromRelativeDeltas: true,
        phoneBandHz: [200, 8_000],
        presenceBandHz: [500, 5_000],
      },
      runtimeMixes,
      diagnostics: bridge.getDiagnostics(),
    };
  });
  const comparisonByReference = Object.fromEntries(
    result.relativeWeaponComparisons.map((comparison) => [comparison.referenceId, comparison]),
  );
  const inRange = (value, minimum, maximum) => value >= minimum && value <= maximum;
  const relativeMetricsPass = Object.values(result.weaponProfiles).every((profile) => (
    profile.category === "weapons"
    && profile.assets.length === profile.assetIds.length
    && profile.manifestCategories.length === profile.assetIds.length
    && profile.manifestCategories.every((category) => category === "weapons")
    && profile.assets.every(({ clipSamples }) => clipSamples === 0)
  ))
    && result.relativeComparisonContract.globalBusAdjusted === false
    && result.relativeComparisonContract.sharedWeaponsBusCancelsFromRelativeDeltas === true
    && inRange(comparisonByReference.rifle.runtimeDeltaDb.peakDb, -2.5, .5)
    && inRange(comparisonByReference.rifle.runtimeDeltaDb.rmsDb, -.5, 2.5)
    && inRange(comparisonByReference.rifle.runtimeDeltaDb.phoneBandRmsDb, -1, 1.5)
    && inRange(comparisonByReference.rifle.runtimeDeltaDb.presenceBandRmsDb, -2.5, 0)
    && inRange(comparisonByReference.gunner.runtimeDeltaDb.peakDb, -.75, .5)
    && inRange(comparisonByReference.gunner.runtimeDeltaDb.rmsDb, -.75, .5)
    && inRange(comparisonByReference.gunner.runtimeDeltaDb.phoneBandRmsDb, -1.5, 0)
    && inRange(comparisonByReference.gunner.runtimeDeltaDb.presenceBandRmsDb, -3, -1.5)
    && inRange(comparisonByReference["suppressed-carbine"].runtimeDeltaDb.peakDb, -1, 2)
    && inRange(comparisonByReference["suppressed-carbine"].runtimeDeltaDb.rmsDb, 0, 3)
    && inRange(comparisonByReference["suppressed-carbine"].runtimeDeltaDb.phoneBandRmsDb, 3.5, 8)
    && inRange(comparisonByReference["suppressed-carbine"].runtimeDeltaDb.presenceBandRmsDb, 3.5, 8);
  const babaMetricsPass = result.babaDecoded.length === 2
    && result.babaDecoded.every((metrics) => (
      metrics.peakDb >= -3.1
      && metrics.peakDb <= -.75
      && metrics.rmsDb >= -18.8
      && metrics.rmsDb <= -16
      && metrics.phoneBand.rmsDb >= -19
      && metrics.phoneBand.rmsDb <= -18.3
      && metrics.presenceBand.rmsDb >= -20
      && metrics.presenceBand.rmsDb <= -18.5
      && metrics.clipSamples === 0
    ))
    && Math.abs(result.babaDecoded[0].peakDb - result.babaDecoded[1].peakDb) <= 1
    && Math.abs(result.babaDecoded[0].phoneBand.rmsDb - result.babaDecoded[1].phoneBand.rmsDb) <= 1
    && result.runtimeMixes.every(({ peakDb, clipSamples }) => peakDb <= -1 && clipSamples === 0);
  result.babaMetricsPass = babaMetricsPass;
  result.relativeMetricsPass = relativeMetricsPass;
  if (result.status !== "passed"
    || result.audioDecoded !== result.audioRequested
    || result.portraitDecoded !== result.portraitRequested
    || result.imageDecoded !== result.imageRequested
    || result.failures.length > 0
    || result.carbineAssets.length !== 2
    || result.carbinePool?.assetIds?.length !== 2
    || !result.carbinePlayed
    || !result.babaPlayed
    || !result.babaDedupeMatched
    || !babaMetricsPass
    || !relativeMetricsPass
    || Object.values(diagnostics).some((entries) => entries.length > 0)) {
    throw new Error(`Asset decode QA failed: ${JSON.stringify({ result, diagnostics })}`);
  }
  await context.close();
} finally {
  await browser.close();
}

const buildIdentityAtEnd = await productionBuildIdentity();
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  engine: "chromium",
  buildIdentity: buildIdentityAtEnd,
  buildIdentityAtStart,
  buildIdentityStable: (
    buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256
  ),
  result,
  diagnostics,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (!summary.buildIdentityStable) {
  throw new Error("Production dist changed while asset decode QA was running");
}
