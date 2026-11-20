const WORKER_STATE_RECHECK_MS = 5000;
const unavailable = state => !state || state.type === "pwa:error";

async function readWorkerState(registration, readState, options) {
  const attempt = async () => {
    const active = registration.active;
    const state = await readState(registration, options);
    return active && registration.active !== active ? null : state;
  };
  const first = attempt();
  if (!registration.active) return first;

  let timer;
  const waiting = Symbol("waiting for worker");
  try {
    const initial = await Promise.race([
      first,
      new Promise(resolve => { timer = setTimeout(resolve, WORKER_STATE_RECHECK_MS, waiting); }),
    ]);
    if (options.signal.aborted) return null;
    if (initial !== waiting) return unavailable(initial) ? attempt() : initial;

    // A recheck does not invalidate a response already on its way. Either
    // request can finish, while both share the same original boot deadline.
    const usable = async request => {
      const response = await request;
      if (unavailable(response)) throw new Error("worker-state-unavailable");
      return response;
    };
    return Promise.any([usable(first), usable(attempt())]).catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}

// Local inventory must be known before deciding to install or repair a pack.
// A rejected or stalled cache read is not evidence that the cache is empty.
export async function readPwaBootState({ register, readState, readHashes, timeoutMs = 12000 }) {
  const controller = new AbortController();
  const { signal } = controller;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("pwa-boot-timeout")), timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const registration = await register();
        if (!registration || signal.aborted) return { registration: null };
        const state = await readWorkerState(registration, readState, { signal, timeoutMs });
        if (unavailable(state) || signal.aborted) throw new Error("worker-state-unavailable");
        // Use the inventory delivered with the manifest. The page supplies
        // it only when an older worker omitted it or sent an invalid list.
        const workerHashes = state.type === "pwa:state" && Array.isArray(state.storedHashes)
          && state.storedHashes.every(hash => typeof hash === "string" && /^sha256-[0-9a-f]{64}$/u.test(hash))
          ? state.storedHashes : null;
        const hashes = workerHashes ? new Set(workerHashes) : await readHashes();
        return { registration, state, hashes };
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
