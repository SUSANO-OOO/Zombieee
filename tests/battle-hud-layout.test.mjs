import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_BATTLE_HUD_READABILITY,
  MOBILE_BATTLE_HUD_TYPOGRAPHY,
  MOBILE_BATTLE_HUD_ZONE_RATIOS,
  mobileBattleHudLayout,
} from "../app/battleHudLayout.js";

const RELEASE_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 844, height: 390 }),
  Object.freeze({ width: 844, height: 340 }),
]);

function right(rect) {
  return rect.x + rect.width;
}

function bottom(rect) {
  return rect.y + rect.height;
}

function assertHorizontalPartition(zones, width, label) {
  assert.equal(zones[0].x, 0, `${label} starts at viewport edge`);
  for (let index = 1; index < zones.length; index += 1) {
    assert.equal(zones[index].x, right(zones[index - 1]), `${label} gap or overlap at ${index}`);
  }
  assert.equal(right(zones.at(-1)), width, `${label} ends at viewport edge`);
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
    assert.deepEqual([crawler.x, right(crawler)], [0, Math.round(844 * .28)]);
    assert.deepEqual(
      [communication.x, right(communication)],
      [Math.round(844 * .28), Math.round(844 * .66)],
    );
    assert.deepEqual([controls.x, right(controls)], [Math.round(844 * .66), 844]);
    assertHorizontalPartition([crawler, communication, controls], 844, `${viewport.height}/top`);
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
    assertHorizontalPartition([resources, units, support], 844, `${viewport.height}/bottom`);
    assert.ok(resources.width >= 118, "resource/state column remains readable");
    assert.ok(units.width >= 422, "five unit cards retain their center ownership");
    assert.ok(support.width >= 304, "support/CRAWLER controls retain their right ownership");
    assert.equal(layout.bottomContent.objective.x, units.x);
    assert.equal(right(layout.bottomContent.objective), 844);
    assert.equal(layout.bottomContent.stats.x, 0);
    assert.equal(right(layout.bottomContent.stats), resources.width);
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

test("844x390 and 844x340 preserve a non-overlapping battlefield between HUD bands", () => {
  for (const viewport of RELEASE_VIEWPORTS) {
    const layout = mobileBattleHudLayout(viewport);
    assert.equal(layout.battlefield.y, layout.topHeight);
    assert.equal(bottom(layout.battlefield), layout.bottom.resources.y);
    assert.ok(layout.battlefield.height >= 212, `${viewport.height} battlefield remains visible`);
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
  assert.equal(mobileBattleHudLayout({ width: 390, height: 844 }), null);
  assert.equal(mobileBattleHudLayout({ width: 844, height: 0 }), null);
});
