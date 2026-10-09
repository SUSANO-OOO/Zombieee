// This callback runs as one browser task. Keep the settled-state check and
// the returned measurements together so a later RPC cannot sample a new fade.
export function v100EventPortraitSnapshot({selector, nodeIndex, identities}) {
  const surface = document.querySelector(selector);
  if (!surface || surface.getAttribute("data-v100-node-index") !== nodeIndex) return null;
  const images = [...surface.querySelectorAll(".v100-portrait")];
  if (images.length === 0 || images.length !== identities.length) return null;
  const currentIdentities = images.map(element => ({
    src: element.getAttribute("src"),
    owner: element.closest(".v100-portrait-frame")?.getAttribute("data-portrait-owner") ?? null,
  }));
  if (currentIdentities.some((identity, index) => identity.src !== identities[index].src
    || identity.owner !== identities[index].owner)) return null;
  const states = images.map(element => {
    const animations = element.getAnimations();
    const style = getComputedStyle(element);
    return {
      element,
      unsettled: animations.some(animation => animation.pending
        || !["finished", "idle"].includes(animation.playState)),
      opacity: style.opacity,
      objectFit: style.objectFit,
      backgroundColor: style.backgroundColor,
    };
  });
  if (states.some(({element, unsettled, opacity}) => unsettled
    || !element.complete || element.naturalWidth <= 0 || opacity !== "1")) return null;
  const primary = states.find(({element}) => !element.classList.contains("v100-portrait-secondary"));
  if (!primary) return null;
  const rect = primary.element.getBoundingClientRect();
  const frame = primary.element.closest(".v100-portrait-frame");
  const frameRect = frame?.getBoundingClientRect();
  return {
    nodeIndex,
    identities: currentIdentities,
    opacity: primary.opacity,
    objectFit: primary.objectFit,
    backgroundColor: primary.backgroundColor,
    width: rect.width,
    height: rect.height,
    frameWidth: frameRect?.width ?? 0,
    frameHeight: frameRect?.height ?? 0,
    frameOverflow: frame ? getComputedStyle(frame).overflow : "missing",
    frameFraming: frame?.getAttribute("data-portrait-framing") ?? "missing",
  };
}
