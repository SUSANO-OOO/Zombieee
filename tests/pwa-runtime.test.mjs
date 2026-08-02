import assert from "node:assert/strict";
import test from "node:test";

import { ASSET_CATEGORY_LABELS, ASSET_MANIFEST_SCHEMA } from "../app/pwaAssetManifest.js";
import { assessCommitRecovery, manifestCacheComplete, manifestsEqual } from "../app/pwaManifestCommit.js";
import {
  assessPwaState,
  canPlayOffline,
  createAssetFetcher,
  derivePwaPhase,
  describeInstall,
  describeInstallGuidance,
  describeInstallOffer,
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

test("a browser tab is invited to install before it reaches the title", () => {
  assert.equal(derivePwaPhase({ supported: true, standalone: false }), "install-offer");
  // Even a tab that somehow holds a complete pack is still invited: the point is
  // to get the player into the installed app, not to sell them a download.
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: false,
      installedManifest: manifest([asset("/a", 1)]),
      installPlan: plan([asset("/a", 1)], []),
    }),
    "install-offer",
  );
});

test("declining the invitation plays straight from the network", () => {
  // The invitation must not become a wall: dismissing it renders the game.
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

test("a browser tab is never sent into a download", () => {
  // Nothing a browser tab can be in - no plan, a partial pack, an update waiting
  // - may resolve to a phase that fetches the pack. The download belongs to the
  // home-screen app.
  const downloadingPhases = new Set(["install-required", "installing", "repair-required"]);
  for (const installPlan of [null, plan([], [asset("/a", 1)]), plan([asset("/a", 1)], [asset("/b", 2)])]) {
    for (const offerDismissed of [false, true]) {
      const phase = derivePwaPhase({
        supported: true,
        standalone: false,
        installedManifest: manifest([asset("/a", 1), asset("/b", 2)]),
        installPlan,
        offerDismissed,
        updateEvaluation: { available: true },
      });
      assert.ok(!downloadingPhases.has(phase), `browser tab resolved to ${phase}`);
    }
  }
});

test("a finished download reports completion before starting the game", () => {
  // The first home-screen launch is where this matters, and it is also where the
  // phase used to fall straight through to "ready" and swap the screen without a
  // word.
  for (const standalone of [true, false]) {
    assert.equal(
      derivePwaPhase({
        supported: true,
        standalone,
        installedManifest: manifest([asset("/a", 1)]),
        downloadState: "complete",
        installPlan: plan([asset("/a", 1)], []),
      }),
      "download-complete",
    );
  }
});

test("the install invitation states the size without fetching anything", () => {
  const assets = [asset("/a", 1), asset("/b", 2), asset("/c", 3)];
  const offer = describeInstallOffer(manifest(assets));
  assert.match(offer.headline, /西新世紀末物語をインストール/);
  assert.equal(offer.totalAssets, 3);
  assert.equal(offer.totalBytes, 3 * 1048576);
  assert.match(offer.sizeLine, /3件/);
  assert.match(offer.sizeLine, /3\.0MB/);
  // The size is a promise about later, not a description of now.
  assert.match(offer.sizeLine, /最初に起動したとき/);
  assert.match(offer.noDownloadHint, /ダウンロードしません/);
  // Declining stays available and is described plainly.
  assert.ok(offer.skipLabel);
  assert.match(offer.skipHint, /インストールせずに/);
});

test("the install invitation offers a real button only when the browser has one", () => {
  const assets = [asset("/a", 1)];
  assert.equal(describeInstallOffer(manifest(assets)).actionLabel, null);
  assert.ok(describeInstallOffer(manifest(assets), { promptAvailable: true }).actionLabel);
});

test("install guidance adapts to the browser instead of requiring one", () => {
  // Chromium offers a real prompt.
  const chromium = describeInstallGuidance({ promptAvailable: true, userAgent: "Chrome" });
  assert.equal(chromium.mode, "prompt");
  assert.ok(chromium.actionLabel);
  // A browser prompt can be raised once and then dismissed, so the written route
  // is always available behind it rather than leaving a dead end.
  assert.ok(chromium.steps.length > 0);

  // iPhone has no prompt event, so it gets the manual route rather than nothing,
  // and every step names the control the player is hunting for in brackets.
  const iphone = describeInstallGuidance({
    promptAvailable: false,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  assert.equal(iphone.mode, "manual");
  assert.equal(iphone.platform, "iphone");
  assert.equal(iphone.steps.length, 3);
  assert.ok(iphone.steps.every((step) => /「.+」/.test(step.text)));
  assert.equal(iphone.steps[0].icon, "share");
  // The share control is at the bottom on iPhone, so the arrow points down.
  assert.equal(iphone.steps[0].arrow, "down");
  assert.match(iphone.steps[0].text, /画面下/);
  assert.match(iphone.steps[1].text, /ホーム画面に追加/);
  assert.match(iphone.steps[2].text, /追加/);

  // iPad puts the same control at the top, and says so.
  const ipad = describeInstallGuidance({
    promptAvailable: false,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  assert.equal(ipad.platform, "ipad");
  assert.equal(ipad.steps[0].arrow, "up");
  assert.match(ipad.steps[0].text, /画面上/);

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

test("a complete pack without a matching worker generation requires a commit before play", () => {
  const candidate = manifest([asset("/a", 1), asset("/b", 2)]);
  const storedHashes = new Set(candidate.assets.map((entry) => entry.hash));
  const recovery = assessCommitRecovery({
    activeManifest: null,
    publishedManifest: candidate,
    storedHashes,
  });
  assert.equal(recovery.required, true);
  assert.equal(recovery.reason, "active-missing");
  assert.equal(manifestCacheComplete(candidate, storedHashes), true);
  assert.equal(manifestsEqual(candidate, candidate), true);
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: true,
      installedManifest: null,
      installPlan: plan([asset("/a", 1), asset("/b", 2)], []),
      commitRequired: recovery.required,
    }),
    "commit-required",
  );
  assert.equal(canPlayOffline({ phase: "commit-required" }), false);

  // Without a published manifest we cannot identify a newer uncommitted pack.
  // A previously installed generation remains usable offline instead.
  assert.equal(assessCommitRecovery({ activeManifest: candidate, publishedManifest: null, storedHashes }).required, false);

  // A partial pack with no manifest is still a first install, not a repair:
  // there is no committed generation to repair towards.
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: true,
      installedManifest: null,
      installPlan: plan([asset("/a", 1)], [asset("/b", 2)]),
    }),
    "install-required",
  );
});

test("an active generation mismatch blocks an update until the complete cached candidate is committed", () => {
  const old = { ...manifest([asset("/a", 1)]), version: "0.9.8.1", releaseSha: "old" };
  const candidate = { ...manifest([asset("/a", 1)]), version: "0.9.8.2", releaseSha: "new" };
  const storedHashes = new Set(candidate.assets.map((entry) => entry.hash));
  const recovery = assessCommitRecovery({ activeManifest: old, publishedManifest: candidate, storedHashes });
  assert.equal(recovery.required, true);
  assert.equal(recovery.reason, "active-mismatch");
  assert.equal(derivePwaPhase({
    supported: true,
    standalone: true,
    installedManifest: old,
    installPlan: plan(old.assets, []),
    updateEvaluation: { available: true },
    commitRequired: true,
  }), "commit-required");
  assert.equal(derivePwaPhase({
    supported: true,
    standalone: true,
    installedManifest: old,
    installPlan: plan(old.assets, []),
    downloadState: "commit-failed",
    commitRequired: true,
  }), "download-incomplete");
});

test("the pure runtime state model also reports commit-required instead of a playable update", async () => {
  const old = { ...manifest([asset("/a", 1)]), version: "0.9.8.1", releaseSha: "old" };
  const candidate = { ...manifest([asset("/a", 1)]), version: "0.9.8.2", releaseSha: "new" };
  const storedHashes = new Set(candidate.assets.map((entry) => entry.hash));
  const state = await assessPwaState({
    windowRef: {
      isSecureContext: true,
      caches: {},
      navigator: { serviceWorker: {}, standalone: true },
      matchMedia: () => ({ matches: true }),
    },
    store: {
      storedHashes: async () => storedHashes,
      storedHashesByPath: async () => new Map(old.assets.map((entry) => [entry.path, entry.hash])),
    },
    installedManifest: old,
    publishedManifest: candidate,
  });
  assert.equal(state.commitRecovery.required, true);
  assert.equal(state.phase, "commit-required");
  assert.equal(state.canPlay, false);
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
  // In a tab the invitation to install comes first; the update notice is what
  // remains once the player has declined it. Offering both at once would put two
  // competing asks on one screen.
  assert.equal(
    derivePwaPhase({
      supported: true, standalone: false, installedManifest: installed,
      updateEvaluation: { available: true },
    }),
    "install-offer",
  );
  assert.equal(
    derivePwaPhase({
      supported: true, standalone: false, installedManifest: installed,
      updateEvaluation: { available: true }, offerDismissed: true,
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
  assert.equal(result.networkRequestCount, 1);
});

test("the asset fetcher uses optimized source paths while preserving runtime paths", async () => {
  const requested = [];
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async (url) => {
      requested.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => "image/webp" },
        arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
      };
    },
  });

  const result = await fetcher({ ...asset("/art/a.png", 1), sourcePath: "/art/a.webp" }, {});
  assert.equal(requested[0], "https://example.test/Zombieee/art/a.webp");
  assert.equal(result.body.byteLength, 2);
});

test("the asset fetcher downloads an audio bundle once and slices each cue", async () => {
  const requested = [];
  const bundle = new Uint8Array([10, 11, 12, 13, 14, 15]);
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async (url) => {
      requested.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/octet-stream" },
        arrayBuffer: async () => bundle.slice().buffer,
      };
    },
  });

  const first = await fetcher({
    ...asset("/audio/a.mp3", 1),
    bundlePath: "/pwa-bundles/audio-v1.bin",
    bundleOffset: 1,
    bundleBytes: 2,
  }, {});
  const second = await fetcher({
    ...asset("/audio/b.mp3", 2),
    bundlePath: "/pwa-bundles/audio-v1.bin",
    bundleOffset: 4,
    bundleBytes: 2,
  }, {});

  assert.deepEqual([...first.body], [11, 12]);
  assert.deepEqual([...second.body], [14, 15]);
  assert.equal(requested.length, 1);
  assert.equal(first.networkRequestCount, 1);
  assert.equal(second.networkRequestCount, 0);
});
