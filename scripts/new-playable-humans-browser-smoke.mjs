import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.NEW_PLAYABLE_HUMANS_QA_BASE_URL) {
  throw new Error("NEW_PLAYABLE_HUMANS_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.NEW_PLAYABLE_HUMANS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`New playable human QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.NEW_PLAYABLE_HUMANS_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = Math.max(10_000, Number(process.env.NEW_PLAYABLE_HUMANS_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.NEW_PLAYABLE_HUMANS_QA_EVIDENCE_DIR ?? "outputs/new-playable-humans-browser-smoke",
);
const unitContracts = [
  {
    kind: "tky",
    label: "TKY：光刃解放",
    atlas: "tky-battle-r1.png",
    icon: "tky-light-blade-ready-r1.svg",
  },
  {
    kind: "mrs-chiha",
    label: "Mrs.チハ：全弾制圧",
    atlas: "mrs-chiha-battle-r1.png",
    icon: "mrs-chiha-full-salvo-ready-r1.svg",
  },
  {
    kind: "miyamoto-musashi",
    label: "宮本武蔵：二天一流・無空",
    atlas: "miyamoto-musashi-battle-r1.png",
    icon: "miyamoto-musashi-muku-ready-r1.svg",
  },
];
const dedicatedAudioCueIds = [
  "weapon-tky-plasma-blade",
  "ability-tky-light-blade-charge",
  "ability-tky-light-blade-release",
  "ability-tky-light-blade-impact",
  "weapon-mrs-chiha-grenade-launcher",
  "weapon-mrs-chiha-grenade-impact",
  "weapon-mrs-chiha-launcher-bash",
  "ability-mrs-chiha-salvo-ready",
  "ability-mrs-chiha-salvo-shot",
  "ability-mrs-chiha-salvo-impact",
  "ability-mrs-chiha-salvo-final",
  "weapon-musashi-dual-katana",
  "ability-musashi-cross-guard",
  "ability-musashi-counter",
];
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function decodeDedicatedAudio(page) {
  return page.evaluate(async (cueIds) => {
    const bridge = window.__ASHFALL_AUDIO_QA__;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return { supported: false, requested: cueIds.length * 2, decoded: 0, failures: [] };
    }
    const context = new AudioContextCtor();
    const failures = [];
    let decoded = 0;
    try {
      for (const cueId of cueIds) {
        const asset = bridge.assets.find(({ id }) => id === cueId);
        if (!asset) {
          failures.push(`${cueId}: manifest asset missing`);
          continue;
        }
        for (const source of asset.sources) {
          try {
            const response = await fetch(source.src, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
            if (!(buffer.duration > 0) || buffer.numberOfChannels < 1) throw new Error("invalid decoded buffer");
            decoded += 1;
          } catch (error) {
            failures.push(`${source.src}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } finally {
      await context.close();
    }
    return { supported: true, requested: cueIds.length * 2, decoded, failures };
  }, dedicatedAudioCueIds);
}

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") state.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

function overlaps(left, right, gap = 2) {
  return left.left < right.right + gap
    && left.right + gap > right.left
    && left.top < right.bottom + gap
    && left.bottom + gap > right.top;
}

async function enterBattle(page) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ qa: "new-playables", safe: "iphone-landscape" }).toString();
  await page.goto(String(url), { waitUntil: "domcontentloaded" });
  const migrationButton = page.getByRole("button", { name: "内容を確認" });
  if (await migrationButton.isVisible().catch(() => false)) await migrationButton.click();
  const start = page.locator(".formation-footer .campaign-primary");
  await start.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const button = document.querySelector(".formation-footer .campaign-primary");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await start.click();
  for (let count = 0; count < 8; count += 1) {
    await page.waitForFunction(() => (
      Boolean(document.querySelector("canvas.battlefield.active"))
      || Boolean(document.querySelector(".event-screen"))
    ));
    if (await page.locator("canvas.battlefield.active").isVisible().catch(() => false)) return;
    await page.locator(".event-screen").getByRole("button", { name: "スキップ", exact: true }).click();
    await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
  }
  throw new Error("Battlefield was not reached");
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unknown NEW_PLAYABLE_HUMANS_QA_ENGINES value: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(timeout);
      const diagnostics = diagnosticsFor(page);
      await enterBattle(page);
      await page.waitForFunction((expectedKinds) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return expectedKinds.every((kind) => {
          const fighter = snapshot?.fighters?.find((candidate) => candidate.kind === kind);
          return fighter?.combatReady === true && fighter.attackSequence >= 1;
        });
      }, unitContracts.map(({ kind }) => kind));
      invariant(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.stabilizeNewPlayableProof()),
        `${engine}/${viewport.height}: local-only playable proof could not stabilize after normal attacks`);
      await page.waitForTimeout(500);
      const readinessProof = await page.evaluate((contracts) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        return contracts.map(({ kind }) => {
          const fighter = snapshot.fighters.find((candidate) => candidate.kind === kind);
          return {
            kind,
            buttonCount: document.querySelectorAll(`.manual-ability-ready[data-ability-kind='${kind}']`).length,
            fighter,
            livingEnemies: snapshot.fighters
              .filter(({ side, hp, combatReady }) => side === "zombie" && hp > 0 && combatReady)
              .map(({ id, kind: enemyKind, x, y, lane, hp }) => ({ id, kind: enemyKind, x, y, lane, hp })),
          };
        });
      }, unitContracts);

      for (const contract of unitContracts) {
        const readiness = readinessProof.find(({ kind }) => kind === contract.kind);
        invariant(readiness?.buttonCount === 1,
          `${engine}/${viewport.height}/${contract.kind}: ready icon missing ${JSON.stringify(readiness)}`);
        await page.locator(`.manual-ability-ready[data-ability-kind='${contract.kind}']`)
          .waitFor({ state: "visible" });
      }
      const layout = await page.evaluate((contracts) => {
        const canvas = document.querySelector("canvas.battlefield");
        const obstacles = [
          ".top-hud", ".survival-hud", ".boss-hud", ".crawler-alert",
          ".battle-barks", ".placement-hint", ".bottom-hud", ".stats-strip",
        ].flatMap((selector) => [...document.querySelectorAll(selector)])
          .filter((element) => {
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map((element) => element.getBoundingClientRect().toJSON());
        return {
          canvas: canvas?.getBoundingClientRect().toJSON() ?? null,
          snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          obstacles,
          buttons: contracts.map(({ kind }) => {
            const button = document.querySelector(`.manual-ability-ready[data-ability-kind='${kind}']`);
            const icon = button?.querySelector(".manual-ability-ready-icon");
            return {
              kind,
              rect: button?.getBoundingClientRect().toJSON() ?? null,
              iconBackground: icon ? getComputedStyle(icon).backgroundImage : "",
            };
          }),
        };
      }, unitContracts);
      invariant(layout.canvas, `${engine}/${viewport.height}: battlefield geometry missing`);
      invariant(layout.snapshot.geometry.offFloorCount === 0, `${engine}/${viewport.height}: fighter grounding failed`);
      for (const [index, button] of layout.buttons.entries()) {
        invariant(button.rect, `${engine}/${viewport.height}/${button.kind}: ready icon geometry missing`);
        invariant(button.rect.width >= 44 && button.rect.height >= 44,
          `${engine}/${viewport.height}/${button.kind}: ready hit target below 44px`);
        invariant(button.rect.left >= layout.canvas.left + 44
          && button.rect.right <= layout.canvas.right - 44
          && button.rect.top >= layout.canvas.top
          && button.rect.bottom <= layout.canvas.bottom - 21,
        `${engine}/${viewport.height}/${button.kind}: ready icon breached safe area`);
        invariant(button.iconBackground.includes(unitContracts[index].icon),
          `${engine}/${viewport.height}/${button.kind}: dedicated ready icon not connected`);
        for (const obstacle of layout.obstacles) {
          invariant(!overlaps(button.rect, obstacle),
            `${engine}/${viewport.height}/${button.kind}: ready icon overlaps HUD`);
        }
        for (const other of layout.buttons.slice(index + 1)) {
          invariant(!overlaps(button.rect, other.rect),
            `${engine}/${viewport.height}: ready icons overlap each other`);
        }
      }

      const atlasProof = await page.evaluate(async (contracts) => Promise.all(contracts.map((contract) => (
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve({
            kind: contract.kind,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
          image.onerror = () => resolve({ kind: contract.kind, width: 0, height: 0 });
          image.src = `/art/v090/characters/${contract.atlas}`;
        })
      ))), unitContracts);
      for (const atlas of atlasProof) {
        invariant(atlas.width === 3360 && atlas.height === 896,
          `${engine}/${viewport.height}/${atlas.kind}: battle atlas did not decode`);
      }
      let audioDecodeProof = null;

      const baseName = `${engine}-${viewport.width}x${viewport.height}`;
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-ready.png`) });
      const beforeTky = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      await page.getByRole("button", { name: unitContracts[0].label }).click();
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-tky-charge.png`) });
      await page.waitForFunction(() => {
        const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ kind }) => kind === "tky");
        return fighter?.manualAbility?.phase === "cooldown";
      });
      invariant(await page.locator(".manual-ability-ready[data-ability-kind='tky']").count() === 0,
        `${engine}/${viewport.height}/tky: cooldown rendered a persistent overhead icon`);
      const afterTky = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const tkyTargetsBefore = beforeTky.fighters.filter(({ side, lane }) => side === "zombie" && lane === 0);
      invariant(tkyTargetsBefore.some((target) => {
        const after = afterTky.fighters.find(({ id }) => id === target.id);
        return after && after.hp < target.hp;
      }), `${engine}/${viewport.height}: 光刃解放 did not damage the forward lane`);

      await page.getByRole("button", { name: unitContracts[1].label }).click();
      await page.waitForTimeout(50);
      const mrsActivationSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const mrsActivationFighter = mrsActivationSnapshot.fighters.find(({ kind }) => kind === "mrs-chiha");
      invariant(mrsActivationFighter?.manualAbility?.phase !== "ready",
        `${engine}/${viewport.height}: 全弾制圧 did not start ${JSON.stringify(mrsActivationFighter)}`);
      let mrsActionLocked = true;
      for (let expectedCount = 1; expectedCount <= 4; expectedCount += 1) {
        await page.waitForFunction((count) => {
          const receipts = window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts
            .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "impact");
          return receipts.length >= count;
        }, expectedCount);
        if (expectedCount === 1) {
          const mrsMid = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          invariant(mrsMid.manualAbilityVfx.some(({ kind }) => kind === "mrs-chiha"),
            `${engine}/${viewport.height}: 全弾制圧 VFX was not active on first impact`);
          await page.screenshot({ path: path.join(evidenceDir, `${baseName}-mrs-salvo.png`) });
        }
        if (expectedCount < 4) {
          const lockSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const lockedFighter = lockSnapshot.fighters.find(({ kind }) => kind === "mrs-chiha");
          const activationReceipt = lockSnapshot.manualAbilityReceipts
            .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "start")
            .at(-1);
          mrsActionLocked &&= lockedFighter.attackSequence === activationReceipt?.attackSequence
            && Math.abs(lockedFighter.aiMoveDirection) < .01
            && ["windup", "salvo"].includes(lockedFighter.manualAbility.phase);
        }
      }
      await page.waitForFunction(() => {
        const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ kind }) => kind === "mrs-chiha");
        return fighter?.manualAbility?.phase === "recovery";
      });
      const mrsRecoverySnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const mrsRecoveryFighter = mrsRecoverySnapshot.fighters.find(({ kind }) => kind === "mrs-chiha");
      const mrsRecoveryStartReceipt = mrsRecoverySnapshot.manualAbilityReceipts
        .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "start")
        .at(-1);
      const mrsRecoveryLocked = mrsRecoveryFighter.attackSequence === mrsRecoveryStartReceipt?.attackSequence
        && Math.abs(mrsRecoveryFighter.aiMoveDirection) < .01
        && mrsRecoveryFighter.manualAbility.phase === "recovery";
      await page.waitForFunction(() => {
        const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ kind }) => kind === "mrs-chiha");
        return fighter?.manualAbility?.phase === "cooldown";
      });
      const afterMrs = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const mrsLaunchReceipts = afterMrs.manualAbilityReceipts
        .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "launch")
        .slice(-4);
      const mrsImpactReceipts = afterMrs.manualAbilityReceipts
        .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "impact")
        .slice(-4);
      const mrsStartReceipt = afterMrs.manualAbilityReceipts
        .filter(({ kind, eventType }) => kind === "mrs-chiha" && eventType === "start")
        .at(-1);
      invariant(mrsStartReceipt, `${engine}/${viewport.height}: 全弾制圧 activation receipt missing`);
      invariant(JSON.stringify(mrsLaunchReceipts.map(({ salvoIndex }) => salvoIndex)) === JSON.stringify([0, 1, 2, 3]),
        `${engine}/${viewport.height}: 全弾制圧 did not emit four ordered launches`);
      invariant(JSON.stringify(mrsImpactReceipts.map(({ salvoIndex }) => salvoIndex)) === JSON.stringify([0, 1, 2, 3]),
        `${engine}/${viewport.height}: 全弾制圧 did not emit four ordered impacts`);
      const mrsLaunchOffsets = mrsLaunchReceipts.map(({ at }) => Number((at - mrsStartReceipt.at).toFixed(2)));
      const mrsImpactOffsets = mrsImpactReceipts.map(({ at }) => Number((at - mrsStartReceipt.at).toFixed(2)));
      const expectedMrsLaunchOffsets = [1.05, 1.27, 1.49, 1.71];
      const expectedMrsImpactOffsets = [1.23, 1.45, 1.67, 1.89];
      invariant(mrsLaunchOffsets.every((offset, index) => Math.abs(offset - expectedMrsLaunchOffsets[index]) <= .08),
        `${engine}/${viewport.height}: 全弾制圧 launch timing drifted ${mrsLaunchOffsets}`);
      invariant(mrsImpactOffsets.every((offset, index) => Math.abs(offset - expectedMrsImpactOffsets[index]) <= .08),
        `${engine}/${viewport.height}: 全弾制圧 impact timing drifted ${mrsImpactOffsets}`);
      invariant(mrsActionLocked,
      `${engine}/${viewport.height}: 全弾制圧 resumed normal movement or attack before settlement`);
      invariant(mrsRecoveryLocked,
        `${engine}/${viewport.height}: 全弾制圧 resumed normal movement or attack during launcher stow`);
      invariant(await page.locator(".manual-ability-ready[data-ability-kind='mrs-chiha']").count() === 0,
        `${engine}/${viewport.height}/mrs-chiha: cooldown rendered a persistent overhead icon`);

      await page.getByRole("button", { name: unitContracts[2].label }).click();
      await page.waitForFunction(() => {
        const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(({ kind }) => kind === "miyamoto-musashi");
        return fighter?.manualAbility?.phase === "guard";
      });
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-musashi-guard.png`) });
      const counterProof = await page.evaluate(() => {
        const bridge = window.__ASHFALL_BATTLE_QA__;
        const before = bridge.getSnapshot();
        const musashi = before.fighters.find(({ kind }) => kind === "miyamoto-musashi");
        const targetId = musashi.manualAbility.target.targetId;
        const targetBefore = before.fighters.find(({ id }) => id === targetId);
        const result = bridge.applyHumanDamage(musashi.id, 35);
        const after = bridge.getSnapshot();
        const musashiAfter = after.fighters.find(({ id }) => id === musashi.id);
        const targetAfter = after.fighters.find(({ id }) => id === targetId);
        return {
          result,
          ownerHpBefore: musashi.hp,
          ownerHpAfter: musashiAfter.hp,
          targetHpBefore: targetBefore.hp,
          targetHpAfter: targetAfter.hp,
          phase: musashiAfter.manualAbility.phase,
        };
      });
      invariant(counterProof.result.preventedDamage === 35
        && counterProof.ownerHpAfter === counterProof.ownerHpBefore
        && counterProof.targetHpAfter < counterProof.targetHpBefore
        && counterProof.phase === "cooldown",
      `${engine}/${viewport.height}: 二天一流・無空 did not parry and counter exactly once`);
      invariant(await page.locator(".manual-ability-ready[data-ability-kind='miyamoto-musashi']").count() === 0,
        `${engine}/${viewport.height}/miyamoto-musashi: cooldown rendered a persistent overhead icon`);
      if (viewport.height === 390) {
        audioDecodeProof = await decodeDedicatedAudio(page);
        if (audioDecodeProof.supported) {
          invariant(audioDecodeProof.decoded === audioDecodeProof.requested && audioDecodeProof.failures.length === 0,
            `${engine}/${viewport.height}: dedicated SE decode failed ${audioDecodeProof.failures}`);
        }
      }
      invariant(diagnostics.consoleErrors.length === 0, `${engine}/${viewport.height}: console errors ${diagnostics.consoleErrors}`);
      invariant(diagnostics.pageErrors.length === 0, `${engine}/${viewport.height}: page errors ${diagnostics.pageErrors}`);
      invariant(diagnostics.requestFailures.length === 0, `${engine}/${viewport.height}: request failures ${diagnostics.requestFailures}`);
      invariant(diagnostics.httpErrors.length === 0, `${engine}/${viewport.height}: HTTP errors ${diagnostics.httpErrors}`);

      results.push({
        engine,
        viewport,
        units: layout.buttons.map(({ kind, rect, iconBackground }) => ({ kind, rect, iconBackground })),
        atlasProof,
        audioDecodeProof,
        offFloorCount: layout.snapshot.geometry.offFloorCount,
        tkyDamagedForwardLane: true,
        mrsTimedSalvo: {
          salvoIndices: mrsImpactReceipts.map(({ salvoIndex }) => salvoIndex),
          launchOffsetsSeconds: mrsLaunchOffsets,
          impactOffsetsSeconds: mrsImpactOffsets,
          actionLocked: mrsActionLocked,
          recoveryLocked: mrsRecoveryLocked,
        },
        musashiCounter: counterProof,
        diagnostics,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

await writeFile(
  path.join(evidenceDir, "results.json"),
  `${JSON.stringify({ cases: results.length, results }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  message: "New playable human browser QA passed",
  cases: results.length,
  evidenceDir,
}, null, 2));
