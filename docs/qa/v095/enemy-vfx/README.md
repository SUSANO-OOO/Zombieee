# Version 0.9.5 enemy, boss, CRAWLER, and battlefield VFX evidence

## Scope and provenance

- Integration base:
  `de56596e65e4eeb5457ed4762ca5df25200a9b8a`
- Phase branch: `codex/0.9.5-enemy-vfx`
- Production build and local-only browser QA
- No GitHub Pages deployment and no physical-device heat claim

Raw browser captures and reports are generated below `outputs/` and remain
ignored build evidence. The stable review record is
[`enemy-vfx-summary.json`](./enemy-vfx-summary.json).

## Player-facing implementation

- Every enemy in the active registry receives state-driven entry, movement,
  attack-warning, hit, and low-HP readability effects.
- All twelve ordinary non-projectile enemies exercise their warning and
  low-HP states through a real runtime attack transaction; the warning window
  is included inside the existing attack interval so authored DPS is retained.
- Spitter, Ooze, Resonator, and Choir Knot fire visually distinct projectiles
  from their authored organ or mouth anchor. Their actual gameplay shot
  transactions use the same origin and target geometry shown on Canvas, and
  damage is applied only when the visible projectile reaches its impact.
- Bosses retain their existing authored warnings and gain bounded critical
  aura, vapor, and impact readability after full-body combat readiness.
- CRAWLER door, storage, weapon aim, recoil, muzzle flash, damage sparks,
  critical smoke, exhaust, and Survival repair arcs are connected to live
  runtime state. The browser proof fires at three real enemy targets and
  verifies that all three remain undamaged in flight and receive damage at
  impact. Dense lanes keep every damage receipt while bounding visible tracers
  and impact staggering to three presentation slots.
- High, Auto, and Power save keep the same combat transactions. Optional
  particles and secondary effects are bounded by the active graphics profile.
- The QA bridge reports that production rendering does not enable debug
  geometry.

## Automated and browser gates

- Full Node suite: `726 / 726`
- ESLint: passed
- Production build: passed
- `git diff --check`: passed
- Enemy/VFX matrix: `6 / 6`
  - Chromium and WebKit
  - `1280x720`, `844x390`, and `844x340`
  - High at `1280x720` and `844x390`; Power save at `844x340`
  - all twelve ordinary non-projectile enemy kinds
  - four projectile kinds and six CRAWLER states
  - 24 production projectile transactions and 6 production CRAWLER barrages
  - 24 continuous-frame sequences
  - console, page, request, and HTTP errors: 0
- Existing boss-foundation regression: `12 / 12`
- Existing boss-anomaly regression: `18 / 18`
- Existing continuous battle-space regression: `4 / 4`
- Existing CRAWLER-defense regression: `240 / 240`
  - pass-throughs: 0
  - invalid direct objective attacks: 0

Representative reviewed captures:

- `outputs/v095-enemy-vfx-browser-smoke/`
  `chromium-1280x720-enemy-resonator-frame-1.png`
- `outputs/v095-enemy-vfx-browser-smoke/`
  `chromium-844x340-crawler-firing-frame-1.png`

Both captures show repository-resident production art rather than diagnostic
fallback shapes. The compact CRAWLER capture retains an unobstructed target,
aimed muzzle, shot trace, combat HUD, and grounded battlefield composition.

## Fifteen-minute performance gate

The current branch completed the isolated Chromium `844x390` Auto-quality gate
for 900,000 ms with 100% battle coverage.

| Metric | Version 0.9.0 baseline | Current phase | Result |
| --- | ---: | ---: | --- |
| Median frame interval | 16.7 ms | 16.7 ms | unchanged |
| p95 frame interval | 16.7 ms | 16.7 ms | unchanged |
| Maximum frame gap | 50 ms | 49.9 ms | improved 0.1 ms |
| Retained heap growth | 3.27% | 3.21% | improved 0.06 points |
| Runtime proxy growth | 0% | 0% | unchanged |
| Long tasks over 100 ms | 0 | 0 | unchanged |
| RAF stalls over 100 ms | 0 | 0 | unchanged |

The current run also recorded 40,468 rendered battle frames, 54,004 simulation
ticks, no sample overflow, no unexpected navigation, and no pool discard.
Particles, shots, and damage labels all demonstrated bounded reuse.

The raw `usedJSHeapSize` median rose 22.31%, but this includes browser heap that
is not retained after collection. The gate's explicit CDP collection measured
retained heap growth at 3.21%; the bounded runtime proxy remained exactly 841.
Both authoritative memory checks passed.

This is frame-time and memory evidence, not a temperature measurement.
Physical-smartphone temperature, native Safari lifecycle, touch, rotation, and
screen-lock recovery remain RC acceptance work.
