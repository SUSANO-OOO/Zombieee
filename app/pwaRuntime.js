// Version 0.9.6 PWA runtime.
//
// `derivePwaPhase` is the single place that decides what the player is shown:
// nothing at all in a plain browser tab, a first-install prompt in a freshly
// added home-screen app, a repair prompt after OS cache eviction, and an update
// prompt on a safe screen. Keeping it pure means every branch is testable
// without a browser.
//
// The controller below is the thin browser adapter: it registers the worker,
// fetches the published manifest, and owns nothing that is not I/O.

import { detectEviction, estimateStorage, resolveAssetUrl } from "./pwaAssetStore.js";
import { formatBytes, planInstall, validateAssetManifest } from "./pwaAssetManifest.js";
import { evaluateActivationSafety, evaluateUpdate } from "./pwaUpdatePlanner.js";

export const PWA_PHASES = Object.freeze([
  "unsupported",
  "browser",
  "download-offer",
  "download-complete",
  "install-required",
  "installing",
  "install-incomplete",
  "repair-required",
  "ready",
  "update-available",
  "updating",
]);

/**
 * Decides the phase from facts only. `standalone` distinguishes a home-screen
 * launch from an ordinary tab: a browser tab keeps working exactly as it does
 * today and is never forced through a 111MB install.
 */
export function derivePwaPhase({
  supported = false,
  standalone = false,
  installedManifest = null,
  installPlan = null,
  downloadState = null,
  updateEvaluation = null,
  offerDismissed = false,
} = {}) {
  if (!supported) return "unsupported";

  if (downloadState === "running" || downloadState === "paused") {
    return "installing";
  }

  if (!standalone) {
    // A tab that has just finished its download says so, and offers to start
    // playing, rather than silently swapping the screen underneath the player.
    if (downloadState === "complete") return "download-complete";
    // An ordinary tab may still run an update check, but never an install gate.
    if (installedManifest && updateEvaluation?.available) return "update-available";
    // First visit, or a pack that never finished: the download entry point comes
    // before the title so the offer is the first thing a new player sees. It is
    // an offer, not a gate - dismissing it plays straight from the network, and
    // a device that already holds the pack never sees it at all.
    if (!offerDismissed && installPlan && !installPlan.complete) return "download-offer";
    return "browser";
  }

  if (!installedManifest) return "install-required";
  if (installPlan && !installPlan.complete) {
    // Distinguish "never finished" from "the OS reclaimed our bytes", because
    // the two need different wording even though both re-fetch only the gap.
    return installPlan.satisfied.length === 0 ? "install-required" : "repair-required";
  }
  if (updateEvaluation?.available) return "update-available";
  return "ready";
}

/** True when the player may start playing from local assets. */
export function canPlayOffline({ phase, installPlan }) {
  if (phase === "browser" || phase === "unsupported") return true;
  if (phase === "ready" || phase === "update-available") return true;
  // A partially installed pack can still play if nothing critical is missing.
  if (phase === "repair-required") {
    return (installPlan?.pending ?? []).every((asset) => asset.criticality === "optional");
  }
  return false;
}

/** Player-facing copy for the first-install prompt. */
export function describeInstall(plan, storage) {
  if (!plan) return null;
  const lines = [
    `${plan.pendingCount}件・${formatBytes(plan.pendingBytes)}をこの端末へ保存します`,
  ];
  if (storage?.available != null) {
    lines.push(`空き容量の目安 ${formatBytes(storage.available)}`);
  }
  const shortOnSpace = storage?.available != null && storage.available < plan.pendingBytes * 1.1;
  return {
    headline: "ゲームデータをダウンロードします",
    lines,
    shortOnSpace,
    warning: shortOnSpace ? "空き容量が不足している可能性があります" : null,
    wifiHint: "Wi-Fi接続を推奨します",
  };
}

/**
 * Copy for the download entry screen a first-time visitor sees.
 *
 * Every number comes from the published manifest and the install plan, so the
 * screen cannot drift from what will actually be fetched. Nothing here is
 * hard-coded: a pack that grows or shrinks changes this text automatically.
 */
export function describeDownloadOffer(plan, manifest, storage) {
  if (!plan || !manifest) return null;
  const totalAssets = manifest.assets?.length ?? 0;
  const alreadyHeld = Math.max(0, totalAssets - plan.pendingCount);
  const resuming = alreadyHeld > 0;

  const lines = [
    `${plan.pendingCount}件・${formatBytes(plan.pendingBytes)}をこの端末に保存します`,
  ];
  if (resuming) {
    lines.push(`保存済み ${alreadyHeld} / ${totalAssets}件のぶんは再取得しません`);
  }
  if (storage?.available != null) {
    lines.push(`空き容量の目安 ${formatBytes(storage.available)}`);
  }

  const shortOnSpace = storage?.available != null && storage.available < plan.pendingBytes * 1.1;
  return {
    headline: resuming ? "ダウンロードを再開します" : "ゲームをダウンロード",
    actionLabel: resuming ? "ダウンロードを再開" : "ゲームをダウンロード",
    lines,
    totalAssets,
    pendingCount: plan.pendingCount,
    pendingBytes: plan.pendingBytes,
    resuming,
    shortOnSpace,
    warning: shortOnSpace ? "空き容量が不足している可能性があります" : null,
    wifiHint: "Wi-Fi接続を推奨します。ダウンロードは開始するまで始まりません。",
    skipLabel: "ダウンロードせずに遊ぶ",
    skipHint: "保存せずに遊ぶこともできます。その場合は毎回通信が必要です。",
  };
}

/**
 * Chooses how to explain installing to the home screen for whatever browser is
 * in front of us.
 *
 * `beforeinstallprompt` is Chromium-only, so relying on it alone would make the
 * app feel broken on iOS. When the browser offers no prompt we describe the
 * manual route instead, and the generic wording is deliberately not tied to any
 * one browser: no engine is required to play.
 */
export function describeInstallGuidance({ standalone = false, promptAvailable = false, userAgent = "" } = {}) {
  if (standalone) return null;

  const agent = String(userAgent);
  const iOS = /iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && /Mobile/.test(agent));

  if (promptAvailable) {
    return {
      mode: "prompt",
      headline: "ホーム画面に追加",
      body: "アプリのように全画面で起動できます。",
      actionLabel: "ホーム画面に追加",
      steps: [],
    };
  }
  if (iOS) {
    return {
      mode: "manual",
      headline: "ホーム画面に追加",
      body: "アプリのように全画面で起動できます。",
      actionLabel: null,
      steps: ["共有ボタンを開く", "「ホーム画面に追加」を選ぶ", "「追加」を押す"],
    };
  }
  return {
    mode: "manual",
    headline: "ホーム画面に追加",
    body: "アプリのように全画面で起動できます。ブラウザのメニューから追加できます。",
    actionLabel: null,
    steps: ["ブラウザのメニューを開く", "「インストール」または「ホーム画面に追加」を選ぶ"],
  };
}

/** Progress caption naming the category currently being fetched. */
export function describeProgress(snapshot, categoryLabels) {
  if (!snapshot) return null;
  const label = snapshot.activeCategory ? categoryLabels[snapshot.activeCategory] ?? snapshot.activeCategory : null;
  return {
    countLine: `${snapshot.completedCount} / ${snapshot.totalCount}件`,
    byteLine: `${formatBytes(snapshot.completedBytes)} / ${formatBytes(snapshot.totalBytes)}`,
    categoryLine: label ? `${label}を取得中` : null,
    failedLine: snapshot.failedCount > 0 ? `失敗 ${snapshot.failedCount}件` : null,
    percent: Math.round(snapshot.ratio * 100),
  };
}

// --- Browser adapter ------------------------------------------------------

export function isStandaloneDisplay(windowRef) {
  try {
    if (windowRef?.matchMedia?.("(display-mode: standalone)")?.matches) return true;
    // iOS Safari reports a home-screen launch through a non-standard flag.
    return Boolean(windowRef?.navigator?.standalone);
  } catch {
    return false;
  }
}

export function isPwaSupported(windowRef) {
  return Boolean(
    windowRef?.isSecureContext
    && windowRef?.navigator?.serviceWorker
    && windowRef?.caches,
  );
}

/**
 * Registers the worker at the app's own base path.
 *
 * The script URL and scope are both derived from the document base, so the same
 * code registers `/sw.js` locally and `/Zombieee/sw.js` on Pages.
 */
export async function registerServiceWorker(windowRef, { baseUrl } = {}) {
  if (!isPwaSupported(windowRef)) return null;
  const base = baseUrl ?? new URL("./", windowRef.location.href).toString();
  try {
    return await windowRef.navigator.serviceWorker.register(new URL("sw.js", base).toString(), {
      scope: base,
      updateViaCache: "none",
    });
  } catch {
    // A failed registration must never block play; the app falls back to
    // ordinary network loading.
    return null;
  }
}

/** Fetches the published manifest, network-first, and validates it. */
export async function fetchPublishedManifest({ baseUrl, fetchImpl = fetch, signal } = {}) {
  const url = new URL("asset-manifest.json", baseUrl).toString();
  const response = await fetchImpl(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`asset-manifest.json responded ${response.status}`);
  const manifest = await response.json();
  const { valid, errors } = validateAssetManifest(manifest);
  if (!valid) throw new Error(`Invalid published manifest: ${errors.join("; ")}`);
  return manifest;
}

/**
 * Builds the fetch function the download session uses. Requests bypass the HTTP
 * cache so a verified download always reflects what the server actually has.
 */
export function createAssetFetcher({ baseUrl, fetchImpl = fetch }) {
  return async (asset, { signal }) => {
    const response = await fetchImpl(resolveAssetUrl(asset.path, baseUrl), {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return { ok: false, status: response.status };
    const type = response.headers.get("content-type") ?? "";
    // A soft 404 returns an HTML page with status 200; refuse it here so the
    // session records a real failure instead of storing a web page as art.
    if (type.includes("text/html")) return { ok: false, status: response.status };
    const buffer = await response.arrayBuffer();
    return { ok: true, status: response.status, body: new Uint8Array(buffer) };
  };
}

/**
 * Computes everything the UI needs in one pass: what is installed, what is
 * missing, whether an update is offered, and whether it may activate now.
 */
export async function assessPwaState({
  windowRef,
  store,
  installedManifest,
  publishedManifest,
  screen,
  battleActive,
  resultSaving,
  saveMutationPending,
  downloadState,
} = {}) {
  const supported = isPwaSupported(windowRef);
  const standalone = isStandaloneDisplay(windowRef);

  if (!supported) {
    return { phase: "unsupported", supported, standalone, installPlan: null, updateEvaluation: null };
  }

  const storedHashes = await store.storedHashes();
  const activeManifest = installedManifest ?? null;

  const installPlan = activeManifest
    ? planInstall(activeManifest, { storedHashesByPath: await store.storedHashesByPath(activeManifest) })
    : null;

  const eviction = activeManifest ? detectEviction({ manifest: activeManifest, storedHashes }) : null;

  const updateEvaluation = activeManifest && publishedManifest
    ? evaluateUpdate({ installedManifest: activeManifest, publishedManifest, storedHashes })
    : null;

  const phase = derivePwaPhase({
    supported,
    standalone,
    installedManifest: activeManifest,
    installPlan,
    downloadState,
    updateEvaluation,
  });

  const activation = evaluateActivationSafety({
    screen,
    battleActive,
    resultSaving,
    saveMutationPending,
    downloadActive: downloadState === "running" || downloadState === "paused",
  });

  return {
    phase,
    supported,
    standalone,
    installPlan,
    eviction,
    updateEvaluation,
    activation,
    storage: await estimateStorage(windowRef?.navigator),
    canPlay: canPlayOffline({ phase, installPlan }),
  };
}

/** Sends one message to the active worker and waits for its reply. */
export function requestFromServiceWorker(registration, message, { timeoutMs = 5000 } = {}) {
  const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data ?? null);
    };
    try {
      worker.postMessage(message, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}
