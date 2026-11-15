import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// An explicit, fresh profile lets a large installed-PWA check use a volume
// with enough space without changing the computer's global temp directory.
export async function createPartialPwaProfileDirectory(directory) {
  if (directory === undefined) {
    return mkdtemp(path.join(os.tmpdir(), "z-pwa-"));
  }
  if (typeof directory !== "string" || !directory.trim() || !path.isAbsolute(directory)) {
    throw new Error("PWA_PARTIAL_UPDATE_PROFILE_DIR must be an absolute directory path");
  }
  const resolved = path.resolve(directory);
  // Keep Windows storage-backend paths within the same bound as the
  // installed-profile runner. This does not change the browser or its guards.
  if (process.platform === "win32" && resolved.length > 60) {
    throw new Error("PWA_PARTIAL_UPDATE_PROFILE_DIR must be at most 60 characters on Windows");
  }
  // Never open, clear, or reuse an existing directory, even an empty one.
  // The caller supplies an existing parent, and owns this newly created path.
  await mkdir(resolved);
  return resolved;
}
