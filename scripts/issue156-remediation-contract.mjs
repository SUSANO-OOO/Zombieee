export const PORTRAIT_DIALOGUE_OVERLAP_MIN_PX = 12;
export const PORTRAIT_DIALOGUE_OVERLAP_MAX_PX = 40;

export function portraitDialogueOverlapWithinContract(overlapPx) {
  return Number.isFinite(overlapPx)
    && overlapPx >= PORTRAIT_DIALOGUE_OVERLAP_MIN_PX
    && overlapPx <= PORTRAIT_DIALOGUE_OVERLAP_MAX_PX;
}
