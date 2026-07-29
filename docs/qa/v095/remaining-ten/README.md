# Version 0.9.5 remaining-ten evidence

## Scope

- Integration base: `925370ec5c558946a9f0394761c768166eb0eeac`
- Phase branch: `codex/0.9.5-remaining-ten`
- Production build and local-only QA route; no deployment
- Chromium and Playwright WebKit at `844x390` and `844x340`, DPR `3`

This phase completes the player-facing animation pass for Paisen, Mizuchi, Nao,
Tatara, Kumaverson, Babayaga, Gantetsu, Monkey, Zakimiya, and Miyamoto Musashi.
It uses approved production atlases and the real combat loop. Raw screenshots
and the full browser output are generated under `outputs/v095-remaining-ten/`
and are intentionally ignored; the stable result is
`remaining-ten-summary.json`.

## Runtime changes

Each unit now owns distinct idle, movement, turn, normal-attack
wind-up/active/recovery, and manual-special motion. Procedural transforms remain
pivoted at the authored foot point (`groundAnchor=1`, `offsetY=0`).

The normal-attack proof does not assign `attack`, increment `attackSequence`, or
inject damage. It places a valid target, releases the production battle loop,
and atomically pauses the first observed wind-up, active, and recovery frame.
Every active proof requires a real sequence increment, damage or a pending
damage transaction, and the expected production weapon cue.

All ten manual abilities now retain a locked recovery interval. Sustained
Kumaverson and Gantetsu effects recover after `active-end`. Miyamoto Musashi
now shows a cross-cut release and recovery after both a real melee counter and
the untouched fallback path, while preserving one impact per activation.

The normal attack transaction subtracts only the authored wind-up from the
post-impact cooldown. Therefore `wind-up + post-impact cooldown` equals the
pre-animation hit-to-hit interval for all 16 playable units; damage and the
authored `attackEvery` values are unchanged.

Gantetsu's shield strike now resolves to the existing approved heavy-metal
impact cue. No new or unlicensed audio file was introduced.

## Browser evidence

The final browser run completed `4/4` cases:

- real normal-attack proofs: `120`
- manual activations and recovery proofs: `60`
- real Musashi melee-counter recovery proofs: `4`
- 1x activations: `40`; real Survival 2x activations: `20`
- Canvas captures: `444`; unique SHA-256 hashes: `444`
- captures per `844x390` case: `121`
- captures per `844x340` case: `101`
- resident production sprites per case: `45`
- logical off-floor and visual off-floor fighters: `0`
- console errors, page errors, request failures, HTTP errors: `0`
- missing damage/pending-hit, weapon cue, VFX, or recovery proof: `0`

Auto resolved to Balanced (`45 fps`, DPR cap `1.5`), High to High (`60 fps`,
DPR cap `2`), and Power save to Power save (`30 fps`, DPR cap `1`).

## Validation

- focused combat, manual-ability, and audio contract tests: `71/71`
- complete test suite: `720/720`
- production build: passed
- Lint: passed
- content validator: passed with no errors or warnings
- `git diff --check`: passed
- combat-presentation browser regression: `4/4`
- manual-ability browser regression: `6` cases, `32` activations
- new-playable-human browser regression: `4/4`
- independent read-only review: High `0`, Medium `0`, Low `0`

Physical-phone temperature is not claimed by this evidence.
