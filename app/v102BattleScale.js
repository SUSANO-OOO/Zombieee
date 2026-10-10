import { fitSpriteBattleDisplaySize, spriteFrameFor } from './spriteManifest.js';

// An actor has one pixel-to-world scale. Refitting every crouch, raised weapon,
// hit and death silhouette made bodies grow or shrink during the same action.
export function v102BattleDisplaySize(kind, frame, maximum) {
  const reference = spriteFrameFor(kind, 'idle', 'right');
  const fitted = fitSpriteBattleDisplaySize(kind, reference, maximum);
  const scale = fitted.h / reference.sourceRect.h;
  return { w: frame.sourceRect.w * scale, h: frame.sourceRect.h * scale };
}
