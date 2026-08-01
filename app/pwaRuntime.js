// PWA runtime.
//
// `derivePwaPhase` is the single place that decides what the player is shown: an
// invitation to install in a plain browser tab, the first download in a freshly
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
  "install-offer",
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
 * Decides the phase from facts only.
 *
 * `standalone` is what separates the two halves of the journey. A browser tab is
 * where the player is invited to install, and nothing is downloaded there: 111MB
 * saved into a tab that is about to be replaced by a home-screen app is 111MB
 * fetched twice. The download belongs to the first home-screen launch, where the
 * bytes land in the app the player will actually keep using.
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

  // A finished download says so and hands the player a button, rather than
  // swapping the screen underneath them. This sits above the standalone split
  // because it is the end of the home-screen first-run just as much as it is the
  // end of an update.
  if (downloadState === "complete") return "download-complete";

  if (!standalone) {
    // An ordinary tab may still run an update check, but never an install gate.
    if (offerDismissed && installedManifest && updateEvaluation?.available) return "update-available";
    // The invitation to install is the first thing a browser visitor sees, and
    // it is an offer rather than a wall: dismissing it plays straight from the
    // network, exactly as a tab did before.
    if (!offerDismissed) return "install-offer";
    return "browser";
  }

  if (!installedManifest) {
    // The worker is where the committed manifest normally lives, but it can be
    // unregistered, replaced, or simply unavailable while the content-addressed
    // pack itself survives untouched. Asking such a device to fetch a pack it
    // demonstrably already holds - every hash in the published manifest present
    // in the cache - would be a full re-download for nothing.
    if (installPlan?.complete) return "ready";
    return "install-required";
  }
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
  // The install invitation covers the title, but it never takes play away: the
  // tab behind it is as capable as it ever was.
  if (phase === "install-offer") return true;
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
 * Copy for the install invitation a browser visitor meets first.
 *
 * The size line is informational only - it says what the app will save *after*
 * it is installed, so the player knows what they are agreeing to before they
 * agree to it. Every number still comes from the published manifest, so the
 * screen cannot promise a figure the download will not match, and reading a
 * manifest is not the same as fetching a pack: nothing is downloaded here.
 */
export function describeInstallOffer(manifest, { promptAvailable = false } = {}) {
  if (!manifest) return null;
  const assets = manifest.assets ?? [];
  const totalAssets = assets.length;
  const totalBytes = assets.reduce((sum, asset) => sum + (Number(asset?.bytes) || 0), 0);

  return {
    headline: "西新世紀末物語をインストール",
    body: "ホーム画面に追加すると、アプリのように全画面で起動できます。",
    sizeLine: totalAssets > 0
      ? `ゲームデータ ${totalAssets}件・${formatBytes(totalBytes)} は、追加したあと最初に起動したときに保存します`
      : null,
    noDownloadHint: "この画面ではゲームデータをダウンロードしません。",
    actionLabel: promptAvailable ? "インストール" : null,
    totalAssets,
    totalBytes,
    skipLabel: "ブラウザで遊ぶ",
    skipHint: "インストールせずに遊ぶこともできます。その場合は毎回通信が必要です。",
  };
}

/**
 * Chooses how to explain installing to the home screen for whatever browser is
 * in front of us.
 *
 * `beforeinstallprompt` is Chromium-only, so relying on it alone would make the
 * app feel broken on iOS, where the route is real but entirely manual. Each
 * manual step therefore carries the control's own label in brackets, the glyph
 * the player is looking for, and which edge of the screen to look at - a player
 * who has never installed a web app has no idea what "share" means here, and
 * "share" on iPhone is at the bottom while on iPad it is at the top.
 *
 * The generic wording is deliberately not tied to any one browser: no engine is
 * required to play.
 */
export function describeInstallGuidance({ standalone = false, promptAvailable = false, userAgent = "" } = {}) {
  if (standalone) return null;

  const agent = String(userAgent);
  const iPad = /iPad/.test(agent) || (/Macintosh/.test(agent) && /Mobile/.test(agent));
  const iPhone = /iPhone|iPod/.test(agent);

  // The manual steps are always computed, even where a prompt exists. A browser
  // prompt can only be raised once, and the player may dismiss it; without a
  // written route behind it that leaves a screen whose only remaining button is
  // "play in the browser", which is a dead end for someone who wanted to install.
  const platform = iPhone ? "iphone" : iPad ? "ipad" : "generic";
  const steps = platform === "generic"
    ? [
      { icon: "menu", arrow: null, text: "ブラウザの「メニュー」を開く", label: "メニュー" },
      { icon: "add", arrow: null, text: "「インストール」または「ホーム画面に追加」を押す", label: "ホーム画面に追加" },
    ]
    : [
      {
        icon: "share",
        arrow: iPhone ? "down" : "up",
        text: `${iPhone ? "画面下" : "画面上"}の「共有」ボタンを押す`,
        label: "共有",
      },
      { icon: "add", arrow: null, text: "「ホーム画面に追加」を押す", label: "ホーム画面に追加" },
      { icon: "confirm", arrow: null, text: "右上の「追加」を押す", label: "追加" },
    ];

  return {
    mode: promptAvailable ? "prompt" : "manual",
    platform,
    headline: promptAvailable ? "ホーム画面に追加" : "ホーム画面に追加する手順",
    body: promptAvailable
      ? "この端末はインストール画面を開けます。"
      : platform === "generic"
        ? "ブラウザのメニューから追加できます。"
        : "3ステップで終わります。",
    actionLabel: promptAvailable ? "ホーム画面に追加" : null,
    steps,
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
