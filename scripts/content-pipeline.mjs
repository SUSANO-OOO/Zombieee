import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runContentPipelineAudits } from "../app/content/audits.js";
import {
  createSyntheticContentRegistry,
  generateContentFixture,
  generateContentFixtureFiles,
} from "../app/content/generator.js";
import { CONTENT_REGISTRY } from "../app/content/registry.js";
import { validateContentRegistry } from "../app/content/validator.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const fixturePath = path.join(repositoryRoot, "tests", "fixtures", "content-pipeline", "drill-input.json");
const outputDirectory = path.join(repositoryRoot, "work", "content-pipeline-fixture");
const mediaPattern = /\.(?:avif|gif|jpe?g|mp3|ogg|png|svg|webp|wav)$/iu;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function collectPhysicalAssetPaths(directory, prefix = "") {
  const output = new Set();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const child of await collectPhysicalAssetPaths(path.join(directory, entry.name), relativePath)) output.add(child);
    } else if (entry.isFile() && mediaPattern.test(entry.name)) {
      output.add(relativePath);
    }
  }
  return output;
}

async function readFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

async function writeGeneratedFiles(files) {
  await mkdir(outputDirectory, { recursive: true });
  const results = [];
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(outputDirectory, name);
    let previous = null;
    try {
      previous = await readFile(target, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const changed = previous !== contents;
    if (changed) await writeFile(target, contents, "utf8");
    results.push({ name, changed, sha256: digest(contents), bytes: Buffer.byteLength(contents) });
  }
  return results;
}

async function cleanGeneratedFiles(files) {
  const resolvedOutput = path.resolve(outputDirectory);
  const resolvedWork = path.resolve(repositoryRoot, "work");
  if (!resolvedOutput.startsWith(`${resolvedWork}${path.sep}`)) {
    throw new Error(`Refusing to clean outside work directory: ${resolvedOutput}`);
  }
  const removed = [];
  for (const name of Object.keys(files)) {
    const target = path.join(resolvedOutput, name);
    try {
      const targetStats = await stat(target);
      if (!targetStats.isFile()) throw new Error(`Refusing to remove non-file output: ${target}`);
      await unlink(target);
      removed.push(name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    await rmdir(resolvedOutput);
  } catch (error) {
    if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
  }
  return removed;
}

async function validationReport() {
  const physicalAssetPaths = await collectPhysicalAssetPaths(path.join(repositoryRoot, "public"));
  const production = validateContentRegistry(CONTENT_REGISTRY, { physicalAssetPaths });
  const syntheticRegistry = createSyntheticContentRegistry({
    unitCount: 100,
    enemyCount: 100,
    stageCount: 100,
  });
  const synthetic = validateContentRegistry(syntheticRegistry);
  const audits = runContentPipelineAudits();
  return {
    ok: production.ok && synthetic.ok && audits.ok,
    production,
    synthetic: {
      ok: synthetic.ok,
      errors: synthetic.errors,
      warnings: synthetic.warnings,
      counts: synthetic.counts,
    },
    audits,
  };
}

async function drillReport(mode) {
  const fixture = await readFixture();
  const registry = generateContentFixture(fixture);
  const validation = validateContentRegistry(registry);
  const files = generateContentFixtureFiles(fixture);
  const manifest = Object.entries(files).map(([name, contents]) => ({
    name,
    sha256: digest(contents),
    bytes: Buffer.byteLength(contents),
  }));
  if (mode === "dry-run") {
    return { ok: validation.ok, mode, validation, manifest, changedFiles: null };
  }
  if (mode === "write") {
    const writeResults = await writeGeneratedFiles(files);
    return {
      ok: validation.ok,
      mode,
      validation,
      manifest,
      changedFiles: writeResults.filter(({ changed }) => changed).map(({ name }) => name),
      outputDirectory,
    };
  }
  if (mode === "clean") {
    return {
      ok: true,
      mode,
      removedFiles: await cleanGeneratedFiles(files),
      outputDirectory,
    };
  }
  throw new RangeError(`Unknown drill mode: ${mode}`);
}

async function galleryQaReport() {
  const { chromium } = await import("playwright");
  const galleryPath = path.join(outputDirectory, "qa-gallery.html");
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 844, height: 390 },
    { width: 844, height: 340 },
  ];
  const results = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const diagnostics = [];
      page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console:${message.text()}`);
      });
      page.on("pageerror", (error) => diagnostics.push(`pageerror:${error.message}`));
      page.on("requestfailed", (request) => diagnostics.push(`requestfailed:${request.url()}`));
      await page.goto(pathToFileURL(galleryPath).href, { waitUntil: "load" });
      const kinds = await page.locator("article[data-kind]").evaluateAll((articles) => (
        articles.map((article) => article.getAttribute("data-kind"))
      ));
      results.push({
        viewport,
        title: await page.title(),
        fixture: await page.locator("body").getAttribute("data-fixture"),
        kinds,
        diagnostics,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return {
    ok: results.every((result) => (
      result.title === "Content fixture gallery"
      && result.fixture === "true"
      && JSON.stringify(result.kinds) === JSON.stringify(["unit", "enemy", "stage"])
      && result.diagnostics.length === 0
    )),
    results,
  };
}

async function main() {
  const [command = "validate", option = ""] = process.argv.slice(2);
  let report;
  if (command === "validate") {
    report = await validationReport();
  } else if (command === "drill") {
    const mode = option === "--write" ? "write" : option === "--clean" ? "clean" : "dry-run";
    report = await drillReport(mode);
  } else if (command === "gallery-qa") {
    report = await galleryQaReport();
  } else {
    throw new RangeError(`Unknown command: ${command}`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

await main();
