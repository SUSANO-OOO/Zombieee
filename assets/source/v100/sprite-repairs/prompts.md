# Issue 177 sprite fixes — 2026-10-10

All edits used the built-in `image_gen` tool with `transparent_background: true`.
The original published sprites and identity masters remain immutable inputs.
Boss edits supply alpha guides only: every RGB byte in the runtime sheets is
retained from the published original. Musashi adopts generated pixels only
inside the two recorded local repair polygons, mirrored for the opposite row.
`provenance.json` records exact inputs, outputs and allowed changes.

## Musashi walking

Remove only the silver blade entering from the left edge and crossing behind
the cloak, which has no hand holding it and belongs to a neighbouring pose.
Restore the small covered cloak area. Preserve the genuine katana and visible
hand, other hilt, face, topknot, clothing, armor, feet, pose, scale and framing.
No new weapon, body part or background; actual transparent RGBA.

## Musashi waiting

Remove only the neighbouring figure's cloak fragment at the far right. Keep
the two legitimate hand-held katanas. Complete the existing far katana's
clipped tip within the canvas. Preserve the samurai's identity, clothing,
hands, pose, feet, proportions, colors and framing. No third sword or backdrop.

## Mutated president

Clean the existing eight-pose four-column, two-row sheet. Preserve all poses,
layout, positions, scale, identity, colors and details. Make the white matte
inside arm/torso, pipe loops, claws, cane/wires and around feet transparent.
Retain thin outlines and real highlights. No redesigned or additional limbs,
weapons, poses, text, checkerboard or backdrop.

## TAKUYA-Ω

Clean the existing eight-pose four-column, two-row sheet. Remove trapped white
background inside tubing loops, between arm and torso, elbows, fingers and
weapon/limb gaps. Preserve grey hair, sunglasses, bare chest, straps, shorts,
boots, mutated arm, tubes and heavy cleaver, all poses, dimensions and layout.
Keep legitimate highlights. No orange vest, new clothing, new limbs, changed
weapon, re-layout, crop, text, checkerboard or backdrop.
