import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const baseUrl = new URL(process.env.V095_VISUAL_BASELINE_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5 visual baseline is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engine = process.env.V095_VISUAL_BASELINE_ENGINE ?? "chromium";
const browserType = { chromium: playwright.chromium, webkit: playwright.webkit }[engine];
if (!browserType) throw new Error(`Unsupported V095_VISUAL_BASELINE_ENGINE: ${engine}`);

const evidenceDir = path.resolve(
  process.env.V095_VISUAL_BASELINE_EVIDENCE_DIR ?? "outputs/v095-visual-baseline",
);
const reportDir = path.resolve(
  process.env.V095_VISUAL_BASELINE_REPORT_DIR ?? evidenceDir,
);
const timeout = Math.max(8_000, Number(process.env.V095_VISUAL_BASELINE_TIMEOUT_MS) || 24_000);
const attackProbeMs = Math.max(
  1_500,
  Math.min(timeout, Number(process.env.V095_VISUAL_BASELINE_ATTACK_PROBE_MS) || 4_000),
);
const viewport = { width: 844, height: 390 };
const unitKinds = [
  "scout",
  "ranger",
  "brute",
  "brawler",
  "gunner",
  "medic",
  "crazy-king",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
];
const baselineReleaseSha = "f2633c538756385f13d166d3adbcdd39b3a08b21";
const baselineIntegrationSha = "76b9168d03109fbb473df7632f0f201d9612f13d";
const phases = ["entry", "ready", "attack-probe-0", "attack-probe-1", "attack-probe-2", "attack-probe-3"];
const results = [];

await mkdir(evidenceDir, { recursive: true });
await mkdir(reportDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function baselineProvenance() {
  const currentHead = git("rev-parse", "HEAD");
  git("merge-base", "--is-ancestor", baselineReleaseSha, currentHead);
  const changed = [
    ...git("diff", "--name-only", baselineReleaseSha, "--").split(/\r?\n/u),
    ...git("ls-files", "--others", "--exclude-standard").split(/\r?\n/u),
  ].filter(Boolean);
  const allowedExact = new Set([
    "AGENTS.md",
    "README.md",
    "package.json",
    "scripts/run-browser-qa-with-server.mjs",
    "scripts/v095-visual-baseline.mjs",
    "tests/v095-baseline-contract.test.mjs",
  ]);
  const unexpected = [...new Set(changed)].filter((file) => (
    !allowedExact.has(file) && !file.startsWith("docs/")
  ));
  invariant(
    unexpected.length === 0,
    `Version 0.9.0 visual baseline runtime drifted outside the evidence allowlist: ${unexpected.join(", ")}`,
  );

  const releasePackage = JSON.parse(git("show", `${baselineReleaseSha}:package.json`));
  const currentPackage = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  delete currentPackage.scripts["qa:v095-visual-baseline"];
  invariant(
    JSON.stringify(currentPackage) === JSON.stringify(releasePackage),
    "package.json changed beyond the one Version 0.9.5 visual baseline command",
  );
  const releaseRunner = git("show", `${baselineReleaseSha}:scripts/run-browser-qa-with-server.mjs`)
    .replaceAll("\r\n", "\n");
  const currentRunner = readFileSync(
    path.resolve("scripts/run-browser-qa-with-server.mjs"),
    "utf8",
  )
    .replaceAll("\r\n", "\n")
    .replace("process.env.V095_VISUAL_BASELINE_QA_BASE_URL = origin;\n", "");
  invariant(
    currentRunner.trimEnd() === releaseRunner.trimEnd(),
    "run-browser-qa-with-server.mjs changed beyond the Version 0.9.5 baseline origin handoff",
  );

  return {
    currentHead,
    changedPaths: [...new Set(changed)].sort(),
  };
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function assertDiagnostics(diagnostics) {
  for (const [kind, entries] of Object.entries(diagnostics)) {
    invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
  }
}

function compactFighter(fighter) {
  if (!fighter) return null;
  return {
    id: fighter.id,
    kind: fighter.kind,
    side: fighter.side,
    x: fighter.x,
    y: fighter.y,
    lane: fighter.lane,
    combatReady: fighter.combatReady,
    gateEntering: fighter.gateEntering,
    targetId: fighter.targetId,
    crawlerDefenseTargetId: fighter.crawlerDefenseTargetId,
    aiDestinationX: fighter.aiDestinationX,
    aiMoveDirection: fighter.aiMoveDirection,
    attack: fighter.attack,
    attackSequence: fighter.attackSequence,
    cooldown: fighter.cooldown,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
  };
}

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (ratio) => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? null;
  return {
    samples: sorted.length,
    minimum: sorted.at(0) ?? null,
    median: at(.5),
    p95: at(.95),
    maximum: sorted.at(-1) ?? null,
  };
}

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "1",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

async function fighterSnapshot(page, unitKind, fighterId) {
  return page.evaluate(({ kind, id }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return {
      capturedAt: performance.now(),
      fighter: snapshot.fighters.find((candidate) => (
        candidate.id === id && candidate.kind === kind
      )) ?? null,
      attacker: snapshot.fighters.find((candidate) => candidate.side === "zombie") ?? null,
      attackIdentity: snapshot.attackIdentity.filter(({ sourceId }) => sourceId === id),
      geometry: snapshot.geometry,
      crawlerDoor: snapshot.crawlerDoor,
    };
  }, { kind: unitKind, id: fighterId });
}

async function captureCanvas(page, unitKind, phase) {
  const outputPath = path.join(evidenceDir, `${String(results.length + 1).padStart(2, "0")}-${unitKind}-${phase}.png`);
  await page.locator("canvas.battlefield.active").screenshot({
    path: outputPath,
    animations: "allow",
  });
  return outputPath;
}

async function captureContinuousStrikeFrames(page, unitKind, fighterId) {
  const captures = await page.evaluate(async ({ id, count }) => {
    const canvas = document.querySelector("canvas.battlefield.active");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Active battle canvas is unavailable");
    const captured = [];
    for (let index = 0; index < count; index += 1) {
      if (index > 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const pixels = document.createElement("canvas");
      pixels.width = canvas.width;
      pixels.height = canvas.height;
      const context = pixels.getContext("2d");
      if (!context) throw new Error("Continuous frame canvas context is unavailable");
      context.drawImage(canvas, 0, 0);
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      captured.push({
        capturedAt: performance.now(),
        dataUrl: pixels.toDataURL("image/png"),
        fighter: snapshot.fighters.find((candidate) => candidate.id === id) ?? null,
        attacker: snapshot.fighters.find((candidate) => candidate.side === "zombie") ?? null,
        attackIdentity: snapshot.attackIdentity.filter(({ sourceId }) => sourceId === id),
        geometry: {
          offFloorCount: snapshot.geometry.offFloorCount,
          visuallyOffFloorCount: snapshot.geometry.visuallyOffFloorCount,
        },
      });
    }
    return captured;
  }, { id: fighterId, count: 4 });

  const frameNumber = String(results.length + 1).padStart(2, "0");
  return Promise.all(captures.map(async (snapshot, strikeIndex) => {
    const phase = `attack-probe-${strikeIndex}`;
    const outputPath = path.join(evidenceDir, `${frameNumber}-${unitKind}-${phase}.png`);
    const base64 = snapshot.dataUrl.slice(snapshot.dataUrl.indexOf(",") + 1);
    await writeFile(outputPath, Buffer.from(base64, "base64"));
    return {
      phase,
      path: outputPath,
      snapshot: {
        capturedAt: snapshot.capturedAt,
        fighter: snapshot.fighter,
        attacker: snapshot.attacker,
        attackIdentity: snapshot.attackIdentity,
        geometry: snapshot.geometry,
      },
    };
  }));
}

const browser = await browserType.launch({ headless: true });
let diagnostics;
const provenance = baselineProvenance();
try {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(timeout);
  diagnostics = diagnosticsFor(page);
  const response = await page.goto(caseUrl(), { waitUntil: "domcontentloaded", timeout });
  invariant(response?.ok(), `Navigation failed: HTTP ${response?.status()}`);
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running === true,
    null,
    { timeout },
  );
  await page.locator("canvas.battlefield.active").waitFor({ state: "visible" });

  for (const unitKind of unitKinds) {
    const proof = await page.evaluate(
      (options) => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof(options),
      { attackerKind: "walker", lane: 1, existingClaim: true },
    );
    invariant(Number.isInteger(proof?.attackerId), `${unitKind}: CRAWLER proof setup failed`);
    const queuedAt = await page.evaluate(() => performance.now());
    const queued = await page.evaluate(
      ({ kind, lane }) => window.__ASHFALL_BATTLE_QA__.queueCrawlerDefenseUnit(kind, lane),
      { kind: unitKind, lane: 1 },
    );
    invariant(queued === true, `${unitKind}: deployment queue rejected canonical unit`);

    await page.waitForFunction(
      (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
        (fighter) => fighter.side === "human"
          && fighter.kind === kind
          && fighter.spawnPortalId === "crawler-door",
      ),
      unitKind,
      { timeout, polling: 5 },
    );
    const fighterId = await page.evaluate(
      (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
        (fighter) => fighter.side === "human"
          && fighter.kind === kind
          && fighter.spawnPortalId === "crawler-door",
      )?.id ?? null,
      unitKind,
    );
    invariant(Number.isInteger(fighterId), `${unitKind}: deployed fighter identity missing`);

    const frames = [];
    const entry = await fighterSnapshot(page, unitKind, fighterId);
    invariant(entry.fighter?.gateEntering === true, `${unitKind}: entry frame missed CRAWLER gate state`);
    frames.push({ phase: "entry", path: await captureCanvas(page, unitKind, "entry"), snapshot: entry });

    await page.waitForFunction(
      ({ kind, id }) => {
        const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
          (candidate) => candidate.id === id && candidate.kind === kind,
        );
        return fighter?.combatReady === true && fighter.gateEntering === false;
      },
      { kind: unitKind, id: fighterId },
      { timeout, polling: 5 },
    );
    const ready = await fighterSnapshot(page, unitKind, fighterId);
    frames.push({ phase: "ready", path: await captureCanvas(page, unitKind, "ready"), snapshot: ready });
    const readySequence = ready.fighter?.attackSequence ?? 0;

    let firstDamageObserved = true;
    try {
      await page.waitForFunction(
        ({ attackerId, initialHp }) => {
          const attacker = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
            (candidate) => candidate.id === attackerId,
          );
          return !attacker || attacker.hp < initialHp;
        },
        { attackerId: proof.attackerId, initialHp: proof.initialAttackerHp },
        { timeout: attackProbeMs, polling: 5 },
      );
    } catch (error) {
      if (error?.name !== "TimeoutError") throw error;
      firstDamageObserved = false;
    }

    frames.push(...await captureContinuousStrikeFrames(page, unitKind, fighterId));

    const final = frames.at(-1).snapshot;
    invariant(
      final.geometry?.offFloorCount === 0 && final.geometry?.visuallyOffFloorCount === 0,
      `${unitKind}: combat-ready grounding failed ${JSON.stringify(final.geometry)}`,
    );
    results.push({
      unitKind,
      fighterId,
      attackerId: proof.attackerId,
      queuedAt,
      entryToReadyMs: Math.round((ready.capturedAt - entry.capturedAt) * 10) / 10,
      queuedToEntryMs: Math.round((entry.capturedAt - queuedAt) * 10) / 10,
      readyToStrikeMs: Math.round((frames[2].snapshot.capturedAt - ready.capturedAt) * 10) / 10,
      firstDamageObserved,
      entryDirection: entry.fighter.entryDirection,
      assignedLane: ready.fighter.assignedLane,
      combatReadyPosition: {
        x: ready.fighter.x,
        y: ready.fighter.y,
        expectedX: ready.fighter.combatReadyX,
        expectedY: ready.fighter.combatReadyY,
      },
      attackSequence: {
        ready: readySequence,
        strike: final.fighter.attackSequence,
      },
      attackIdentityObserved: frames.some(({ snapshot }) => snapshot.attackIdentity.length > 0),
      continuousAttackProbeFrameDeltasMs: frames.slice(3).map((frame, index) => (
        Math.round((frame.snapshot.capturedAt - frames[index + 2].snapshot.capturedAt) * 10) / 10
      )),
      frames: frames.map(({ phase, path: framePath, snapshot }) => ({
        phase,
        file: path.relative(process.cwd(), framePath).replaceAll("\\", "/"),
        capturedAt: snapshot.capturedAt,
        fighter: compactFighter(snapshot.fighter),
        attacker: compactFighter(snapshot.attacker),
        attackIdentity: snapshot.attackIdentity,
        geometry: snapshot.geometry,
      })),
    });
  }
  assertDiagnostics(diagnostics);
} finally {
  await browser.close();
}

const tileWidth = 211;
const tileHeight = 98;
const labelHeight = 26;
const headerHeight = 34;
const sheetWidth = tileWidth * phases.length;
const sheetHeight = headerHeight + (tileHeight + labelHeight) * unitKinds.length;
const composites = [];

for (let column = 0; column < phases.length; column += 1) {
  const label = phases[column].replace("-", " ");
  composites.push({
    input: Buffer.from(
      `<svg width="${tileWidth}" height="${headerHeight}">
        <rect width="100%" height="100%" fill="#151719"/>
        <text x="10" y="23" fill="#f1f3f3" font-family="Arial, sans-serif" font-size="15">${label}</text>
      </svg>`,
    ),
    left: column * tileWidth,
    top: 0,
  });
}

for (let row = 0; row < results.length; row += 1) {
  for (let column = 0; column < phases.length; column += 1) {
    const frame = results[row].frames[column];
    const resized = await sharp(path.resolve(frame.file))
      .resize(tileWidth, tileHeight, { fit: "fill" })
      .png()
      .toBuffer();
    const top = headerHeight + row * (tileHeight + labelHeight);
    composites.push({ input: resized, left: column * tileWidth, top });
    const label = column === 0
      ? `${String(row + 1).padStart(2, "0")} ${results[row].unitKind}`
      : `${frame.fighter.attackSequence} / ${frame.fighter.combatReady ? "ready" : "entry"}`;
    composites.push({
      input: Buffer.from(
        `<svg width="${tileWidth}" height="${labelHeight}">
          <rect width="100%" height="100%" fill="#202427"/>
          <text x="8" y="18" fill="#e8ecec" font-family="Arial, sans-serif" font-size="13">${label}</text>
        </svg>`,
      ),
      left: column * tileWidth,
      top: top + tileHeight,
    });
  }
}

const contactSheetPath = path.join(reportDir, "v090-16-unit-continuous-frame-baseline.png");
await sharp({
  create: {
    width: sheetWidth,
    height: sheetHeight,
    channels: 4,
    background: "#101214",
  },
})
  .composite(composites)
  .png()
  .toFile(contactSheetPath);

const summary = {
  evidenceVersion: 1,
  baselineVersion: "0.9.0",
  baselineReleaseSha,
  measuredFromIntegrationSha: baselineIntegrationSha,
  measuredFromGitHead: provenance.currentHead,
  verifiedDifferencePaths: provenance.changedPaths,
  generatedAt: new Date().toISOString(),
  engine,
  viewport,
  unitCount: results.length,
  framesPerUnit: phases.length,
  totalFrames: results.length * phases.length,
  phases,
  contactSheet: path.relative(process.cwd(), contactSheetPath).replaceAll("\\", "/"),
  diagnostics,
  groundingPassed: results.every(({ frames }) => frames.every(
    ({ geometry }) => geometry.offFloorCount === 0 && geometry.visuallyOffFloorCount === 0,
  )),
  firstDamageObservedCount: results.filter(({ firstDamageObserved }) => firstDamageObserved).length,
  firstDamageMissingUnits: results
    .filter(({ firstDamageObserved }) => !firstDamageObserved)
    .map(({ unitKind }) => unitKind),
  timingMs: {
    queuedToEntry: distribution(results.map(({ queuedToEntryMs }) => queuedToEntryMs)),
    entryToReady: distribution(results.map(({ entryToReadyMs }) => entryToReadyMs)),
    readyToFirstDamage: distribution(results
      .filter(({ firstDamageObserved }) => firstDamageObserved)
      .map(({ readyToStrikeMs }) => readyToStrikeMs)),
  },
  attackIdentityObservedCount: results.filter(({ attackIdentityObserved }) => attackIdentityObserved).length,
  continuousAttackProbeFrameTimingMs: distribution(results.flatMap(
    ({ continuousAttackProbeFrameDeltasMs }) => continuousAttackProbeFrameDeltasMs,
  )),
  units: results,
};
await writeFile(
  path.join(reportDir, "v090-16-unit-visual-baseline.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  baselineVersion: summary.baselineVersion,
  baselineReleaseSha: summary.baselineReleaseSha,
  engine: summary.engine,
  viewport: summary.viewport,
  unitCount: summary.unitCount,
  totalFrames: summary.totalFrames,
  groundingPassed: summary.groundingPassed,
  firstDamageObservedCount: summary.firstDamageObservedCount,
  firstDamageMissingUnits: summary.firstDamageMissingUnits,
  diagnostics: summary.diagnostics,
  contactSheet: summary.contactSheet,
}, null, 2));
