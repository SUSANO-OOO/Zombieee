# Version 0.9.5 RC physical-smartphone acceptance checklist

This checklist is for the producer acceptance that follows RC integration.
Completing the automated RC does not mark any item below as physically
verified.

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

## Record

Record pass/fail, a short observation, and any screenshot or video filename for
each failed item. A physical failure blocks formal release approval even when
the automated RC gates remain green. It does not authorize an
`integration/0.9.5 -> main` merge, tag, Release, or Pages deployment without a
separate producer instruction.
