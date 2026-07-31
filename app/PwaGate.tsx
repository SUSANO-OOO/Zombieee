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
  describeInstall,
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
      if (state?.active) setInstalledManifest(state.active as Manifest);

      setStoredHashes(await store.storedHashes());
      setStorage(await import("./pwaAssetStore.js").then((m) => m.estimateStorage(window.navigator)));

      try {
        const published = await fetchPublishedManifest({ baseUrl });
        if (!cancelled) setPublishedManifest(published as Manifest);
      } catch {
        // Offline, or the release metadata is unreachable. Play continues from
        // whatever is already stored; no update is offered.
      }
    })().catch((cause) => {
      if (!cancelled) setError(String(cause?.message ?? cause));
    });
    return () => { cancelled = true; };
  }, [baseUrl]);

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
    const byPath = new Map<string, string>();
    for (const entry of targetManifest.assets as Array<{ path: string; hash: string }>) {
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

  // A plain tab, or a fully installed app, renders the game untouched.
  const blocking = !playable && (phase === "install-required" || phase === "installing");

  return (
    <>
      {!blocking && children}

      {blocking && (
        <section className="pwa-gate" role="dialog" aria-label="ゲームデータの準備" aria-live="polite">
          <div className="pwa-gate-panel">
            <h1>西新世紀末物語</h1>

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
