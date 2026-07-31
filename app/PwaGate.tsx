"use client";

// Version 0.9.6 PWA shell.
//
// Wraps the game rather than editing it, so the 0.9.5.2 asset and audio
// recovery paths stay exactly as they shipped. The gate only ever blocks play
// on a home-screen launch that has not finished its first download; an ordinary
// browser tab renders the game immediately, unchanged.
//
// Recovery here never navigates and never reloads: a failed or interrupted
// download is retried in place, which is the same rule Issue #113 established
// for in-battle asset retry.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ASSET_CATEGORY_LABELS,
  formatBytes,
  planInstall,
} from "./pwaAssetManifest.js";
import { createAssetStore } from "./pwaAssetStore.js";
import { createAssetDownloadSession } from "./pwaDownloadSession.js";
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
  requestFromServiceWorker,
} from "./pwaRuntime.js";
import { describeUpdate, evaluateActivationSafety, evaluateUpdate } from "./pwaUpdatePlanner.js";

type Manifest = { version: string; releaseSha: string; assets: Array<Record<string, unknown>> };

function readSafetyFromDocument() {
  if (typeof document === "undefined") return {};
  const data = document.documentElement.dataset;
  return {
    screen: data.pwaScreen ?? "title",
    battleActive: data.pwaBattleActive === "true",
    resultSaving: data.pwaResultSaving === "true",
    saveMutationPending: data.pwaSaveMutationPending === "true",
  };
}

export function PwaGate({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installedManifest, setInstalledManifest] = useState<Manifest | null>(null);
  const [publishedManifest, setPublishedManifest] = useState<Manifest | null>(null);
  const [storedHashes, setStoredHashes] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<ReturnType<typeof describeProgress> | null>(null);
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ available: number } | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [safety, setSafety] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [manifestUnreachable, setManifestUnreachable] = useState(false);
  // The player chose to play without saving the pack. Remembered for the visit
  // only, so the offer is never nagged twice in one session.
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<unknown> } | null>(null);
  const [installPromptUsed, setInstallPromptUsed] = useState(false);
  const [booted, setBooted] = useState(false);

  const baseUrl = useMemo(
    () => (typeof window === "undefined" ? "/" : new URL("./", window.location.href).toString()),
    [],
  );
  const storeRef = useRef<ReturnType<typeof createAssetStore> | null>(null);
  const sessionRef = useRef<ReturnType<typeof createAssetDownloadSession> | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const refreshStored = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setStoredHashes(await store.storedHashes());
  }, []);

  /**
   * Loads the published release metadata. Separated so the first-run screen can
   * offer a retry: a home-screen launch with no connection and nothing installed
   * has no manifest to plan from, and must say so instead of showing an empty
   * panel with no way forward.
   */
  const loadPublishedManifest = useCallback(async () => {
    setError(null);
    try {
      // Bounded: the title waits on this during boot, so an unanswered request
      // must not hold the screen indefinitely.
      const published = await fetchPublishedManifest({
        baseUrl,
        signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(10_000) : undefined,
      });
      setPublishedManifest(published as Manifest);
      setManifestUnreachable(false);
      return true;
    } catch {
      setManifestUnreachable(true);
      return false;
    }
  }, [baseUrl]);

  // Boot: register the worker, learn what is installed, and look for a release.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPwaSupported(window)) {
        setSupported(false);
        return;
      }
      setSupported(true);
      setStandalone(isStandaloneDisplay(window));

      const store = createAssetStore({ caches: window.caches, scope: baseUrl });
      storeRef.current = store;

      registrationRef.current = await registerServiceWorker(window);

      const state = await requestFromServiceWorker(registrationRef.current, { type: "pwa:get-state" });
      if (cancelled) return;
      // Only accept a manifest that carries its asset list: everything below
      // plans repairs and update diffs from it, and a summary would both crash
      // the plan and make an update look like a full reinstall.
      if (Array.isArray(state?.active?.assets) && state.active.assets.length > 0) {
        setInstalledManifest(state.active as Manifest);
      }

      setStoredHashes(await store.storedHashes());
      setStorage(await import("./pwaAssetStore.js").then((m) => m.estimateStorage(window.navigator)));

      // Offline, or the release metadata is unreachable: play continues from
      // whatever is already stored and no update is offered. A first run with
      // nothing stored gets an explicit retry instead of a blank panel.
      if (!cancelled) await loadPublishedManifest();
    })().catch((cause) => {
      if (!cancelled) setError(String(cause?.message ?? cause));
    }).finally(() => {
      if (!cancelled) setBooted(true);
    });
    return () => { cancelled = true; };
  }, [baseUrl, loadPublishedManifest]);

  // Chromium fires this instead of showing its own install affordance. Capturing
  // it lets the page offer a real install button; browsers that never fire it
  // get written instructions instead, so no engine is required.
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as unknown as { prompt: () => Promise<unknown> });
    };
    const onInstalled = () => { setInstallPrompt(null); setInstallPromptUsed(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // The game publishes activation-safety facts on the root element.
  useEffect(() => {
    const read = () => setSafety(readSafetyFromDocument());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [
      "data-pwa-screen", "data-pwa-battle-active", "data-pwa-result-saving", "data-pwa-save-mutation-pending",
    ] });
    return () => observer.disconnect();
  }, []);

  const targetManifest = (installedManifest ?? publishedManifest) as Manifest | null;

  const installPlan = useMemo(() => {
    if (!targetManifest) return null;
    const entries = (targetManifest.assets ?? []) as Array<{ path: string; hash: string }>;
    if (entries.length === 0) return null;
    const byPath = new Map<string, string>();
    for (const entry of entries) {
      if (storedHashes.has(entry.hash)) byPath.set(entry.path, entry.hash);
    }
    return planInstall(targetManifest, { storedHashesByPath: byPath });
  }, [storedHashes, targetManifest]);

  const updateEvaluation = useMemo(() => {
    if (!installedManifest || !publishedManifest) return null;
    return evaluateUpdate({ installedManifest, publishedManifest, storedHashes });
  }, [installedManifest, publishedManifest, storedHashes]);

  const phase = derivePwaPhase({
    supported,
    standalone,
    installedManifest,
    installPlan,
    downloadState,
    updateEvaluation,
    offerDismissed,
  });

  const activation = evaluateActivationSafety({ ...safety, downloadActive: downloadState === "running" });

  const runDownload = useCallback(async (assets: Array<Record<string, unknown>>, manifest: Manifest) => {
    const store = storeRef.current;
    if (!store) return;
    setError(null);
    const session = createAssetDownloadSession({
      assets,
      store,
      fetchAsset: createAssetFetcher({ baseUrl }),
      onProgress: (snapshot) => {
        setDownloadState(snapshot.state);
        setProgress(describeProgress(snapshot, ASSET_CATEGORY_LABELS));
      },
    });
    sessionRef.current = session;
    const final = await session.start();
    await refreshStored();

    if (final.state === "complete") {
      // Only a fully verified pack becomes the active generation.
      await requestFromServiceWorker(registrationRef.current, { type: "pwa:commit-manifest", manifest });
      // Ask the browser to stop treating the pack as evictable cache, so a
      // player who has finished the download is not asked to repeat it. Best
      // effort: a refusal changes nothing else.
      await import("./pwaAssetStore.js").then((m) => m.persistStorage(window.navigator));
      setInstalledManifest(manifest);
      setUpdateDismissed(false);
    }
    setDownloadState(final.state);
  }, [baseUrl, refreshStored]);

  const startInstall = useCallback(() => {
    if (!targetManifest || !installPlan) return;
    void runDownload(installPlan.pending, targetManifest);
  }, [installPlan, runDownload, targetManifest]);

  const startUpdate = useCallback(() => {
    if (!publishedManifest || !updateEvaluation?.available) return;
    void runDownload(updateEvaluation.diff.downloadable, publishedManifest);
  }, [publishedManifest, runDownload, updateEvaluation]);

  const clearAssets = useCallback(async () => {
    await storeRef.current?.clearAssets();
    await requestFromServiceWorker(registrationRef.current, { type: "pwa:clear-assets" });
    await refreshStored();
  }, [refreshStored]);

  const playable = canPlayOffline({ phase, installPlan });
  const installCopy = describeInstall(installPlan, storage);
  const updateCopy = updateEvaluation ? describeUpdate(updateEvaluation, { formatBytes }) : null;
  const offerCopy = describeDownloadOffer(installPlan, targetManifest, storage);
  const guidance = describeInstallGuidance({
    standalone,
    promptAvailable: Boolean(installPrompt),
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
  });

  const acceptInstallPrompt = useCallback(() => {
    const prompt = installPrompt;
    if (!prompt) return;
    setInstallPromptUsed(true);
    void Promise.resolve(prompt.prompt()).catch(() => {});
  }, [installPrompt]);

  // A fully installed app, or a tab whose player chose to skip, renders the game
  // untouched. The download offer and its progress sit in front of the title so
  // the entry point is the first thing a new visitor sees.
  //
  // While the release metadata is still arriving there is nothing to offer yet.
  // Holding the title back for that moment avoids showing the title and then
  // yanking it away when the offer resolves a beat later.
  //
  // `supported` is deliberately not part of this. It is only known once the boot
  // effect has run, so including it left the very first render unblocked, and
  // the game mounted and fetched title art and music before the player had
  // agreed to download anything. A device that already holds the pack clears
  // this as soon as the worker reports its manifest, which is a local lookup.
  const settling = !booted && !standalone && !installedManifest;
  const blocking = settling
    || phase === "download-offer"
    || phase === "download-complete"
    || (!playable && (phase === "install-required" || phase === "installing"));

  return (
    <>
      {!blocking && children}

      {blocking && (
        <section className="pwa-gate" role="dialog" aria-label="ゲームデータの準備" aria-live="polite">
          <div className="pwa-gate-panel">
            <h1>西新世紀末物語</h1>

            {phase === "install-required" && !installCopy && (
              <>
                <h2>ゲームデータを準備できません</h2>
                <p className="pwa-warning" role="alert">
                  {manifestUnreachable
                    ? "配信データに接続できませんでした。通信環境を確認してください。"
                    : "配信データを確認しています。"}
                </p>
                <button type="button" className="pwa-primary" onClick={() => {
                  // Retries in place: no navigation, no reload.
                  void (async () => {
                    setManifestUnreachable(false);
                    await loadPublishedManifest();
                  })();
                }}>再試行</button>
              </>
            )}

            {settling && (
              <p className="pwa-hint" role="status">配信データを確認しています…</p>
            )}

            {!settling && phase === "download-offer" && offerCopy && (
              <>
                <h2>{offerCopy.headline}</h2>
                <ul>{offerCopy.lines.map((line) => <li key={line}>{line}</li>)}</ul>
                {offerCopy.warning && <p className="pwa-warning" role="alert">{offerCopy.warning}</p>}
                <p className="pwa-hint">{offerCopy.wifiHint}</p>
                <button type="button" className="pwa-primary" onClick={startInstall}>
                  {offerCopy.actionLabel}
                </button>
                <div className="pwa-actions pwa-secondary-actions">
                  <button type="button" onClick={() => setOfferDismissed(true)}>
                    {offerCopy.skipLabel}
                  </button>
                </div>
                <p className="pwa-hint">{offerCopy.skipHint}</p>
                {guidance && (
                  <aside className="pwa-install-guidance">
                    <h3>{guidance.headline}</h3>
                    <p className="pwa-hint">{guidance.body}</p>
                    {guidance.mode === "prompt" && !installPromptUsed && (
                      <button type="button" onClick={acceptInstallPrompt}>{guidance.actionLabel}</button>
                    )}
                    {guidance.steps.length > 0 && (
                      <ol>{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    )}
                  </aside>
                )}
              </>
            )}

            {phase === "download-complete" && (
              <>
                <h2>ダウンロードが完了しました</h2>
                <p className="pwa-progress-line">
                  {installedManifest?.assets?.length ?? storedHashes.size}件・
                  {formatBytes(
                    ((installedManifest?.assets ?? []) as Array<{ bytes: number }>)
                      .reduce((sum, asset) => sum + (Number(asset.bytes) || 0), 0),
                  )}を保存しました
                </p>
                <button type="button" className="pwa-primary" onClick={() => setDownloadState(null)}>
                  ゲームを起動
                </button>
                {guidance && (
                  <aside className="pwa-install-guidance">
                    <h3>{guidance.headline}</h3>
                    <p className="pwa-hint">{guidance.body}</p>
                    {guidance.mode === "prompt" && !installPromptUsed && (
                      <button type="button" onClick={acceptInstallPrompt}>{guidance.actionLabel}</button>
                    )}
                    {guidance.steps.length > 0 && (
                      <ol>{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    )}
                  </aside>
                )}
              </>
            )}

            {phase === "install-required" && installCopy && (
              <>
                <h2>{installCopy.headline}</h2>
                <ul>{installCopy.lines.map((line) => <li key={line}>{line}</li>)}</ul>
                {installCopy.warning && <p className="pwa-warning" role="alert">{installCopy.warning}</p>}
                <p className="pwa-hint">{installCopy.wifiHint}</p>
                <button type="button" className="pwa-primary" onClick={startInstall}>
                  ダウンロードを開始
                </button>
              </>
            )}

            {phase === "installing" && progress && (
              <>
                <h2>ゲームデータをダウンロード中</h2>
                <p className="pwa-progress-line">{progress.countLine}・{progress.byteLine}</p>
                {progress.categoryLine && <p className="pwa-hint">{progress.categoryLine}</p>}
                {progress.failedLine && <p className="pwa-warning">{progress.failedLine}</p>}
                <div className="pwa-progress-track" role="progressbar"
                  aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="pwa-progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="pwa-actions">
                  {downloadState === "running" && (
                    <button type="button" onClick={() => sessionRef.current?.pause()}>一時停止</button>
                  )}
                  {downloadState === "paused" && (
                    <button type="button" onClick={() => sessionRef.current?.resume()}>再開</button>
                  )}
                  <button type="button" onClick={() => sessionRef.current?.cancel()}>中断</button>
                </div>
              </>
            )}

            {(downloadState === "failed" || downloadState === "cancelled") && (
              <div className="pwa-actions">
                <p className="pwa-warning" role="alert">
                  {downloadState === "failed" ? "一部のデータを取得できませんでした" : "ダウンロードを中断しました"}
                  ・完了済みのデータは保持しています
                </p>
                <button type="button" className="pwa-primary" onClick={() => {
                  // Retries in place. No navigation, no reload.
                  void (async () => {
                    await sessionRef.current?.retryFailed();
                    await refreshStored();
                    setDownloadState(sessionRef.current?.getSnapshot().state ?? null);
                  })();
                }}>失敗した項目だけ再試行</button>
              </div>
            )}

            {error && <p className="pwa-warning" role="alert">{error}</p>}
          </div>
        </section>
      )}

      {/* Repair and update notices never block play; they sit above the game. */}
      {!blocking && phase === "repair-required" && installPlan && (
        <aside className="pwa-notice" role="status">
          <p>保存済みデータのうち{installPlan.pendingCount}件・{formatBytes(installPlan.pendingBytes)}が不足しています</p>
          <button type="button" onClick={startInstall}>不足分だけ再取得</button>
        </aside>
      )}

      {!blocking && phase === "update-available" && updateCopy && !updateDismissed && (
        <aside className="pwa-notice pwa-update" role="status">
          <p className="pwa-update-headline">{updateCopy.headline}</p>
          <p>{updateCopy.downloadLine}</p>
          <p className="pwa-hint">{updateCopy.fileLine}・{updateCopy.wifiHint}</p>
          {!activation.safe && (
            <p className="pwa-hint">
              {activation.blockers.includes("battle-active") || activation.blockers.includes("unsafe-screen")
                ? "戦闘の終了後に更新できます"
                : "保存処理の完了後に更新できます"}
            </p>
          )}
          <div className="pwa-actions">
            <button type="button" className="pwa-primary" disabled={!activation.safe} onClick={startUpdate}>
              更新をダウンロード
            </button>
            <button type="button" onClick={() => setUpdateDismissed(true)}>今はしない</button>
          </div>
        </aside>
      )}

      {!blocking && supported && standalone && (
        <>
          <button type="button" className="pwa-storage-toggle" onClick={() => setShowStorage((open) => !open)}>
            データ管理
          </button>
          {showStorage && (
            <aside className="pwa-notice pwa-storage" role="dialog" aria-label="データ管理">
              <dl>
                <div><dt>現在のVersion</dt><dd>{installedManifest?.version ?? "未インストール"}</dd></div>
                <div><dt>release SHA</dt><dd>{installedManifest?.releaseSha ?? "-"}</dd></div>
                <div><dt>保存済みアセット</dt><dd>{storedHashes.size}件</dd></div>
                <div>
                  <dt>不足・破損</dt>
                  <dd>{installPlan ? `${installPlan.pendingCount}件` : "-"}</dd>
                </div>
              </dl>
              <p className="pwa-hint">アセットの削除はセーブデータに影響しません。</p>
              <div className="pwa-actions">
                <button type="button" onClick={() => { void clearAssets(); }}>アセットを削除</button>
                <button type="button" onClick={() => setShowStorage(false)}>閉じる</button>
              </div>
            </aside>
          )}
        </>
      )}
    </>
  );
}
