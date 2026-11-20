// Local inventory must be known before deciding to install or repair a pack.
// A rejected or stalled cache read is not evidence that the cache is empty.
export async function readPwaBootState({ register, readState, readHashes, timeoutMs = 12000 }) {
  let timer;
  let expired = false;
  try {
    return await Promise.race([
      (async () => {
        const registration = await register();
        if (!registration) return { registration: null };
        let state = await readState(registration);
        const unavailable = value => !value || value.type === "pwa:error";
        // A saved pack may still be waking its worker on the first request.
        if (registration.active && unavailable(state) && !expired) state = await readState(registration);
        if (unavailable(state)) throw new Error("worker-state-unavailable");
        // The worker reports the same Cache Storage inventory with its manifest.
        // Read it from the page only for older or incomplete worker responses.
        const workerHashes = state.type === "pwa:state" && Array.isArray(state.storedHashes)
          && state.storedHashes.every(hash => typeof hash === "string" && /^sha256-[0-9a-f]{64}$/u.test(hash))
          ? state.storedHashes : null;
        const hashes = workerHashes ? new Set(workerHashes) : await readHashes();
        return { registration, state, hashes };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("pwa-boot-timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
