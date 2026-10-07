import { readdir } from "node:fs/promises";
import path from "node:path";

/** RSC styles can be emitted without a corresponding Vite manifest entry. */
export async function emittedPwaShellFiles(clientDir) {
  const files = [];
  async function visit(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`PWA shell asset cannot be a link: ${relative}`);
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), relative);
      else if (entry.isFile() && /\.(?:js|mjs|css)$/u.test(entry.name)) {
        if (!/^assets\/[A-Za-z0-9_./-]+\.(?:js|mjs|css)$/u.test(relative)) throw new Error(`Invalid PWA shell path: ${relative}`);
        files.push(relative);
      }
    }
  }
  await visit(path.join(clientDir, "assets"), "assets");
  if (files.length === 0) throw new Error("Build emitted no PWA shell JS/CSS files");
  return files.sort();
}
