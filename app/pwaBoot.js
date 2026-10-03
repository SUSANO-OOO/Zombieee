// Local inventory must be known before deciding to install or repair a pack.
// A rejected or stalled cache read is not evidence that the cache is empty.
export async function readPwaBootState({ register, readState, readHashes, timeoutMs = 12000 }) {
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const registration = await register();
        if (!registration) return { registration: null };
        const state = await readState(registration);
        if (!state || state.type === "pwa:error") throw new Error("worker-state-unavailable");
        const hashes = await readHashes();
        return { registration, state, hashes };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("pwa-boot-timeout")), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
