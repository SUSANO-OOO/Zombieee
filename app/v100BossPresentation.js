export function mugarianPresidentCompactScale({ compact, shortViewport } = {}) {
  if (!compact) return 1;
  return shortViewport ? .52 : .6;
}
