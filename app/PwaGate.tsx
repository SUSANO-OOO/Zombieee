"use client";

// PWA shell.
//
// Wraps the game rather than editing it, so the 0.9.5.2 asset and audio
// recovery paths stay exactly as they shipped.
//
// The gate stands in front of the title twice, and only twice: once in a browser
// tab, to invite the player to install, and once on the first home-screen launch,
// to download the pack into the app they will keep. Neither is a wall - the
// invitation can be declined and the tab plays on - and an installed app that
// already holds its pack sees neither.
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
import { finalizePwaDownload, recoverVerifiedPwaManifest } from "./pwaInstallFinalize.js";
import { assessCommitRecovery, manifestsEqual } from "./pwaManifestCommit.js";
import {
  activateWaitingWorker,
  canPlayOffline,
  createAssetFetcher,
  derivePwaPhase,
  describeFailureDiagnostics,
  describeInstall,
  describeInstallGuidance,
  describeInstallOffer,
  describeProgress,
  formatFailureDiagnostics,
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

/**
 * The save environment the game has worked out for itself. It used to sit on the
 * title screen, where an origin and a storage scope meant nothing to a player;
 * it now lives in the data screen, and reaches this component through the same
 * dataset bridge the activation-safety facts already use.
 */
function readSaveEnvironmentFromDocument() {
  if (typeof document === "undefined") return null;
  const data = document.documentElement.dataset;
  if (!data.saveEnvironmentKind) return null;
  return {
    kind: data.saveEnvironmentKind,
    label: data.saveEnvironmentLabel ?? "",
    origin: data.saveEnvironmentOrigin ?? "",
    storageScope: data.saveEnvironmentScope ?? "",
    isolationNotice: data.saveEnvironmentIsolation ?? "",
  };
}

/** Screens where a data-management entry point belongs. */
const DATA_SCREENS = new Set(["title"]);

const STEP_ICONS: Record<string, React.ReactNode> = {
  // The iOS share glyph: a box with an arrow leaving the top of it.
  share: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5v10" />
      <path d="M8.5 7 12 3.5 15.5 7" />
      <path d="M6 11v8.5h12V11" />
    </svg>
  ),
  add: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  confirm: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};

const STEP_ARROWS: Record<string, string> = { down: "↓", up: "↑" };

function InstallSteps({ steps }: { steps: Array<Record<string, unknown>> }) {
  if (steps.length === 0) return null;
  return (
    <ol className="pwa-install-steps">
      {steps.map((step, index) => {
        const icon = typeof step.icon === "string" ? STEP_ICONS[step.icon] : null;
        const arrow = typeof step.arrow === "string" ? STEP_ARROWS[step.arrow] : null;
        return (
          <li key={String(step.text)}>
            <span className="pwa-step-number" aria-hidden="true">{index + 1}</span>
            <span className="pwa-step-body">
              {icon && <span className="pwa-step-icon">{icon}</span>}
              <span className="pwa-step-text">{String(step.text)}</span>
              {arrow && <span className="pwa-step-arrow" aria-hidden="true">{arrow}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PwaGate({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installedManifest, setInstalledManifest] = useState<Manifest | null>(null);
  const [publishedManifest, setPublishedManifest] = useState<Manifest | null>(null);
  // The rollback generation, kept so the data screen can account for every byte
  // on the device rather than only the ones the active version uses.
  const [previousManifest, setPreviousManifest] = useState<Manifest | null>(null);
  const [registrationScope, setRegistrationScope] = useState<string | null>(null);
  const [storedHashes, setStoredHashes] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<ReturnType<typeof describeProgress> | null>(null);
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const [commitRecoveryBusy, setCommitRecoveryBusy] = useState(false);
  const [storage, setStorage] = useState<{ available: number } | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [safety, setSafety] = useState<Record<string, unknown>>({});
  const [saveEnvironment, setSaveEnvironment] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manifestUnreachable, setManifestUnreachable] = useState(false);
  // The player chose to keep playing in the browser instead of installing.
  // Remembered for the visit only, so the invitation is never nagged twice in
  // one session.
  const [offerDismissed, setOfferDismissed] = useState(false);
  // The last failure, kept until the next success or an explicit dismissal, so
  // a player can still read it after they have looked away from the screen.
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof describeFailureDiagnostics> | null>(null);
  const [stalledSince, setStalledSince] = useState<number | null>(null);
  const [stalledSeconds, setStalledSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<unknown> } | null>(null);
  const [installPromptUsed, setInstallPromptUsed] = useState(false);
  const [booted, setBooted] = useState(false);
  // A standalone launch cannot decide whether a fully cached candidate still
  // needs its generation pointer until the published manifest has either
  // arrived or failed its bounded lookup. This closes the reload-time gap where
  // an old active generation could briefly mount before commit recovery ran.
  const [publishedChecked, setPublishedChecked] = useState(false);

  const baseUrl = useMemo(
    () => (typeof window === "undefined" ? "/" : new URL("./", window.location.href).toString()),
    [],
  );
  const storeRef = useRef<ReturnType<typeof createAssetStore> | null>(null);
  const sessionRef = useRef<ReturnType<typeof createAssetDownloadSession> | null>(null);
  const finalizeSessionRef = useRef<((final: { state?: string } | null | undefined) => Promise<unknown>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const commitRecoveryRef = useRef<Promise<unknown> | null>(null);
  // Read inside the download callback, which must not be rebuilt every time one
  // of these changes or an in-flight session would be replaced mid-transfer.
  const installPlanRef = useRef<{ pendingCount: number; pendingBytes: number; satisfiedBytes?: number } | null>(null);
  const installedManifestRef = useRef<Manifest | null>(null);
  const storedHashesRef = useRef<Set<string>>(new Set());

  const refreshStored = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return new Set<string>();
    const hashes = await store.storedHashes();
    setStoredHashes(hashes);
    return hashes;
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
    } finally {
      setPublishedChecked(true);
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
      if (Array.isArray(state?.previous?.assets) && state.previous.assets.length > 0) {
        setPreviousManifest(state.previous as Manifest);
      }
      setRegistrationScope(registrationRef.current?.scope ?? null);

      setStoredHashes(await store.storedHashes());
      setStorage(await import("./pwaAssetStore.js").then((m) => m.estimateStorage(window.navigator)));

      // Boot is complete once the local facts are known. The published manifest
      // is a network round trip, and waiting for it here would hold an installed
      // app's title screen hostage to the connection for as long as the fetch
      // takes - the exact opposite of what an offline-capable app should do. It
      // arrives on its own and fills in the size line when it does.
      if (!cancelled) setBooted(true);
      if (!cancelled) await loadPublishedManifest();
    })().catch((cause) => {
      if (!cancelled) setError(String(cause?.message ?? cause));
    }).finally(() => {
      if (!cancelled) setBooted(true);
    });
    return () => { cancelled = true; };
  }, [baseUrl, loadPublishedManifest]);

  // How long the counts have stood still. A stalled transfer produces no
  // progress callbacks by definition, so the only way to notice one is to look
  // at the clock on our own schedule rather than waiting to be told.
  useEffect(() => {
    const running = downloadState === "running" || downloadState === "paused";
    if (stalledSince == null || !running) return undefined;
    const timer = setInterval(
      () => setStalledSeconds(Math.round((Date.now() - stalledSince) / 1000)),
      1000,
    );
    // Cleared on the way out rather than on the way in, so the effect never
    // sets state during the render that scheduled it.
    return () => { clearInterval(timer); setStalledSeconds(0); };
  }, [downloadState, stalledSince]);

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

  // The game publishes activation-safety facts, and the save environment, on the
  // root element.
  useEffect(() => {
    const read = () => {
      setSafety(readSafetyFromDocument());
      setSaveEnvironment(readSaveEnvironmentFromDocument());
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [
      "data-pwa-screen", "data-pwa-battle-active", "data-pwa-result-saving", "data-pwa-save-mutation-pending",
      "data-save-environment-kind", "data-save-environment-origin", "data-save-environment-scope",
      "data-save-environment-label", "data-save-environment-isolation",
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

  // A complete candidate pack with no matching active generation is not
  // playable. This is intentionally assessed only from the published manifest,
  // the worker state learned during boot, and verified cache hashes; it never
  // guesses while offline, so a committed rollback remains available.
  const commitRecovery = useMemo(() => assessCommitRecovery({
    activeManifest: installedManifest,
    publishedManifest,
    storedHashes,
  }), [installedManifest, publishedManifest, storedHashes]);

  // Mirrored into refs so the download callback can read the current values
  // without listing them as dependencies - rebuilding that callback mid-run
  // would swap the session out from under an in-flight transfer.
  useEffect(() => {
    installPlanRef.current = installPlan;
    installedManifestRef.current = installedManifest;
    storedHashesRef.current = storedHashes;
  }, [installPlan, installedManifest, storedHashes]);

  const phase = derivePwaPhase({
    supported,
    standalone,
    installedManifest,
    installPlan,
    downloadState,
    updateEvaluation,
    offerDismissed,
    commitRequired: commitRecovery.required,
    commitRecoveryBusy,
  });

  const activation = evaluateActivationSafety({ ...safety, downloadActive: downloadState === "running" });

  const runDownload = useCallback(async (
    assets: Array<Record<string, unknown>>,
    manifest: Manifest,
    kind: "install" | "repair" | "update",
  ) => {
    const store = storeRef.current;
    if (!store) return;
    setError(null);
    setDiagnostics(null);
    const startedAt = Date.now();
    let lastProgressAt = startedAt;
    let lastCompleted = -1;

    // An update must not run under a worker that answers asset requests from
    // the generation it is replacing. Promoting the waiting worker first is what
    // makes the download able to reach the network at all.
    let serviceWorkerState: string | null = null;
    if (kind === "update") {
      serviceWorkerState = await activateWaitingWorker(registrationRef.current, { windowRef: window });
    }

    const session = createAssetDownloadSession({
      assets,
      store,
      fetchAsset: createAssetFetcher({ baseUrl }),
      onProgress: (snapshot) => {
        if (snapshot.completedCount !== lastCompleted) {
          lastCompleted = snapshot.completedCount;
          lastProgressAt = Date.now();
        }
        setDownloadState(snapshot.state);
        setProgress(describeProgress(snapshot, ASSET_CATEGORY_LABELS));
        setStalledSince(lastProgressAt);
      },
    });
    sessionRef.current = session;

    const recordDiagnostics = (
      failures: Array<Record<string, unknown>>,
      overrides: Record<string, unknown> = {},
    ) => {
      const plan = installPlanRef.current;
      setDiagnostics(describeFailureDiagnostics({
        kind,
        fromVersion: installedManifestRef.current?.version ?? null,
        toVersion: manifest.version,
        releaseSha: manifest.releaseSha,
        failures,
        startedAt,
        lastProgressAt,
        origin: window.location.origin,
        scope: registrationRef.current?.scope ?? baseUrl,
        standalone: isStandaloneDisplay(window),
        storedCount: storedHashesRef.current.size,
        storedBytes: plan?.satisfiedBytes ?? 0,
        pendingCount: plan?.pendingCount ?? 0,
        pendingBytes: plan?.pendingBytes ?? 0,
        serviceWorkerState,
        ...overrides,
      }));
    };

    let finalization: Promise<{ state: string; committed: boolean }> | null = null;
    const finalize = async (final: { state?: string } | null | undefined) => {
      // A double tap may join the same session promise. It must also join the
      // same commit, otherwise one completed retry can publish twice.
      if (finalization) return finalization;
      const task = finalizePwaDownload({
        final,
        manifest,
        registration: registrationRef.current,
        refreshStored,
        commitManifest: async (registration, candidate) => {
          try {
            return await requestFromServiceWorker(registration, { type: "pwa:commit-manifest", manifest: candidate });
          } catch {
            return null;
          }
        },
        readActiveState: async (registration) => requestFromServiceWorker(registration, { type: "pwa:get-state" }),
        persistStorage: async () => import("./pwaAssetStore.js").then((m) => m.persistStorage(window.navigator)),
        onIncomplete: async (incomplete) => {
          recordDiagnostics(session.getSnapshot().failures ?? []);
          setDownloadState(incomplete?.state ?? "failed");
        },
        onCommitFailed: async (response) => {
          recordDiagnostics(
            [{ path: "(manifest)", reason: "manifest-commit", status: 0, attempts: 1 }],
            { serviceWorkerState: String(response?.reason ?? serviceWorkerState ?? "commit-unconfirmed") },
          );
          setDownloadState("commit-failed");
        },
        onCommitted: async (_candidate, _response, activeState) => {
          // Keep refs current synchronously: a player may immediately invoke a
          // follow-up action before React has scheduled the mirroring effect.
          const active = (activeState?.active ?? manifest) as Manifest;
          installedManifestRef.current = active;
          setInstalledManifest(active);
          setPreviousManifest((activeState?.previous ?? null) as Manifest | null);
          setUpdateDismissed(false);
          setDiagnostics(null);
          setDownloadState("complete");
        },
      });
      finalization = task;
      const outcome = await task;
      // A failed commit is intentionally retryable without downloading the
      // already verified pack again. A successful completion stays sealed for
      // this session; the next install/update creates a new closure above.
      if (!outcome.committed) finalization = null;
      return outcome;
    };
    finalizeSessionRef.current = finalize;

    let final;
    try {
      final = await session.start();
    } catch (cause) {
      // A rejection here used to escape into an unhandled promise and leave the
      // screen exactly as it was, which read as "nothing happened".
      await refreshStored();
      recordDiagnostics([{ path: "(session)", reason: "unknown", status: 0, attempts: 1 }]);
      setError(String((cause as Error)?.message ?? cause));
      setDownloadState("failed");
      return;
    }
    await finalize(final);
  }, [baseUrl, refreshStored]);

  const startInstall = useCallback(() => {
    if (!targetManifest || !installPlan) return;
    // If a newer release exists while the active pack is partially missing,
    // repair directly into the published generation. Repairing the old
    // manifest first would download the same bytes and then require a second
    // update/commit step.
    if (publishedManifest && updateEvaluation?.available) {
      void runDownload(updateEvaluation.diff.downloadable, publishedManifest, "update");
      return;
    }
    void runDownload(installPlan.pending, targetManifest, installedManifest ? "repair" : "install");
  }, [installPlan, installedManifest, publishedManifest, runDownload, targetManifest, updateEvaluation]);

  const startUpdate = useCallback(() => {
    if (!publishedManifest || !updateEvaluation?.available) return;
    void runDownload(updateEvaluation.diff.downloadable, publishedManifest, "update");
  }, [publishedManifest, runDownload, updateEvaluation]);

  /**
   * After a commit acknowledgement failed, a reload can find a complete,
   * verified candidate pack before the worker has an active pointer to it. This
   * path deliberately performs only the pointer recovery: no session, fetcher,
   * asset write, cache clearing, or game/save mutation is involved.
   */
  const recoverCommittedPack = useCallback(() => {
    if (commitRecoveryRef.current) return;
    const candidate = publishedManifest as Manifest | null;
    if (!candidate) return;

    const task = (async () => {
      setError(null);
      setDiagnostics(null);
      setCommitRecoveryBusy(true);
      const startedAt = Date.now();
      const record = (reason: string) => setDiagnostics(describeFailureDiagnostics({
        kind: "commit-recovery",
        fromVersion: installedManifestRef.current?.version ?? null,
        toVersion: candidate.version,
        releaseSha: candidate.releaseSha,
        failures: [{ path: "(manifest)", reason, status: 0, attempts: 1 }],
        startedAt,
        lastProgressAt: startedAt,
        origin: window.location.origin,
        scope: registrationRef.current?.scope ?? baseUrl,
        standalone: isStandaloneDisplay(window),
        storedCount: storedHashesRef.current.size,
        storedBytes: 0,
        pendingCount: 0,
        pendingBytes: 0,
        serviceWorkerState: "commit-recovery",
      }));

      // Re-read the active state just before the write. If another context
      // already completed the commit, reflect it and avoid a duplicate commit.
      const before = await requestFromServiceWorker(registrationRef.current, { type: "pwa:get-state" });
      if (Array.isArray(before?.active?.assets) && before.active.assets.length > 0) {
        installedManifestRef.current = before.active as Manifest;
        setInstalledManifest(before.active as Manifest);
      }
      if (Array.isArray(before?.previous?.assets)) setPreviousManifest(before.previous as Manifest);
      if (manifestsEqual(before?.active, candidate)) {
        setDownloadState(null);
        return;
      }

      await recoverVerifiedPwaManifest({
        manifest: candidate,
        storedHashes: storedHashesRef.current,
        refreshStored,
        registration: registrationRef.current,
        commitManifest: async (registration, manifest) => requestFromServiceWorker(
          registration,
          { type: "pwa:commit-manifest", manifest },
        ),
        readActiveState: async (registration) => requestFromServiceWorker(registration, { type: "pwa:get-state" }),
        persistStorage: async () => import("./pwaAssetStore.js").then((m) => m.persistStorage(window.navigator)),
        onIncomplete: async () => {
          record("cache-incomplete");
          setDownloadState("failed");
        },
        onCommitFailed: async (response) => {
          record("manifest-commit");
          setError(response?.reason === "active-mismatch"
            ? "保存済みデータの切り替えを確認できませんでした。"
            : null);
          setDownloadState("commit-failed");
        },
        onCommitted: async (_manifest, _response, activeState) => {
          const active = (activeState?.active ?? candidate) as Manifest;
          installedManifestRef.current = active;
          setInstalledManifest(active);
          setPreviousManifest((activeState?.previous ?? null) as Manifest | null);
          setUpdateDismissed(false);
          setDiagnostics(null);
          setDownloadState("complete");
        },
      });
    })().catch((cause) => {
      setError(String((cause as Error)?.message ?? cause));
      setDownloadState("commit-failed");
    }).finally(() => {
      commitRecoveryRef.current = null;
      setCommitRecoveryBusy(false);
    });
    commitRecoveryRef.current = task;
  }, [baseUrl, publishedManifest, refreshStored]);

  /** Retries only what did not finish, never what already verified. */
  const retryFailed = useCallback(() => {
    if (commitRecovery.required) {
      recoverCommittedPack();
      return;
    }
    void (async () => {
      const session = sessionRef.current;
      const finalize = finalizeSessionRef.current;
      if (!session || !finalize) return;
      setDiagnostics(null);
      try {
        const final = await session.retryFailed();
        await finalize(final);
      } catch (cause) {
        setError(String((cause as Error)?.message ?? cause));
        setDownloadState("failed");
      }
    })();
  }, [commitRecovery.required, recoverCommittedPack]);

  const clearAssets = useCallback(async () => {
    await storeRef.current?.clearAssets();
    await requestFromServiceWorker(registrationRef.current, { type: "pwa:clear-assets" });
    await refreshStored();
  }, [refreshStored]);

  // Bytes held that neither the active nor the rollback generation references.
  // Null until both manifests are known, because guessing from a partial view
  // would report every asset of an unknown generation as garbage.
  const orphanCount = useMemo(() => {
    if (!installedManifest) return null;
    const retained = new Set<string>();
    for (const manifest of [installedManifest, previousManifest]) {
      for (const asset of (manifest?.assets ?? []) as Array<{ hash: string }>) retained.add(asset.hash);
    }
    let orphans = 0;
    for (const hash of storedHashes) if (!retained.has(hash)) orphans += 1;
    return orphans;
  }, [installedManifest, previousManifest, storedHashes]);

  const playable = canPlayOffline({ phase, installPlan });
  const installCopy = describeInstall(installPlan, storage);
  const updateCopy = updateEvaluation ? describeUpdate(updateEvaluation, { formatBytes }) : null;
  const offerCopy = describeInstallOffer(targetManifest, { promptAvailable: Boolean(installPrompt) });
  const guidance = describeInstallGuidance({
    standalone,
    promptAvailable: Boolean(installPrompt),
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
  });

  const copyDiagnostics = useCallback(() => {
    const text = formatFailureDiagnostics(diagnostics);
    if (!text) return;
    void (async () => {
      try {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      } catch { /* a refused clipboard is not worth an error panel */ }
    })();
  }, [diagnostics]);

  const acceptInstallPrompt = useCallback(() => {
    const prompt = installPrompt;
    if (!prompt) return;
    setInstallPromptUsed(true);
    void Promise.resolve(prompt.prompt()).catch(() => {});
  }, [installPrompt]);

  // A fully installed app, or a tab whose player chose to keep browsing, renders
  // the game untouched. The install invitation and the first-run download sit in
  // front of the title so they are the first thing a new visitor sees.
  //
  // `settling` covers the gap before the boot effect has established what this
  // device is. Without it the very first render is unblocked, the game mounts,
  // and title art and music are fetched before the player has been asked
  // anything - which is precisely what a browser tab must not do here. A
  // standalone launch also waits for the bounded published-manifest lookup:
  // otherwise a complete uncommitted candidate could slip through on reload.
  // If the lookup fails offline, `publishedChecked` still releases the retained
  // active generation rather than treating a network absence as data loss.
  const settling = !booted || (standalone && !publishedChecked);
  const blocking = settling
    || phase === "install-offer"
    || phase === "download-complete"
    || phase === "download-incomplete"
    || phase === "commit-required"
    || phase === "committing"
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

            {!settling && phase === "install-offer" && (
              <>
                <h2>{offerCopy?.headline ?? "西新世紀末物語をインストール"}</h2>
                <p>{offerCopy?.body ?? "ホーム画面に追加すると、アプリのように全画面で起動できます。"}</p>
                {offerCopy?.sizeLine && <p className="pwa-hint">{offerCopy.sizeLine}</p>}
                <p className="pwa-hint">{offerCopy?.noDownloadHint ?? "この画面ではゲームデータをダウンロードしません。"}</p>

                {guidance?.mode === "prompt" && !installPromptUsed && (
                  <button type="button" className="pwa-primary" onClick={acceptInstallPrompt}>
                    {offerCopy?.actionLabel ?? guidance.actionLabel}
                  </button>
                )}

                {/*
                  The written route stands in whenever there is no button to
                  press - either because the browser never offered one, or
                  because its one-shot prompt has already been used and possibly
                  dismissed. Without this, dismissing the prompt would leave the
                  player no way to install at all.
                */}
                {guidance && (guidance.mode === "manual" || installPromptUsed) && (
                  <div className="pwa-install-guidance" data-install-platform={guidance.platform}>
                    <h3>ホーム画面に追加する手順</h3>
                    {installPromptUsed && guidance.mode === "prompt" && (
                      <p className="pwa-hint">インストール画面が出ないときは、この手順でも追加できます。</p>
                    )}
                    {!installPromptUsed && <p className="pwa-hint">{guidance.body}</p>}
                    <InstallSteps steps={guidance.steps as Array<Record<string, unknown>>} />
                  </div>
                )}

                <div className="pwa-actions pwa-secondary-actions">
                  <button type="button" onClick={() => setOfferDismissed(true)}>
                    {offerCopy?.skipLabel ?? "ブラウザで遊ぶ"}
                  </button>
                </div>
                <p className="pwa-hint">{offerCopy?.skipHint ?? "インストールせずに遊ぶこともできます。"}</p>
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
                <p className="pwa-hint">次回からはダウンロードなしで起動できます。</p>
                <button type="button" className="pwa-primary" onClick={() => setDownloadState(null)}>
                  ゲームを始める
                </button>
              </>
            )}

            {(phase === "commit-required" || phase === "committing") && (
              <>
                <h2>保存済みデータを反映しています</h2>
                <p className="pwa-progress-line">
                  取得・サイズ確認・SHA-256確認済みの{publishedManifest?.assets?.length ?? storedHashes.size}件を、
                  この端末のゲームVersionとして確定します。
                </p>
                <p className="pwa-hint">
                  データ本体は再取得しません。反映が完了するまでゲームは開始しません。
                </p>
                {phase === "commit-required" && (
                  <button type="button" className="pwa-primary" onClick={recoverCommittedPack}>
                    保存済みデータを反映
                  </button>
                )}
                {phase === "committing" && <p className="pwa-hint" role="status">反映を確認しています…</p>}
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
                {/*
                  Large assets take a long time to arrive, verify and store, and
                  during that the counts do not move. Saying so is the difference
                  between "working" and "frozen"; without it the only honest
                  reading of a still screen is that the app has died.
                */}
                {stalledSeconds >= 12 && (
                  <p className="pwa-hint" role="status">
                    大きなデータを取得・検証中です（最終進捗から{stalledSeconds}秒）。
                    中断しても続きから再開できます。
                  </p>
                )}
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

            {phase === "download-incomplete" && (
              <>
                <h2>
                  {downloadState === "cancelled" ? "ダウンロードを中断しました"
                    : downloadState === "commit-failed" ? "保存はできましたが、切り替えに失敗しました"
                      : "データを取得できませんでした"}
                </h2>
                <p className="pwa-hint">
                  {downloadState === "commit-failed"
                    ? "取得したデータは端末に残っています。もう一度お試しください。"
                    : "完了済みのデータは保持しています。失敗した分だけ取り直せます。"}
                </p>
                {diagnostics && diagnostics.failures.length > 0 && (
                  <ul className="pwa-failure-list">
                    {diagnostics.failures.slice(0, 6).map((failure) => (
                      <li key={failure.path}>
                        <code>{failure.path}</code>
                        <span>{failure.label}{failure.status ? `／HTTP ${failure.status}` : ""}・{failure.attempts}回試行</span>
                      </li>
                    ))}
                    {diagnostics.failures.length > 6 && (
                      <li><span>ほか {diagnostics.failures.length - 6} 件</span></li>
                    )}
                  </ul>
                )}
                <div className="pwa-actions">
                  <button type="button" className="pwa-primary" onClick={retryFailed}>
                    {commitRecovery.required ? "保存済みデータを反映し直す" : "失敗した項目だけ再試行"}
                  </button>
                  <button type="button" onClick={copyDiagnostics}>
                    {copied ? "コピーしました" : "診断情報をコピー"}
                  </button>
                </div>
                <div className="pwa-actions pwa-secondary-actions">
                  {/* The old version keeps working while an update is unresolved. */}
                  <button type="button" onClick={() => setDownloadState(null)}>あとにする</button>
                </div>
                {error && <p className="pwa-warning" role="alert">{error}</p>}
              </>
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

      {/*
        Data management is a maintenance tool, not part of playing. It used to
        sit on every screen, which put a developer-facing button over the map,
        the loadout, dialogue, battle and the result. It now appears only where
        a player would go looking for it, and stays put while its own panel is
        open so the close button never moves out from under the cursor.
      */}
      {!blocking && supported && (DATA_SCREENS.has(String(safety.screen ?? "title")) || showStorage) && (
        <>
          <button type="button" className="pwa-storage-toggle" onClick={() => setShowStorage((open) => !open)}>
            データ管理
          </button>
          {showStorage && (
            <aside className="pwa-notice pwa-storage" role="dialog" aria-label="データ管理">
              <dl>
                <div><dt>現在のVersion</dt><dd>{installedManifest?.version ?? "未インストール"}</dd></div>
                <div><dt>ひとつ前のVersion</dt><dd>{previousManifest?.version ?? "-"}</dd></div>
                <div><dt>release SHA</dt><dd>{installedManifest?.releaseSha ?? "-"}</dd></div>
                <div><dt>origin</dt><dd>{typeof window === "undefined" ? "-" : window.location.origin}</dd></div>
                <div><dt>scope</dt><dd>{registrationScope ?? baseUrl}</dd></div>
                <div><dt>保存済みアセット</dt><dd>{storedHashes.size}件</dd></div>
                <div>
                  <dt>このVersionが使用中</dt>
                  <dd>{installPlan ? `${installPlan.satisfied.length}件・${formatBytes(installPlan.satisfiedBytes ?? 0)}` : "-"}</dd>
                </div>
                <div>
                  <dt>不足・破損</dt>
                  <dd>{installPlan ? `${installPlan.pendingCount}件・${formatBytes(installPlan.pendingBytes)}` : "-"}</dd>
                </div>
                <div>
                  {/*
                    Bytes held that no retained generation references. Kept
                    visible rather than swept silently: a number a player can
                    watch is what tells us whether repeated version testing is
                    accumulating anything, and clearing the cache wholesale is
                    never the answer we want them reaching for.
                  */}
                  <dt>参照されていないデータ</dt>
                  <dd>{orphanCount == null ? "確認中" : `${orphanCount}件`}</dd>
                </div>
              </dl>

              {diagnostics && (
                <div className="pwa-failure-summary">
                  <p className="pwa-warning">
                    直近の失敗：{diagnostics.kind}／{diagnostics.failureCount}件
                    {diagnostics.failures[0] ? `／${diagnostics.failures[0].reason}` : ""}
                  </p>
                  <div className="pwa-actions">
                    <button type="button" onClick={copyDiagnostics}>
                      {copied ? "コピーしました" : "診断情報をコピー"}
                    </button>
                    <button type="button" onClick={() => setDiagnostics(null)}>診断を消去</button>
                  </div>
                </div>
              )}
              {saveEnvironment && (
                <aside
                  className="save-environment-badge"
                  data-save-environment={saveEnvironment.kind}
                  data-save-origin={saveEnvironment.origin}
                  aria-label="セーブ保存環境"
                >
                  <span><b>{saveEnvironment.label}</b><code>{saveEnvironment.origin}</code></span>
                  <small>{saveEnvironment.storageScope}　{saveEnvironment.isolationNotice}</small>
                </aside>
              )}
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
