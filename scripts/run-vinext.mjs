import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cliPath = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));

const env = {
  ...process.env,
  WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
};

// vinext 0.0.50 builds its production static-file cache from path.relative().
// Windows returns backslashes there, while HTTP lookups always use slashes, so
// `vinext start` otherwise SSRs `/` but 404s every `/assets/*` request. Run the
// start command in-process with URL-style relative paths until upstream fixes
// the cache. Its MIME table also omits MP3/OGG, so register those production
// formats before the cache is built. Other commands stay in the child process.
if (process.argv[2] === "start") {
  if (process.platform === "win32") {
    const platformRelative = path.relative;
    path.relative = (...args) => platformRelative(...args).replaceAll(path.sep, "/");
  }
  const { CONTENT_TYPES } = await import("../node_modules/vinext/dist/server/static-file-cache.js");
  CONTENT_TYPES[".mp3"] = "audio/mpeg";
  CONTENT_TYPES[".ogg"] = "audio/ogg";
  await import(pathToFileURL(cliPath).href);
} else {
  const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
