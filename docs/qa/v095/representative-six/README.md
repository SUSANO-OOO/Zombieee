# Version 0.9.5 representative-six evidence

## Scope and provenance

- Integration base: `3d7141a0307c841ce82547e68eaff5959e8c4482`
- Phase branch: `codex/0.9.5-representative-six`
- Production build and local-only QA route; no Pages deployment
- Reference viewports: `844x390`, `844x340`
- Device pixel ratio emulation: `3`
- Browser engines: Chromium and Playwright WebKit

This phase is the player-facing vertical slice for Hachi, Raider, Crazy King,
TKY, Mrs. Chiha, and Mayo-chan. It uses their approved production battle
atlases and the shared Version 0.9.5 animation runtime. It does not replace the
characters with test-only drawings or a foundation-only state demonstration.

Raw continuous-frame captures and the full browser summary are generated under
`outputs/v095-representative-six/` and are intentionally not release assets.
The stable review result is copied into
`representative-six-summary.json`.

## Player-facing implementation

Each of the six units owns a distinct locomotion cadence, normal-attack
wind-up/active/recovery timeline, manual-ability timeline, procedural pose, and
weapon or attack-organ anchor. Every transform remains pivoted at the authored
foot point with `offsetY=0`.

- Hachi uses the canonical crowbar rather than the former incorrect handgun
  profile. His fast step, intercept dash, crowbar sweep, impact, and reacquire
  frames are synchronized; no casing is emitted.
- Raider braces for sustained fire. Normal fire remains a three-round sequence.
  His manual suppression waits through the authored `0.18s` aim, then resolves
  as five ordered muzzle/SE/hit rounds rather than one aggregate damage event,
  while preserving the same total damage.
- Crazy King has a heavy walk, chainsaw lift/contact/extract cycle, and a
  separate rev-to-overdrive special.
- TKY locks facing and extends his plasma blade through charge, two contact
  frames, sweep, and release.
- Mrs. Chiha balances and cycles the launcher during normal attacks. Her special
  retrieves, aims, launches four timed grenades, resolves four impacts, then
  stows and returns to ready.
- Mayo-chan uses alert/sniff movement, paw cadence, bite/reset, feral bloom, and
  the existing non-death retreat lifecycle.

Manual VFX originate from the same runtime weapon anchor used by the character
render. Moving Crazy King and Mayo effects follow their owner. Raider reveals
no line before aim, then reveals five sequential lines and muzzle pulses at the
same timestamps as SE and damage. TKY's sweep follows the blade, and Mrs.
Chiha's four projectile arcs retain their locked impact points.

The normal-attack proof does not assign `attack`, increment `attackSequence`, or
inject a synthetic shot. It places a valid production target, releases the real
battle loop, and observes target acquisition, wind-up, the production damage or
pending-hit transaction, Canvas VFX, and the production weapon-cue request.

## Browser matrix

`npm.cmd run qa:v095-representative-six` completed all four engine/viewport
cases:

- passed: `4/4`
- failed: `0`
- production sprites resident per case: `45`
- Auto: resolved Balanced, `45 fps`, DPR cap `1.5`
- High: resolved High, `60 fps`, DPR cap `2`
- Power save: resolved Power save, `30 fps`, DPR cap `1`
- 1x manual-ability activations: all six units in all four cases (`24`)
- 2x manual-ability activations: all six units at `844x390` in both engines
  (`12`)
- normal-attack runtime proofs: all six units in all four cases (`24`)
- manual-special recovery proofs: every activation (`36`)
- Canvas captures: `264`; unique hashes within every case: `72/72` or `60/60`
- ground anchor: `1` in every sampled normal and special frame
- procedural vertical offset: `0` in every sampled normal and special frame
- logical and visual off-floor fighters: `0`
- console errors, page errors, request failures, HTTP errors: `0`
- missing real damage/pending-hit or expected production weapon SE: `0`

For every unit the Auto pass captures idle, right-facing movement, left-facing
turn, real normal-attack wind-up, active, and recovery. High and Power save each
capture the real normal-attack active frame. Every manual activation captures
both the initial `special` sample and the actual locked `recovery` phase
submitted to the production Canvas render, plus the dedicated VFX and runtime
receipt sequence.

The receipt evidence includes Raider's ordered muzzle `0..4` and impact `0..4`
pairs, Mrs. Chiha's four launch/impact pairs followed by cooldown, Hachi and
TKY's impact, Crazy King's active-start, and Mayo-chan's feral-start. The 2x
checks use the real Survival speed control; they do not shorten the fixture
timer directly.

## Regression and validation

- focused combat-presentation and manual-ability tests: `47/47`
- complete test suite: `718/718`
- production build: passed
- Lint: passed
- content validator: passed with no errors or warnings
- `git diff --check`: passed
- existing combat-presentation browser QA: `4/4`
- existing manual-ability browser QA: `6` cases and `32` activations
- TKY/Mrs. Chiha browser QA: `4/4`
- Mayo vertical-slice browser QA: `4/4`
- animation-foundation browser QA: `4/4`

## Independent review corrections

The first independent read-only review reported `High 0 / Medium 3 / Low 1`.
All four findings were corrected before the final evidence run:

- Hachi, Raider, Crazy King, TKY, and Mayo-chan now enter an observable,
  action-locking recovery phase and own authored recovery frames.
- Raider's manual VFX, weapon SE, and damage now share the same five-round
  post-aim timeline.
- normal-attack browser proof now traverses the production attack transaction
  instead of assigning animation state or injecting a test shot.
- production normal attacks now execute a real per-unit wind-up before their
  damage and SE transaction.

Final independent read-only re-review passed with
`High 0 / Medium 0 / Low 0`. The reviewer also re-ran the focused tests,
complete test suite, production build, Lint, and `git diff --check`, and found
no prohibited-scope change.

## Validation boundary

This phase establishes the approved quality bar for the representative six.
The remaining ten playable units, the combined all-sixteen continuous-frame
proof, enemies, bosses, CRAWLER, wider battlefield/VFX polish, and RC
performance comparison remain later Issue #96 phases.

The checks use headless Chromium and Playwright WebKit. They are evidence for
rendering, timing, direction, grounding, effect identity, and browser
diagnostics, not a claim of measured physical-smartphone temperature or native
iPhone acceptance.
