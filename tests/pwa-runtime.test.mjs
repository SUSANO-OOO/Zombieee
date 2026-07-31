import assert from "node:assert/strict";
import test from "node:test";

import { ASSET_CATEGORY_LABELS, ASSET_MANIFEST_SCHEMA } from "../app/pwaAssetManifest.js";
import {
  canPlayOffline,
  createAssetFetcher,
  derivePwaPhase,
  describeDownloadOffer,
  describeInstall,
  describeInstallGuidance,
  describeProgress,
  fetchPublishedManifest,
  isPwaSupported,
  isStandaloneDisplay,
  registerServiceWorker,
} from "../app/pwaRuntime.js";

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;
const asset = (path, seed, overrides = {}) => ({
  path, bytes: 1048576, hash: hashOf(seed), pack: "units", category: "unit", criticality: "critical", ...overrides,
});
const manifest = (assets) => ({
  schema: ASSET_MANIFEST_SCHEMA, version: "0.9.6", releaseSha: "a0dd0b3", assets,
});

const plan = (satisfied, pending) => ({
  satisfied, pending, complete: pending.length === 0, pendingCount: pending.length,
  pendingBytes: pending.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
});

test("an unsupported browser never enters an install flow", () => {
  assert.equal(derivePwaPhase({ supported: false, standalone: true }), "unsupported");
});

test("an ordinary browser tab is never gated behind the install", () => {
  // No plan yet, and a device that already holds the pack: both go straight to
  // the game. The offer is only for a tab that would actually download.
  assert.equal(derivePwaPhase({ supported: true, standalone: false }), "browser");
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: false,
      installedManifest: manifest([asset("/a", 1)]),
      installPlan: plan([asset("/a", 1)], []),
    }),
    "browser",
  );
});

test("a first browser visit is offered the download before the title", () => {
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: false,
      installPlan: plan([], [asset("/a", 1), asset("/b", 2)]),
    }),
    "download-offer",
  );
});

test("declining the download plays straight from the network", () => {
  // The offer must not become a wall: dismissing it renders the game.
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: false,
      installPlan: plan([], [asset("/a", 1)]),
      offerDismissed: true,
    }),
    "browser",
  );
});

test("a finished browser download reports completion before starting the game", () => {
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: false,
      downloadState: "complete",
      installPlan: plan([asset("/a", 1)], []),
    }),
    "download-complete",
  );
});

test("the download offer counts and sizes come from the manifest and the plan", () => {
  const assets = [asset("/a", 1), asset("/b", 2), asset("/c", 3)];
  const offer = describeDownloadOffer(plan([], assets), manifest(assets), null);
  assert.equal(offer.totalAssets, 3);
  assert.equal(offer.pendingCount, 3);
  assert.equal(offer.pendingBytes, 3 * 1048576);
  assert.equal(offer.resuming, false);
  assert.match(offer.actionLabel, /ゲームをダウンロード/);
  assert.match(offer.lines[0], /3件/);
  assert.match(offer.lines[0], /3\.0MB/);
  // The offer must say plainly that nothing is fetched until it is accepted.
  assert.match(offer.wifiHint, /開始するまで始まりません/);
});

test("a partly downloaded pack offers to resume and never recounts what is held", () => {
  const assets = [asset("/a", 1), asset("/b", 2), asset("/c", 3)];
  const offer = describeDownloadOffer(plan([assets[0], assets[1]], [assets[2]]), manifest(assets), null);
  assert.equal(offer.resuming, true);
  assert.equal(offer.pendingCount, 1);
  assert.equal(offer.pendingBytes, 1048576);
  assert.match(offer.actionLabel, /再開/);
  assert.ok(offer.lines.some((line) => /保存済み 2 \/ 3件/.test(line)));
});

test("the download offer warns when the device may not have room", () => {
  const assets = [asset("/a", 1)];
  const roomy = describeDownloadOffer(plan([], assets), manifest(assets), { available: 999 * 1048576 });
  assert.equal(roomy.shortOnSpace, false);
  assert.equal(roomy.warning, null);
  const tight = describeDownloadOffer(plan([], assets), manifest(assets), { available: 1024 });
  assert.equal(tight.shortOnSpace, true);
  assert.match(tight.warning, /空き容量/);
});

test("install guidance adapts to the browser instead of requiring one", () => {
  // Chromium offers a real prompt.
  const chromium = describeInstallGuidance({ promptAvailable: true, userAgent: "Chrome" });
  assert.equal(chromium.mode, "prompt");
  assert.ok(chromium.actionLabel);

  // iOS has no prompt event, so it gets the manual route rather than nothing.
  const ios = describeInstallGuidance({
    promptAvailable: false,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  assert.equal(ios.mode, "manual");
  assert.ok(ios.steps.length > 0);
  assert.ok(ios.steps.some((step) => step.includes("ホーム画面に追加")));

  // Anything else still gets usable, browser-neutral wording.
  const other = describeInstallGuidance({ promptAvailable: false, userAgent: "Firefox" });
  assert.equal(other.mode, "manual");
  assert.ok(other.steps.length > 0);
  assert.doesNotMatch(other.body, /Safari|Chrome|Edge/);

  // Already installed: nothing to suggest.
  assert.equal(describeInstallGuidance({ standalone: true, promptAvailable: true }), null);
});

test("a fresh standalone launch asks for the first install", () => {
  assert.equal(derivePwaPhase({ supported: true, standalone: true }), "install-required");
});

test("a standalone launch with a complete pack is ready", () => {
  const phase = derivePwaPhase({
    supported: true,
    standalone: true,
    installedManifest: manifest([asset("/a", 1)]),
    installPlan: plan([asset("/a", 1)], []),
  });
  assert.equal(phase, "ready");
});

test("a partially evicted pack asks for repair, not a full reinstall", () => {
  const phase = derivePwaPhase({
    supported: true,
    standalone: true,
    installedManifest: manifest([asset("/a", 1), asset("/b", 2)]),
    installPlan: plan([asset("/a", 1)], [asset("/b", 2)]),
  });
  assert.equal(phase, "repair-required");
});

test("a pack with nothing stored is treated as a first install", () => {
  const phase = derivePwaPhase({
    supported: true,
    standalone: true,
    installedManifest: manifest([asset("/a", 1)]),
    installPlan: plan([], [asset("/a", 1)]),
  });
  assert.equal(phase, "install-required");
});

test("an active download outranks every other phase", () => {
  for (const downloadState of ["running", "paused"]) {
    assert.equal(
      derivePwaPhase({ supported: true, standalone: true, downloadState }),
      "installing",
    );
  }
});

test("an available update is surfaced in both standalone and tab contexts", () => {
  const installed = manifest([asset("/a", 1)]);
  assert.equal(
    derivePwaPhase({
      supported: true, standalone: true, installedManifest: installed,
      installPlan: plan([asset("/a", 1)], []), updateEvaluation: { available: true },
    }),
    "update-available",
  );
  assert.equal(
    derivePwaPhase({
      supported: true, standalone: false, installedManifest: installed,
      updateEvaluation: { available: true },
    }),
    "update-available",
  );
});

test("play is allowed offline whenever only optional assets are missing", () => {
  assert.equal(canPlayOffline({ phase: "ready" }), true);
  assert.equal(canPlayOffline({ phase: "browser" }), true);
  assert.equal(canPlayOffline({ phase: "update-available" }), true);
  assert.equal(canPlayOffline({ phase: "install-required" }), false);
  assert.equal(canPlayOffline({ phase: "installing" }), false);

  assert.equal(
    canPlayOffline({
      phase: "repair-required",
      installPlan: { pending: [asset("/a", 1, { criticality: "optional" })] },
    }),
    true,
    "a missing optional asset must not block play",
  );
  assert.equal(
    canPlayOffline({
      phase: "repair-required",
      installPlan: { pending: [asset("/a", 1, { criticality: "critical" })] },
    }),
    false,
  );
});

test("the install prompt states count, size, and free space", () => {
  const described = describeInstall(
    { pendingCount: 531, pendingBytes: 116877281 },
    { available: 900000000 },
  );
  assert.match(described.lines[0], /531件・111MBをこの端末へ保存します/);
  assert.match(described.lines[1], /空き容量の目安/);
  assert.equal(described.shortOnSpace, false);
  assert.equal(described.warning, null);
  assert.match(described.wifiHint, /Wi-Fi/);
});

test("a tight free-space estimate produces an explicit warning", () => {
  const described = describeInstall(
    { pendingCount: 531, pendingBytes: 116877281 },
    { available: 100000000 },
  );
  assert.equal(described.shortOnSpace, true);
  assert.match(described.warning, /空き容量が不足/);
});

test("an unavailable storage estimate omits the free-space line rather than guessing", () => {
  const described = describeInstall({ pendingCount: 10, pendingBytes: 1048576 }, null);
  assert.equal(described.lines.length, 1);
  assert.equal(described.shortOnSpace, false);
});

test("progress copy reports counts, bytes, category, and failures", () => {
  const described = describeProgress({
    completedCount: 120, totalCount: 531,
    completedBytes: 20 * 1048576, totalBytes: 111 * 1048576,
    activeCategory: "audio", failedCount: 2, ratio: 0.18,
  }, ASSET_CATEGORY_LABELS);

  assert.equal(described.countLine, "120 / 531件");
  assert.equal(described.byteLine, "20.0MB / 111MB");
  assert.equal(described.categoryLine, "音声を取得中");
  assert.equal(described.failedLine, "失敗 2件");
  assert.equal(described.percent, 18);
});

test("standalone detection accepts both the media query and the iOS flag", () => {
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: true }) }),
    true,
  );
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }),
    true,
  );
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: {} }),
    false,
  );
  assert.equal(isStandaloneDisplay(undefined), false);
});

test("PWA support requires a secure context, a worker, and Cache Storage", () => {
  assert.equal(isPwaSupported({ isSecureContext: true, navigator: { serviceWorker: {} }, caches: {} }), true);
  assert.equal(isPwaSupported({ isSecureContext: false, navigator: { serviceWorker: {} }, caches: {} }), false);
  assert.equal(isPwaSupported({ isSecureContext: true, navigator: {}, caches: {} }), false);
  assert.equal(isPwaSupported({ isSecureContext: true, navigator: { serviceWorker: {} } }), false);
});

test("the worker is registered at the app base path, not the site root", async () => {
  const registered = [];
  const windowRef = {
    isSecureContext: true,
    caches: {},
    location: { href: "https://example.test/Zombieee/index.html" },
    navigator: {
      serviceWorker: {
        register: async (url, options) => { registered.push({ url, options }); return { scope: options.scope }; },
      },
    },
  };

  await registerServiceWorker(windowRef);
  assert.equal(registered[0].url, "https://example.test/Zombieee/sw.js");
  assert.equal(registered[0].options.scope, "https://example.test/Zombieee/");
  assert.equal(registered[0].options.updateViaCache, "none");
});

test("a failed registration returns null instead of breaking the app", async () => {
  const windowRef = {
    isSecureContext: true,
    caches: {},
    location: { href: "https://example.test/" },
    navigator: { serviceWorker: { register: async () => { throw new Error("blocked"); } } },
  };
  assert.equal(await registerServiceWorker(windowRef), null);
});

test("a published manifest is validated before it is trusted", async () => {
  const good = manifest([asset("/a.webp", 1)]);
  const fetched = await fetchPublishedManifest({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async () => ({ ok: true, json: async () => good }),
  });
  assert.equal(fetched.version, "0.9.6");

  await assert.rejects(
    fetchPublishedManifest({
      baseUrl: "https://example.test/",
      fetchImpl: async () => ({ ok: true, json: async () => ({ schema: "wrong", assets: [] }) }),
    }),
    /Invalid published manifest/,
  );

  await assert.rejects(
    fetchPublishedManifest({
      baseUrl: "https://example.test/",
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /responded 503/,
  );
});

test("the asset fetcher refuses an HTML soft 404 instead of storing a web page", async () => {
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      arrayBuffer: async () => new ArrayBuffer(64),
    }),
  });
  const result = await fetcher(asset("/art/missing.webp", 1), {});
  assert.equal(result.ok, false);
});

test("the asset fetcher requests the scoped URL and returns raw bytes", async () => {
  const requested = [];
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async (url, options) => {
      requested.push({ url, cache: options.cache });
      return {
        ok: true,
        status: 200,
        headers: { get: () => "image/webp" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      };
    },
  });

  const result = await fetcher(asset("/art/a.webp", 1), {});
  assert.equal(requested[0].url, "https://example.test/Zombieee/art/a.webp");
  assert.equal(requested[0].cache, "no-store");
  assert.equal(result.ok, true);
  assert.equal(result.body.byteLength, 3);
});
