# Version 0.9.5 baseline evidence

## Authority and scope

- Version 0.9.0 release SHA: `f2633c538756385f13d166d3adbcdd39b3a08b21`
- Version 0.9.5 docs merge／integration start SHA: `76b9168d03109fbb473df7632f0f201d9612f13d`
- Runtime difference between the two SHAs: docs-only
- Formal Version 0.9.0 Pages metadata: version `0.9.0`, release SHA `f2633c538756385f13d166d3adbcdd39b3a08b21`, request ID `v0.9.0-formal-release-20260729`, Issue `#68`
- Baseline target: current Version 0.9.0 player-facing runtime before Version 0.9.5 implementation

This directory fixes the comparison input for Issue #96. It does not claim that
the baseline already satisfies the Version 0.9.5 acceptance criteria.

## Performance baseline

The 844×390 Chromium gate ran for 900,000 ms with 100% battle coverage.
It recorded 53,909 frames, 16.7 ms median and p95 frame time, zero frame samples
dropped, zero long tasks over 100 ms, zero RAF stalls over 100 ms, and zero
browser diagnostics. The retained heap grew 3.27%, while the ordinary used JS
heap median grew 11.1%; the bounded runtime proxy stayed at 851.

The automated gate passed. This is a software measurement only: it does not
claim physical-smartphone heat was verified.

Machine-readable evidence:
[`v090-performance-baseline.json`](./v090-performance-baseline.json)

## All 16 units: continuous-frame baseline

The reproducible local capture records six player-facing canvas frames per
canonical unit at 844×390:

1. CRAWLER entry
2. combat ready
3. attack-probe frame after observed damage, or the four-second timeout state
4. next animation frame
5. next animation frame
6. next animation frame

All 16 units were generated through the production CRAWLER deployment path.
The capture contains 96 frames, zero browser diagnostics, and zero grounding
audit failures. In this captured run, the three intervals between the four
attack-probe frames were 17.4–23.0 ms across all 16 units, so they are retained
from consecutive `requestAnimationFrame` callbacks rather than independently
timed screenshots.
Fifteen units reached player-facing damage within the four
second probe. `scout` acquired the correct CRAWLER attacker and showed
`aiMoveDirection = -1`, but remained at close range with `attackSequence = 0`;
this is a confirmed Version 0.9.0 residual defect for the later CRAWLER／combat
phase, not a waived result.

Visual evidence:
[`v090-16-unit-continuous-frame-baseline.png`](./v090-16-unit-continuous-frame-baseline.png)

Machine-readable evidence:
[`v090-16-unit-visual-baseline.json`](./v090-16-unit-visual-baseline.json)

## Save baseline and explicit gap

The existing migration matrix passed 44／44 cases across Chromium and WebKit at
844×390 and 844×340 with zero diagnostics. It covers fresh save, release 0.7.1
fixtures, schema 10, partial and corrupt replicas, tampering, recovery without
automatic reset, and manual import.

It does **not** yet prove Version 0.9.0 origin-by-origin transfer, Pages-to-LAN
transfer, or the Version 0.9.5 schema. Those remain mandatory work in Issue #96.

Machine-readable evidence:
[`v090-save-migration-baseline.json`](./v090-save-migration-baseline.json)

## Reproduction

```powershell
npm.cmd run build
$env:V095_VISUAL_BASELINE_EVIDENCE_DIR = "outputs/v095-visual-baseline"
$env:V095_VISUAL_BASELINE_REPORT_DIR = "docs/qa/v095/baseline"
npm.cmd run qa:v095-visual-baseline
npm.cmd run qa:save-migration
```

The visual command fails closed unless the current checkout is descended from
the Version 0.9.0 release and every difference is confined to the docs／baseline
evidence allowlist. It also verifies that `package.json` differs only by the
baseline command. The evidence records the actual Git HEAD and verified paths.

The 15-minute performance command uses `scripts/browser-performance-budget.mjs`
with gate mode, Chromium, 844×390, a 900,000 ms duration, and the release label
`0.9.0-f2633c5-baseline`. Its full raw report remains under the ignored
`outputs/` directory; the stable comparison fields are copied into this
directory.
