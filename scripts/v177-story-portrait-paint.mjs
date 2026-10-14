// Serialized unchanged into the hosted browser. Read only: the observer never
// changes opacity, CSS animations, playback, the scene, or the browser clock.
export function readV177StoryPortraitPaint(selector) {
  const scene = document.querySelector(selector);
  if (!scene?.isConnected) return false;
  const portraits = [...scene.querySelectorAll('.v100-portrait')].map(image => {
    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
    return {
      source: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      opacity: Number(style.opacity),
      visibility: style.visibility,
      display: style.display,
      width: rect.width,
      height: rect.height,
      animations: image.getAnimations().map(animation => ({
        name: animation.animationName ?? null,
        playState: animation.playState,
        pending: animation.pending,
      })),
    };
  });
  if (portraits.some(p => !p.complete || p.naturalWidth <= 0 || p.naturalHeight <= 0
    || p.opacity !== 1 || p.visibility !== 'visible' || p.display === 'none'
    || p.width <= 0 || p.height <= 0
    || p.animations.some(a => a.pending || a.playState !== 'finished'))) return false;
  return { portraits, portraitCount: portraits.length, nativePaintReady: true };
}
