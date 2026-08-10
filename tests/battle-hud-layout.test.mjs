import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_BATTLE_HUD_READABILITY,
  MOBILE_BATTLE_HUD_TYPOGRAPHY,
  MOBILE_BATTLE_HUD_ZONE_RATIOS,
  mobileBattleHudUnitSlots,
  mobileBattleHudLayout,
} from "../app/battleHudLayout.js";

const RELEASE_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 667, height: 375 }),
  Object.freeze({ width: 736, height: 414 }),
  Object.freeze({ width: 844, height: 390 }),
  Object.freeze({ width: 844, height: 340 }),
]);

function right(rect) {
  return rect.x + rect.width;
}

function bottom(rect) {
  return rect.y + rect.height;
}

function assertHorizontalPartition(zones, start, end, label) {
  assert.equal(zones[0].x, start, `${label} starts at content edge`);
  for (let index = 1; index < zones.length; index += 1) {
    assert.equal(zones[index].x, right(zones[index - 1]), `${label} gap or overlap at ${index}`);
  }
  assert.equal(right(zones.at(-1)), end, `${label} ends at content edge`);
}

test("mobile battle HUD fixes top ownership at 0-28%, 28-66%, and 66-100%", () => {
  assert.deepEqual(MOBILE_BATTLE_HUD_ZONE_RATIOS.top, {
    crawler: { start: 0, end: .28 },
    communication: { start: .28, end: .66 },
    controls: { start: .66, end: 1 },
  });

  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    assert.ok(layout);
    const { crawler, communication, controls } = layout.top;
    assert.deepEqual([crawler.x, right(crawler)], [0, Math.round(viewport.width * .28)]);
    assert.deepEqual(
      [communication.x, right(communication)],
      [Math.round(viewport.width * .28), Math.round(viewport.width * .66)],
    );
    assert.deepEqual([controls.x, right(controls)], [Math.round(viewport.width * .66), viewport.width]);
    assertHorizontalPartition([crawler, communication, controls], 0, viewport.width, `${viewport.height}/top`);
  }
});

test("bottom ownership keeps resources, unit cards, and support/objective in separate columns", () => {
  assert.deepEqual(MOBILE_BATTLE_HUD_ZONE_RATIOS.bottom, {
    resources: { start: 0, end: .14 },
    units: { start: .14, end: .64 },
    support: { start: .64, end: 1 },
  });

  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    const { resources, units, support } = layout.bottom;
    assertHorizontalPartition([resources, units, support], 0, viewport.width, `${viewport.height}/bottom`);
    assert.ok(resources.width >= 104, "resource/state column remains readable");
    assert.ok(units.width >= 320, "unit strip retains four readable card columns");
    assert.ok(support.width >= 216, "support controls retain three 72px columns");
    assert.equal(layout.bottomContent.objective.x, units.x);
    assert.equal(right(layout.bottomContent.objective), viewport.width);
    assert.equal(layout.bottomContent.stats.x, 0);
    assert.equal(right(layout.bottomContent.stats), resources.width);
  }
});

test("safe-area insets are deducted once from the shared content rectangle", () => {
  for (const viewport of RELEASE_VIEWPORTS.filter(({ width }) => width === 844)) {
    const layout = mobileBattleHudLayout({
      ...viewport,
      safeAreaTop: 0,
      safeAreaRight: 44,
      safeAreaBottom: 21,
      safeAreaLeft: 44,
    });
    assert.ok(layout);
    assert.deepEqual(layout.safeArea, { top: 0, right: 44, bottom: 21, left: 44 });
    assert.deepEqual(layout.content, { x: 44, y: 0, width: 756, height: viewport.height - 21 });
    assert.equal(layout.top.crawler.x, 44);
    assert.equal(right(layout.top.controls), 800);
    assert.equal(layout.bottom.resources.x, 44);
    assert.equal(right(layout.bottom.support), 800);
    assert.equal(bottom(layout.bottom.support), viewport.height - 21);
    assert.ok(layout.bottom.resources.width >= 104);
    assert.ok(layout.bottom.support.width >= 268);
    assert.equal(right(layout.bottomContent.objective), 800);
  }
});

test("physical 16:9 phones keep all bottom owners inside the landscape safe area", () => {
  for (const viewport of RELEASE_VIEWPORTS.filter(({ width }) => width < 844)) {
    const layout = mobileBattleHudLayout({
      ...viewport,
      safeAreaTop: 0,
      safeAreaRight: 44,
      safeAreaBottom: 21,
      safeAreaLeft: 44,
    });
    assert.ok(layout);
    assert.deepEqual(layout.content, {
      x: 44,
      y: 0,
      width: viewport.width - 88,
      height: viewport.height - 21,
    });
    assertHorizontalPartition(
      [layout.bottom.resources, layout.bottom.units, layout.bottom.support],
      44,
      viewport.width - 44,
      `${viewport.width}x${viewport.height}/bottom-safe-area`,
    );
    assert.ok(layout.bottom.resources.width >= 104);
    assert.ok(layout.bottom.units.width >= 250);
    assert.ok(layout.bottom.support.width >= 216);
    assert.equal(bottom(layout.bottom.support), viewport.height - 21);
  }
});

test("the objective owns the full unit/support meta row without shrinking the action rows", () => {
  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    assert.ok(layout);
    const expectedMetaHeight = viewport.height <= 360 ? 18 : 20;
    assert.equal(layout.bottomContent.objective.height, expectedMetaHeight);
    assert.equal(layout.bottomContent.objective.x, layout.bottom.units.x);
    assert.equal(right(layout.bottomContent.objective), right(layout.bottom.support));
    assert.equal(layout.bottomContent.objective.y, bottom(layout.bottom.resources) - expectedMetaHeight);
    assert.equal(layout.bottomContent.units.height, layout.bottom.resources.height - expectedMetaHeight);
    assert.equal(layout.bottomContent.support.height, layout.bottom.resources.height - expectedMetaHeight);
  }
});

test("dialogue and the short deployment banner stack inside the center safe zone", () => {
  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    const { dialogue, banner } = layout.communication;
    const center = layout.top.communication;

    assert.ok(dialogue.x >= center.x && right(dialogue) <= right(center));
    assert.ok(banner.x >= center.x && right(banner) <= right(center));
    assert.ok(bottom(dialogue) < banner.y, "dialogue and banner do not overlap");
    assert.ok(bottom(banner) <= bottom(center), "banner stays below the phase/control zone boundary");
    assert.equal(layout.communication.queueDirection, "vertical");
    assert.equal(layout.communication.bannerMaxLines, 2);
    assert.equal(layout.readability.overflowPolicy, "wrap-no-ellipsis");
  }
});

test("supported landscape phones preserve a non-overlapping battlefield between HUD bands", () => {
  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    assert.equal(layout.battlefield.y, layout.topHeight);
    assert.equal(bottom(layout.battlefield), layout.bottom.resources.y);
    assert.ok(layout.battlefield.height >= 212, `${viewport.width}x${viewport.height} battlefield remains visible`);
    assert.equal(bottom(layout.bottom.resources), viewport.height);
    assert.equal(bottom(layout.bottom.units), viewport.height);
    assert.equal(bottom(layout.bottom.support), viewport.height);
  }
});

test("mobile type contract meets the final readability minima without global scaling", () => {
  assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY.banner.fontSizePx >= 16);
  assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY.banner.fontSizePx <= 18);
  assert.equal(MOBILE_BATTLE_HUD_TYPOGRAPHY.banner.maxLines, 2);

  for (const role of ["unitName", "unitCost", "supportName", "supportCost"]) {
    assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY[role].fontSizePx >= 14, role);
  }
  for (const role of ["detail", "disabledReason", "stats"]) {
    assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY[role].fontSizePx >= 12, role);
  }
  assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY.objective.fontSizePx >= 12);
  assert.ok(MOBILE_BATTLE_HUD_TYPOGRAPHY.objective.fontSizePx <= 14);
  assert.ok(MOBILE_BATTLE_HUD_READABILITY.disabledTextOpacityMinimum >= .72);
  assert.ok(MOBILE_BATTLE_HUD_READABILITY.backplateAlphaMinimum >= .72);
  assert.equal(MOBILE_BATTLE_HUD_READABILITY.textShadowRequired, true);
});

test("the focused helper does not silently claim unsupported desktop or portrait layouts", () => {
  assert.equal(mobileBattleHudLayout({ width: 1280, height: 720 }), null);
  assert.equal(mobileBattleHudLayout({ width: 639, height: 375 }), null);
  assert.equal(mobileBattleHudLayout({ width: 901, height: 390 }), null);
  assert.equal(mobileBattleHudLayout({ width: 390, height: 844 }), null);
  assert.equal(mobileBattleHudLayout({ width: 844, height: 0 }), null);
});

test("the battle strip always exposes seven logical slots without making empty slots interactive", () => {
  const cards = [
    { kind: "brawler", name: "パイセン" },
    { kind: "scout", name: "ハチ" },
    { kind: "ranger", name: "ミズチ" },
    { kind: "medic", name: "ナオ" },
    { kind: "brute", name: "タタラ" },
    { kind: "gunner", name: "レイダー" },
    { kind: "guardian", name: "ガンテツ" },
  ];
  for (const [formation, expectedCards] of [
    [["brawler"], 1],
    [["brawler", "scout", "ranger"], 3],
    [cards.map((card) => card.kind), 7],
  ]) {
    const slots = mobileBattleHudUnitSlots(cards, formation);
    assert.equal(slots.length, 7);
    assert.equal(slots.filter(Boolean).length, expectedCards);
    assert.equal(slots.filter((slot) => slot === null).length, 7 - expectedCards);
  }
});
