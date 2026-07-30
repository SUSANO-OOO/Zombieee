# Version 0.9.5 residual-bug evidence

## Authority and scope

- Version 0.9.0 release SHA: `f2633c538756385f13d166d3adbcdd39b3a08b21`
- Version 0.9.5 phase base: `743f08583667f39875f61a7b663c7168f0fc3d1f`
- Issue authority: `#96`
- Scope: player-facing residual defects after the animation, mobile-performance,
  and enemy／VFX phases

This phase does not change the roster, add a stage or boss, or rewrite the
engine. It fixes shared combat boundaries and verifies the production render
path.

## Confirmed defects and fixes

### CRAWLER responder could stop without attacking

The Version 0.9.0 baseline deployed all 16 units through the real CRAWLER door.
Fifteen landed damage. Scout selected the correct breach attacker and moved
left, but remained at a 39 px center distance with `attackSequence = 0`.

The movement recovery gate treated the target as engaged with a 2 px tolerance,
while both actual attack call sites used a stricter reach. Version 0.9.5 now
uses one exported reach calculation for target selection, the attack
transaction, damage execution, and navigation recovery. A defender may also
retreat to the authored CRAWLER `rampFootX` instead of an unrelated 10 px
forward offset. This lets the smallest short-range unit, Mayo, intercept the
same x=119 breach fixture without entering or floating inside the CRAWLER.

### Attack wind-up could face away from a rear threat

Normal-attack wind-up sets movement direction to zero. The former presentation
fallback then faced every stationary human to the right, even when its locked
CRAWLER target was on the left. Facing now resolves in this order:

1. active manual-ability target;
2. actual movement direction;
3. locked normal-attack target;
4. side default.

All 96 attack captures face the real breach target and show actual HP loss.

### WebKit transparency false positive

The battlefield intentionally composes a transparent Canvas foreground over a
CSS production background. Reading only raw Canvas alpha incorrectly reported
transparent holes in WebKit at 1280×720 even though the visible screenshot was
complete. The residual QA now analyzes the browser-composited screenshot.
Across 384 captured states it found zero transparent pixels in the inspected
CRAWLER region and at least 177 quantized color bins.

## Player-facing matrix

`npm.cmd run qa:v095-residual-bugs` ran the production build across:

- Chromium and WebKit;
- 1280×720, 844×390, and 844×340;
- all 16 canonical playable units;
- CRAWLER entry, ramp movement, combat-ready, and real attack frames.

Results:

- 96／96 cases passed;
- 384／384 frame hashes were distinct;
- 96／96 real attacks reduced the bound threat's HP;
- 96／96 attacks faced left toward the CRAWLER threat;
- entry-to-ready: 500.0–1,133.3 ms of active battle time;
- ready-to-damage: 283.3–4,016.7 ms of active battle time;
- logical off-floor, visual off-floor, changed ground anchor, and vertical
  contact-point offset: 0;
- composited transparent pixels, rendered debug geometry, player-facing debug
  labels, and keyboard labels: 0;
- console errors, page errors, request failures, and HTTP errors: 0.

The ignored output directory retains 16 compact attack screenshots plus WebKit
entry／ramp／ready／attack sequences for Scout and Mayo. The committed
machine-readable summary contains the stable audit values and hashes.

## Cross-checks and required gates

- CRAWLER defense: 240／240, pass-through 0, objective-direct 0
- battle-space browser QA: 4／4
- combat-presentation browser QA: 4／4
- asset decode: audio 399／399, portraits 34／34, images 57／57; the carbine
  playback proof ran with a live AudioContext
- focused combat／AI／presentation tests: passed
- all tests: 727／727
- production build: passed
- Lint: passed
- `git diff --check`: passed

The headless browser result verifies rendering, decoding, mixer state, and
runtime events. It does not claim physical speaker quality or physical-device
temperature. Those remain part of RC producer acceptance.

## Reproduction

```powershell
npm.cmd run build
npm.cmd run qa:v095-residual-bugs
npm.cmd run qa:crawler-defense
npm.cmd run qa:battle-space
npm.cmd run qa:combat-presentation
npm.cmd run qa:asset-decode
npm.cmd test
npm.cmd run lint
git diff --check
```
