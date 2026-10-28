import { EVENT_PORTRAIT_INK_BOTTOM } from './eventPortraitInkBounds.js';

// Align visible torso, rather than transparent image bounds, to the dialogue.
export function observeEventPortraitLayout(root) {
  const portrait = root?.querySelector('.event-portrait.active');
  const dialogue = root?.querySelector('.dialogue-box');
  if (!portrait || !dialogue) return () => {};
  let frame = 0;
  const align = () => {
    frame = 0;
    const style = getComputedStyle(portrait);
    const url = /^url\(["']?(.*?)["']?\)$/u.exec(style.backgroundImage)?.[1];
    const pathname = url ? new URL(url, document.baseURI).pathname : '';
    const assetPath = Object.keys(EVENT_PORTRAIT_INK_BOTTOM).find(path => pathname.endsWith(path));
    const inkBottom = EVENT_PORTRAIT_INK_BOTTOM[assetPath];
    if (inkBottom === undefined) return;
    const top = Number.parseFloat(style.paddingTop);
    const height = portrait.clientHeight - top - Number.parseFloat(style.paddingBottom);
    const ratio = Number.parseFloat(style.backgroundSize.split(' ')[1]) / 100;
    const focus = Number.parseFloat(style.backgroundPosition.split(' ')[1]) / 100;
    const paintedBottom = portrait.getBoundingClientRect().top + top
      + height * (1 - ratio) * focus + height * ratio * inkBottom;
    const delta = dialogue.getBoundingClientRect().top + 24 - paintedBottom;
    if (Number.isFinite(delta) && Math.abs(delta) > .1) {
      portrait.style.bottom = `${Number.parseFloat(style.bottom) - delta}px`;
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(align); };
  const resize = new ResizeObserver(schedule);
  resize.observe(root); resize.observe(portrait); resize.observe(dialogue);
  const mutation = new MutationObserver(schedule);
  mutation.observe(portrait, { attributes: true, attributeFilter: ['style', 'class', 'data-portrait'] });
  schedule();
  return () => { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); };
}
