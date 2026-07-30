import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function fileSha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function recursiveFileNames(root, directory = root) {
  const names = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      names.push(...await recursiveFileNames(root, entryPath));
    } else if (entry.isFile()) {
      names.push(path.relative(root, entryPath).replaceAll("\\", "/"));
    }
  }
  return names;
}

function manifestSha256(entries) {
  const manifest = createHash("sha256");
  for (const entry of entries) {
    manifest.update(entry.path);
    manifest.update("\0");
    manifest.update(String(entry.bytes));
    manifest.update("\0");
    manifest.update(entry.sha256);
    manifest.update("\n");
  }
  return manifest.digest("hex");
}

export async function productionBuildIdentity(root = process.cwd()) {
  const distRoot = path.resolve(root, "dist");
  const relativeNames = await recursiveFileNames(distRoot);
  const files = [];
  for (const relativeName of relativeNames) {
    const filePath = path.join(distRoot, ...relativeName.split("/"));
    files.push({
      path: relativeName,
      bytes: (await stat(filePath)).size,
      sha256: await fileSha256(filePath),
    });
  }
  const entryByPath = new Map(files.map((entry) => [entry.path, entry]));
  const serverIndex = entryByPath.get("server/index.js");
  const clientManifest = entryByPath.get("client/.vite/manifest.json");
  if (!serverIndex || !clientManifest) {
    throw new Error("Production build identity requires dist/server/index.js and dist/client/.vite/manifest.json");
  }
  const clientAssets = files.filter(({ path: filePath }) => (
    filePath.startsWith("client/assets/")
  ));
  const fullDistManifestSha256 = manifestSha256(files);
  return Object.freeze({
    algorithm: "sha256",
    scope: "dist-recursive",
    serverIndex: {
      path: "dist/server/index.js",
      sha256: serverIndex.sha256,
    },
    clientManifest: {
      path: "dist/client/.vite/manifest.json",
      sha256: clientManifest.sha256,
    },
    clientAssets: {
      path: "dist/client/assets",
      files: clientAssets.length,
      bytes: clientAssets.reduce((total, entry) => total + entry.bytes, 0),
      manifestSha256: manifestSha256(clientAssets),
    },
    fullDist: {
      path: "dist",
      files: files.length,
      bytes: files.reduce((total, entry) => total + entry.bytes, 0),
      manifestSha256: fullDistManifestSha256,
    },
    combinedSha256: fullDistManifestSha256,
  });
}
