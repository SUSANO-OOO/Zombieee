# Version 0.9.5 RC physical-smartphone acceptance checklist

This checklist records the physical-smartphone boundary used by the Version
0.9.5 producer acceptance. Automated evidence never marks a physical-only item
as verified.

## Acceptance record

- The producer physically played Stages 1-13 before the audited release
  authorization in Issue #96 comment `5124971857`.
- Stage 14-20 are covered by the correction browser regression and AI mission
  matrix, not claimed as physical-device play.
- Native Safari, physical speaker listening, sustained device temperature, and
  physical touch/rotation/lock-return remain explicitly unverified by Codex.
- Heat optimization is shipped as a measured render-work reduction, not a
  claim that every physical smartphone no longer heats up.

## Connect

1. Put the smartphone and this Windows host on the same trusted LAN.
2. Keep the RC production server running on the host.
3. Open the LAN trial URL recorded in this directory's `README.md`.
4. Confirm the title screen shows the LAN environment badge and explains that
   the save belongs to this origin.
5. Expect a fresh save on first LAN access. LAN, localhost, and GitHub Pages
   do not share localStorage or IndexedDB. Use manual export/import only when a
   specific save-transfer check is intended.

## Required physical checks

- Play at least 15 minutes in a normal operation and 15 minutes in a dense
  Survival Wave 20 situation.
- Compare device temperature before play, after the normal run, and after the
  Survival run. Record the device model, OS, browser, case/charging state,
  ambient conditions, and graphics mode. Do not translate desktop frame-time
  evidence into a temperature claim.
- Exercise High, Auto, and Power save. Confirm Power save remains playable and
  that simulation, damage, cooldowns, rewards, and unlock receipts do not
  change with graphics quality.
- Deploy units repeatedly and confirm the entry sequence never becomes
  unintentionally transparent, floats above the lane, faces away from the
  target, or applies damage before the visible attack cue.
- Inspect all 16 playable units' normal attacks and manual abilities in the
  player-facing battle screen. Confirm weapon cue, sound, contact point,
  direction, recovery, and damage timing.
- Exercise ordinary enemies, projectile enemies, bosses, CRAWLER door/fire/
  hit/critical/repair states, and dense battlefield effects. Confirm targets
  remain readable and visible projectiles reach impact before damage.
- Verify touch deployment, manual ability controls, pause, safe areas, browser
  toolbar changes, portrait-to-landscape rotation, tab return, screen lock/
  unlock, and BFCache-style back/forward return.
- Listen through the physical speaker for BGM, weapon SE, enemy sound, human
  battle voice, duplicated playback, clipping, and missing sound.
- Verify 「雇用」copy, the one-time employment-available popup, and Mayo's
  Survival Wave 20 reach unlock without duplicate receipt or caps charge.
- Reload, close/reopen the browser, and confirm the LAN-origin save persists.
  Separately confirm manual export/import if that transfer is part of the
  acceptance session.

## Future physical record

Record pass/fail, a short observation, and any screenshot or video filename for
each failed item. Any newly observed release-blocking failure must be recorded
on Issue #96 before publication proceeds. The audited Issue #96 comment
`5124971857` is the formal instruction for the current release sequence;
GitHub Pages Public QA must succeed before Issue #96 is closed.
