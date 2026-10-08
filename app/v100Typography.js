export const V100_FONT_FAMILIES = Object.freeze({
  reading: '"BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
  display: '"Zen Kaku Gothic New", "BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
  numeric: 'Rajdhani, "BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
});

export const V100_FONT_ASSETS = Object.freeze([
  "/fonts/v100/BIZUDPGothic-Regular.woff2",
  "/fonts/v100/ZenKakuGothicNew-Bold.woff2",
  "/fonts/v100/Rajdhani-Bold.woff2",
  "/fonts/v100/NewTegomin-Title.woff2",
]);

export const V100_CANVAS_FONT = Object.freeze({
  reading: (size) => `400 ${size}px ${V100_FONT_FAMILIES.reading}`,
  display: (size) => `700 ${size}px ${V100_FONT_FAMILIES.display}`,
  numeric: (size) => `700 ${size}px ${V100_FONT_FAMILIES.numeric}`,
});
