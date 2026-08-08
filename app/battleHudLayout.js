const freezeRect = (rect) => Object.freeze(rect);

export const MOBILE_BATTLE_HUD_ZONE_RATIOS = Object.freeze({
  top: Object.freeze({
    crawler: Object.freeze({ start: 0, end: .28 }),
    communication: Object.freeze({ start: .28, end: .66 }),
    controls: Object.freeze({ start: .66, end: 1 }),
  }),
  bottom: Object.freeze({
    resources: Object.freeze({ start: 0, end: .14 }),
    units: Object.freeze({ start: .14, end: .64 }),
    support: Object.freeze({ start: .64, end: 1 }),
  }),
});

export const MOBILE_BATTLE_HUD_TYPOGRAPHY = Object.freeze({
  banner: Object.freeze({ fontSizePx: 17, minPx: 16, maxPx: 18, maxLines: 2 }),
  unitName: Object.freeze({ fontSizePx: 14, minPx: 14 }),
  unitCost: Object.freeze({ fontSizePx: 14, minPx: 14 }),
  supportName: Object.freeze({ fontSizePx: 14, minPx: 14 }),
  supportCost: Object.freeze({ fontSizePx: 14, minPx: 14 }),
  detail: Object.freeze({ fontSizePx: 12, minPx: 12 }),
  disabledReason: Object.freeze({ fontSizePx: 12, minPx: 12 }),
  objective: Object.freeze({ fontSizePx: 13, minPx: 12, maxPx: 14 }),
  stats: Object.freeze({ fontSizePx: 12, minPx: 12 }),
});

export const MOBILE_BATTLE_HUD_READABILITY = Object.freeze({
  disabledTextOpacityMinimum: .72,
  backplateAlphaMinimum: .72,
  textShadowRequired: true,
  overflowPolicy: "wrap-no-ellipsis",
});

function finiteDimension(value) {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 ? dimension : 0;
}

function horizontalZone(width, y, height, range) {
  const x = Math.round(width * range.start);
  const end = Math.round(width * range.end);
  return freezeRect({ x, y, width: end - x, height });
}

function insetRect(rect, insetX, top, height) {
  return freezeRect({
    x: rect.x + insetX,
    y: rect.y + top,
    width: Math.max(0, rect.width - insetX * 2),
    height,
  });
}

/**
 * Pure layout contract for the two release mobile viewports. Runtime CSS/DOM
 * may implement the rectangles with grid percentages, but it must preserve
 * these ownership boundaries and type minima.
 */
export function mobileBattleHudLayout({ width, height } = {}) {
  const viewportWidth = finiteDimension(width);
  const viewportHeight = finiteDimension(height);
  if (viewportWidth !== 844 || ![340, 390].includes(viewportHeight)) return null;

  const compact = viewportHeight === 340;
  const topHeight = compact ? 54 : 60;
  const bottomHeight = compact ? 74 : 82;
  const metaHeight = 20;
  const bottomY = viewportHeight - bottomHeight;

  const top = Object.freeze({
    crawler: horizontalZone(
      viewportWidth,
      0,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.crawler,
    ),
    communication: horizontalZone(
      viewportWidth,
      0,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.communication,
    ),
    controls: horizontalZone(
      viewportWidth,
      0,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.controls,
    ),
  });
  const dialogueHeight = compact ? 19 : 22;
  const dialogueTop = 4;
  const bannerTop = dialogueTop + dialogueHeight + 3;
  const bannerHeight = topHeight - bannerTop - 4;

  const bottom = Object.freeze({
    resources: horizontalZone(
      viewportWidth,
      bottomY,
      bottomHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.bottom.resources,
    ),
    units: horizontalZone(
      viewportWidth,
      bottomY,
      bottomHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.bottom.units,
    ),
    support: horizontalZone(
      viewportWidth,
      bottomY,
      bottomHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.bottom.support,
    ),
  });

  return Object.freeze({
    viewport: Object.freeze({ width: viewportWidth, height: viewportHeight }),
    topHeight,
    bottomHeight,
    battlefield: freezeRect({
      x: 0,
      y: topHeight,
      width: viewportWidth,
      height: bottomY - topHeight,
    }),
    top,
    communication: Object.freeze({
      dialogue: insetRect(top.communication, 6, dialogueTop, dialogueHeight),
      banner: insetRect(top.communication, 6, bannerTop, bannerHeight),
      queueDirection: "vertical",
      bannerMaxLines: MOBILE_BATTLE_HUD_TYPOGRAPHY.banner.maxLines,
    }),
    bottom,
    bottomContent: Object.freeze({
      resources: freezeRect({
        ...bottom.resources,
        height: bottom.resources.height - metaHeight,
      }),
      stats: freezeRect({
        x: bottom.resources.x,
        y: bottom.resources.y + bottom.resources.height - metaHeight,
        width: bottom.resources.width,
        height: metaHeight,
      }),
      units: freezeRect({
        ...bottom.units,
        height: bottom.units.height - metaHeight,
      }),
      support: freezeRect({
        ...bottom.support,
        height: bottom.support.height - metaHeight,
      }),
      objective: freezeRect({
        x: bottom.units.x,
        y: bottom.units.y + bottom.units.height - metaHeight,
        width: bottom.units.width + bottom.support.width,
        height: metaHeight,
      }),
    }),
    typography: MOBILE_BATTLE_HUD_TYPOGRAPHY,
    readability: MOBILE_BATTLE_HUD_READABILITY,
  });
}
