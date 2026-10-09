// This function is also evaluated in the remote browser. Keep it self-contained.
export function inspectFormationPortraits(mode = "report") {
  const cards = [...document.querySelectorAll(".v100-slot.filled")], malformed = [];
  const requiredImages = cards.flatMap((card, index) => {
    const matches = [...card.querySelectorAll(".v100-slot-portrait img")];
    if (matches.length !== 1) malformed.push({ slot: index + 1, imageCount: matches.length });
    return matches;
  });
  const images = requiredImages.map(image => {
    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
    let ancestorsVisible = true;
    for (let parent = image.parentElement; parent; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (parentStyle.display === "none" || parentStyle.visibility !== "visible" || Number(parentStyle.opacity) < .99) ancestorsVisible = false;
      if (["hidden", "clip", "auto", "scroll"].includes(parentStyle.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (["hidden", "clip", "auto", "scroll"].includes(parentStyle.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    const drawnWidth = Math.max(0, right - left), drawnHeight = Math.max(0, bottom - top);
    const ready = image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && image.dataset.loaded === "true"
      && style.display !== "none" && style.visibility === "visible" && Number(style.opacity) >= .99
      && ancestorsVisible && drawnWidth > 0 && drawnHeight > 0;
    return { src: image.getAttribute("src"), complete: image.complete, naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight, loaded: image.dataset.loaded ?? null,
      display: style.display, visibility: style.visibility, opacity: style.opacity,
      drawnWidth, drawnHeight, ancestorsVisible, ready };
  });
  const result = { ready: malformed.length === 0 && images.every(image => image.ready), filledSlots: cards.length, malformed, images };
  return mode === "wait" ? result.ready : result;
}
