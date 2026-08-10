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

function finiteInset(value, maximum) {
  const inset = Number(value);
  return Number.isFinite(inset) && inset > 0 ? Math.min(maximum, inset) : 0;
}

function horizontalZone(rect, height, range) {
  const x = rect.x + Math.round(rect.width * range.start);
  const end = rect.x + Math.round(rect.width * range.end);
  return freezeRect({ x, y: rect.y, width: end - x, height });
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
 * Pure layout contract for supported landscape-phone viewports. Runtime
 * CSS/DOM may implement the rectangles with grid columns, but it must
 * preserve these ownership boundaries and type minima. The width/height
 * range intentionally includes the 16:9 667x375 CSS viewport used by older
 * physical iPhones; exact-width matching would silently fall back to the
 * legacy clipped HUD.
 */
export function mobileBattleHudLayout({
  width,
  height,
  safeAreaTop = 0,
  safeAreaRight = 0,
  safeAreaBottom = 0,
  safeAreaLeft = 0,
} = {}) {
  const viewportWidth = finiteDimension(width);
  const viewportHeight = finiteDimension(height);
  const landscapePhone = viewportWidth >= 640
    && viewportWidth <= 900
    && viewportHeight >= 320
    && viewportHeight <= 430
    && viewportWidth > viewportHeight;
  if (!landscapePhone) return null;

  const normalizedSafeAreaTop = finiteInset(safeAreaTop, viewportHeight);
  const normalizedSafeAreaRight = finiteInset(safeAreaRight, viewportWidth);
  const normalizedSafeAreaBottom = finiteInset(safeAreaBottom, viewportHeight - normalizedSafeAreaTop);
  const normalizedSafeAreaLeft = finiteInset(safeAreaLeft, viewportWidth - normalizedSafeAreaRight);
  const safeArea = Object.freeze({
    top: normalizedSafeAreaTop,
    right: normalizedSafeAreaRight,
    bottom: normalizedSafeAreaBottom,
    left: normalizedSafeAreaLeft,
  });
  const content = freezeRect({
    x: safeArea.left,
    y: safeArea.top,
    width: Math.max(0, viewportWidth - safeArea.left - safeArea.right),
    height: Math.max(0, viewportHeight - safeArea.top - safeArea.bottom),
  });
  const compact = viewportHeight <= 350;
  const topHeight = compact ? 54 : 60;
  const bottomHeight = compact ? 74 : 82;
  const metaHeight = compact ? 18 : 20;
  const bottomY = content.y + content.height - bottomHeight;

  const top = Object.freeze({
    crawler: horizontalZone(
      content,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.crawler,
    ),
    communication: horizontalZone(
      content,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.communication,
    ),
    controls: horizontalZone(
      content,
      topHeight,
      MOBILE_BATTLE_HUD_ZONE_RATIOS.top.controls,
    ),
  });
  const dialogueHeight = compact ? 19 : 22;
  const dialogueTop = 4;
  const bannerTop = dialogueTop + dialogueHeight + 3;
  const bannerHeight = topHeight - bannerTop - 4;

  const resourcesWidth = Math.max(104, Math.round(content.width * .14));
  const supportWidth = Math.max(216, Math.round(content.width * .36));
  const unitsWidth = Math.max(0, content.width - resourcesWidth - supportWidth);
  const bottom = Object.freeze({
    resources: freezeRect({
      x: content.x,
      y: bottomY,
      width: resourcesWidth,
      height: bottomHeight,
    }),
    units: freezeRect({
      x: content.x + resourcesWidth,
      y: bottomY,
      width: unitsWidth,
      height: bottomHeight,
    }),
    support: freezeRect({
      x: content.x + resourcesWidth + unitsWidth,
      y: bottomY,
      width: supportWidth,
      height: bottomHeight,
    }),
  });

  return Object.freeze({
    viewport: Object.freeze({ width: viewportWidth, height: viewportHeight }),
    safeArea,
    content,
    topHeight,
    bottomHeight,
    battlefield: freezeRect({
      x: content.x,
      y: content.y + topHeight,
      width: content.width,
      height: Math.max(0, bottomY - (content.y + topHeight)),
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

/**
 * Renders the selected formation as a fixed seven-slot logical strip. Empty
 * slots are inert presentation placeholders; they never become buttons or
 * enter the save/gameplay path.
 */
export function mobileBattleHudUnitSlots(cards = [], formationKinds = [], maxSlots = 7) {
  const limit = Math.max(0, Math.floor(Number(maxSlots) || 0));
  const byKind = new Map((Array.isArray(cards) ? cards : [])
    .filter((card) => card && typeof card.kind === "string")
    .map((card) => [card.kind, card]));
  const selected = (Array.isArray(formationKinds) ? formationKinds : [])
    .filter((kind, index, values) => typeof kind === "string" && values.indexOf(kind) === index)
    .map((kind) => byKind.get(kind))
    .filter(Boolean)
    .slice(0, limit);
  return Object.freeze([
    ...selected,
    ...Array.from({ length: Math.max(0, limit - selected.length) }, () => null),
  ]);
}
