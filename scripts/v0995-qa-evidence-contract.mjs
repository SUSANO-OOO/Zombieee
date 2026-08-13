const normalizePathname = (value) => {
  try {
    return decodeURIComponent(new URL(value, "http://qa.invalid/").pathname).replace(/\/+$/u, "");
  } catch {
    return String(value ?? "").replace(/[?#].*$/u, "").replace(/\/+$/u, "");
  }
};

const pathMatches = (requestUrl, requiredPath) => {
  const requestPath = normalizePathname(requestUrl);
  const candidatePath = normalizePathname(requiredPath);
  return requestPath === candidatePath || requestPath.endsWith(candidatePath);
};

export function reconcilePageClockRequestFailures({
  failures,
  calibrations,
  maxRoundTripMs = 250,
  maxOffsetDriftMs = 50,
}) {
  if (!Array.isArray(calibrations) || calibrations.length < 2) {
    throw new Error("request failure clock requires two page-clock calibrations");
  }
  const normalized = calibrations.map((sample) => {
    const values = [sample?.nodeBefore, sample?.nodeAfter, sample?.pageNow];
    if (!values.every(Number.isFinite) || sample.nodeAfter < sample.nodeBefore) {
      throw new Error("request failure clock calibration is not finite");
    }
    const roundTripMs = sample.nodeAfter - sample.nodeBefore;
    if (roundTripMs > maxRoundTripMs) {
      throw new Error(`request failure clock calibration exceeded ${maxRoundTripMs}ms`);
    }
    const nodeMidpoint = sample.nodeBefore + roundTripMs / 2;
    return {
      ...sample,
      nodeMidpoint,
      roundTripMs,
      pageMinusNodeMs: sample.pageNow - nodeMidpoint,
    };
  });
  const offsets = normalized.map(({ pageMinusNodeMs }) => pageMinusNodeMs);
  if (Math.max(...offsets) - Math.min(...offsets) > maxOffsetDriftMs) {
    throw new Error(`request failure clock offset drift exceeded ${maxOffsetDriftMs}ms`);
  }
  const first = normalized[0];
  const last = normalized.at(-1);
  const interpolateOffset = (nodeTime) => {
    if (last.nodeMidpoint <= first.nodeMidpoint) return last.pageMinusNodeMs;
    const ratio = Math.max(0, Math.min(1,
      (nodeTime - first.nodeMidpoint) / (last.nodeMidpoint - first.nodeMidpoint)));
    return first.pageMinusNodeMs + (last.pageMinusNodeMs - first.pageMinusNodeMs) * ratio;
  };
  return {
    calibrations: normalized,
    failures: failures.map((failure) => {
      if (![failure?.startedAt, failure?.failedAt].every(Number.isFinite)
        || failure.failedAt < failure.startedAt) {
        throw new Error("request failure timestamp is not finite");
      }
      return {
        ...failure,
        nodeStartedAt: failure.startedAt,
        nodeFailedAt: failure.failedAt,
        startedAt: failure.startedAt + interpolateOffset(failure.startedAt),
        failedAt: failure.failedAt + interpolateOffset(failure.failedAt),
      };
    }),
  };
}

export function classifySupersededAssetRequestFailures({
  failures,
  history,
  requiredSprites,
  loadedSpriteKeys,
  terminalState,
  cancellationGraceMs = 1_000,
}) {
  const terminalReady = [...history].reverse().find((entry) => (
    entry?.status === "ready" && entry?.generation === terminalState?.generation
  ));
  const cancelled = history.filter((entry) => (
    entry?.status === "cancelled"
    && entry?.reason === "superseded-by-selection-change"
    && Number(entry?.generation) < Number(terminalState?.generation)
  ));
  const loaded = new Set(loadedSpriteKeys);
  const accepted = [];
  const rejected = [];

  for (const failure of failures) {
    const sprite = requiredSprites.find(({ path }) => pathMatches(failure.url, path));
    const owner = cancelled.find((entry) => {
      const startedAt = Date.parse(entry.startedAt);
      const endedAt = startedAt + Number(entry.elapsedMs ?? 0);
      return Number.isFinite(startedAt)
        && failure.startedAt >= startedAt
        // Playwright can deliver the request event immediately after the
        // product cleanup that aborted it.  Keep the same bounded grace on
        // both observed request timestamps; pending-path ownership below is
        // still required, so this does not admit an unrelated abort.
        && failure.startedAt <= endedAt + cancellationGraceMs
        && failure.failedAt >= failure.startedAt
        && failure.failedAt <= endedAt + cancellationGraceMs;
    });
    const reasons = [];
    if (failure.phase !== "setup") reasons.push("failure was observed after the ready boundary");
    if (failure.errorText !== "net::ERR_ABORTED") reasons.push(`unexpected failure ${failure.errorText}`);
    if (!terminalReady
      || terminalState?.state !== "ready"
      || terminalState?.failed !== 0
      || terminalState?.pending !== 0
      || terminalState?.completed !== terminalState?.total
      || terminalReady.completed !== terminalReady.total
      || (terminalReady.failures?.length ?? 0) !== 0
      || terminalReady.deadlineReached !== false) {
      reasons.push("terminal asset generation was not ready");
    }
    if (!owner) reasons.push("no temporally owning superseded selection-change generation");
    if (owner && sprite && !owner.pendingPaths?.some((path) => pathMatches(failure.url, path))) {
      reasons.push("failure path was not pending in the owning cancelled generation");
    }
    if (!sprite) reasons.push("request is not a required production sprite");
    if (sprite && !loaded.has(sprite.kind)) reasons.push(`terminal generation did not load ${sprite.kind}`);
    const evidence = {
      ...failure,
      spriteKind: sprite?.kind ?? null,
      cancelledGeneration: owner?.generation ?? null,
      terminalGeneration: terminalState?.generation ?? null,
      reasons,
    };
    (reasons.length === 0 ? accepted : rejected).push(evidence);
  }
  return { accepted, rejected, terminalReady: terminalReady ?? null };
}

export function strictCanvasScreenshotClip(box, viewport) {
  const values = [box?.x, box?.y, box?.width, box?.height, viewport?.width, viewport?.height];
  if (!values.every(Number.isFinite)) throw new Error("canvas screenshot geometry is not finite");
  if (box.width <= 0 || box.height <= 0) throw new Error("canvas screenshot geometry is empty");
  if (box.x < 0 || box.y < 0) throw new Error("canvas screenshot starts outside the viewport");
  if (box.x + box.width > viewport.width + .01 || box.y + box.height > viewport.height + .01) {
    throw new Error("canvas screenshot extends outside the viewport");
  }
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}
