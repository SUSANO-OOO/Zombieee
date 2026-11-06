// Authored head/chin and face-centre landmarks in logical portrait coordinates
// (512 px, or explicit width). Stage bitmaps are 2x; topknots aren't face height.
// Use one camera per person across expressions: equipment bounds and transparent
// margins must not determine face size, and changing emotion must not zoom it.
export const V100_PORTRAIT_LANDMARKS = Object.freeze({
  'unit-babayaga': {top: 12, height: 118, center: 270},
  'unit-kumaverson': {top: 12, height: 118, center: 270},
  'unit-paisen': {top: 40, height: 180, center: 256},
  'unit-tky': {top: 40, height: 170, center: 230},
  'unit-zakimiya': {top: 40, height: 188, center: 248},
  'unit-mrs-chiha': {top: 56, height: 146, center: 224},
  'unit-miyamoto-musashi': {top: 35, height: 114, center: 257},
  'unit-crazy-king': {top: 60, height: 128, center: 202},
  'unit-tatara': {top: 120, height: 104, center: 314},
  'unit-raider': {top: 30, height: 178, center: 248},
  'unit-gantetsu': {top: 12, height: 100, center: 238},
  'guide-ikura': {top: 10, height: 170, center: 253},
  'unit-nao': {top: 62, height: 178, center: 270},
  'unit-mizuchi': {top: 50, height: 168, center: 234},
  'unit-monkey': {top: 42, height: 182, center: 252},
  'unit-hachi': {top: 58, height: 160, center: 306},
  'unit-mayo-chan': {top: 64, height: 256, center: 234},
  segawa: {top: 60, height: 150, center: 384, width: 768},
  'mugarian-president': {top: 60, height: 150, center: 384, width: 768},
  'red-panther-commander': {top: 60, height: 150, center: 384, width: 768},
  'minor-human-shared-event-silhouette': {top: 60, height: 150, center: 384, width: 768},
});
export function v100PortraitFraming(owner) {
  const {top, height, center, width = 512} = V100_PORTRAIT_LANDMARKS[owner] ?? {top: 20, height: 180, center: 256};
  return {
    '--portrait-width-factor': width / height,
    '--portrait-top-factor': -top / height,
    '--portrait-face-center': `${100 * center / width}%`,
    '--portrait-face-fraction': center / width,
  };
}
