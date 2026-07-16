import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve("_site");
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? "/Zombieee";
const evidenceDir = path.resolve("pages-evidence");
await mkdir(evidenceDir, { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (!requestUrl.pathname.startsWith(`${basePath}/`) && requestUrl.pathname !== basePath) {
    response.writeHead(404).end("Not found");
    return;
  }
  let relativePath = decodeURIComponent(requestUrl.pathname.slice(basePath.length)).replace(/^\/+/, "");
  if (!relativePath) relativePath = "index.html";
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(400).end("Invalid path");
    return;
  }
  try {
    const metadata = await stat(absolutePath);
    response.writeHead(200, {
      "content-length": metadata.size,
      "content-type": contentTypes[path.extname(absolutePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(absolutePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start the Pages smoke server");
const url = `http://127.0.0.1:${address.port}${basePath}/`;

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], warnings: [] };
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "warning") diagnostics.warnings.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
    page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));

    const navigation = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (!navigation?.ok()) throw new Error(`GitHub Pages document failed: ${navigation?.status()}`);
    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout: 120_000 });
    await page.getByRole("button", { name: "物語を始める", exact: true }).waitFor({ state: "visible", timeout: 30_000 });

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
    }));
    if (dimensions.documentWidth !== viewport.width || dimensions.bodyWidth !== viewport.width) {
      throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(dimensions)}`);
    }

    await page.screenshot({ path: path.join(evidenceDir, `github-pages-title-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await page.getByRole("button", { name: "物語を始める", exact: true }).click();
    await page.locator(".event-screen, .campaign-map-screen").first().waitFor({ state: "visible", timeout: 30_000 });

    const unexpectedWarnings = diagnostics.warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
    if (diagnostics.consoleErrors.length || diagnostics.pageErrors.length || diagnostics.requestFailures.length || unexpectedWarnings.length) {
      throw new Error(`Browser diagnostics failed: ${JSON.stringify({ ...diagnostics, warnings: unexpectedWarnings })}`);
    }

    results.push({ viewport, title: await page.title(), dimensions, warningCount: diagnostics.warnings.length });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify({ url, results }, null, 2), "utf8");
console.log(JSON.stringify({ url, results }, null, 2));
