import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const DESIGN = "docs/design/v1.0.0/DESIGN_LOCK.md";
const INVENTORY = "docs/design/v1.0.0/ASSET_INVENTORY.md";
const HANDOFF = "docs/design/v1.0.0/LUNA_HANDOFF.md";
const PROJECT_STATE = "docs/PROJECT_STATE.md";
const PROVENANCE = "assets/source/v100/PROVENANCE.md";
const SPRITE_MANIFEST_SOURCE = "app/spriteManifest.js";
const R10_PREFLIGHT = "scripts/v100-r10-local-gate-preflight.mjs";
const R11_CAUSAL_TEST = "tests/v100-r11-combat-causal-history.test.mjs";
const BOUNDED_DEPLOYMENT_RUNNER = "scripts/run-v099-deployment-units-bounded.mjs";

const selectedAssets = Object.freeze([
  ["assets/source/v100/characters/segawa-identity-master-r2.png", "0bb98569efa36dbc7df6fbd7fb7ec2cce11671ddbe58f4ce84d9ce26fb187c1d", 934, 1684],
  ["assets/source/v100/characters/mugarian-president-identity-master-r2.png", "c5c6a40e161197a15855ca7733dc3c4af7f32138516eb885130244a2c3b22ab6", 1024, 1536],
  ["assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png", "be58f640e7b918e0a37a04d6e128b448c71926483a95f9a5a161cd83dfae0d72", 1024, 1536],
  ["assets/source/v100/enemies/takuya-omega-identity-master-r2.png", "d46f6a96f693dbf0aa9b81b9ef2b1f5797f461c87505c7390c80464e3a0249af", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-knife-identity-master-r1.png", "8875b636ed887caa34aa1a704c31291aa1a774c4429891d2c66e7356fc8082a2", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-shield-identity-master-r1.png", "584e03350283e6e7a92709c98d14ca63a9574e53f46961a39b466a3760d5ea2f", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-smg-identity-master-r1.png", "3f03c2e8e6eae37173e637ea801944b1016858222437b4e0c4d3d320b2f52fd8", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-commander-identity-master-r1.png", "dab75e9ec7e6e1075f969d021d8089477ca2e2cb40e3a1e416e5e029bade6dba", 1024, 1536],
  ["assets/source/v100/portraits/minor-human-shared-event-silhouette-r2.png", "a5e58d69828d5dacf99ceae1ce427f88fe751fbf3b491eedd50e5992b8c0eeb7", 1024, 1536],
]);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

test("v1.0.0 design documents bind one immutable Design ID and baseline", async () => {
  const [design, inventory, handoff, provenance] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(INVENTORY, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(PROVENANCE, "utf8"),
  ]);

  for (const source of [design, inventory, handoff, provenance]) {
    assert.match(source, /V100-SOL-DL-001/u);
  }
  assert.match(design, /Revision: `r59`/u);
  assert.match(design, /Status: `DESIGN_LOCKED`/u);
  assert.match(handoff, /Canonical Design Lock: `V100-SOL-DL-001 r59`/u);
  assert.match(handoff, /docs\/CODEX_SOL_ROLE\.md/u);
  assert.match(handoff, /docs\/CODEX_LUNA_ROLE\.md/u);
  assert.match(design, /435dc959d1972646f7e82b6c45d3f1c25d890252/u);
  assert.match(design, /4833a1eed29e3901e3dcfca01cf77db6846e5265/u);
  assert.match(design, /c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4/u);
  assert.match(handoff, /STATUS: READY_FOR_SOL_FINAL_REVIEW/u);
  assert.match(handoff, /No amend, rebase, force push, direct main push/u);
});

test("r7 preserves the release loop and locks both independent correction classes", async () => {
  const [design, handoff] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
  ]);

  for (const state of [
    "SOL_DESIGN_ACTIVE",
    "LUNA_IMPLEMENTATION_ACTIVE",
    "BLOCKED_RETURN_TO_SOL",
    "PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED",
    "PRODUCER_VISUAL_APPROVED_FREEZE",
    "READY_FOR_SOL_FINAL_REVIEW",
    "SOL_FINAL_REVIEW_APPROVED",
    "PRODUCER_FINAL_ACCEPTANCE",
    "STACKED_INTEGRATION_ACTIVE",
    "RELEASE_SHA_LOCKED",
    "POST_RELEASE_BLOCKED",
  ]) {
    assert.match(design, new RegExp(state.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(design, /Any branch commit after Visual Approval invalidates that approval/u);
  assert.match(design, /PR #169: `docs\/story-v10-final-release-baseline` -> `main`/u);
  assert.match(design, /PR #171 merge result commit[\s\S]*becomes `RELEASE_SHA`/u);
  assert.match(design, /annotated tag `v1\.0\.0`/u);
  assert.match(design, /operation=release`.*deploy=true`.*issue_number=172`/u);
  assert.match(design, /High ambiguity: 0.*Medium ambiguity: 0/u);

  const r7Design = design.match(/## 21\. Revision r7([\s\S]*)$/u)?.[1] ?? "";
  const r7Handoff = handoff.match(/## 14\. Revision r7([\s\S]*)$/u)?.[1] ?? "";
  assert.match(r7Handoff, /LAST_AUDITED_HEAD`: `bad1578b45171b476a8989c3180433ba14f973b7`/u);
  assert.match(r7Handoff, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(r7Handoff, /REPO_HYGIENE \/ FIVE_FILE_MIXED_EOL \/ REMEDIATION_LOCAL/u);
  assert.match(r7Handoff, /QA_HARNESS_PREDICATE_ORCHESTRATION \/ REMEDIATION_LOCAL/u);
  assert.match(r7Handoff, /RESUME_FROM`: five-file LF\/BOM normalization \+ exact LF attributes \+ Node-owned final-cut predicate wait -> focused local checks -> one normal correction push -> wait for that one automatic CI run terminal -> `BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`/u);
  assert.match(r7Handoff, /Return this status whether the run is green or failed/u);
  assert.match(r7Handoff, /docs\/test-only r7 packet commit is metadata-only/u);
  assert.match(r7Handoff, /Only the later run whose `headSha` is your one authorized correction commit counts/u);
  assert.match(r7Design, /`9452903579`/u);
  assert.match(r7Design, /all five r6 diagnostic files/u);
  assert.match(r7Design, /every existing final-cut predicate component was true/u);
  assert.match(r7Design, /waitForFinalCutPredicateFromNode/u);
  assert.match(r7Design, /scripts\/run-stage3-audio-bounded\.mjs` byte-identical/u);
  assert.match(r7Design, /High ambiguity: 0` and `Medium ambiguity: 0/u);
  assert.match(handoff, /Luna never classifies a failure, finding, Producer rejection/u);
});

test("r7 Section 22 locks the single-file attributes remediation and mandatory Sol return", async () => {
  const [design, handoff] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
  ]);
  const packet = design.match(/## 22\. Revision r7 same-revision packet([\s\S]*)$/u)?.[1] ?? "";
  const execution = handoff.match(/## 15\. Revision r7 same-revision handoff([\s\S]*)$/u)?.[1] ?? "";

  for (const source of [packet, execution]) {
    assert.match(source, /7429460950a37b2ac68415a5046547c97f8bb263/u);
    assert.match(source, /9c1cab7d8a8950a2ba475d89ffb986434ba36d15/u);
    assert.match(source, /REPO_HYGIENE \/ DOT_GITATTRIBUTES_MIXED_EOL \/ REMEDIATION_LOCAL/u);
    assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
    assert.match(source, /BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE/u);
  }
  assert.match(packet, /26 CRLF plus 6 LF/u);
  assert.match(packet, /LOCAL_VALIDATION_EVIDENCE_REJECTED \/ IMMUTABLE_BLOB_CONTRADICTION/u);
  assert.match(packet, /Stage 3 3\/3/u);
  assert.match(packet, /WebKit deployment bounded summaries 6\/6/u);
  assert.match(packet, /six Chromium deployment axes[\s\S]*remain unexecuted/u);
  assert.match(packet, /Design ID remains `V100-SOL-DL-001 r7`; no r8 revision is created/u);
  assert.match(packet, /changing exactly `\.gitattributes` relative to its parent/u);
  assert.match(packet, /add exactly one self-contract line: `\.gitattributes text eol=lf`/u);
  assert.match(packet, /inspect the committed blob—not only the working file/u);
  assert.match(execution, /Change exactly one file relative to the Sol packet parent: `\.gitattributes`/u);
  assert.match(execution, /Then return exactly, whether green or failed/u);
  assert.match(execution, /Do not repeat completed diagnostics or local full\/unfiltered Phase G/u);
  assert.match(design, /High ambiguity: 0` and `Medium ambiguity: 0/u);
});

test("r11 preserves r8-r10 ownership and closes monotonic Stage 24 causal history", async () => {
  const [design, handoff, projectState, preflight, causalTest] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(PROJECT_STATE, "utf8"),
    readFile(R10_PREFLIGHT, "utf8"),
    readFile(R11_CAUSAL_TEST, "utf8"),
  ]);
  const packet = design.match(/## 23\. Revision r8([\s\S]*)$/u)?.[1] ?? "";
  const execution = handoff.match(/## 16\. Revision r8([\s\S]*)$/u)?.[1] ?? "";
  const closure = design.match(/## 24\. Revision r9([\s\S]*)$/u)?.[1] ?? "";
  const resume = handoff.match(/## 17\. Revision r9([\s\S]*)$/u)?.[1] ?? "";
  const loopBreaker = design.match(/## 25\. Revision r10([\s\S]*)$/u)?.[1] ?? "";
  const bootstrap = handoff.match(/## 18\. Revision r10([\s\S]*)$/u)?.[1] ?? "";
  const causalClosure = design.match(/## 26\. Revision r11([\s\S]*)$/u)?.[1] ?? "";
  const causalHandoff = handoff.match(/## 19\. Revision r11([\s\S]*)$/u)?.[1] ?? "";
  const sourceConsistency = design.match(/## 27\. Revision r11 same-revision packet([\s\S]*)$/u)?.[1] ?? "";
  const sourceConsistencyHandoff = handoff.match(/## 20\. Revision r11 same-revision handoff([\s\S]*)$/u)?.[1] ?? "";

  for (const source of [packet, execution]) {
    assert.match(source, /d1aab90ccefa8ad6601821c8520741bde49cd087/u);
    assert.match(source, /00df3ea842578cddc846059dd2c12f9dca1936a2/u);
    assert.match(source, /32539432537/u);
    assert.match(source, /96949389397/u);
    assert.match(source, /96954658044/u);
    assert.match(source, /DUAL_QA_HARNESS \/ PHASE_G_ATOMIC_DEPLOYMENT_ELIGIBILITY \+ HUD_LIFECYCLE_CRASH_CLASSIFICATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
    assert.match(source, /dynamic evidence packet \+ twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`/u);
  }

  assert.match(packet, /QA_PREDICATE_OR_ORCHESTRATION \/ STALE_DOM_READY_VS_RUNTIME_AFFORDABILITY_ACTIONABILITY_RACE/u);
  assert.match(packet, /BROWSER_LIFECYCLE_OR_RESOURCE \/ CLEAN_UNEXPECTED_PAGE_CRASH_MISCLASSIFIED_BY_BOUNDED_HUD_RUNNER/u);
  assert.match(packet, /Neither incident may be used to infer the other's root cause/u);
  assert.match(packet, /Producer Directive `5377824157`/u);
  assert.match(packet, /Artifact `9466905397`/u);
  assert.match(packet, /Artifact `9467643324`/u);
  assert.match(packet, /Design ID is now `V100-SOL-DL-001 r8`/u);
  assert.match(packet, /energy >= cost/u);
  assert.match(packet, /candidate-invalidated-before-click/u);
  assert.match(packet, /at most 2,000 ms/u);
  assert.match(packet, /normal player-facing Playwright click/u);
  assert.match(packet, /attempt's own summary and lifecycle JSONL/u);
  assert.match(packet, /Maximum attempts remains exactly two/u);
  assert.match(packet, /scripts\/run-v099-hud-states-bounded\.mjs text eol=lf/u);
  assert.match(packet, /tests\/v099-hud-states-bounded\.test\.mjs text eol=lf/u);
  assert.match(packet, /three consecutive fresh-process WebKit runs of only `stage24-panther-commander`/u);
  assert.match(packet, /three consecutive bounded WebKit runs of only canonical 667x375 `stage3-boss`/u);
  assert.match(packet, /Sol-authored docs\/test-only r8 packet[\s\S]*metadata-only/u);
  assert.match(packet, /Only the later automatic run whose `headSha` is Luna's one authorized correction commit counts/u);
  assert.match(packet, /restore `v100-phase-g-production` to the original unfiltered contract/u);
  assert.match(packet, /QA\/developer controls may establish reachability only/u);
  assert.match(packet, /Sol owns the human-player quality judgment/u);
  assert.match(packet, /STATUS: BLOCKED_RETURN_TO_SOL_R8/u);
  assert.match(packet, /High ambiguity: 0` and `Medium ambiguity: 0/u);

  assert.match(execution, /Change only these paths/u);
  assert.match(execution, /V100_PHASE_G_ONLY_VARIANT='stage24-panther-commander'/u);
  assert.match(execution, /ISSUE156_WEBKIT_HUD_STATE='stage3-boss'/u);
  assert.match(execution, /V099_FINAL_REMEDIATION_QA_VIEWPORTS='667x375'/u);
  assert.match(execution, /Sol's docs\/test r8 packet[\s\S]*metadata-only/u);
  assert.match(execution, /Only the later automatic run whose `headSha` is your one authorized correction commit counts/u);
  assert.match(execution, /one normal correction commit and push once/u);
  assert.match(execution, /one promotion commit changing only `\.github\/workflows\/ci\.yml`/u);
  assert.match(execution, /Do not grind through stages only to reach a state/u);
  assert.match(execution, /no retry\/rerun or extra fix/u);
  for (const source of [closure, resume]) {
    assert.match(source, /c6d3a2e8a925ca294fad82b47954d79b02a127bc/u);
    assert.match(source, /a4568cc2dbac3c6352de17170f92150865329ea2/u);
    assert.match(source, /43[^\n]*41[^\n]*2 fail/u);
    assert.match(source, /DUAL_LOCAL_SOURCE_CONTRACT \/ HUD_CI_ASSERTION_ALLOWLIST \+ PHASE_G_PROBE_SERIALIZATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  }
  assert.match(closure, /route comment `5379131527`/u);
  assert.match(closure, /DESIGN_CONTRACT_DEFECT \/ STALE_HUD_GENERIC_RETRY_ASSERTION \+ FIRST_COMMIT_ALLOWLIST_OMISSION \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(closure, /QA_PROBE_SERIALIZATION \/ REJECTED_CANDIDATE_REASON_OMITTED \/ IMPLEMENTATION_MISMATCH_WITH_LOCKED_EVIDENCE/u);
  assert.match(closure, /correctly returns `candidates: \[\]`/u);
  assert.match(closure, /tests\/ci-contract\.test\.mjs/u);
  assert.match(closure, /Preserve the enemy-runtime and deployment-runner `isRetryableTargetClosedLog` assertions/u);
  assert.match(closure, /sample\[0\][\s\S]*`insufficient-energy`/u);
  assert.match(closure, /must pass 43\/43/u);
  assert.match(closure, /STATUS: BLOCKED_RETURN_TO_SOL_R9/u);
  assert.match(closure, /High ambiguity: 0` and `Medium ambiguity: 0/u);
  assert.match(resume, /dirty paths must be exactly the five Section 23\.2 paths/u);
  assert.match(resume, /The one correction commit may contain exactly/u);
  assert.match(resume, /HUD runner does not use `isRetryableTargetClosedLog`/u);
  assert.match(resume, /Stage 24 WebKit 3\/3 and canonical 667x375 Stage 3 WebKit 3\/3/u);
  assert.match(resume, /still-unmade single normal correction commit\/push/u);
  assert.match(resume, /Sol r9 packet CI is metadata-only/u);
  for (const source of [loopBreaker, bootstrap, projectState]) {
    assert.match(source, /3a40b95eafe8df17b9de907b6644e66912e1e218/u);
    assert.match(source, /486b9cf0cc92152372ff6414b61e2df440e8087a/u);
    assert.match(source, /26[^\n]*20[^\n]*6 fail/u);
    assert.match(source, /LOCAL_ACCEPTANCE_BOOTSTRAP \/ LOCKFILE_INSTALL \+ WORKTREE_LOCAL_BROWSERS \+ DRAFT_BYTE_PRESERVATION \/ DESIGN_CHANGE_REQUIRED/u);
  }
  for (const source of [loopBreaker, bootstrap]) assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(loopBreaker, /Producer Loop-Breaker `5379794856`/u);
  assert.match(loopBreaker, /EXECUTION_ENVIRONMENT_PRECONDITION \/ ISOLATED_WORKTREE_DEPENDENCIES_ABSENT \+ HANDOFF_BOOTSTRAP_OMISSION \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(loopBreaker, /same stopped isolated worktree/u);
  assert.match(loopBreaker, /npm\.cmd ci --no-audit --no-fund/u);
  assert.match(loopBreaker, /v100-r10-local-gate-preflight\.mjs snapshot/u);
  assert.match(loopBreaker, /PLAYWRIGHT_BROWSERS_PATH = '0'/u);
  assert.match(loopBreaker, /playwright\.cmd install chromium webkit/u);
  assert.match(loopBreaker, /45144b0bf6813d6b6cc47a79861217fc8fb73c744afbc2731f13bd7f2b6716f6/u);
  assert.match(loopBreaker, /c3167d50451b0887271cf0b06280b6fb1393a497c20229ccc865331e0ee9fcd6/u);
  assert.match(loopBreaker, /V100_R10_LOCAL_GATE_PREFLIGHT_OK/u);
  assert.match(loopBreaker, /V100_R10_DRAFT_VERIFY_OK/u);
  assert.match(loopBreaker, /--test-name-pattern='\(\?!\)'/u);
  assert.match(loopBreaker, /focused source command must pass 43\/43/u);
  for (const status of ["ENVIRONMENT", "LOADABILITY", "SOURCE", "RUNTIME"]) {
    assert.match(loopBreaker, new RegExp(`BLOCKED_RETURN_TO_SOL_R10_${status}`, "u"));
  }
  assert.match(loopBreaker, /installed 512 packages/u);
  assert.match(loopBreaker, /Chromium build 1194 and WebKit build 2215/u);
  assert.match(loopBreaker, /Revision r10 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`/u);
  assert.match(bootstrap, /Preserve the stopped six-path r8\/r9 correction draft; do not reconstruct it/u);
  assert.match(bootstrap, /No individual\/global package install/u);
  assert.match(bootstrap, /four-file load exit 0/u);
  assert.match(bootstrap, /same stopped isolated worktree and existing six-path r8\/r9 draft/u);
  assert.match(preflight, /import\("playwright"\)/u);
  assert.match(preflight, /import\("sharp"\)/u);
  assert.match(preflight, /PLAYWRIGHT_BROWSERS_PATH must be exactly 0/u);
  assert.match(preflight, /node_modules\/playwright-core\/\.local-browsers/u);
  assert.match(preflight, /outputs\/v100-r10-local-gate\/draft-snapshot\.json/u);
  assert.match(preflight, /status", "--porcelain=v1", "--untracked-files=all/u);
  for (const path of [
    ".gitattributes",
    "scripts/run-v099-hud-states-bounded.mjs",
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/ci-contract.test.mjs",
    "tests/v099-hud-states-bounded.test.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
  ]) {
    assert.match(preflight, new RegExp(path.replaceAll(".", "\\."), "u"));
  }
  assert.match(preflight, /45144b0bf6813d6b6cc47a79861217fc8fb73c744afbc2731f13bd7f2b6716f6/u);
  assert.match(preflight, /c3167d50451b0887271cf0b06280b6fb1393a497c20229ccc865331e0ee9fcd6/u);
  assert.match(preflight, /V100_R10_DRAFT_SNAPSHOT_OK/u);
  assert.match(preflight, /V100_R10_LOCAL_GATE_PREFLIGHT_OK/u);
  assert.match(preflight, /V100_R10_DRAFT_VERIFY_OK/u);
  for (const source of [causalClosure, causalHandoff]) {
    assert.match(source, /3f4190eb0fa89eef59141692e338ff3a9c81b40b/u);
    assert.match(source, /8782ed45b0cc85130d0a86fc2ce3135be1f22160/u);
    assert.match(source, /QA_HARNESS_CAUSAL_HISTORY \/ MONOTONIC_SOURCE_TARGET_EDGE_CLOBBER \+ FINAL_WINDOW_PHASE_COUPLING \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /PHASE_G_CAUSAL_HISTORY \/ MONOTONIC_SOURCE_EDGE \+ NON_DESTRUCTIVE_FINAL_MERGE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  }
  assert.match(projectState, /QA_HARNESS_CAUSAL_HISTORY \/ MONOTONIC_SOURCE_TARGET_EDGE_CLOBBER \+ FINAL_WINDOW_PHASE_COUPLING \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(projectState, /PHASE_G_CAUSAL_HISTORY \/ MONOTONIC_SOURCE_EDGE \+ NON_DESTRUCTIVE_FINAL_MERGE \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(causalClosure, /route `5383696506`/u);
  assert.match(causalClosure, /Run 1 passed with source edge `13->25`/u);
  assert.match(causalClosure, /zero console error, page error, request failure, or HTTP failure/u);
  assert.match(causalClosure, /does not relabel run 2 green/u);
  assert.match(causalClosure, /waitForCombatActivity` replaces those histories with only the instantaneous snapshot arrays/u);
  assert.match(causalClosure, /sourceToTargetEdges` and `sourceAttribution`/u);
  assert.match(causalClosure, /channel` is `attackIdentity` or `pendingWeaponHits`/u);
  assert.match(causalClosure, /never replace or truncate the unique page-lifetime source-edge set/u);
  assert.match(causalClosure, /attackingActors`[\s\S]*alone as `source=true`/u);
  assert.match(causalClosure, /focused source acceptance is exactly 47\/47/u);
  assert.match(causalClosure, /fresh corrected Stage 24 3\/3/u);
  assert.match(causalClosure, /Revision r11 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`/u);
  assert.match(causalHandoff, /Do not run `npm ci`, install a browser\/package, or rerun the r10 bootstrap\/source 43/u);
  assert.match(causalHandoff, /V100_R11_RUNTIME_RETURN_PREFLIGHT_OK/u);
  assert.match(causalHandoff, /preserve the other four draft paths and all Sol-owned r11 files/u);
  assert.match(causalHandoff, /five-file load, focused 47\/47/u);
  for (const status of ["ENVIRONMENT", "SOURCE", "RUNTIME", "REMOTE"]) {
    assert.match(causalHandoff, new RegExp(`BLOCKED_RETURN_TO_SOL_R11_${status}`, "u"));
  }
  assert.match(preflight, /R10_PACKET_HEAD = "3f4190eb0fa89eef59141692e338ff3a9c81b40b"/u);
  assert.match(preflight, /merge-base", "--is-ancestor"/u);
  assert.match(preflight, /V100_R11_RUNTIME_RETURN_PREFLIGHT_OK/u);
  assert.match(preflight, /mode === "resume"/u);
  assert.match(causalTest, /V100_PHASE_G_CAUSAL_HISTORY_PROBE/u);
  assert.match(causalTest, /sourceToTargetEdges/u);
  assert.match(causalTest, /sourceAttribution/u);
  assert.match(causalTest, /does not substitute attacker, impact, reaction, or audio evidence/u);
  assert.match(projectState, /current Design Lock：`V100-SOL-DL-001 r59`/u);
  assert.match(projectState, /SOL human-player quality audit未完了/u);
  for (const source of [sourceConsistency, sourceConsistencyHandoff, projectState]) {
    assert.match(source, /SOL_PACKET_CANONICAL_STATE_CONTRACT \/ R10_REMEDIATION_CLASS_OMITTED_FROM_PROJECT_STATE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /f3db25f00c9209830d79d7f01b599bdb02834a06/u);
    assert.match(source, /ee0bcd81f3aed9bedaf642f6990acf8907865259/u);
  }
  for (const source of [sourceConsistency, sourceConsistencyHandoff]) assert.match(source, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(sourceConsistency, /reported `SOL human-player quality audit未完了` absence is not the failing contract/u);
  assert.match(sourceConsistency, /Do not delete, relax, redirect, or make the assertion optional/u);
  assert.match(sourceConsistency, /targeted Design Lock\/Project State contract must pass 1\/1/u);
  assert.match(sourceConsistency, /focused source suite must pass exactly 47\/47/u);
  assert.match(sourceConsistency, /no r12 revision is created/u);
  assert.match(sourceConsistencyHandoff, /Do not repeat the resume preflight, five-file load, or focused source suite/u);
  assert.match(projectState, /LOCAL_ACCEPTANCE_BOOTSTRAP \/ LOCKFILE_INSTALL \+ WORKTREE_LOCAL_BROWSERS \+ DRAFT_BYTE_PRESERVATION \/ DESIGN_CHANGE_REQUIRED/u);
});

test("r12-r59 lock SOL actionability, WebKit lifecycle, asset ownership, causal continuity, and one final Producer checkpoint", async () => {
  const [design, handoff, projectState, boundedDeploymentRunner] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(PROJECT_STATE, "utf8"),
    readFile(BOUNDED_DEPLOYMENT_RUNNER, "utf8"),
  ]);
  const r12 = design.match(/## 28\. Revision r12([\s\S]+?)(?=## 29\. Revision r13)/u)?.[1] ?? "";
  const r13 = design.match(/## 29\. Revision r13([\s\S]+?)(?=## 30\. Revision r14)/u)?.[1] ?? "";
  const r14 = design.match(/## 30\. Revision r14([\s\S]+?)(?=## 31\. Revision r15)/u)?.[1] ?? "";
  const r15 = design.match(/## 31\. Revision r15([\s\S]+?)(?=## 32\. Revision r16)/u)?.[1] ?? "";
  const r16 = design.match(/## 32\. Revision r16([\s\S]+?)(?=## 33\. Revision r17)/u)?.[1] ?? "";
  const r17 = design.match(/## 33\. Revision r17([\s\S]+?)(?=## 34\. Revision r18)/u)?.[1] ?? "";
  const r18 = design.match(/## 34\. Revision r18([\s\S]+?)(?=## 35\. Revision r19)/u)?.[1] ?? "";
  const r19 = design.match(/## 35\. Revision r19([\s\S]+?)(?=## 36\. Revision r20)/u)?.[1] ?? "";
  const r20 = design.match(/## 36\. Revision r20([\s\S]+?)(?=## 37\. Revision r21)/u)?.[1] ?? "";
  const r21 = design.match(/## 37\. Revision r21([\s\S]+?)(?=## 38\. Revision r22)/u)?.[1] ?? "";
  const r22 = design.match(/## 38\. Revision r22([\s\S]+?)(?=## 39\. Revision r23)/u)?.[1] ?? "";
  const r23 = design.match(/## 39\. Revision r23([\s\S]+?)(?=## 40\. Revision r24)/u)?.[1] ?? "";
  const r24 = design.match(/## 40\. Revision r24([\s\S]+?)(?=## 41\. Revision r25)/u)?.[1] ?? "";
  const r25 = design.match(/## 41\. Revision r25([\s\S]+?)(?=## 42\. Revision r26)/u)?.[1] ?? "";
  const r26 = design.match(/## 42\. Revision r26([\s\S]+?)(?=## 43\. Revision r27)/u)?.[1] ?? "";
  const r27 = design.match(/## 43\. Revision r27([\s\S]+?)(?=## 44\. Revision r28)/u)?.[1] ?? "";
  const r28 = design.match(/## 44\. Revision r28([\s\S]+?)(?=## 45\. Revision r29)/u)?.[1] ?? "";
  const r29 = design.match(/## 45\. Revision r29([\s\S]+?)(?=## 46\. Revision r30)/u)?.[1] ?? "";
  const r30 = design.match(/## 46\. Revision r30([\s\S]+?)(?=## 47\. Revision r31)/u)?.[1] ?? "";
  const r31 = design.match(/## 47\. Revision r31([\s\S]+?)(?=## 48\. Revision r32)/u)?.[1] ?? "";
  const r32 = design.match(/## 48\. Revision r32([\s\S]+?)(?=## 49\. Revision r33)/u)?.[1] ?? "";
  const r33 = design.match(/## 49\. Revision r33([\s\S]+?)(?=## 50\. Revision r34)/u)?.[1] ?? "";
  const r34 = design.match(/## 50\. Revision r34([\s\S]+?)(?=## 51\. Revision r35)/u)?.[1] ?? "";
  const r35 = design.match(/## 51\. Revision r35([\s\S]+?)(?=## 52\. Revision r36)/u)?.[1] ?? "";
  const r36 = design.match(/## 52\. Revision r36([\s\S]+?)(?=## 53\. Revision r37)/u)?.[1] ?? "";
  const r37 = design.match(/## 53\. Revision r37([\s\S]+?)(?=## 54\. Revision r38)/u)?.[1] ?? "";
  const r38 = design.match(/## 54\. Revision r38([\s\S]+?)(?=## 55\. Revision r39)/u)?.[1] ?? "";
  const r39 = design.match(/## 55\. Revision r39([\s\S]+?)(?=## 56\. Revision r40)/u)?.[1] ?? "";
  const r40 = design.match(/## 56\. Revision r40([\s\S]+?)(?=## 57\. Revision r41)/u)?.[1] ?? "";
  const r41 = design.match(/## 57\. Revision r41([\s\S]+?)(?=## 58\. Revision r42)/u)?.[1] ?? "";
  const r42 = design.match(/## 58\. Revision r42([\s\S]+?)(?=## 59\. Revision r43)/u)?.[1] ?? "";
  const r43 = design.match(/## 59\. Revision r43([\s\S]+?)(?=## 60\. Revision r44)/u)?.[1] ?? "";
  const r44 = design.match(/## 60\. Revision r44([\s\S]+?)(?=## 61\. Revision r45)/u)?.[1] ?? "";
  const r45 = design.match(/## 61\. Revision r45([\s\S]+?)(?=## 62\. Revision r46)/u)?.[1] ?? "";
  const r46 = design.match(/## 62\. Revision r46([\s\S]+?)(?=## 63\. Revision r47)/u)?.[1] ?? "";
  const r47 = design.match(/## 63\. Revision r47([\s\S]+?)(?=## 64\. Revision r48)/u)?.[1] ?? "";
  const r48 = design.match(/## 64\. Revision r48([\s\S]+?)(?=## 65\. Revision r49)/u)?.[1] ?? "";
  const r49 = design.match(/## 65\. Revision r49([\s\S]+?)(?=## 66\. Revision r50)/u)?.[1] ?? "";
  const r50 = design.match(/## 66\. Revision r50([\s\S]+?)(?=## 67\. Revision r51)/u)?.[1] ?? "";
  const r51 = design.match(/## 67\. Revision r51([\s\S]+?)(?=## 68\. Revision r52)/u)?.[1] ?? "";
  const r52 = design.match(/## 68\. Revision r52([\s\S]+?)(?=## 69\. Revision r53)/u)?.[1] ?? "";
  const r53 = design.match(/## 69\. Revision r53([\s\S]+?)(?=## 70\. Revision r54)/u)?.[1] ?? "";
  const r54 = design.match(/## 70\. Revision r54([\s\S]+?)(?=## 71\. Revision r55)/u)?.[1] ?? "";
  const r55 = design.match(/## 71\. Revision r55([\s\S]+?)(?=## 72\. Revision r56)/u)?.[1] ?? "";
  const r56 = design.match(/## 72\. Revision r56([\s\S]+?)(?=## 73\. Revision r57)/u)?.[1] ?? "";
  const r57 = design.match(/## 73\. Revision r57([\s\S]+?)(?=## 74\. Revision r58)/u)?.[1] ?? "";
  const r58 = design.match(/## 74\. Revision r58([\s\S]+?)(?=## 75\. Revision r59)/u)?.[1] ?? "";
  const r59 = design.match(/## 75\. Revision r59([\s\S]*)$/u)?.[1] ?? "";
  const historicalHandoff = handoff.match(/## 22\. Revision r13([\s\S]+?)(?=## 23\. Revision r14)/u)?.[1] ?? "";
  const r14Handoff = handoff.match(/## 23\. Revision r14([\s\S]+?)(?=## 24\. Revision r15)/u)?.[1] ?? "";
  const r15Handoff = handoff.match(/## 24\. Revision r15([\s\S]+?)(?=## 25\. Revision r16)/u)?.[1] ?? "";
  const r16Handoff = handoff.match(/## 25\. Revision r16([\s\S]+?)(?=## 26\. Revision r17)/u)?.[1] ?? "";
  const r17Handoff = handoff.match(/## 26\. Revision r17([\s\S]+?)(?=## 27\. Revision r18)/u)?.[1] ?? "";
  const r18Handoff = handoff.match(/## 27\. Revision r18([\s\S]+?)(?=## 28\. Revision r19)/u)?.[1] ?? "";
  const r19Handoff = handoff.match(/## 28\. Revision r19([\s\S]+?)(?=## 29\. Revision r20)/u)?.[1] ?? "";
  const r20Handoff = handoff.match(/## 29\. Revision r20([\s\S]+?)(?=## 30\. Revision r21)/u)?.[1] ?? "";
  const r21Handoff = handoff.match(/## 30\. Revision r21([\s\S]+?)(?=## 31\. Revision r22)/u)?.[1] ?? "";
  const r22Handoff = handoff.match(/## 31\. Revision r22([\s\S]+?)(?=## 32\. Revision r23)/u)?.[1] ?? "";
  const r23Handoff = handoff.match(/## 32\. Revision r23([\s\S]+?)(?=## 33\. Revision r24)/u)?.[1] ?? "";
  const r24Handoff = handoff.match(/## 33\. Revision r24([\s\S]+?)(?=## 34\. Revision r25)/u)?.[1] ?? "";
  const r25Handoff = handoff.match(/## 34\. Revision r25([\s\S]+?)(?=## 35\. Revision r26)/u)?.[1] ?? "";
  const r26Handoff = handoff.match(/## 35\. Revision r26([\s\S]+?)(?=## 36\. Revision r27)/u)?.[1] ?? "";
  const r27Handoff = handoff.match(/## 36\. Revision r27([\s\S]+?)(?=## 37\. Revision r28)/u)?.[1] ?? "";
  const r28Handoff = handoff.match(/## 37\. Revision r28([\s\S]+?)(?=## 38\. Revision r29)/u)?.[1] ?? "";
  const r29Handoff = handoff.match(/## 38\. Revision r29([\s\S]+?)(?=## 39\. Revision r30)/u)?.[1] ?? "";
  const r30Handoff = handoff.match(/## 39\. Revision r30([\s\S]+?)(?=## 40\. Revision r31)/u)?.[1] ?? "";
  const r31Handoff = handoff.match(/## 40\. Revision r31([\s\S]+?)(?=## 41\. Revision r32)/u)?.[1] ?? "";
  const r32Handoff = handoff.match(/## 41\. Revision r32([\s\S]+?)(?=## 42\. Revision r33)/u)?.[1] ?? "";
  const r33Handoff = handoff.match(/## 42\. Revision r33([\s\S]+?)(?=## 43\. Revision r34)/u)?.[1] ?? "";
  const r34Handoff = handoff.match(/## 43\. Revision r34([\s\S]+?)(?=## 44\. Revision r35)/u)?.[1] ?? "";
  const r35Handoff = handoff.match(/## 44\. Revision r35([\s\S]+?)(?=## 45\. Revision r36)/u)?.[1] ?? "";
  const r36Handoff = handoff.match(/## 45\. Revision r36([\s\S]+?)(?=## 46\. Revision r37)/u)?.[1] ?? "";
  const r37Handoff = handoff.match(/## 46\. Revision r37([\s\S]+?)(?=## 47\. Revision r38)/u)?.[1] ?? "";
  const r38Handoff = handoff.match(/## 47\. Revision r38([\s\S]+?)(?=## 48\. Revision r39)/u)?.[1] ?? "";
  const r39Handoff = handoff.match(/## 48\. Revision r39([\s\S]+?)(?=## 49\. Revision r40)/u)?.[1] ?? "";
  const r40Handoff = handoff.match(/## 49\. Revision r40([\s\S]+?)(?=## 50\. Revision r41)/u)?.[1] ?? "";
  const r41Handoff = handoff.match(/## 50\. Revision r41([\s\S]+?)(?=## 51\. Revision r42)/u)?.[1] ?? "";
  const r42Handoff = handoff.match(/## 51\. Revision r42([\s\S]+?)(?=## 52\. Revision r43)/u)?.[1] ?? "";
  const r43Handoff = handoff.match(/## 52\. Revision r43([\s\S]+?)(?=## 53\. Revision r44)/u)?.[1] ?? "";
  const r44Handoff = handoff.match(/## 53\. Revision r44([\s\S]+?)(?=## 54\. Revision r45)/u)?.[1] ?? "";
  const r45Handoff = handoff.match(/## 54\. Revision r45([\s\S]+?)(?=## 55\. Revision r46)/u)?.[1] ?? "";
  const r46Handoff = handoff.match(/## 55\. Revision r46([\s\S]+?)(?=## 56\. Revision r47)/u)?.[1] ?? "";
  const r47Handoff = handoff.match(/## 56\. Revision r47([\s\S]+?)(?=## 57\. Revision r48)/u)?.[1] ?? "";
  const r48Handoff = handoff.match(/## 57\. Revision r48([\s\S]+?)(?=## 58\. Revision r49)/u)?.[1] ?? "";
  const r49Handoff = handoff.match(/## 58\. Revision r49([\s\S]+?)(?=## 59\. Revision r50)/u)?.[1] ?? "";
  const r50Handoff = handoff.match(/## 59\. Revision r50([\s\S]+?)(?=## 60\. Revision r51)/u)?.[1] ?? "";
  const r51Handoff = handoff.match(/## 60\. Revision r51([\s\S]+?)(?=## 61\. Revision r52)/u)?.[1] ?? "";
  const r52Handoff = handoff.match(/## 61\. Revision r52([\s\S]+?)(?=## 62\. Revision r53)/u)?.[1] ?? "";
  const r53Handoff = handoff.match(/## 62\. Revision r53([\s\S]+?)(?=## 63\. Revision r54)/u)?.[1] ?? "";
  const r54Handoff = handoff.match(/## 63\. Revision r54([\s\S]+?)(?=## 64\. Revision r55)/u)?.[1] ?? "";
  const r55Handoff = handoff.match(/## 64\. Revision r55([\s\S]+?)(?=## 65\. Revision r56)/u)?.[1] ?? "";
  const r56Handoff = handoff.match(/## 65\. Revision r56([\s\S]+?)(?=## 66\. Revision r57)/u)?.[1] ?? "";
  const r57Handoff = handoff.match(/## 66\. Revision r57([\s\S]+?)(?=## 67\. Revision r58)/u)?.[1] ?? "";
  const r58Handoff = handoff.match(/## 67\. Revision r58([\s\S]+?)(?=## 68\. Revision r59)/u)?.[1] ?? "";
  const activeHandoff = handoff.match(/## 68\. Revision r59([\s\S]*)$/u)?.[1] ?? "";
  const currentProcess = projectState.match(/## 4\. 実行体制 — V1 SOL single-owner override([\s\S]+?)## 5\./u)?.[1] ?? "";
  const currentCursor = projectState.match(/## 6\. Version 1\.0\.0 execution cursor — r59 Section 75([\s\S]+?)### Post-V1/u)?.[1] ?? "";

  for (const source of [r12, projectState]) {
    assert.match(source, /0495e95e3bc59fcf546ffa02ee83704a1f63e366/u);
    assert.match(source, /30071d5a9f4fd92e93f54ddea2e9713382247f74/u);
    assert.match(source, /32636742294/u);
    assert.match(source, /97189630445/u);
    assert.match(source, /9492754238/u);
    assert.match(source, /PHASE_G_REAL_POINTER_ACTIONABILITY \/ EXPLICIT_HIT_TEST \+ STABLE_RECT \+ ONE_INPUT \+ TRUE_FAILURE_CURSOR \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r12, /QA_HARNESS_ACTIONABILITY_GATE_POLICY_FAILURE \/ PRE_POINTER_LOCATOR_STABILITY_TIMEOUT \+ FAILURE_CURSOR_FINALIZATION_LOSS \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(projectState, /QA_HARNESS_ACTIONABILITY_GATE_POLICY_FAILURE \/ PRE_POINTER_LOCATOR_STABILITY_TIMEOUT \+ FAILURE_CURSOR_FINALIZATION_LOSS \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(r12, /performVerifiedDeploymentPointer/u);
  assert.match(r12, /withPhaseGPageInputLock/u);
  assert.match(r12, /concurrent main-flow manual\/vehicle proof actions/u);
  assert.match(r12, /final `before` snapshot and `waitForDeploymentAcceptance`/u);
  assert.match(r12, /exact DOM node plus `data-kind` plus `data-slot-index`/u);
  assert.match(r12, /event\.target\.closest\('button\.unit-card'\)/u);
  assert.match(r12, /diagnostics DOM-order eligible candidate `\[0\]`/u);
  assert.match(r12, /candidate-invalidated-before-pointer/u);
  assert.match(r12, /coordinate-invalidated-before-pointer/u);
  assert.match(r12, /candidate-invalidated-during-pointer/u);
  assert.match(r12, /coordinate-invalidated-during-pointer/u);
  assert.match(r12, /no second pointer/u);
  assert.match(r12, /document\.elementFromPoint/u);
  assert.match(r12, /two consecutive distinct `requestAnimationFrame` samples/u);
  assert.match(r12, /terminal immediate recheck[\s\S]*same 0\.75 CSS-pixel tolerance/u);
  assert.match(r12, /DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000/u);
  assert.match(r12, /DEPLOYMENT_POINTER_FRAME_SAMPLE_TIMEOUT_MS = 1_000/u);
  assert.match(r12, /DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS = 2_000/u);
  assert.match(r12, /absolute delta <= 0\.75 CSS px/u);
  assert.match(r12, /minimum 28x24 CSS-pixel hit surface/u);
  assert.match(r12, /targetLeft = clamp\(rail\.scrollLeft \+ cardCenterX - railCenterX, 0, rail\.scrollWidth - rail\.clientWidth\)/u);
  assert.match(r12, /rail\.scrollTo\(\{ left: targetLeft, behavior: "instant" \}\)/u);
  assert.match(r12, /scrollIntoViewIfNeeded/u);
  assert.match(r12, /page\.mouse\.click/u);
  assert.match(r12, /document remains live[\s\S]*remove it in `finally`/u);
  assert.match(r12, /await page\/context close before returning/u);
  assert.match(r12, /expected cancellation close remains `BROWSER_POINTER_DISPATCH_TIMEOUT`/u);
  assert.match(r12, /pointerdown -> pointerup -> click/u);
  assert.match(r12, /only after steps 1-3 are green, evaluate\/wait the unchanged production acceptance/u);
  assert.match(r12, /successful ready-to-cooldown\/queue\/energy\/card\/fighter transition is acceptance/u);
  assert.match(r12, /receipt-time pre-handler identity\/eligibility\/owner/u);
  assert.match(r12, /Success requires the logical AND of the exact ordered trusted same-card receipt,[\s\S]*production acceptance/u);
  assert.match(r12, /missing, partial, untrusted, mixed-owner, or out-of-order exact sequence is `BROWSER_POINTER_RECEIPT_MISSING`/u);
  assert.match(r12, /correlated trusted sequence whose normalized owner differs[\s\S]*`PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE`/u);
  assert.match(r12, /Neither branch may become success even if production state changes/u);
  assert.match(r12, /hard `QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE` return to `SOL_DESIGN`/u);
  assert.match(r12, /BROWSER_POINTER_DISPATCH_TIMEOUT/u);
  assert.match(r12, /BROWSER_POINTER_API_ERROR/u);
  assert.match(r12, /BROWSER_POINTER_RECEIPT_MISSING/u);
  assert.match(r12, /PRODUCT_DEPLOYMENT_ACCEPTANCE_MISSING/u);
  assert.match(r12, /PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE/u);
  assert.match(r12, /deploymentPointerPreconditionDecision/u);
  assert.match(r12, /deploymentPointerOutcome/u);
  assert.match(r12, /awaitingAtFailure/u);
  assert.match(r12, /lastCompletedBeforeFailure/u);
  assert.match(r12, /unresolvedBeforeFailure/u);
  assert.match(r12, /failure\.preFinalizationCheckpointSnapshot/u);
  assert.match(r12, /freezeCheckpointFailureCursor/u);
  assert.match(r12, /V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE/u);
  assert.match(r12, /V100_PHASE_G_DEPLOYMENT_POINTER_PROBE/u);
  assert.match(r12, /published five-file focused suite 48\/48/u);
  assert.match(r12, /require exactly 54\/54/u);
  assert.match(r12, /exactly five r12 pointer contracts and one failure-cursor contract/u);
  assert.match(r12, /Scope negative source assertions to the deployment helper plus its six invocation regions/u);
  assert.match(r12, /Existing non-deployment QA reads[\s\S]*non-WebKit capture retry elsewhere[\s\S]*not globally forbidden tokens/u);
  assert.match(r12, /capture variant `stage06-spitter-seal`, actual stage ID `stage-nishijin-station-tunnel-seal`/u);
  assert.match(r12, /workflow-only restoration commit/u);
  assert.match(r12, /sole workflow exception and cannot be folded into the first candidate/u);
  assert.match(r12, /locally committed restored-workflow HEAD/u);
  assert.match(r12, /one `npm run qa:v100-phase-g`/u);
  assert.match(r12, /v100-phase-g-production-evidence/u);
  assert.match(r12, /ACTIVE_PRODUCER_CHECKPOINT_COUNT: 1/u);
  assert.match(r12, /SOL_FINAL_REVIEW \(read-only\/adversarial\)/u);
  assert.match(r12, /staged, unstaged, and untracked state all empty/u);
  assert.match(r12, /`High: 0`, `Medium: 0`, `PB: 0`/u);
  assert.match(r12, /`RELEASE_READY: YES`/u);
  assert.match(r12, /FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT/u);
  assert.match(r12, /PR #169 -> #170 -> #171/u);
  assert.match(r12, /annotated `v1\.0\.0` tag/u);
  assert.match(r12, /High ambiguity: 0` and `Medium ambiguity: 0/u);
  for (const path of [
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v100-design-lock.test.mjs",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "docs/PROJECT_STATE.md",
  ]) assert.match(r12, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(handoff.slice(0, 700), /Active handoff: `NONE`/u);
  assert.match(activeHandoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.doesNotMatch(activeHandoff, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(activeHandoff, /ROLE_LOCK`: `SOL_(?:DESIGN|REMEDIATION)/u);
  assert.doesNotMatch(activeHandoff, /then `SOL_REMEDIATION`/u);
  assert.match(r14Handoff, /Issue-locked r14 publication/u);
  assert.match(historicalHandoff, /actual stage ID `stage-mugarian-executive-lab`/u);
  assert.match(historicalHandoff, /targetOwnershipHistory/u);
  assert.match(historicalHandoff, /maximum 96/u);
  assert.match(historicalHandoff, /proofActorHumanTargetFromHistory/u);
  assert.match(historicalHandoff, /Generic source-target edges[\s\S]*never substitutes/u);
  assert.match(historicalHandoff, /Stage 25 fresh 3\/3/u);
  assert.match(historicalHandoff, /ordered trio fresh 3\/3/u);
  assert.match(r13, /QA_HARNESS_TARGET_OWNERSHIP_HISTORY \/ LIVE_ONLY_CONTACT_CHECKPOINT \+ ATTACK_HISTORY_WITHOUT_SIDE_KIND_TARGET_ATTRIBUTION \/ DESIGN_CHANGE_REQUIRED/u);
  for (const source of [r13, historicalHandoff, projectState]) {
    assert.match(source, /PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP \/ MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY \+ NO_GENERIC_SUBSTITUTION \/ DESIGN_CHANGE_REQUIRED/u);
  }
  for (const source of [r13, historicalHandoff]) {
    assert.match(source, /r12-trio-fresh-2-d5986723-b/u);
    assert.match(source, /living-human-target-acquired-or-not-required/u);
  }
  assert.match(r13, /targetOwnershipHistory/u);
  assert.match(r13, /Once 96 unique observations exist/u);
  assert.match(r13, /proofActorHumanTargetFromHistory/u);
  assert.match(r13, /source side is `zombie`[\s\S]*target side is `human`[\s\S]*targetAlive === true/u);
  assert.match(r13, /exact field names `channel`, `battleTime`, `sourceId`, `sourceSide`, `sourceKind`, `targetId`, `targetSide`, `targetKind`, `targetHp`, and `targetAlive`/u);
  assert.match(r13, /Once 96 unique observations exist, ignore later new unique observations; never evict, replace, clear, or reorder/u);
  assert.match(r13, /scans accepted observations in first-observed order/u);
  assert.match(r13, /final proof-actor attack predicate succeeds[\s\S]*call `readProofActorContactState` exactly once with no added wait, retry, deployment, or attack attempt/u);
  assert.match(r13, /A passing attack against a support object is not human-target proof/u);
  assert.match(r13, /V100_PHASE_G_CAUSAL_HISTORY_PROBE/u);
  assert.match(r13, /five-file focused total exactly 54\/54/u);
  assert.match(r13, /checkpoint test remains exactly 12 tests/u);
  assert.match(r13, /fresh Stage 25 WebKit 932x430 processes/u);
  assert.match(r13, /Neither r12 ordered sequence counts for r13 acceptance/u);
  assert.match(r13, /QA_HARNESS_TARGET_HISTORY_CONSUMER_DIVERGENCE/u);
  assert.match(r13, /PROOF_ACTOR_HUMAN_TARGET_NOT_ESTABLISHED/u);
  assert.match(r13, /QA_HARNESS_TARGET_IDENTITY_OBSERVATION_GAP/u);
  assert.match(r13, /LOOP_ITERATION`: `2`/u);
  assert.match(r13, /SAME_GATE_REPEAT_COUNT`: `1` for the current Stage 25/u);
  for (const source of [r12, r13, historicalHandoff]) {
    assert.match(source, /workflow-restoration promotion HEAD|workflow-only iteration-3 HEAD/u);
    assert.match(source, /remain `2`|remain iteration 2|iteration 3|`2`を維持/u);
  }

  for (const source of [r14, r14Handoff]) {
    assert.match(source, /ab91621561926bbd4af90bb0d1ca8551699797d7/u);
    assert.match(source, /dc8dcc085bcc4e21429201d64e36e4290a14d027/u);
    assert.match(source, /32656697160/u);
    assert.match(source, /97238965438/u);
    assert.match(source, /9497903328/u);
    assert.match(source, /QA_HARNESS_RENDER_OPPORTUNITY_COUPLING \/ RAF_ONLY_PRE-DOM_SAMPLE_TIMEOUT \+ UNCANCELLED_EVALUATE \+ PREFLIGHT_EVIDENCE_LOSS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /PHASE_G_SCHEDULER_INDEPENDENT_ACTIONABILITY \/ HOST_TURN_SEPARATED_SYNC_SNAPSHOTS \+ NONBLOCKING_RAF_TELEMETRY \+ PREINPUT_CANCELLATION_AND_EVIDENCE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /SAME_GATE_REPEAT_COUNT`: `2`/u);
  }
  assert.match(r14, /DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000/u);
  assert.match(r14, /DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS = 1_000/u);
  assert.match(r14, /DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS = 40/u);
  assert.match(r14, /no existing deadline increases/u);
  assert.match(r14, /synchronous page evaluation/u);
  assert.match(r14, /Remove its `awaitAnimationFrame` parameter/u);
  assert.match(r14, /QA-only rAF telemetry probe/u);
  assert.match(r14, /never await it/u);
  assert.match(r14, /Pending rAF alone never authorizes or rejects a pointer/u);
  assert.match(r14, /wait exactly one host-owned 40 ms sampling turn/u);
  assert.match(r14, /two consecutive samples with strictly increasing ordinal/u);
  assert.match(r14, /40 ms host separation minus a 1 ms scheduling tolerance/u);
  assert.match(r14, /at least 16 ms positive page wall-clock and performance-clock advance/u);
  assert.match(r14, /rAF may be pending in a valid pair/u);
  assert.match(r14, /terminal recheck remains required[\s\S]*synchronous/u);
  assert.match(r14, /Close and await disposal of the current capture context\/page/u);
  assert.match(r14, /record exactly one deployment attempt before rethrowing/u);
  assert.match(r14, /initial diagnostics, centered result, scheduler-probe installation\/readback\/cleanup, every host turn, every synchronous sample, terminal recheck, timeout cancellation/u);
  assert.match(r14, /rAF pending plus two valid task-turn samples is positive/u);
  assert.match(r14, /same-turn\/repeated-ordinal\/non-advancing clocks remain pointer-zero divergence/u);
  assert.match(r14, /Add no test block[\s\S]*exactly 12 tests[\s\S]*exactly 54\/54/u);
  assert.match(r14, /Preserve r13 `targetOwnershipHistory`/u);
  assert.match(r14, /three separate fresh Stage 6 WebKit 667x375 processes/u);
  assert.match(r14, /three separate fresh ordered Stage 6 -> Stage 24 -> Stage 25 WebKit processes/u);
  assert.match(r14, /atomic six-path r14 candidate[\s\S]*`LOOP_ITERATION: 3`/u);
  assert.match(r14, /workflow-only restoration commit as iteration 4/u);
  assert.match(r14, /A repeat at Stage 6 increments `SAME_GATE_REPEAT_COUNT` to 3/u);
  assert.match(r14Handoff, /synchronous scheduler-independent deployment snapshots separated by host turns/u);
  assert.match(r14Handoff, /focused 54\/54, checkpoint 12\/12, Stage 6 3\/3, ordered trio 3\/3/u);
  assert.match(r14Handoff, /one atomic iteration-3 candidate/u);
  assert.match(r14Handoff, /workflow-only iteration-4 restoration/u);

  for (const source of [r15, r15Handoff, projectState]) {
    assert.match(source, /7793433921f82c483a5b2f4a3887e56f6182c3f0/u);
    assert.match(source, /9a2ce2ca3028337a83667adf164c870e9ab157f6/u);
    assert.match(source, /32661183323/u);
    assert.match(source, /97250055296/u);
    assert.match(source, /9499106555/u);
    assert.match(source, /QA_HARNESS_OBSERVABILITY_RESOURCE_PRESSURE \/ 40MS_FULL_BATTLE_QA_DEEP_SNAPSHOT \+ LONG_LIVED_STAGE24_WEBKIT_RENDERER_CRASH \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /PHASE_G_LEAN_COMBAT_OBSERVABILITY \/ LOCALHOST_ONLY_BOUNDED_SNAPSHOT_SCHEMA \+ NO_FULL_SNAPSHOT_FALLBACK \+ PROFILED_LONG_ROUTE_ACCEPTANCE \/ DESIGN_CHANGE_REQUIRED/u);
  }
  assert.match(r15, /getPhaseGCombatSnapshot/u);
  assert.match(r15, /existing localhost-only `__ASHFALL_BATTLE_QA__` bridge/u);
  assert.match(r15, /must not serialize survival\/save\/equipment inventories/u);
  assert.match(r15, /no fallback to full `getSnapshot`/u);
  assert.match(r15, /observer interval exactly 40 ms/u);
  assert.match(r15, /phaseGCombatSnapshotProfile/u);
  assert.match(r15, /[Pp]reserve the last non-null readable checkpoint state/u);
  assert.match(r15, /Do not stop early after commander attack/u);
  assert.match(r15, /reset the browser between ordered positions/u);
  assert.match(r15, /checkpoint file remains exactly 12 tests[\s\S]*focused suite remains exactly 54\/54/u);
  for (const path of [
    "app/AshfallGame.tsx",
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v100-design-lock.test.mjs",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "docs/PROJECT_STATE.md",
  ]) assert.match(r15, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r15, /three fresh Stage 6 WebKit 667x375 processes and three fresh Stage 24 WebKit 736x414 processes/u);
  assert.match(r15, /three fresh ordered Stage 6 -> Stage 24 -> Stage 25 WebKit processes/u);
  assert.match(r15, /atomic seven-path iteration-4 candidate/u);
  assert.match(r15, /workflow-only unfiltered restoration as iteration 5/u);
  assert.match(r15Handoff, /localhost-only bounded combat snapshot/u);
  assert.match(r15Handoff, /Stage 6 3\/3, Stage 24 3\/3, ordered trio 3\/3/u);

  for (const source of [r16, r16Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_SOURCE_CONTRACT_EOL_MISMATCH \/ LF_ONLY_REGEX_AGAINST_CRLF_APP_SOURCE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /SOURCE_TEST_EOL_PORTABILITY \/ CRLF_OR_LF_METHOD_BOUNDARY_WITHOUT_SOURCE_NORMALIZATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /53\/54/u);
    assert.match(source, /7793433921f82c483a5b2f4a3887e56f6182c3f0/u);
    assert.match(source, /9a2ce2ca3028337a83667adf164c870e9ab157f6/u);
  }
  assert.match(r16, /literal LF at both method boundaries/u);
  assert.match(r16, /both exact method-boundary newlines use `\\r\?\\n`/u);
  assert.match(r16, /existing r15 `app\/AshfallGame\.tsx` and `scripts\/v100-phase-g-production-matrix\.mjs` remediation bytes are immutable/u);
  assert.match(r16, /checkpoint file remains exactly 12 tests[\s\S]*focused suite remains exactly 54 tests/u);
  assert.match(r16, /pre-r16 Stage 6\/24\/ordered capture as diagnosis\/comparison only/u);
  assert.match(r16Handoff, /keep the r15 app\/runner draft unchanged/u);
  assert.match(r16Handoff, /fresh Stage 6 3\/3, Stage 24 3\/3, and ordered trio 3\/3/u);
  assert.match(activeHandoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(currentCursor, /SAME_GATE_REPEAT_COUNT`: `10`/u);
  assert.match(currentCursor, /DEFERRED_STAGE24_REPEAT_COUNT`: `4`/u);

  for (const source of [r17, r17Handoff, projectState]) {
    assert.match(source, /d11464927efd1d21e573d969a767057bdd5c8b04/u);
    assert.match(source, /2ce952c6fe70c347e866e7201824ac623bbbe993/u);
    assert.match(source, /32667714653/u);
    assert.match(source, /97266100902/u);
    assert.match(source, /9500819430/u);
    assert.match(source, /97267069513/u);
    assert.match(source, /9500961088/u);
    assert.match(source, /QA_HARNESS_OBSERVATION_REENTRANCY \/ VALID_LEAN_PROFILE \+ RAF_RATE_DUPLICATE_SNAPSHOT \+ NONCHECKPOINT_PIXEL_AUDIT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_QA_SINGLE_PRODUCER_OBSERVABILITY \/ 40MS_OBSERVER_CACHE_CONSUMERS \+ CHECKPOINT_ONLY_PIXEL_AUDIT \+ HOST_TURN_FIRST_FRAME_FREEZE \+ NO_RETRY \/ DESIGN_CHANGE_REQUIRED/u);
  }
  assert.match(r17, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/u);
  assert.match(r17, /sole continuous bridge producer/u);
  assert.match(r17, /explicit numeric `polling: 100`/u);
  assert.match(r17, /consumerMode: "single-producer-cache"/u);
  assert.match(r17, /event-time receipt snapshot are the only allowed direct reader sites/u);
  assert.match(r17, /must not call `auditFighterUnitLayer`/u);
  assert.match(r17, /Node-host 100 ms turn loop/u);
  assert.match(r17, /exactly 48 checkpoint PNGs and eight contact sheets/u);
  assert.match(r17, /each of the eight canonical kinds exactly once/u);
  assert.match(r17, /Remove the retry-classifier import/u);
  assert.match(r17, /existing five-file focused suite 54\/54 plus deployment\/runtime contract suites 6\/6, total 60\/60/u);
  assert.match(r17, /three separate fresh Stage 6 WebKit 667x375 processes/u);
  assert.match(r17, /three separate fresh Stage 24 WebKit 736x414 processes/u);
  assert.match(r17, /three separate fresh ordered Stage 6 -> Stage 24 -> Stage 25 WebKit processes/u);
  assert.match(r17, /atomic ten-path iteration-5 candidate/u);
  assert.match(r17, /workflow-only iteration-6 restoration/u);
  assert.match(r17, /Preserve the existing r16 product `app\/AshfallGame\.tsx` byte-for-byte/u);
  for (const path of [
    "scripts/v100-phase-g-production-matrix.mjs",
    "scripts/v099-final-remediation-browser-smoke.mjs",
    "scripts/run-v099-deployment-units-bounded.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v099-deployment-units-bounded.test.mjs",
    "tests/v0995-runtime-evidence-contract.test.mjs",
    "tests/v100-design-lock.test.mjs",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "docs/PROJECT_STATE.md",
  ]) assert.match(r17, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

  for (const source of [r18, r18Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_SOURCE_CONTRACT_TOPOLOGY_OMISSION \/ NO_RETRY_DEPLOYMENT_POLICY_CONFLICT_WITH_EXISTING_CI_SOURCE_ASSERTION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /CI_CONTRACT_NO_RETRY_ALIGNMENT \/ EXACT_SINGLE_ATTEMPT_POSITIVE_NEGATIVE_ASSERTIONS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /59\/60/u);
    assert.match(source, /tests\/ci-contract\.test\.mjs/u);
  }
  assert.match(r18, /Preserve the current ten r17 draft paths byte-for-byte/u);
  assert.match(r18, /material r18 candidate is exactly eleven paths/u);
  assert.match(r18, /positive exact `const attempt = 1` assertion/u);
  assert.match(r18, /forbidding `attempt <= 2`, `isRetryableTargetClosedLog`/u);
  assert.match(r18, /targeted 1\/1; then seven-file load-only 7\/7 and exact focused 60\/60/u);
  assert.match(r18, /material candidate remains 5; workflow-only restoration remains 6/u);
  assert.match(r18Handoff, /edit only the existing deployment-runner assertion region/u);
  assert.match(currentCursor, /SAME_GATE_REPEAT_COUNT`: `10`/u);

  for (const source of [r19, r19Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_BYTE_CONTRACT_MISDECLARATION \/ PREEXISTING_CI_CONTRACT_UTF8_BOM_DECLARED_NO_BOM \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /SOURCE_BYTE_CONTRACT_CORRECTION \/ PRESERVE_EXISTING_UTF8_BOM_AND_LF_WITH_ZERO_SEMANTIC_CHANGE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /(?:pre-)?existing UTF-8 BOM|existing BOM|既存UTF-8 BOM/u);
    assert.match(source, /eleven-path|eleven paths/u);
  }
  assert.match(r19, /exact `d1146492` HEAD blob is 15,154 bytes/u);
  assert.match(r19, /starts `EF BB BF 69 6D 70 6F 72`/u);
  assert.match(r19, /232 LF and zero CRLF/u);
  assert.match(r19, /Do not strip\/rewrite the BOM/u);
  assert.match(r19, /The previously green targeted 1\/1 need not be repeated separately/u);
  assert.match(r19Handoff, /preserve all eleven candidate paths/u);

  for (const source of [r20, r20Handoff, projectState]) {
    assert.match(source, /4191afe2fe84283125c0e9ec817185c94685630c/u);
    assert.match(source, /cb808fff195d58fd96718cb8381f7f9091e9f313/u);
    assert.match(source, /32673445643/u);
    assert.match(source, /97277691325/u);
    assert.match(source, /QA_HARNESS_DEPLOYMENT_LIFECYCLE_OVERLOAD \/ EXHAUSTIVE_55_ASSET_GATE \+ FULL_SNAPSHOT_CHECKPOINT_POLLING \+ COMPOSITOR_SCREENSHOT \/ CLEAN_PAGE_CRASH \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /FINITE_DEPLOYMENT_EVIDENCE_LIFECYCLE \/ REQUIRED_ASSET_PLAN \+ LEAN_HOST_TURN_CHECKPOINTS \+ FROZEN_PRODUCTION_CANVAS_PNG \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /DEPLOYMENT_736_REPEAT_COUNT`: `2`/u);
  }
  for (const job of ["97281054120", "97281054139", "97281054121", "97281054124"]) {
    assert.match(r20, new RegExp(job, "u"));
  }
  assert.match(r20, /exactly one read-only method, `getCrawlerDeploymentProofSnapshot`/u);
  assert.match(r20, /schema `v099-crawler-deployment-snapshot\/v1`/u);
  assert.match(r20, /current bounded `renderAudit` record \(including `poseOpacity`\/`effectiveOpacity`\)/u);
  assert.match(r20, /current sampled `animationPose` \(including `opacity`\)/u);
  assert.match(r20, /does not mutate state, read canvas pixels, copy render histories/u);
  assert.match(r20, /existing localhost-only `qaHudFiniteAssets=1` switch/u);
  assert.match(r20, /strict `ensureUnitRenderProofAsset\(kind\)` once/u);
  assert.match(r20, /Node-host 100 ms bounded loop/u);
  assert.match(r20, /Read full session history only when setup request failures/u);
  assert.match(r20, /no in-page requestAnimationFrame loop, Playwright `waitForFunction`, or full `getSnapshot\(\)`/u);
  assert.match(r20, /exactly one frozen `auditFighterUnitLayer\(fighterId\)`/u);
  assert.match(r20, /direct PNG serialization of the frozen production `canvas\.battlefield\.active`/u);
  assert.match(r20, /requires PNG format, exact intrinsic dimensions, positive byte count/u);
  assert.match(r20, /exact PR Verify Chromium deployment route across all six required viewports/u);
  assert.match(r20, /288 production-canvas checkpoint PNGs, 48 contact sheets/u);
  assert.match(r20, /exact bounded WebKit deployment route for all six required viewports/u);
  assert.match(r20, /48 unit processes executes once/u);
  assert.match(r20, /atomic seven-path iteration-6 candidate/u);
  assert.match(r20, /workflow-only iteration-7 restoration/u);
  assert.match(r20Handoff, /current `renderAudit` record \(including pose\/effective opacity\)/u);
  assert.match(r20Handoff, /current sampled `animationPose`/u);
  assert.match(r20Handoff, /copies no render history/u);
  for (const path of [
    "app/AshfallGame.tsx",
    "scripts/v099-final-remediation-browser-smoke.mjs",
    "tests/v0995-runtime-evidence-contract.test.mjs",
    "tests/v100-design-lock.test.mjs",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "docs/PROJECT_STATE.md",
  ]) assert.match(r20, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

  for (const source of [r21, r21Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_CHECKPOINT_FREEZE_OWNERSHIP_GAP \/ HOST_POLL_POST_CANDIDATE_FREEZE_DID_NOT_LATCH_EXISTING_NATURAL_SEMANTIC_INTERVAL \/ MONOTONIC_OVERSHOOT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /RUNTIME_SEMANTIC_CHECKPOINT_LATCH \/ LOCALHOST_ONLY_ARM \+ SAME_SIMULATION_TICK_PAUSE_RECEIPT \+ HOST_READBACK_ONE_AUDIT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /DEPLOYMENT_844_REPEAT_COUNT`: `1`/u);
  }
  assert.match(r21, /progress `0\.117268`/u);
  assert.match(r21, /does not claim whether any particular 100 ms host read began inside the interval/u);
  assert.match(r21, /armCrawlerDeploymentCheckpoint/u);
  assert.match(r21, /qaArmedCrawlerDeploymentCheckpointRef/u);
  assert.match(r21, /qaCrawlerDeploymentCheckpointReceiptRef/u);
  assert.match(r21, /same simulation tick/u);
  assert.match(r21, /unchanged minimum progress from `CRAWLER_DEPLOYMENT_CHECKPOINTS`/u);
  assert.match(r21, /including `0\.08` for `first-visible`/u);
  assert.match(r21, /arm method accepts no caller-supplied threshold/u);
  assert.match(r21, /v099-crawler-deployment-checkpoint-receipt\/v1/u);
  assert.match(r21, /never calls `setRepresentativeSixProofPaused\(true\)`/u);
  assert.match(r21, /Remove the separate pre-checkpoint unpause/u);
  assert.match(r21, /one fresh bounded Chromium 844x390 Mayo-chan-only acceptance/u);
  assert.match(r21, /fresh r21 Phase G Stage 6 WebKit 667x375 3\/3/u);
  assert.match(r21, /Chromium six cases\/48 units\/288 PNGs\/48 sheets/u);
  assert.match(r21, /WebKit 48 fresh unit processes\/288 PNGs\/48 sheets/u);
  assert.match(r21, /material candidate remains iteration 6/u);
  assert.match(r21, /workflow-only restoration remains iteration 7/u);
  assert.match(r21Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r21Handoff, /natural simulation as owner/u);
  assert.match(r21Handoff, /same simulation tick/u);

  for (const source of [r22, r22Handoff]) {
    assert.match(source, /QA_EVIDENCE_PERSISTENCE_GAP \/ VERIFIED_RUNTIME_CHECKPOINT_RECEIPT_OMITTED_FROM_SUMMARY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /CHECKPOINT_RECEIPT_SERIALIZATION \/ EXACT_ACCEPTED_RECEIPT \+ STATIC_AND_RUNTIME_SUMMARY_ASSERTION \/ DESIGN_CHANGE_REQUIRED/u);
  }
  assert.match(r22, /01033765479be3378ad96b67ffd836ea2f5edd603dc43228b80d12fb4b282fd8/u);
  assert.match(r22, /08ed7ee9a849bbb0a9558d9836b8e92472dd583cfd26d53d40c6020a06e32623/u);
  assert.match(r22, /progress `0\.08795115181416581`/u);
  assert.match(r22, /`summary\.json` contains `checkpointReceipt: null`/u);
  assert.match(r22, /Preserve the existing seven-path r21 draft/u);
  assert.match(r22, /or change `app\/AshfallGame\.tsx` from its r21 bytes/u);
  assert.match(r22, /serialize a bounded copy as exact field `checkpointReceipt`/u);
  assert.match(r22, /For `fully-inside`, serialize `checkpointReceipt: null`/u);
  assert.match(r22, /five exact persisted receipts/u);
  assert.match(r22, /exact focused count remains 60/u);
  assert.match(r22, /Design Lock count remains 19/u);
  assert.match(r22Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r22Handoff, /r21 runtime semantic latch is accepted and must remain byte-identical/u);

  for (const source of [r23, r23Handoff, projectState]) {
    assert.match(source, /QA_EVIDENCE_ARTIFACT_IDENTITY_COLLISION \/ SHARED_FAMILY_FILENAME \+ LAST_WRITER_WINS_PNG_AND_CONTACT_SHEET_OVERWRITE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /DEPLOYMENT_ARTIFACT_UNIQUE_IDENTITY_AND_INTEGRITY \/ FAMILY_PLUS_KIND_FILENAME \+ PRE-PASS_UNIQUE_PATH_AND_DISK_SHA_ASSERTION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /DEPLOYMENT_ARTIFACT_COLLISION_REPEAT_COUNT`: `1`/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r23, /288 checkpoint entries but only 252 unique checkpoint paths/u);
  assert.match(r23, /48 contact-sheet entries but only 42 unique contact-sheet paths/u);
  assert.match(r23, /every recorded Kumaverson checkpoint SHA-256 mismatched the final file/u);
  assert.match(r23, /No WebKit full deployment process was started/u);
  assert.match(r23, /\$\{name\}-deployment-\$\{unit\.family\}-\$\{unit\.kind\}-\$\{checkpointIndex\}-\$\{checkpoint\.id\}\.png/u);
  assert.match(r23, /\$\{name\}-deployment-\$\{family\}-\$\{kind\}-contact-sheet\.png/u);
  assert.match(r23, /Before any terminal pass decision/u);
  assert.match(r23, /combined recorded path to be unique/u);
  assert.match(r23, /final disk SHA-256 at every path to equal that entry's recorded SHA-256/u);
  assert.match(r23, /regardless of `canonicalAxes`/u);
  assert.match(r23, /Do not require content hashes to be globally unique/u);
  assert.match(r23, /Add or remove no test block/u);
  assert.match(r23, /Exact focused count remains 60 and Design Lock count remains 19/u);
  assert.match(r23, /Chromium 667x375 process filtered to exactly `kumaverson,medic`/u);
  assert.match(r23, /12 unique checkpoint paths, two unique contact-sheet paths/u);
  assert.match(r23, /exactly 288 logical and unique checkpoint paths/u);
  assert.match(r23, /exactly 48 logical and unique contact-sheet paths/u);
  assert.match(r23, /material candidate remains the same exact seven paths/u);
  assert.match(r23Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r23Handoff, /family-plus-kind filenames and fail-closed unique-path\/final-disk-SHA integrity/u);

  for (const source of [r24, r24Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_CANONICAL_REVISION_HEADER_DRIFT \/ R23_SECTIONS_PUBLISHED_WITH_R22_DESIGN_HANDOFF_PROJECT_STATE_HEADERS_AND_POSITIVE_ASSERTIONS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /CANONICAL_REVISION_IDENTITY_ALIGNMENT \/ R24_HEADER_SUMMARY_CURSOR_AND_NEGATIVE_STALE_ASSERTIONS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /97e6bc60a9130c68b8a1cfcd86b7b76b9d769478/u);
    assert.match(source, /f9ff663dd8e3c36f8553153fe1d4fc3d5b0d4727/u);
    assert.match(source, /CANONICAL_REVISION_HEADER_DRIFT_REPEAT_COUNT`: `1`/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r24, /CI run `32686937760` \(#923\)/u);
  assert.match(r24, /exact four-path r24 correction scope/u);
  assert.match(r24, /workflow-only unfiltered restoration, now iteration 8/u);
  assert.match(activeHandoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r24Handoff, /Correct only the four named design\/source paths/u);
  const designHeader = design.match(/^# Version 1\.0\.0 Design Lock[\s\S]+?(?=## 1\.)/u)?.[0] ?? "";
  const handoffHeader = handoff.match(/^# Version 1\.0\.0 Historical Luna Handoff[\s\S]+?(?=## 1\.)/u)?.[0] ?? "";
  const projectCurrentSummary = projectState.match(/## 2\. 次の正式release target([\s\S]+?)(?=## 3\.)/u)?.[1] ?? "";
  for (const activeSource of [designHeader, handoffHeader, projectCurrentSummary]) {
    assert.doesNotMatch(activeSource, /(?:V100-SOL-DL-001 |Revision: `)r(?:22|23|24|25|26|27|28|29)`/u);
  }

  for (const source of [r25, r25Handoff]) {
    assert.match(source, /REMOTE_WEBKIT_QA_LIFECYCLE_COUPLING \/ PHASE_G_CROSS_CAPTURE_BROWSER_REUSE \+ DEPLOYMENT_DIAGNOSTIC_PAGE_IO_REENTRANCY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_QA_CAPTURE_LIFECYCLE_ISOLATION \/ FRESH_PHASE_G_BATTLE_EXTRA_BROWSER_PER_CAPTURE \+ COOPERATIVE_SINGLE_PAGE_IO_DEPLOYMENT_TRACE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /585eed74e5725e40f992ef4c7f85a0179ae2ae8f/u);
    assert.match(source, /09f04dd9b6bdadef99c9b71ddc2cad5553077c1f/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  for (const id of ["32687912194", "97319047736", "9506668044", "97320937838", "9507055506", "97320937859", "9507008698"]) {
    assert.match(r25, new RegExp(id, "u"));
  }
  assert.match(r25, /phaseGBrowserLifecyclePolicy/u);
  assert.match(r25, /fresh-process-per-capture/u);
  assert.match(r25, /capture count 1/u);
  assert.match(r25, /V100_PHASE_G_BROWSER_LIFECYCLE_PROBE/u);
  assert.match(r25, /captureMode: "cooperative-main-flow"/u);
  assert.match(r25, /overlap-wait count 0/u);
  assert.match(r25, /exact eight-path topology/u);
  assert.match(r25, /WebKit 844x340 Ranger 3\/3/u);
  assert.match(r25, /WebKit 844x390 Crazy King 3\/3/u);
  assert.match(r25, /workflow-only iteration-9 restoration/u);

  for (const source of [r26, r26Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_CONTACT_FIRST_TARGET_CONTINUITY_DEADLOCK \/ MONOTONIC_LIVING_TARGET_HISTORY_STOPS_FRONTLINE \+ SUPPRESSES_REAL_CARD_REDEPLOY_BEFORE_PROOF_ATTACK \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /PHASE_G_CONTACT_FIRST_LIVE_TARGET_CONTINUITY \/ HISTORICAL_TARGET_EVIDENCE_ONLY \+ REAL_CARD_SURVIVAL_REDEPLOY_WHILE_ATTACK_PENDING \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /585eed74e5725e40f992ef4c7f85a0179ae2ae8f/u);
    assert.match(source, /09f04dd9b6bdadef99c9b71ddc2cad5553077c1f/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r26, /0b4fd89d6ecdc18fcb6a2b953f2f583d8825049d81b4d16fa53ca185dfe3c35c/u);
  assert.match(r26, /62e09be01f9b60be1799ab548b63b388df32e7746d653ed763439075c8ae1f9b/u);
  assert.match(r26, /fbd4c3a55bc5692f5b6ec3d4876ebd0ece92947b219d9d665e8e94b0035ac0d8/u);
  assert.match(r26, /proofActorTargetContinuityDecision/u);
  assert.match(r26, /hasLiveHumanTarget/u);
  assert.match(r26, /Historical evidence must never set `hasLiveHumanTarget`/u);
  assert.match(r26, /V100_PHASE_G_CAUSAL_HISTORY_PROBE/u);
  assert.match(r26, /Do not set Stage 25 `keepHumanTargetAlive`/u);
  assert.match(r26, /fresh WebKit standalone Stage 6 667x375 3\/3, Stage 24 736x414 3\/3, and Stage 25 932x430 3\/3/u);
  assert.match(r26, /exact eight-path topology/u);

  for (const source of [r27, r27Handoff, projectState]) {
    assert.match(source, /REMOTE_WEBKIT_CLEAN_PAGE_CRASH_RECURRENCE \/ FRESH_PHASE_G_AND_COOPERATIVE_DEPLOYMENT_PAGES \+ PROCESS_RESOURCE_OWNER_UNOBSERVED \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_HOST_PROCESS_RESOURCE_TELEMETRY \/ PROC_CGROUP_DESCENDANT_LIFECYCLE \+ PAGE_CRASH_CORRELATION \+ ZERO_ACCEPTANCE_CHANGE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /8e914497272a45ecb7e0558546b05fd4f1bd6cac/u);
    assert.match(source, /310742c60cba2ee07ba4f9acd8bd9d23b7fa8db8/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r27, /32697709716/u);
  assert.match(r27, /97346394306/u);
  assert.match(r27, /97347974699/u);
  assert.match(r27, /97347974482/u);
  assert.match(r27, /v100-webkit-host-resource-telemetry\/v1/u);
  assert.match(r27, /every 500 ms/u);
  assert.match(r27, /linux-proc-cgroup-unavailable/u);
  assert.match(r27, /automatic diagnostic result always returns to `SOL_DESIGN`/u);
  assert.match(r27, /DIAGNOSTIC_NO_REPRODUCTION/u);
  assert.match(r27, /exact ten-path delta\/cumulative topology/u);
  assert.match(r27, /Workflow-only unfiltered restoration becomes iteration 11/u);
  for (const source of [r28, r28Handoff, projectState]) {
    assert.match(source, /R27_DIAGNOSTIC_EVIDENCE_INVALID_AND_INCOMPLETE \/ MASKED_PHASE_G_PAGE_CRASH \+ HOSTED_VISUAL_PAGE_TERMINATION \+ DEPLOYMENT_UNOBSERVED \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_PROCESS_EVIDENCE_FAIL_CLOSED \/ PROC_SELF_ROOT \+ WPE_ROLE_LIFECYCLE \+ PRIMARY_CRASH_LATCH \+ HOSTED_AND_DEPLOYMENT_TERMINAL_OBSERVATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /63eb718fa81ad378c71098c8e01798ea18d4ca4c/u);
    assert.match(source, /a675ee258d2fa65114fda6b5cb9c0ca645e5494a/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  for (const id of ["32704113198", "97366143168", "9512347298", "97364691262", "9512206336"]) {
    assert.match(r28, new RegExp(id, "u"));
  }
  assert.match(r28, /\/proc\/self/u);
  assert.match(r28, /WPEWebProcess/u);
  assert.match(r28, /page crash as primary/u);
  assert.match(r28, /exactly one attempt/u);
  assert.match(r28, /DEBUG: pw:browser/u);
  assert.match(r28, /if: \$\{\{ always\(\) \}\}/u);
  assert.match(r28, /exactly thirteen paths/u);
  assert.match(r28, /both existing deployment telemetry callers/u);
  for (const path of [
    "scripts/webkit-host-resource-telemetry.mjs",
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "scripts/v0995-visual-integrity-browser-smoke.mjs",
    "scripts/v099-final-remediation-browser-smoke.mjs",
    "scripts/run-v099-deployment-units-bounded.mjs",
    "tests/v0995-runtime-evidence-contract.test.mjs",
    ".github/workflows/ci.yml",
    "tests/ci-contract.test.mjs",
  ]) assert.match(r28, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r28, /automatic result always returns to `SOL_DESIGN`/u);
  assert.match(r28, /Workflow-only restoration becomes iteration 12/u);
  for (const source of [r29, r29Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_QA_WEBKIT_EXECUTION_BOUNDARIES \/ LINUX_MOCK_TELEMETRY_REALISM \+ HOSTED_CROSS_CASE_BROWSER_LIFETIME \+ DEPLOYMENT_FULL_WORLD_PIXEL_AUDIT_SURFACES \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_QA_CASE_AND_REGION_OWNERSHIP \/ TEST_ONLY_TELEMETRY_INJECTION \+ FRESH_HOSTED_BROWSER_PER_CASE \+ REGION_LOCAL_FROZEN_PIXEL_AUDIT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /2328e28a6678d56c65582fa07f9b5cff470d8799/u);
    assert.match(source, /6781c750a7901324462039003ce12c16ad6c58a3/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  for (const id of [
    "32709911420", "97378886572", "97382911906", "9514326823", "9514328914",
    "97384488784", "9514454094", "97384488833", "9514547684", "97384488727",
    "9514636504", "97384488731", "9514767845", "97384488694", "9514851678",
    "97384488766", "9514936346", "97379490612", "97384489130",
  ]) assert.match(r29, new RegExp(id, "u"));
  assert.match(r29, /optional telemetry-factory parameter/u);
  assert.match(r29, /default identity is exactly `createWebKitHostResourceTelemetry`/u);
  assert.match(r29, /non-default telemetry factory is legal only when `runAttempt` is also injected/u);
  assert.match(r29, /supported-invalid fixture makes otherwise passing units fail at `host-resource-telemetry`/u);
  assert.match(r29, /never replaces a real unit\/product failure/u);
  assert.match(r29, /fresh browser immediately before each existing ready case and each existing fault class\/mode\/viewport case/u);
  assert.match(r29, /exact case list\/order/u);
  assert.match(r29, /allocate the unit, foreground, and composite offscreen canvases at exact bounded `width x height`/u);
  assert.match(r29, /translate\(-left, -top\)/u);
  assert.match(r29, /Read those surfaces at `\(0, 0, width, height\)`/u);
  assert.match(r29, /focused total remains exactly 60 and Design Lock remains exactly 19/u);
  assert.match(r29, /exactly nine paths/u);
  assert.match(r29, /Chromium 844x340\/brute targeted deployment pixel-equivalence control/u);
  assert.match(r29, /local Windows browser control[\s\S]*`supported: false`, `reason: linux-proc-cgroup-unavailable`, `status: complete`, `valid: null`/u);
  assert.match(r29, /deterministic unsupported unit fixture must model those same fields/u);
  assert.match(r29, /automatic Linux run[\s\S]*`supported: true`, `status: complete`, `valid: true`/u);
  for (const path of [
    "scripts/run-v099-deployment-units-bounded.mjs",
    "tests/v099-deployment-units-bounded.test.mjs",
    "scripts/v0995-visual-integrity-browser-smoke.mjs",
    "app/AshfallGame.tsx",
    "tests/v0995-runtime-evidence-contract.test.mjs",
  ]) assert.match(r29, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r29, /736x414\/brawler/u);
  assert.match(r29, /844x390\/ranger/u);
  assert.match(r29, /844x340\/brute/u);
  assert.match(r29, /932x430\/brawler/u);
  assert.match(r29, /1280x720\/scout/u);
  assert.match(r29, /mission\/delay 844x340/u);
  assert.match(r29, /ordered local Phase G Stage 6 -> Stage 24 -> Stage 25 sequence 3\/3/u);
  assert.match(r29, /automatic run with PR Verify, all enemy shards, Hosted, Phase G, Stage 3, all six deployment viewports, canonical HUD/u);
  assert.match(r29, /Workflow-only unfiltered restoration remains iteration 12|workflow-only unfiltered restoration remains iteration 12/u);
  for (const source of [r30, r30Handoff, projectState]) {
    assert.match(source, /V1_RUNTIME_ATLAS_PACKING_AND_TRANSPORT_CONSISTENCY \/ OVERSIZED_TRANSPARENT_CELL_SURFACES \+ SIX_STALE_PWA_DERIVATIVES \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /V1_APPROVED_PIXEL_PRESERVING_ATLAS_REPACK \/ 544PX_CENTERED_CELLS \+ EXACT_VISIBLE_AND_DISPLAY_GEOMETRY_HASHES \+ LOSSLESS_PWA_REGENERATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /2962be753c2c3e8741a523a4d67a3092f1d90b50/u);
    assert.match(source, /7effc512b6969759ceea2d62aa5a8d2ed1502747/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  for (const id of ["32716292056", "97402460108", "9516654088", "32716292197"]) {
    assert.match(r30, new RegExp(id, "u"));
  }
  assert.match(r30, /65 of 66 jobs passed/u);
  assert.match(r30, /53,597 ms/u);
  assert.match(r30, /WPE WebContent child disappeared while the browser root and network process survived/u);
  assert.match(r30, /does not claim OOM, a particular WebKit engine defect, or a product cooldown defect/u);
  assert.match(r30, /180\.00 MiB/u);
  assert.match(r30, /76\.50 MiB \/ 80,216,064 bytes/u);
  assert.match(r30, /57\.50% reduction/u);
  assert.match(r30, /Crop exactly 368 transparent pixels from both horizontal sides/u);
  assert.match(r30, /largest approved frame is 509 px wide/u);
  assert.match(r30, /exactly 29 paths/u);
  assert.match(r30, /exactly the same six V1 motion WebP paths and no other derivative/u);
  assert.match(r30, /alpha and visible RGB differ/u);
  assert.match(r30, /Hidden RGB under fully transparent alpha is not player-visible/u);
  assert.match(r30, /93e48efa1692b14a61d2de29641570cd10d2f02149f85d9f89815f68861ff53d/u);
  for (const hash of [
    "02a65632ef9731f91a9977e7cd4d58e4ff87999ff6bada097afac85376b39de3",
    "8c70bd8b2eac413fa2909e1a60ab18db7a40d464f6a0eb234ef757ee6288676f",
    "64306872600104595040f2f8dd1d29f18cd347a8e96964694622e6cede855035",
    "4e10e673db28baedde72cc98e38e4c132ad616dde21093310c788a97cbe1aaf7",
    "8c12fa3dd831b6c5e400e13d4b642b79e5cde37a9a1076c24c2b85f9f182d56b",
    "8756beab8bde3780f72c6957c5155b27a3a5b7cdf4f6151af52ea7d0b0201c10",
  ]) assert.match(r30, new RegExp(hash, "u"));
  for (const path of [
    "scripts/build-v100-motion-atlases.mjs",
    "scripts/check-v100-motion-atlases.mjs",
    "app/spriteManifest.js",
    "app/v100RuntimeSprites.js",
    "tests/v100-runtime-motion-atlas.test.mjs",
    "assets/source/v100/runtime/v100-runtime-assets-provenance.json",
    "public/art/v100/bosses/mugarian-president-mutated-battle-v1.png",
    "public/art/v100/bosses/takuya-omega-battle-v1.png",
    "public/art/v100/enemies/red-panther-knife-battle-v1.png",
    "public/art/v100/enemies/red-panther-shield-battle-v1.png",
    "public/art/v100/enemies/red-panther-smg-battle-v1.png",
    "public/art/v100/enemies/red-panther-commander-battle-v1.png",
    "public/pwa-optimized/art/v100/bosses/mugarian-president-mutated-battle-v1.webp",
    "public/pwa-optimized/art/v100/bosses/takuya-omega-battle-v1.webp",
    "public/pwa-optimized/art/v100/enemies/red-panther-knife-battle-v1.webp",
    "public/pwa-optimized/art/v100/enemies/red-panther-shield-battle-v1.webp",
    "public/pwa-optimized/art/v100/enemies/red-panther-smg-battle-v1.webp",
    "public/pwa-optimized/art/v100/enemies/red-panther-commander-battle-v1.webp",
    "public/asset-manifest.json",
  ]) assert.match(r30, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r30, /three fresh standalone Stage 24 WebKit 736x414 processes/u);
  assert.match(r30, /three fresh standalone Stage 25 WebKit 932x430 processes/u);
  assert.match(r30, /three fresh ordered Stage 6 667x375 -> Stage 24 736x414 -> Stage 25 932x430 processes/u);
  assert.match(r30, /atomic exact 29-path iteration-12 commit/u);
  assert.match(r30, /workflow-only unfiltered restoration as iteration 13/u);
  for (const source of [r31, r31Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_EPHEMERAL_TARGET_REACTION_HISTORY_GAP \/ 40MS_OBSERVER_REACTION_NOT_SERIALIZED \+ 120MS_CONSUMER_BOUNDARY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /SOL_LOCAL_EXECUTION_CONTRACT_OMISSION \/ ORDERED_COMMAND_MISSING_BATTLE_EXTRA_AND_WEBKIT_FILTERS \/ INVALID_CURRENT_GATE_OBSERVATION/u);
    assert.match(source, /QA_CAUSAL_REACTION_HISTORY_CONTINUITY \/ ACTUAL_40MS_REACTION_RECORDS \+ 96_RECORD_FIRST_OBSERVED_BOUND \+ EXACT_FOCUSED_ORDERED_PREFLIGHT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /2962be753c2c3e8741a523a4d67a3092f1d90b50/u);
    assert.match(source, /7effc512b6969759ceea2d62aa5a8d2ed1502747/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r31, /81 production samples/u);
  assert.match(r31, /pending for 0\.02 seconds/u);
  assert.match(r31, /`flash` may last only 0\.12 seconds/u);
  assert.match(r31, /polls at 120 ms/u);
  assert.match(r31, /observer polls at 40 ms/u);
  assert.match(r31, /cumulative exact 32-path topology/u);
  for (const path of [
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v100-r11-combat-causal-history.test.mjs",
  ]) assert.match(r31, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r31, /numeric `flash > 0`/u);
  assert.match(r31, /numeric `knock > 0`/u);
  assert.match(r31, /matching `hurt\|hit\|stagger\|die`/u);
  assert.match(r31, /stop accepting new distinct records at 96/u);
  assert.match(r31, /Do not manufacture a reaction from audio, `pendingWeaponHits`, `attackIdentity`, presentation, source-target ownership, elapsed time, or a predicted impact/u);
  assert.match(r31, /V100_PHASE_G_ONLY='battle-extra'/u);
  assert.match(r31, /V100_PHASE_G_ONLY_ENGINE='webkit'/u);
  assert.match(r31, /Remove-Item Env:V100_PHASE_G_ONLY_VARIANT/u);
  assert.match(r31, /exactly three results in Stage 6 -> Stage 24 -> Stage 25 order/u);
  assert.match(r31, /sessions `webkit-1`, `webkit-2`, `webkit-3`/u);
  assert.match(r31, /atomic exact 32-path iteration-13 commit/u);
  assert.match(r31, /workflow-only unfiltered restoration as iteration 14/u);
  for (const source of [r32, r32Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_COMBAT_OBSERVER_LIFETIME_GAP \/ OBSERVER_STOPS_IN_CONFIGURE_BEFORE_CAUSAL_COLLECTION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /QA_CAUSAL_OBSERVER_PROOF_WINDOW_OWNERSHIP \/ KEEP_40MS_OBSERVER_LIVE_THROUGH_COLLECTOR \+ STOP_IN_CAPTURE_FINALLY \+ EXISTING_ACTUAL_REACTION_HISTORY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /2962be753c2c3e8741a523a4d67a3092f1d90b50/u);
    assert.match(source, /7effc512b6969759ceea2d62aa5a8d2ed1502747/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r32, /88 actual production samples/u);
  assert.match(r32, /1,277,771 bytes/u);
  assert.match(r32, /f0cbe4fa4d3ffd7859de16d9fa002e51f2a180b59957494f45cb66a0cda390ae/u);
  assert.match(r32, /Chromium 844x390/u);
  assert.match(r32, /`battlePage` currently stops that observer in its own `finally`/u);
  assert.match(r32, /`captureStateImpl` awaits `configure\(page\)` to completion and only then invokes `collectCombatCausalProof`/u);
  assert.match(r32, /cumulative candidate stays exactly 32 paths/u);
  for (const path of [
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v100-r11-combat-causal-history.test.mjs",
  ]) assert.match(r32, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r32, /remove only the observer stop from `battlePage`'s `finally`/u);
  assert.match(r32, /bounded `try\/finally`/u);
  assert.match(r32, /final stable-history read/u);
  assert.match(r32, /Do not move the observer into product code, add another interval, change 40 ms or 120 ms, extend 12,000 ms or 4,800 ms/u);
  assert.match(r32, /one new Chromium battle-normal control/u);
  assert.match(r32, /fresh Stage 24 WebKit 736x414 standalone 3\/3/u);
  assert.match(r32, /fresh Stage 25 WebKit 932x430 standalone 3\/3/u);
  assert.match(r32, /atomic exact 32-path iteration-14 commit/u);
  assert.match(r32, /workflow-only unfiltered restoration as iteration 15/u);
  for (const source of [r33, r33Handoff, projectState]) {
    assert.match(source, /QA_CAUSAL_TARGET_REACTION_IDENTITY_FAIL_OPEN \/ TARGETLESS_DAMAGE_TEXT_INCLUDES_STATUS_AND_HEAL \+ ANY_REACTION_PREDICATE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /QA_CAUSAL_TARGET_REACTION_IDENTITY_BINDING \/ FIGHTER_ID_SIDE_KIND_ONLY \+ SOURCE_EDGE_TARGET_MATCH \+ DAMAGE_TEXT_EXCLUDED \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /2962be753c2c3e8741a523a4d67a3092f1d90b50/u);
    assert.match(source, /7effc512b6969759ceea2d62aa5a8d2ed1502747/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r33, /120 of the 1,728 reaction records/u);
  assert.match(r33, /1,608 identity-bound/u);
  assert.match(r33, /36-57 such records/u);
  assert.match(r33, /Production `DamageText` contains position\/value\/lifetime\/color and no fighter identity/u);
  assert.match(r33, /cumulative candidate stays exactly 32 paths/u);
  for (const path of [
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "tests/v100-r11-combat-causal-history.test.mjs",
  ]) assert.match(r33, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r33, /Remove `damageTexts` from reaction-history eligibility entirely/u);
  assert.match(r33, /target id occurs as the target of a real captured source-target edge/u);
  assert.match(r33, /target-less numeric damage, `索敵マーク`, `救護`, and positive heal text cannot create reaction history/u);
  assert.match(r33, /identity-bound reaction for an unrelated fighter cannot satisfy an edge targeting another fighter/u);
  assert.match(r33, /all r32 browser reports become comparison-only/u);
  assert.match(r33, /every one of the 18 new captures/u);
  assert.match(r33, /atomic exact 32-path iteration-15 commit/u);
  assert.match(r33, /workflow-only unfiltered restoration as iteration 16/u);
  for (const source of [r34, r34Handoff]) {
    assert.match(source, /SOL_OWNED_RELEASE_PREP_BYTE_SNAPSHOT_DRIFT \/ APPROVED_SIX_ATLAS_TRANSPORT_REDUCTION_NOT_PROPAGATED_TO_EXACT_UPDATE_BYTE_ASSERTIONS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /RELEASE_PREP_APPROVED_SIZE_SNAPSHOT_PROPAGATION \/ ONE_SIX_PATH_TRANSPORT_DELTA \+ ALL_COUNTS_HASH_REUSE_AND_PAYLOAD_VERIFICATION_PRESERVED \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /REMOTE_HOSTED_WEBKIT_NATIVE_RUNTIME_ENVELOPE \/ MULTI_HARNESS_TARGET_PROCESS_LOSS \+ UNPINNED_SYSTEM_DEPENDENCY_SURFACE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /MATCHED_PLAYWRIGHT_RUNTIME_ENVELOPE \/ DIGEST_PINNED_OFFICIAL_V1_56_1_NOBLE \+ INIT_IPC \+ EXACT_PACKAGE_BROWSER_PREFLIGHT \+ STAGE3_PROCESS_TELEMETRY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /e8cfc3b557e9316a33186935c98d110f33bcc5a9/u);
    assert.match(source, /0bbffaf3d14114985bf9c4ba7ddca5ae0524f195/u);
    assert.match(source, /32747475096/u);
    assert.match(source, /97496346503/u);
    assert.match(source, /97503465033/u);
    assert.match(source, /97507755900/u);
    assert.match(source, /97507755990/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
  }
  assert.match(r34, /exactly `6,309,676` bytes/u);
  assert.match(r34, /Candidate total was `104,562,671` instead of stale `110,872,347`/u);
  assert.match(r34, /0\.9\.8\.2 were `31,511,554` instead of `37,821,230`/u);
  assert.match(r34, /0\.9\.9\.3 were `21,136,860` instead of `27,446,536`/u);
  assert.match(r34, /Direct distinct-hash bytes are `104,022,768`/u);
  assert.match(r34, /update counts 108\/348\/3\/26 and 59\/397\/3\/19/u);
  assert.match(r34, /tests\/v099-release-prep\.test\.mjs/u);
  assert.match(r34, /APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION = 6_309_676/u);
  assert.match(r34, /candidate total bytes `104_562_671`/u);
  assert.match(r34, /candidate distinct-hash bytes `104_022_768`/u);
  assert.match(r34, /0\.9\.8\.2 -> candidate download bytes `31_511_554`/u);
  assert.match(r34, /0\.9\.9\.3 -> candidate download bytes `21_136_860`/u);
  assert.match(r34, /9528828235/u);
  assert.match(r34, /5f634c239bca6b47d47a7887bbac181776552c37daf047aa23f080760e7bbc13/u);
  assert.match(r34, /9529101582/u);
  assert.match(r34, /957ce6bff37e34739c81bf5f5419b37cf741e4c5af664274c003b52a9119f902/u);
  assert.match(r34, /9529738512/u);
  assert.match(r34, /8930038dacbe10073258b1f227d850e6f167decd45a1873d9d6c0166342bd878/u);
  assert.match(r34, /WPE WebContent spent a long interval in Linux `D` state/u);
  assert.match(r34, /WPE WebContent again entered intermittent `D` state/u);
  assert.match(r34, /No Stage 3 host-process telemetry exists/u);
  assert.match(r34, /mcr\.microsoft\.com\/playwright:v1\.56\.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a/u);
  assert.match(r34, /sha256:42f02d323c310069b4d54c94bd91a608966a486c3492c48ae0b1cea747ec5ca2/u);
  assert.match(r34, /--init --ipc=host/u);
  assert.match(r34, /Chromium metadata is revision `1194` \/ version `141\.0\.7390\.37`/u);
  assert.match(r34, /WebKit metadata is revision `2215` \/ version `26\.0`/u);
  assert.match(r34, /existing `createWebKitHostResourceTelemetry`/u);
  assert.match(r34, /exactly these eleven tracked paths/u);
  assert.match(r34, /Four r33 paths overlap this r34 governance allowlist/u);
  assert.match(r34, /other 28 r33 paths[\s\S]*remain byte-identical/u);
  assert.match(r34Handoff, /28 r33 committed paths outside the Section 50\.2 allowlist byte-identical/u);
  assert.match(r34Handoff, /four overlapping governance paths/u);
  for (const path of [
    ".github/workflows/ci.yml",
    "scripts/run-stage3-audio-bounded.mjs",
    "scripts/verify-playwright-container-runtime.mjs",
    "tests/ci-contract.test.mjs",
    "tests/playwright-container-runtime.test.mjs",
    "tests/stage3-final-bounded.test.mjs",
    "tests/v099-release-prep.test.mjs",
  ]) assert.match(r34, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r34, /complete `npm test` 1,195\/1,195/u);
  assert.match(r34, /do not rerun the 18 r33 browser captures/u);
  assert.match(r34, /atomic exact eleven-path iteration-16 commit/u);
  assert.match(r34, /workflow-only iteration 17/u);
  for (const source of [r35, r35Handoff, projectState]) {
    assert.match(source, /REMOTE_WEBKIT_HOST_IO_WAIT_CORRELATION \/ SIX_TERMINAL_AXES_WITH_WPE_D_STATE \+ ELEVATED_HOST_IO_PSI \/ KERNEL_WAIT_OWNER_UNOBSERVED \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /R34_RUNTIME_HYPOTHESIS_FALSIFIED \/ PINNED_OFFICIAL_RUNTIME_STILL_LOSES_WPE_ACROSS_HOSTED_PHASE_G_DEPLOYMENT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WEBKIT_KERNEL_WAIT_OWNER_DIAGNOSTIC \/ D_STATE_WCHAN \+ PROC_IO_AND_BLKIO \+ EXACT_OPERATION_SPANS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /a12d738ddb276c096fad6eee6490e78cb2914a51/u);
    assert.match(source, /4d59d17634a7b8bbda02aaf6576abba99dd9e7de/u);
    assert.match(source, /32756548112/u);
    assert.match(source, /97529855291/u);
    assert.match(source, /97531166109/u);
    assert.match(source, /97531211614/u);
    assert.match(source, /97531211541/u);
    assert.match(source, /97531211559/u);
    assert.match(source, /97531211515/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 17/u);
    assert.match(source, /no earlier than iteration 18/u);
    assert.match(source, /no earlier than iteration 19/u);
  }
  for (const artifact of [
    "9531717054",
    "9531824504",
    "9531853897",
    "9532067109",
    "9532172101",
    "9532238214",
    "9531973368",
    "9532375038",
  ]) assert.match(r35, new RegExp(artifact, "u"));
  for (const digest of [
    "1e9e54609b9ad956660a5fd95035413110b460ed9b09d7a97490cc715ad5b258",
    "65505a91d435ff5ddf4c8aac21dbdf8eef371f3f4d4735764c63d74fa40b5df3",
    "afa180effd75f06acae1ecb4e792042b51ac4b966bca57dc376bdaf75511cd55",
    "29bc8d25a08c6e015fe78007049cedd3615bb070f2b440e6db5f91ef49b55af2",
    "b6d3dd1873bb0d118ea5dcfa65ffc1cf28d10252e9a5dd86c2b3b862ae27d114",
    "478bb12b11d1b1b5e8f34697907b156e3c8fa45dc1886a425f9bc9f6a607ae7e",
    "68d9e1757fd1fa2d8f6e5ba2c041633550f65a06c5a5edd2cbed53301f92fc67",
    "af056c4c8ced3983462cdc58c938b2af025b5b7e24ef12033476babec6dac125",
  ]) assert.match(r35, new RegExp(digest, "u"));
  assert.match(r35, /87 `D` samples across six terminal axes/u);
  assert.match(r35, /26 successful unit processes contain zero WPE `D` samples/u);
  assert.match(r35, /32\.40 to 83\.16/u);
  assert.match(r35, /at or below 15\.71/u);
  assert.match(r35, /v100-webkit-wait-owner\/v1/u);
  assert.match(r35, /first 64 `D` samples per stable process identity/u);
  assert.match(r35, /delayacct_blkio_ticks/u);
  assert.match(r35, /at most the first 16 sanitized lines/u);
  assert.match(r35, /A Linux run that observes `D` but persists no matching wait-owner attempt is telemetry-invalid/u);
  assert.match(r35, /Set the requested checkpoint context before the cross-page advance/u);
  for (const outcome of ["DIAGNOSTIC_COMPLETE", "DIAGNOSTIC_EVIDENCE_INVALID", "DIAGNOSTIC_NO_REPRODUCTION"]) {
    assert.match(r35, new RegExp(outcome, "u"));
    assert.match(r35Handoff, new RegExp(outcome, "u"));
  }
  for (const path of [
    "docs/PROJECT_STATE.md",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "tests/v100-design-lock.test.mjs",
    "scripts/webkit-host-resource-telemetry.mjs",
    "tests/v0995-runtime-evidence-contract.test.mjs",
    "scripts/v099-final-remediation-browser-smoke.mjs",
    "scripts/v0995-visual-integrity-browser-smoke.mjs",
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
  ]) assert.match(r35, new RegExp(path.replaceAll(".", "\\."), "u"));
  assert.match(r35, /focused `tests\/v100-design-lock\.test\.mjs`, `tests\/v0995-runtime-evidence-contract\.test\.mjs`, and `tests\/v100-phase-g-checkpoint\.test\.mjs` at exactly 34\/34/u);
  assert.match(r35, /automatic result always returns to `SOL_DESIGN`, including complete green/u);
  assert.match(r35Handoff, /NO ACTIVE LUNA HANDOFF/u);
  for (const source of [r36, r36Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_WEBKIT_CAUSAL_COLLECTION_LIFETIME \/ PROOF_ALREADY_COMPLETE \+ MAX_DURATION_POLLING_CONTINUES_INTO_ANON_PIPE_WRITE_BACKPRESSURE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /QA_ONLY_DEPLOYMENT_PIXEL_AUDIT_SURFACE_LIFETIME \/ FOUR_DETACHED_CANVASES_PER_CHECKPOINT \+ SYNCHRONOUS_FINAL_AUDIT_OVER_WPE_ANON_PIPE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /WORKFLOW_REPOSITORY_SAFE_DIRECTORY_PRECONDITION \/ STAGE3_FINAL_BASE_SOURCE_PREPARATION_ONLY \/ REMEDIATION_LOCAL/u);
    assert.match(source, /BOUNDED_CAUSAL_PROOF_CONVERGENCE \+ SINGLE_REUSABLE_QA_PIXEL_AUDIT_SURFACE \+ COMMAND_SCOPED_STAGE3_SAFE_DIRECTORY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /be4acc7a034858cd9918714895d423da71f4ebf6/u);
    assert.match(source, /f9c7d4306f7104b57ab287767aebba3d19d48775/u);
    assert.match(source, /32764650981/u);
    assert.match(source, /97557384758/u);
    assert.match(source, /97558371928/u);
    assert.match(source, /97559866922/u);
    assert.match(source, /97559866871/u);
    assert.match(source, /97559866973/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 18/u);
    assert.match(source, /iteration 19/u);
  }
  for (const path of [
    "docs/PROJECT_STATE.md",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "tests/v100-design-lock.test.mjs",
    "scripts/v100-phase-g-production-matrix.mjs",
    "tests/v100-phase-g-checkpoint.test.mjs",
    "app/AshfallGame.tsx",
    "scripts/v099-final-remediation-browser-smoke.mjs",
    "tests/v0995-runtime-evidence-contract.test.mjs",
    ".github/workflows/ci.yml",
    "tests/ci-contract.test.mjs",
  ]) assert.match(r36, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r36, /COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS = 2_400/u);
  assert.match(r36, /COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES = 8/u);
  assert.match(r36, /v100-phase-g-causal-collection\/v1/u);
  assert.match(r36, /v100-fighter-unit-layer-audit-scratch\/v1/u);
  assert.match(r36, /surfaceCount: 1, contextCount: 1, passCount: 6/u);
  assert.match(r36, /git -c safe\.directory="\$GITHUB_WORKSPACE" cat-file -e "\$PR_BASE_SHA\^\{commit\}"/u);
  assert.match(r36, /git -c safe\.directory="\$GITHUB_WORKSPACE" worktree add --detach "\$base_source" "\$PR_BASE_SHA"/u);
  assert.match(r36, /full bounded WebKit deployment six viewports \/ eight one-attempt unit processes \/ six checkpoints/u);
  assert.match(r36, /atomic exact eleven-path iteration-18 commit/u);
  assert.match(r36, /workflow-only iteration-19 commit/u);
  assert.match(r36, /Of the six r35 diagnostic implementation paths, four overlap this r36 allowlist/u);
  assert.match(r36, /The two non-overlapping paths \(`scripts\/webkit-host-resource-telemetry\.mjs` and `scripts\/v0995-visual-integrity-browser-smoke\.mjs`\) remain byte-identical/u);
  assert.match(r36, /exact eleven-path topology/u);
  assert.doesNotMatch(r36, /exact ten-path topology|five r35 diagnostic implementation paths outside this allowlist/u);
  assert.match(r36Handoff, /Of the six r35 diagnostic implementation paths, preserve the two non-overlapping paths/u);
  for (const source of [r36, r36Handoff, r37, r37Handoff, projectState]) {
    assert.match(source, /tmp-r35-deploy-compare\//u);
    assert.match(source, /tmp-r35-hosted\//u);
    assert.match(source, /tmp-r35-phaseg\//u);
    assert.match(source, /tracked\/index clean/u);
    assert.match(source, /fresh-equivalent/u);
  }
  assert.match(r36, /Any other untracked path blocks/u);
  assert.match(r36Handoff, /no untracked path outside those three named forensic directories/u);
  assert.match(activeHandoff, /NO ACTIVE LUNA HANDOFF/u);
  for (const source of [r37, r37Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_STAGE3_LOADOUT_DISPATCH_ATOMICITY \/ TARGET_ASSET_GENERATION_READY \+ NATIVE_DISABLED_FALSE_DOES_NOT_PROVE_ARIA_OR_HANDLER_READINESS \+ SPLIT_IPC_CLICK_BOUNDARY \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /PR_VERIFY_ARTIFACT_CASCADE \/ ISSUE165_CAPTURE_SKIPPED_AFTER_PRIMARY_P5_FAILURE \/ NOT_INDEPENDENT_PRODUCT_FAILURE/u);
    assert.match(source, /ATOMIC_PLAYER_FACING_LOADOUT_READY_RECEIPT \+ SAME_PAGE_TASK_SINGLE_DEPLOY_DISPATCH \+ BOUNDED_POST_DISPATCH_ENTRY_EVIDENCE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /32776384366/u);
    assert.match(source, /97588303976/u);
    assert.match(source, /97591867928/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  for (const path of [
    "docs/PROJECT_STATE.md",
    "docs/design/v1.0.0/DESIGN_LOCK.md",
    "docs/design/v1.0.0/LUNA_HANDOFF.md",
    "tests/v100-design-lock.test.mjs",
    "scripts/p5-browser-smoke.mjs",
    "tests/p5-story-audio-contract.test.mjs",
  ]) assert.match(r37, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(r37, /dispatchReadyTakuyaLoadout/u);
  assert.match(r37, /p5-stage3-loadout-dispatch\/v1/u);
  assert.match(r37, /dispatchCount: 1/u);
  assert.match(r37, /aria-disabled !== "true"/u);
  assert.match(r37, /unchanged 45,000 ms P5 deadline/u);
  assert.match(r37, /never retries a click\/product action/u);
  assert.match(r37, /atomic exact six-path iteration-19 commit/u);
  assert.match(r37, /workflow-only iteration-20 commit/u);
  assert.match(r37, /The other seven r36 paths/u);
  assert.match(r37, /all `app\/\*\*`/u);
  assert.match(r37, /exact six-path topology/u);
  assert.match(r37, /one local Chromium entrance-only process containing 667x375 and 736x414, exactly 2\/2 on one attempt/u);
  assert.match(r37, /one local Chromium full battle-audio process containing the unchanged four cases, exactly 4\/4 on one attempt/u);
  assert.match(r37, /do not rerun already-green r36 local Phase G\/deployment/u);
  assert.match(r37, /High ambiguity: 0/u);
  assert.match(r37, /Medium ambiguity: 0/u);
  assert.match(r37Handoff, /Section 53/u);
  assert.match(r37Handoff, /change only `scripts\/p5-browser-smoke\.mjs` and `tests\/p5-story-audio-contract\.test\.mjs`/u);
  assert.match(r37Handoff, /unchanged 45,000 ms deadline/u);
  assert.match(r37Handoff, /no click retry\/fallback\/internal API/u);
  for (const source of [r38, r38Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_STATIC_TEST_REGEX_SYNTAX \/ TWO_UNESCAPED_LITERAL_RBRACES_UNDER_UNICODE_MODE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /TWO_LITERAL_RBRACE_ESCAPES_ONLY \+ R37_P5_DRAFT_BYTE_PRESERVATION \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r38, /Lone quantifier brackets/u);
  assert.match(r38, /110,350 bytes/u);
  assert.match(r38, /92a2ea0bef01670ea69b4c7412d9c328603ec0d9536343d31dbf9b43edd986bb/u);
  assert.match(r38, /CRLF 2,562 \/ lone LF 0/u);
  assert.ok(r38.includes("from literal `\\n}` to `\\n\\}`"));
  assert.match(r38, /No assertion, helper contract, timeout, case, product predicate, or other byte may change/u);
  assert.match(r38, /iteration 19 remains unconsumed because no commit\/push\/automatic run occurred/u);
  assert.match(r38, /High ambiguity: 0/u);
  assert.match(r38, /Medium ambiguity: 0/u);
  assert.match(r38Handoff, /Section 54/u);
  assert.match(r38Handoff, /add only two backslashes/u);
  assert.match(r38Handoff, /Preserve `scripts\/p5-browser-smoke\.mjs` exactly/u);
  for (const source of [r39, r39Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_STATIC_TEST_REGEX_BRACE_AUDIT_INCOMPLETE \/ TWO_ASSERTION_RBRACES_REMAIN_UNDER_UNICODE_MODE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /COMPLETE_NEW_BLOCK_RBRACE_ESCAPE_AUDIT \+ TWO_ASSERTION_ESCAPES_ONLY \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r39, /entire newly added test block/u);
  assert.match(r39, /Exactly two unescaped literal closing braces remain/u);
  assert.match(r39, /34,834 bytes/u);
  assert.match(r39, /23df5695ea1a7ee9d32a8232cd4dac725f5a670818ccfb5cc1ed6c78cd84b0c2/u);
  assert.match(r39, /92a2ea0bef01670ea69b4c7412d9c328603ec0d9536343d31dbf9b43edd986bb/u);
  assert.match(r39, /No lookahead, assertion meaning, regex flag, helper behavior, timeout, case, product predicate/u);
  assert.match(r39, /High ambiguity: 0/u);
  assert.match(r39, /Medium ambiguity: 0/u);
  assert.match(r39Handoff, /Section 55/u);
  assert.match(r39Handoff, /two remaining assertion-regex brace escapes/u);
  for (const source of [r40, r40Handoff]) {
    assert.match(source, /SOL_OWNED_STATIC_TEST_EOL_PORTABILITY \/ LF_ONLY_FUNCTION_BOUNDARY_REGEX_AGAINST_CRLF_SOURCE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /CRLF_OR_LF_FUNCTION_BOUNDARY_REGEX \+ SIX_OPTIONAL_CR_FRAGMENTS_ONLY \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r40, /38\/39 tests/u);
  assert.match(r40, /3,398 characters/u);
  assert.match(r40, /1,402 characters/u);
  assert.match(r40, /exactly one `deployButton\.click\(\);`/u);
  assert.match(r40, /34,836 bytes/u);
  assert.match(r40, /cef9871675243da80c07994a8231289a586d02c87c96e97cfd5f5bd8cc9ec29a/u);
  assert.match(r40, /exactly six inserted `\\r\?` fragments/u);
  assert.match(r40, /No brace escape, regex flag, assertion, helper behavior, timeout, case, product predicate/u);
  assert.match(r40, /no source normalization is added/u);
  assert.match(r40, /High ambiguity: 0/u);
  assert.match(r40, /Medium ambiguity: 0/u);
  assert.match(r40Handoff, /Section 56/u);
  assert.match(r40Handoff, /extract 3,398 \/ 1,402 characters and exactly one click/u);
  for (const source of [r41, r41Handoff]) {
    assert.match(source, /QA_HARNESS_STAGE3_BOOTSTRAP_OBSERVABILITY_GAP \/ PRE_DISPATCH_COMPOSITE_WAITFORFUNCTION_TIMEOUT \+ NO_LAST_PREDICATE_RECEIPT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /BOUNDED_STAGE3_BOOTSTRAP_TRANSITION_DIAGNOSTIC \/ ZERO_LOADOUT_ACTION \+ CHANGE_ONLY_HISTORY \+ EXACT_TIMEOUT_RECEIPT \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_DESIGN \/ LOCAL_DIAGNOSTIC`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r41, /first r40 Chromium entrance-only process/u);
  assert.match(r41, /0\/2/u);
  assert.match(r41, /zero loadout\/deploy clicks/u);
  assert.match(r41, /p5-stage3-bootstrap-observation\/v1/u);
  assert.match(r41, /capped at 64 transitions/u);
  assert.match(r41, /every 50 ms/u);
  assert.match(r41, /at most 45,000 ms/u);
  assert.match(r41, /fb93cccd8b4ce04d061d4c63fd71f6ed0297e1f3957a65b8747574629432c8ef/u);
  assert.match(r41, /High ambiguity: 0/u);
  assert.match(r41, /Medium ambiguity: 0/u);
  assert.match(r41Handoff, /Section 57/u);
  assert.match(r41Handoff, /NO ACTIVE LUNA HANDOFF/u);
  for (const source of [r42, r42Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_STAGE3_ASSET_SCOPE_MISMATCH \/ P5_LEGACY_QA_ROUTE_TRIGGERS_EXHAUSTIVE_55_PATH_74MB_NON_STAGE3_DECODE_SET \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /P5_LOCALHOST_FINITE_REQUIRED_ASSET_ROUTE \/ EXISTING_QA_HUD_FINITE_SWITCH \+ EXACT_FINITE_RESIDENT_SCOPE \+ UNCHANGED_STRICT_DECODE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  for (const source of [r42, r42Handoff, projectState, currentCursor]) {
    assert.match(source, /Actual r42 local acceptance/u);
    assert.match(source, /focused 39\/39/u);
    assert.match(source, /full 1,196\/1,196/u);
    assert.match(source, /entrance 2\/2/u);
    assert.match(source, /full 4\/4/u);
    assert.match(source, /total 29/u);
    assert.match(source, /dispatchCount: 1/u);
  }
  assert.match(r42, /58 unnormalized jobs/u);
  assert.match(r42, /55 unique paths/u);
  assert.match(r42, /74,002,181 repository bytes/u);
  assert.match(r42, /32 jobs \/ 29 unique required paths/u);
  assert.match(r42, /55\/55/u);
  assert.match(r42, /qaHudFiniteAssets=1/u);
  assert.match(r42, /finite-hud-runtime-qa/u);
  assert.match(r42, /one fresh local Chromium entrance-only process/u);
  assert.match(r42, /exactly 2\/2 on one attempt/u);
  assert.match(r42, /exactly 4\/4 on one attempt/u);
  assert.match(r42, /High ambiguity: 0/u);
  assert.match(r42, /Medium ambiguity: 0/u);
  for (const source of [r43, r43Handoff]) {
    assert.match(source, /SOL_OWNED_CURRENT_CURSOR_ASSERTION_PLACEMENT \/ PROJECT_STATE_ACCEPTANCE_READBACK_OUTSIDE_SECTION6_EXTRACTION \/ REMEDIATION_LOCAL/u);
    assert.match(source, /CURRENT_CURSOR_READBACK_RELOCATION \/ ONE_EXISTING_LINE_MOVE \+ NO_RUNTIME_RERUN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_DESIGN`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r43, /focused source suite, 38\/39/u);
  assert.match(r43, /move the existing `Actual r42 local acceptance` bullet/u);
  assert.match(r43, /Do not rerun either r42 Chromium process/u);
  assert.match(r43, /High ambiguity: 0/u);
  assert.match(r43, /Medium ambiguity: 0/u);
  for (const source of [r44, r44Handoff]) {
    assert.match(source, /SOL_OWNED_ACTIVE_HANDOFF_RELEASE_TAIL_LITERAL_OMISSION \/ SECTION52_LACKS_FINAL_PRODUCER_CHECKPOINT_TOKEN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /ACTIVE_HANDOFF_RELEASE_TAIL_LITERAL_CLOSURE \/ SOL_FINAL_REVIEW \+ ONE_FINAL_PRODUCER_CHECKPOINT_SENTENCE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_DESIGN`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r44, /first r43 focused source suite, 38\/39/u);
  assert.match(r44, /Handoff Section 52/u);
  assert.match(r44, /do not rerun the already-green r42 Chromium processes/u);
  assert.match(r44, /High ambiguity: 0/u);
  assert.match(r44, /Medium ambiguity: 0/u);
  for (const source of [r45, r45Handoff]) {
    assert.match(source, /SOL_OWNED_CASE_SENSITIVE_ASSERTION_MISMATCH \/ LOWERCASE_DESIGN_LITERAL_VS_UPPERCASE_TEST_EXPECTATION \/ REMEDIATION_LOCAL/u);
    assert.match(source, /ONE_CHARACTER_ASSERTION_CASE_ALIGNMENT \/ CAPITAL_D_TO_LOWERCASE_D \+ NO_RUNTIME_RERUN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_DESIGN`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r45, /first r44 focused source suite 38\/39/u);
  assert.match(r45, /Change only that one `D` to `d`/u);
  assert.match(r45, /High ambiguity: 0/u);
  assert.match(r45, /Medium ambiguity: 0/u);
  for (const source of [r46, r46Handoff]) {
    assert.match(source, /SOL_OWNED_DESIGN_RELEASE_TAIL_LITERAL_OMISSION \/ R45_SECTION_LACKS_SOL_FINAL_REVIEW_TOKEN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /HISTORICAL_SECTION_RELEASE_TOKEN_NORMALIZATION \/ FIXED_REVIEW_TO_FIXED_HEAD_SOL_FINAL_REVIEW \+ NO_RUNTIME_RERUN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /NEXT_OWNER`: `SOL_REMEDIATION`/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r46, /r45 suite stopped at 38\/39/u);
  assert.match(r46, /complete final-loop source list/u);
  assert.match(r46, /Actual r46 source\/static acceptance/u);
  assert.match(r46, /focused 39\/39/u);
  assert.match(r46, /full 1,196\/1,196/u);
  assert.match(r46, /High ambiguity: 0/u);
  assert.match(r46, /Medium ambiguity: 0/u);
  for (const historicalProjectContract of [
    /SOL_OWNED_CURRENT_CURSOR_ASSERTION_PLACEMENT \/ PROJECT_STATE_ACCEPTANCE_READBACK_OUTSIDE_SECTION6_EXTRACTION \/ REMEDIATION_LOCAL/u,
    /SOL_OWNED_ACTIVE_HANDOFF_RELEASE_TAIL_LITERAL_OMISSION \/ SECTION52_LACKS_FINAL_PRODUCER_CHECKPOINT_TOKEN \/ REMEDIATION_LOCAL/u,
    /SOL_OWNED_CASE_SENSITIVE_ASSERTION_MISMATCH \/ LOWERCASE_DESIGN_LITERAL_VS_UPPERCASE_TEST_EXPECTATION \/ REMEDIATION_LOCAL/u,
    /SOL_OWNED_DESIGN_RELEASE_TAIL_LITERAL_OMISSION \/ R45_SECTION_LACKS_SOL_FINAL_REVIEW_TOKEN \/ REMEDIATION_LOCAL/u,
  ]) assert.match(projectState, historicalProjectContract);
  for (const source of [r47, r47Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_HISTORICAL_OWNER_CURRENT_STATE_ALIAS \/ R43_R46_HISTORY_LOOPS_INCLUDE_MUTABLE_PROJECT_STATE_NEXT_OWNER \/ REMEDIATION_LOCAL/u);
    assert.match(source, /HISTORICAL_CURRENT_ASSERTION_SEPARATION \/ DESIGN_HANDOFF_HISTORY_ONLY \+ PROJECT_CURRENT_CURSOR_ONLY \+ OWNER_COHERENCE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  assert.match(r47, /first terminal-cursor r46 focused result/u);
  assert.match(r47, /remove `projectState` only from the r43, r44, r45, and r46 historical owner loops/u);
  assert.match(r47, /High ambiguity: 0/u);
  assert.match(r47, /Medium ambiguity: 0/u);
  assert.match(r47Handoff, /Section 63/u);
  assert.match(r47Handoff, /NO ACTIVE LUNA HANDOFF/u);
  for (const source of [r48, r48Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_HISTORICAL_FAILURE_ASSERTION_STABILITY \/ R46_TERMINAL_READBACK_REPLACED_FAILED_GATE_LITERAL \/ REMEDIATION_LOCAL/u);
    assert.match(source, /IMMUTABLE_NARRATIVE_ASSERTION_BINDING \/ R45_SUITE_STOPPED_38_OF_39 \+ NO_RUNTIME_RERUN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /246d2cce8086a14ff8a5139f0eded45376aea822/u);
    assert.match(source, /b01ae916859559136f96ad035a316c654c0a2a0b/u);
    assert.match(source, /iteration 19/u);
    assert.match(source, /iteration 20/u);
  }
  for (const source of [r49, r49Handoff, projectState]) {
    assert.match(source, /QA_PRESENTATION_TRANSPORT_BACKPRESSURE \/ CONTINUOUS_HEADLESS_WEBKIT_CANVAS_COMPOSITING \+ ANON_PIPE_WRITE_D_STATE \+ CLEAN_WEBCONTENT_TERMINATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /LOCALHOST_QA_PRESENTATION_QUIESCENCE \/ SIMULATION_CONTINUES \+ EXACT_SEMANTIC_BOUNDARY \+ THREE_VISIBLE_PRODUCTION_FRAMES_BEFORE_ACCEPTANCE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 20/u);
    assert.match(source, /iteration 21/u);
  }
  for (const source of [r50, r50Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_OPTIONAL_BOUNDARY_NULL_COERCION \/ NUMBER_NULL_TO_ZERO_ACTIVATES_STAGE6_ONLY_PATH_ON_STAGE24 \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /SINGLE_NORMALIZED_OPTIONAL_BOUNDARY \/ NULL_OR_UNDEFINED_NOT_REQUIRED \+ PRESENT_VALUE_POSITIVE_FINITE_OR_HARD_FAIL \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 21/u);
    assert.match(source, /iteration 22/u);
  }
  for (const source of [r51, r51Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_CONTACT_FIRST_DEADLINE_OWNERSHIP_GAP \/ ATTACK_TIMER_STARTS_37_770MS_BEFORE_LIVE_TARGET \+ MONOTONIC_CHECKPOINT_RELOG_AMPLIFICATION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /TWO_PHASE_CONTACT_FIRST_PROOF_LIFECYCLE \/ LIVE_TARGET_45S_THEN_AUTHORED_ATTACK_45S \+ MARK_ONCE_CHECKPOINTS \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r52, r52Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_SOURCE_ASSERTION_SCOPE_ALIAS \/ R26_GLOBAL_CONTACT_STATE_COUNT_INCLUDES_R51_FINAL_PROOF_REGION \/ REMEDIATION_LOCAL/u);
    assert.match(source, /REGION_SCOPED_CONTACT_ASSERTION \/ BOSS_DEPLOYMENT_LIVE_ONLY_2_AND_HISTORY_0 \+ R51_FINAL_PROOF_OWN_ASSERTIONS \/ REMEDIATION_LOCAL/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r53, r53Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_QUIESCENCE_SEMANTIC_BOUNDARY_ORDERING_ALIAS \/ FIRST_FRAME_DOM_BANNER_STALE_UNDER_RENDER_SUPPRESSION \+ CHECKPOINT_ARM_HIDDEN_BEHIND_UNPAUSED_PRECONDITION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /INTERNAL_STATE_FIRST_FRAME_READBACK \+ ATOMIC_CHECKPOINT_ARM_THEN_QUIESCENCE \/ PRODUCTION_SNAPSHOT_BANNER \+ SAME_PAGE_TASK_PRECONDITION_TRANSITION \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r54, r54Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_SOURCE_NEGATIVE_SCOPE_ALIAS \/ R6_GLOBAL_CHECKPOINTARM_TOKEN_FORBIDS_R53_EXACT_PRECONDITION_RECEIPT \/ REMEDIATION_LOCAL/u);
    assert.match(source, /EXACT_FORBIDDEN_SERIALIZATION_ONLY \/ KEEP_RAW_EVIDENCE_RECEIPT_AND_DIAGNOSTIC_BANS \+ R53_POSITIVE_ATOMIC_ARM_ASSERTIONS \/ REMEDIATION_LOCAL/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r55, r55Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_SOURCE_LITERAL_HYPHENATION_MISMATCH \/ R53_CANONICAL_SAME_PAGE_TASK_TOKEN_REJECTED_BY_UNHYPHENATED_TEST_LITERAL \/ REMEDIATION_LOCAL/u);
    assert.match(source, /CANONICAL_LITERAL_ASSERTION_ALIGNMENT \/ SAME_PAGE_TASK_TOKEN_OR_HYPHENATED_NARRATIVE \+ NO_RUNTIME_CHANGE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r56, r56Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_ACCEPTANCE_CARDINALITY_DRIFT \/ ACTIVE_6_UNIT_36_CHECKPOINT_CURSOR_CONTRADICTS_CANONICAL_8_UNIT_48_CHECKPOINT_RUNNER \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /CANONICAL_DEPLOYMENT_INVENTORY_ALIGNMENT \/ EXACT_8_KIND_LIST \+ 48_CHECKPOINTS_PER_VIEWPORT \+ NO_RUNTIME_BYTE_CHANGE \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r57, r57Handoff, projectState]) {
    assert.match(source, /QA_HARNESS_POST_RESTORATION_READBACK_GAP \/ QUIESCED_FIGHTER_SNAPSHOT_RETAINED_NULL_RENDER_AUDIT_AFTER_THREE_RESTORED_PRODUCTION_FRAMES \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /POST_RESTORATION_PRODUCTION_SNAPSHOT_REFRESH \/ EXACT_FROZEN_FIGHTER_AND_CHECKPOINT_CONTINUITY \+ OPAQUE_RENDER_AUDIT_READBACK \/ DESIGN_CHANGE_REQUIRED/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r58, r58Handoff, projectState]) {
    assert.match(source, /SOL_OWNED_PROJECT_STATE_HISTORY_GAP \/ R57_PROMOTION_REPLACED_ACTIVE_R56_CURSOR_WITHOUT_PRESERVING_R56_CLASSIFICATION_RECORD \/ REMEDIATION_LOCAL/u);
    assert.match(source, /R56_HISTORICAL_CURSOR_PRESERVATION \/ ADD_EXACT_R56_CLASSIFICATION_AND_REMEDIATION_TO_PROJECT_STATE \+ NO_RUNTIME_CHANGE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  for (const source of [r59, activeHandoff, projectState, currentCursor]) {
    assert.match(source, /SOL_OWNED_RELEASE_ROUTE_LITERAL_OMISSION \/ R58_CURRENT_SECTION_USED_GENERIC_FIXED_HEAD_FINAL_REVIEW_WITHOUT_CANONICAL_SOL_FINAL_REVIEW_TOKEN \/ REMEDIATION_LOCAL/u);
    assert.match(source, /CANONICAL_RELEASE_ROUTE_TOKEN_RESTORATION \/ ADD_EXACT_SOL_FINAL_REVIEW_LITERAL \+ NO_RUNTIME_CHANGE \/ REMEDIATION_LOCAL/u);
    assert.match(source, /6526437a566caeebcc89af3149a9564aba5bc006/u);
    assert.match(source, /9fc1b6f8a8fdf01eab9e1011a2db8311c39a3b33/u);
    assert.match(source, /iteration 22/u);
    assert.match(source, /iteration 23/u);
  }
  const currentOwners = [r59, activeHandoff, currentCursor].map((source) => source.match(/NEXT_OWNER`: `(SOL_DESIGN|SOL_REMEDIATION)`/u)?.[1] ?? "");
  assert.equal(new Set(currentOwners).size, 1);
  assert.match(currentOwners[0], /^SOL_(?:DESIGN|REMEDIATION)$/u);
  assert.match(r48, /first r47 focused result/u);
  assert.match(r48, /Change only that one r46 assertion/u);
  assert.match(r48, /High ambiguity: 0/u);
  assert.match(r48, /Medium ambiguity: 0/u);
  assert.match(r48Handoff, /Section 64/u);
  assert.match(r48Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r49, /Automatic CI run `32786876867` is terminal failure/u);
  assert.match(r49, /artifact `9542291513`/u);
  assert.match(r49, /artifact `9542607225`/u);
  assert.match(r49, /artifact `9542748916`/u);
  assert.match(r49, /exact r49 material topology relative to r48 is nine paths/u);
  assert.match(r49, /v100-qa-presentation-quiescence\/v1/u);
  assert.match(r49, /three fresh local WebKit Stage 6 standalone processes/u);
  assert.match(r49, /all six canonical units and all 36 checkpoints per viewport/u);
  assert.match(r49, /High ambiguity: 0/u);
  assert.match(r49, /Medium ambiguity: 0/u);
  assert.match(r49Handoff, /Section 65/u);
  assert.match(r49Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r50, /first r49 ordered local process/u);
  assert.match(r50, /presentationQuiescenceUntilBattleTime: null/u);
  assert.match(r50, /Number\(null\).*zero/u);
  assert.match(r50, /normalizePhaseGPresentationQuiescenceBoundary/u);
  assert.match(r50, /three r49 Stage 6 standalone processes/u);
  assert.match(r50, /one fresh ordered WebKit Stage 6 -> 24 -> 25 process/u);
  assert.match(r50, /High ambiguity: 0/u);
  assert.match(r50, /Medium ambiguity: 0/u);
  assert.match(r50Handoff, /Section 66/u);
  assert.match(r50Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r51, /first and only r50 ordered process/u);
  assert.match(r51, /37,770 ms/u);
  assert.match(r51, /1,454 mounted-checkpoint marks, 1,453 duplicates/u);
  assert.match(r51, /proof-actor-live-human-target/u);
  assert.match(r51, /proof-actor-attack/u);
  assert.match(r51, /three fresh independent Stage 25 standalone WebKit processes/u);
  assert.match(r51, /one fresh ordered WebKit Stage 6 -> Stage 24 -> Stage 25 process/u);
  assert.match(r51, /High ambiguity: 0/u);
  assert.match(r51, /Medium ambiguity: 0/u);
  assert.match(r51Handoff, /Section 67/u);
  assert.match(r51Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r52, /first r51 source attempt/u);
  assert.match(r52, /239,016 bytes/u);
  assert.match(r52, /6bd9c298437ae7b2d777b18baeafa6b9cff55b994e4a26000804dee1aa50eb9f/u);
  assert.match(r52, /11 pass \/ 1 fail/u);
  assert.match(r52, /exactly two `contactState\?\.hasLiveHumanTarget === true` occurrences/u);
  assert.match(r52, /zero `contactState\?\.hasHumanTarget === true` occurrences/u);
  assert.match(r52, /High ambiguity: 0/u);
  assert.match(r52, /Medium ambiguity: 0/u);
  assert.match(r52Handoff, /Section 68/u);
  assert.match(r52Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r53, /first r52 deployment process/u);
  assert.match(r53, /160 samples/u);
  assert.match(r53, /144,418 bytes/u);
  assert.match(r53, /b6eabfb431a899e84e1cac2ba42d91551d1c7ffcafaf53b743f85b956ac1e145/u);
  assert.match(r53, /same-page-task|SAME_PAGE_TASK/u);
  assert.match(r53, /fresh bounded WebKit deployment 736x414 process/u);
  assert.match(r53, /High ambiguity: 0/u);
  assert.match(r53, /Medium ambiguity: 0/u);
  assert.match(r53Handoff, /Section 69/u);
  assert.match(r53Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r54, /first r53 source test/u);
  assert.match(r54, /2 pass \/ 1 fail/u);
  assert.match(r54, /144,418 bytes/u);
  assert.match(r54, /b6eabfb431a899e84e1cac2ba42d91551d1c7ffcafaf53b743f85b956ac1e145/u);
  assert.match(r54, /remove the bare `checkpointArm` alternative/u);
  assert.match(r54, /High ambiguity: 0/u);
  assert.match(r54, /Medium ambiguity: 0/u);
  assert.match(r54Handoff, /Section 70/u);
  assert.match(r54Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r55, /first r54 Design Lock test/u);
  assert.match(r55, /18 pass \/ 1 fail/u);
  assert.match(r55, /same-page-task/u);
  assert.match(r55, /SAME_PAGE_TASK/u);
  assert.match(r55, /High ambiguity: 0/u);
  assert.match(r55, /Medium ambiguity: 0/u);
  assert.match(r55Handoff, /Section 71/u);
  assert.match(r56Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r56, /post-r55 SOURCE\/EXECUTION audit/u);
  assert.match(r56, /`scout`, `ranger`, `brawler`, `crazy-king`, `kumaverson`, `mayo-chan`, `brute`, `medic`/u);
  assert.match(r56, /eight units \/ 48 checkpoints/u);
  assert.match(r56, /736x414 all 8\/48/u);
  assert.match(r56, /844x340 all 8\/48/u);
  assert.match(r56, /844x390 all 8\/48/u);
  assert.match(r56, /High ambiguity: 0/u);
  assert.match(r56, /Medium ambiguity: 0/u);
  assert.match(r56Handoff, /Section 72/u);
  assert.match(r57, /first and only r56 WebKit 736x414 deployment process/u);
  assert.match(r57, /actual same-attempt evidence disproves product translucency/u);
  assert.match(r57, /renderAudit: null/u);
  assert.match(r57, /three restored production frames/u);
  assert.match(r57, /one lightweight `getCrawlerDeploymentProofSnapshot\(\{ fighterId \}\)`/u);
  assert.match(r57, /must not call `auditFighterUnitLayer`/u);
  assert.match(r57, /same fighter ID, kind, x, y/u);
  assert.match(r57, /fresh r57 bounded WebKit processes/u);
  assert.match(r57, /736x414 all 8\/48/u);
  assert.match(r57, /844x340 all 8\/48/u);
  assert.match(r57, /844x390 all 8\/48/u);
  assert.match(r57, /High ambiguity: 0/u);
  assert.match(r57, /Medium ambiguity: 0/u);
  assert.match(r57Handoff, /Section 73/u);
  assert.match(r57Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r58, /first r57 Design Lock test/u);
  assert.match(r58, /18 pass \/ 1 fail/u);
  assert.match(r58, /149,470 bytes/u);
  assert.match(r58, /815be0ea928655577bbb339b78bb310462ea789db2b8be1688f50a1d50e1c83b/u);
  assert.match(r58, /37,450 bytes/u);
  assert.match(r58, /64af1ed34cea7641dcffbd250fa06c7c0d26e77abf3035b556813c9db4b7be20/u);
  assert.match(r58, /Retain the failing r56 historical assertion unchanged/u);
  assert.match(r58, /High ambiguity: 0/u);
  assert.match(r58, /Medium ambiguity: 0/u);
  assert.match(r58Handoff, /Section 74/u);
  assert.match(r58Handoff, /NO ACTIVE LUNA HANDOFF/u);
  assert.match(r59, /first r58 Design Lock test/u);
  assert.match(r59, /18 pass \/ 1 fail/u);
  assert.match(r59, /exact canonical token `SOL_FINAL_REVIEW`/u);
  assert.match(r59, /Retain the existing global assertion requiring `SOL_FINAL_REVIEW`/u);
  assert.match(r59, /High ambiguity: 0/u);
  assert.match(r59, /Medium ambiguity: 0/u);
  assert.match(activeHandoff, /Section 75/u);
  assert.match(activeHandoff, /NO ACTIVE LUNA HANDOFF/u);
  const canonicalKindsRegion = boundedDeploymentRunner.match(/export const CANONICAL_DEPLOYMENT_KINDS = Object\.freeze\(\[([\s\S]+?)\]\);/u)?.[1] ?? "";
  assert.deepEqual(
    [...canonicalKindsRegion.matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    ["scout", "ranger", "brawler", "crazy-king", "kumaverson", "mayo-chan", "brute", "medic"],
  );
  assert.match(currentCursor, /R36_REMOTE_PR_VERIFY_P5_ENTRANCE_DISPATCH_FAILURE_COUNT`: `1` job \/ `2` of four P5 cases/u);
  assert.match(currentCursor, /R36_REMOTE_PHASE_G_DEPENDENCY_SKIPPED_COUNT`: `1`/u);
  assert.match(currentCursor, /SAME_GATE_REPEAT_COUNT`: `10`/u);
  assert.match(currentCursor, /R48_REMOTE_PHASE_G_PRESENTATION_TERMINATION_COUNT`: `1`/u);
  assert.match(currentCursor, /R48_REMOTE_DEPLOYMENT_PRESENTATION_TERMINATION_COUNT`: `2` of six viewports/u);
  assert.match(currentCursor, /R48_REMOTE_DEPLOYMENT_GREEN_COUNT`: `4` of six viewports/u);
  assert.match(currentCursor, /R48_REMOTE_TERMINAL_WPE_D_STATE_SAMPLE_COUNT`: `50`/u);
  assert.match(currentCursor, /R49_LOCAL_STAGE6_STANDALONE_GREEN_COUNT`: `3` of 3 first attempts/u);
  assert.match(currentCursor, /R49_LOCAL_ORDERED_STAGE6_GREEN_COUNT`: `1` at ordered position 1/u);
  assert.match(currentCursor, /R49_LOCAL_ORDERED_OPTIONAL_BOUNDARY_FAILURE_COUNT`: `1` at Stage 24 ordered position 2/u);
  assert.match(currentCursor, /R50_LOCAL_ORDERED_STAGE6_GREEN_COUNT`: `1` at ordered position 1/u);
  assert.match(currentCursor, /R50_LOCAL_ORDERED_STAGE24_GREEN_COUNT`: `1` at ordered position 2/u);
  assert.match(currentCursor, /R50_LOCAL_STAGE25_CONTACT_FIRST_FAILURE_COUNT`: `1` at ordered position 3/u);
  assert.match(currentCursor, /R50_STAGE25_TARGET_PREREQUISITE_DELAY_MS`: `37770`/u);
  assert.match(currentCursor, /R50_STAGE25_MOUNTED_CHECKPOINT_DUPLICATE_COUNT`: `1453`/u);
  assert.match(currentCursor, /R51_LOCAL_PHASE_G_SOURCE_PASS_COUNT`: `11` of 12/u);
  assert.match(currentCursor, /R51_LOCAL_PHASE_G_SOURCE_SCOPE_ALIAS_FAILURE_COUNT`: `1`/u);
  assert.match(currentCursor, /R52_LOCAL_STAGE25_STANDALONE_GREEN_COUNT`: `3` of 3 first attempts/u);
  assert.match(currentCursor, /R52_LOCAL_ORDERED_PHASE_G_GREEN_COUNT`: `3` of 3 stages on the first ordered attempt/u);
  assert.match(currentCursor, /R52_LOCAL_DEPLOYMENT_FIRST_FRAME_READBACK_FAILURE_COUNT`: `1` at WebKit 736x414 \/ scout/u);
  assert.match(currentCursor, /R56_LOCAL_SOURCE_FULL_STATIC_GREEN_COUNT`: `1`/u);
  assert.match(currentCursor, /R56_LOCAL_DEPLOYMENT_POST_RESTORATION_READBACK_FAILURE_COUNT`: `1` at WebKit 736x414 \/ scout \/ fully-inside/u);
  assert.match(currentCursor, /DEFERRED_STAGE24_REPEAT_COUNT`: `4`/u);
  assert.match(currentCursor, /R29_REMOTE_STAGE24_NATIVE_TERMINATION_COUNT`: `1`/u);
  assert.match(currentCursor, /R29_PWA_DERIVATIVE_DRIFT_COUNT`: `6` exact motion paths/u);
  assert.match(currentCursor, /R30_LOCAL_EXECUTION_CONTRACT_OMISSION_COUNT`: `1`/u);
  assert.match(currentCursor, /R30_LOCAL_CORE_CAUSAL_REACTION_HISTORY_GAP_COUNT`: `1`/u);
  assert.match(currentCursor, /R31_LOCAL_CORE_OBSERVER_LIFETIME_GAP_COUNT`: `1`/u);
  assert.match(currentCursor, /R32_LOCAL_CAUSAL_REACTION_IDENTITY_FAIL_OPEN_COUNT`: `1`/u);
  assert.match(currentCursor, /R33_REMOTE_RELEASE_PREP_SIZE_SNAPSHOT_FAILURE_COUNT`: `1` job／`3` assertions/u);
  assert.match(currentCursor, /R33_REMOTE_STAGE3_TARGET_CLOSED_COUNT`: `1` job／`2` existing bounded attempts/u);
  assert.match(currentCursor, /R33_REMOTE_DEPLOYMENT_WEBCONTENT_TERMINATION_COUNT`: `2` of six viewports/u);
  assert.match(currentCursor, /R33_REMOTE_DEPLOYMENT_GREEN_COUNT`: `4` of six viewports/u);
  assert.match(currentCursor, /R33_REMOTE_CANONICAL_HUD_DEPENDENCY_SKIPPED_COUNT`: `1` aggregate matrix／`48` cases unexecuted/u);
  assert.match(currentCursor, /R34_REMOTE_HOSTED_WEBCONTENT_TERMINATION_COUNT`: `1`/u);
  assert.match(currentCursor, /R34_REMOTE_PHASE_G_STAGE6_WEBCONTENT_TERMINATION_COUNT`: `1`/u);
  assert.match(currentCursor, /R34_REMOTE_DEPLOYMENT_WEBCONTENT_TERMINATION_COUNT`: `4` of six viewports/u);
  assert.match(currentCursor, /R34_REMOTE_DEPLOYMENT_GREEN_COUNT`: `2` of six viewports/u);
  assert.match(currentCursor, /R34_REMOTE_WPE_D_STATE_SAMPLE_COUNT`: `87` across six terminal axes；`0` across 26 green deployment unit controls/u);
  assert.match(currentCursor, /R34_REMOTE_STAGE3_DEPENDENCY_SKIPPED_COUNT`: `1` aggregate／`3` cases unexecuted/u);
  assert.match(currentCursor, /R34_REMOTE_CANONICAL_HUD_DEPENDENCY_SKIPPED_COUNT`: `1` aggregate matrix／`48` cases unexecuted/u);
  assert.match(currentCursor, /R24_REMOTE_DEPLOYMENT_CLEAN_CRASH_COUNT`: `2`/u);
  assert.match(currentCursor, /R26_REMOTE_DEPLOYMENT_CLEAN_CRASH_COUNT`: `2`/u);
  assert.match(currentCursor, /R26_REMOTE_STAGE24_CLEAN_CRASH_COUNT`: `1`/u);
  assert.match(currentCursor, /R25_LOCAL_STAGE25_PROOF_ATTACK_REPEAT_COUNT`: `1`/u);

  for (const source of [r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31, r32, r33, r34, r35, r36, r37, r38, r39, r40, r41, r42, r43, r44, r45, r46, r47, r48, r49, r50, r51, r52, r53, r54, r55, r56, r57, r58, r59, activeHandoff, currentCursor]) {
    assert.match(source, /FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT|one final Producer checkpoint/u);
    assert.match(source, /SOL_FINAL_REVIEW/u);
  }
  assert.doesNotMatch(currentProcess, /-> LUNA_IMPLEMENTATION|`PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`|`PRODUCER_FINAL_ACCEPTANCE`/u);
  assert.doesNotMatch(currentCursor, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.doesNotMatch(activeHandoff, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
});

test("campaign contract has exactly 30 ordered, unique stages", async () => {
  const design = await readFile(DESIGN, "utf8");
  const campaignSection = design.match(/## 4\. Campaign and mission contract([\s\S]+?)### Acceptance criteria/u)?.[1] ?? "";
  const rows = [...campaignSection.matchAll(/^\|\s+(\d+)\s+\|\s+([^|]+)\|\s+([^|]+)\|/gmu)]
    .map((match) => ({ number: Number(match[1]), name: match[2].trim(), mission: match[3].trim() }));
  const stageRows = rows.filter(({ number }) => number >= 1 && number <= 30);
  assert.equal(stageRows.length, 30);
  assert.deepEqual(stageRows.map(({ number }) => number), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(new Set(stageRows.map(({ name }) => name)).size, 30);
  assert.match(stageRows[2].name, /TAKUYA/u);
  assert.match(stageRows[29].mission, /TAKUYA-Ω boss; no hard timer/u);
});

test("economy, levels, vehicle, support, and boss values are fixed", async () => {
  const design = await readFile(DESIGN, "utf8");
  assert.match(design, /exactly 9,000 CAPS/u);
  assert.match(design, /approximately 7,875 CAPS/u);
  assert.match(design, /legacy release gift of 180 CAPS exactly once/u);
  assert.match(design, /`10,12,14,16,18,20,22,24,26,30,34,38,42,46,52,58,64,70,76,84,92,100,108,116,126,138,150,162,174`/u);
  assert.match(design, /Base vehicle HP: 680/u);
  assert.match(design, /maximum 1,080/u);
  assert.match(design, /120, 180, 260, 360, 480 CAPS/u);
  assert.match(design, /\| TAKUYA-Ω \| 9200 \| 56 \| 1\.35 s \| 75%, 45%, 20% \| 2 add waves \| 85 \|/u);
  assert.match(design, /\| mutated president \| 6200 \| 44 \| 1\.20 s \| 70%, 35% \| four-arm form \| 80 \|/u);
});

test("supports unlock at exact non-entry transitions and vehicle abilities stay separate", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  const expected = [
    ["回復支援", "support-healing", "v100:s02:support-healing:unlock", 50, 50, 25],
    ["爆薬ドラム缶", "support-explosive-drum", "v100:s06:support-explosive-drum:unlock", 40, 40, 20],
    ["火炎ドラム缶", "support-incendiary-drum", "v100:s09:support-incendiary-drum:unlock", 55, 55, 28],
  ];
  for (const [label, id, receipt, unlockCost, battleCost, cooldown] of expected) {
    const row = `\\| ${label} \\| ` + "`" + id + "`" + ` \\| Stage (?:2|6|9) first clear: ` + "`" + receipt + "`" + ` \\| ${unlockCost} CAPS \\| ${battleCost} \\| ${cooldown} s \\|`;
    assert.match(design, new RegExp(row, "u"));
  }
  assert.match(design, /Exactly one player-facing support is equipped before sortie/u);
  assert.match(design, /Stage 2, 6, and 9 are the exact unlock stages/u);
  assert.match(design, /\| 一斉砲撃 \| `vehicle-barrage` \| 70 \| 38 s \|/u);
  assert.match(design, /\| 航空支援 \| `vehicle-airstrike` \| 85 \| 50 s \|/u);
  assert.match(handoff, /three-support one-of-three loadout/u);
  assert.match(handoff, /barrage\/airstrike abilities/u);
});

test("all nine Story bosses own spoiler-safe receipts, mode gates, rewards, counts, and replay", async () => {
  const design = await readFile(DESIGN, "utf8");
  const bosses = [
    [3, "boss-takuya", 110, 20],
    [5, "boss-gate-eater", 130, 25],
    [11, "boss-mother", 190, 40],
    [14, "boss-ooguchi", 220, 45],
    [17, "boss-kurome", 250, 50],
    [20, "boss-gairen", 280, 55],
    [24, "boss-futago", 320, 65],
    [25, "boss-mugarian-president-mutated", 330, 65],
    [30, "boss-takuya-omega", 380, 75],
  ];
  for (const [stage, bossId, first, repeat] of bosses) {
    const padded = String(stage).padStart(2, "0");
    const tick = "`";
    const row = `\\| ${stage} \\| [^|]+ / ${tick}${bossId}${tick} \\| ${tick}v100:s${padded}:${bossId}:first-defeat${tick} \\| ${tick}compendium:${bossId}${tick} \\| ${tick}outbreak:${bossId}${tick} \\| ${tick}survival:${bossId}${tick} \\| ${first} / ${repeat} \\|`;
    assert.match(design, new RegExp(row, "u"));
  }
  assert.match(design, /bossDefeatCount\.<bossId>/u);
  assert.match(design, /enables Story replay/u);
  assert.match(design, /Before that receipt,[\s\S]*must omit the boss without leaving a spoiler-shaped locked slot/u);
  assert.match(design, /TAKUYA and TAKUYA-Ω are separate IDs, identities, counters, receipts, discoveries, and mode entries/u);
  assert.match(design, /`boss-kurome-prototype` remains reference-only/u);
});

test("Version 1.0.0 is a separate zero-CAPS campaign and legacy data is non-destructive eligibility only", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /primary storage namespace is `nishijin-campaign-v100`/u);
  assert.match(design, /campaignGeneration: "v100-new-campaign-1"/u);
  assert.match(design, /Stage 1 only,[\s\S]*\*\*0 CAPS\*\*/u);
  assert.match(design, /`nishijin-campaign-v1`[\s\S]*remain byte-preserved legacy data/u);
  assert.match(design, /Automatic transfer is forbidden for Stage completion, stars, owned\/discovered\/recruitable units, CAPS\/supplies/u);
  assert.match(design, /`bgmEnabled`, `sfxEnabled`, `bgmVolume`, `sfxVolume`, `reducedMotion`, `battleEventMode`, `graphicsQuality`, and `autoSkipReadStory`/u);
  assert.match(design, /v100:release-gift:legacy-180:v1/u);
  assert.match(design, /v100:release-gift:legacy-180:popup:v1/u);
  assert.match(design, /付与CAPS: 180/u);
  assert.match(design, /新しいCAPS残高/u);
  assert.match(design, /IndexedDB unique-key transaction/u);
  assert.match(design, /multiple tabs/u);
  assert.doesNotMatch(handoff, /additive, idempotent 1\.0\.0 save migration/u);
  assert.match(handoff, /Do not add an additive migration/u);
});

test("PWA first install is commit-gated and updates retain a rollback generation", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /first standalone\/PWA install/u);
  assert.match(design, /complete required-runtime manifest is downloaded, byte-size and content-hash verified, stored, and acknowledged by a durable manifest commit/u);
  assert.match(design, /network requests for required runtime assets are exactly zero/u);
  assert.match(design, /downloads only changed or missing hashes/u);
  assert.match(design, /previous committed generation and its manifest remain intact for rollback/u);
  assert.match(handoff, /Gate first standalone\/PWA gameplay/u);
  assert.match(handoff, /zero required-runtime fetches after gameplay begins/u);
});

test("latest Producer identity corrections remain explicit and non-negotiable", async () => {
  const [design, inventory, handoff] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(INVENTORY, "utf8"),
    readFile(HANDOFF, "utf8"),
  ]);
  for (const source of [design, inventory, handoff]) {
    assert.match(source, /exactly four/u);
    assert.match(source, /no orange/u);
    assert.match(source, /minor human/u);
  }
  assert.match(inventory, /mugarian-president-mutated-identity-master-r4\.png/u);
  assert.match(inventory, /r3\.png` — coherent two-arm form but superseded/u);
  assert.match(design, /private photos are never committed or distributed/u);
  assert.match(design, /simple, featureless, gender-neutral and age-neutral human silhouette/u);
  assert.match(inventory, /no face, hair, costume, occupation, accessory, weapon, or identity cues/u);
});

test("selected authoring masters match exact bytes, dimensions, and true RGBA transparency", async () => {
  for (const [path, expectedHash, width, height] of selectedAssets) {
    const bytes = await readFile(path);
    assert.equal(sha256(bytes), expectedHash, `${path} hash drift`);
    const image = sharp(bytes, { failOn: "error" });
    const metadata = await image.metadata();
    assert.equal(metadata.width, width, `${path} width`);
    assert.equal(metadata.height, height, `${path} height`);
    assert.equal(metadata.hasAlpha, true, `${path} must have alpha`);

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minAlpha = 255;
    let maxAlpha = 0;
    let transparentPixels = 0;
    for (let index = 3; index < data.length; index += info.channels) {
      const alpha = data[index];
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
      if (alpha === 0) transparentPixels += 1;
    }
    assert.equal(minAlpha, 0, `${path} needs fully transparent background pixels`);
    assert.ok(maxAlpha >= 254, `${path} needs effectively opaque identity pixels`);
    assert.ok(transparentPixels > width * height * 0.01, `${path} transparent area is too small`);
  }
});

test("the inventory is finite and selected paths are the only provenance entries", async () => {
  const [inventory, provenance] = await Promise.all([
    readFile(INVENTORY, "utf8"),
    readFile(PROVENANCE, "utf8"),
  ]);
  for (const [path, hash] of selectedAssets) {
    assert.match(inventory, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.match(provenance, new RegExp(hash, "u"));
  }
  const provenanceRows = [...provenance.matchAll(/^\| `assets\/source\/v100\/[^`]+` \| `[a-f0-9]{64}` \|$/gmu)];
  assert.equal(provenanceRows.length, selectedAssets.length);
  assert.doesNotMatch(provenance, /identity-master-r3\.png/u);
  assert.doesNotMatch(provenance, /segawa-identity-master-r1\.png/u);
  assert.doesNotMatch(provenance, /mugarian-president-mutated-identity-master-r1\.png/u);
  assert.doesNotMatch(provenance, /minor-human-shared-event-portrait-r1\.png/u);
});

test("pre-implementation closure has zero product-decision gaps and an executable name/formation contract", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  for (const source of [design, handoff]) {
    assert.match(source, /PRE_IMPLEMENTATION_CLOSED/u);
    assert.match(source, /PRODUCT_DECISION_GAPS: 0/u);
  }
  assert.match(handoff, /LUNA_HANDOFF_READY: YES/u);

  assert.match(design, /Unicode NFC normalization/u);
  assert.match(design, /U\+0020\/U\+3000/u);
  assert.match(design, /Intl\.Segmenter\("ja", \{ granularity: "grapheme" \}\)/u);
  assert.match(design, /Valid length is 1-12 grapheme clusters/u);
  assert.match(design, /isolated variation selectors/u);
  assert.match(design, /U\+200D outside a valid emoji ZWJ sequence fail/u);
  assert.match(design, /falls back to the last valid Version 1\.0\.0 name, or `指揮官`/u);
  assert.match(design, /IDs, receipts, node keys, read state, and saved source text never contain the chosen name/u);

  assert.match(design, /Formation has exactly seven ordered slots/u);
  assert.match(design, /A character ID may occupy multiple slots/u);
  assert.match(design, /count reservation, command creation, battle-resource debit, cooldown start, and receipt creation in one serialized mutation/u);
  assert.match(design, /no command, resource, cooldown, receipt, animation, bark, or partial spawn/u);
  assert.match(handoff, /Slot eight rejects all of them atomically/u);
});

test("all 16 units have exact primary roles and all 30 stages have one closed implementation row", async () => {
  const design = await readFile(DESIGN, "utf8");
  const expectedRoles = new Map([
    ["Hachi", "skirmisher"],
    ["Paisen", "frontline"],
    ["Kumaverson", "heavy"],
    ["Babayaga", "marksman"],
    ["Nao", "support"],
    ["Mizuchi", "suppression"],
    ["Monkey", "engineer"],
    ["Crazy King", "frontline"],
    ["Raider", "suppression"],
    ["Tatara", "heavy"],
    ["Gantetsu", "heavy"],
    ["Mayo-chan", "skirmisher"],
    ["Zakimiya", "frontline"],
    ["TKY", "skirmisher"],
    ["MrsChiha", "marksman"],
    ["Miyamoto Musashi", "frontline"],
  ]);
  const roleSection = design.match(/Primary role ownership is exact[\s\S]+?### Level cap/u)?.[0] ?? "";
  const actualRoles = new Map(
    [...roleSection.matchAll(/^\| ([^|]+?) \| `([^`]+)` \|$/gmu)]
      .map((match) => [match[1].trim(), match[2]]),
  );
  assert.deepEqual(actualRoles, expectedRoles);

  const closure = design.match(/### 17\.5 Stage content closure matrix([\s\S]+?)### 17\.6/u)?.[1] ?? "";
  const rows = [...closure.matchAll(/^\| (\d+) \| `([^`]+)` \|/gmu)]
    .map((match) => ({ stage: Number(match[1]), id: match[2] }));
  assert.equal(rows.length, 30);
  assert.deepEqual(rows.map(({ stage }) => stage), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(new Set(rows.map(({ id }) => id)).size, 30);
  assert.equal(rows[0].id, "stage-nishijin-shopping-street");
  assert.equal(rows[28].id, "stage-segawa-research-core");
  assert.equal(rows[29].id, "stage-nishijin-defense-line-takuya-omega");
  assert.match(closure, /Stage 29's two destruction targets must both complete/u);
  assert.match(closure, /Stage 30 has no midbattle story dialogue/u);
});

test("event flow, stars, receipts, unlock payloads, speakers, and required assets are closed", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /`v100:event:prologue`/u);
  assert.match(design, /for every `NN` from `01` to `30`, `v100:event:sNN:pre`, `v100:event:sNN:post`, and `v100:event:sNN:first-clear-post`/u);
  assert.match(design, /Defeat ends at a defeat result[\s\S]*without `post`, first-clear, star, reward, join, unlock, boss receipt, or next-stage unlock/u);
  assert.match(design, /After Stage 30 first-clear finalize: `ending -> credits -> epilogue -> postgame campaign-map`/u);
  assert.match(design, /persists `\{eventId, phase, nodeIndex, nodeKey\}`/u);
  assert.match(design, /final armored-vehicle HP \/ current maximum HP >= 0\.70/u);
  assert.match(design, /Three stars require >= 0\.90/u);
  assert.match(design, /replay victory continues `result -> post -> replay-finalize -> map` and never replays `first-clear-post`/u);
  assert.match(design, /`v100:sNN:first-clear`/u);
  assert.match(design, /`v100:sNN:replay:<battleRunId>`/u);

  const payloadSection = handoff.match(/### 10\.3 Exact first-clear payloads([\s\S]+?)### 10\.4/u)?.[1] ?? "";
  const payloadRows = [...payloadSection.matchAll(/^\| (\d+) \| ([^|]+) \|$/gmu)];
  assert.equal(payloadRows.length, 30);
  assert.deepEqual(payloadRows.map((match) => Number(match[1])), Array.from({ length: 30 }, (_, index) => index + 1));

  const speakerSection = handoff.match(/### 10\.4 Canonical speaker\/portrait routing by event([\s\S]+?)### 10\.5/u)?.[1] ?? "";
  const speakerRows = [...speakerSection.matchAll(/^\| (Prologue|S\d{2}|Ending|Credits|Epilogue) \|/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(speakerRows, [
    "Prologue",
    ...Array.from({ length: 30 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`),
    "Ending",
    "Credits",
    "Epilogue",
  ]);
  assert.match(speakerSection, /Zakimiya's wife -> shared silhouette/u);
  assert.match(speakerSection, /Stage 13 `知らない声` has no portrait until Segawa is named/u);
  assert.match(speakerSection, /RED PANTHER\/red-lens captain uses the selected commander identity/u);
  assert.match(design, /Credits have no dialogue and no BGM/u);
  assert.match(design, /inherits only the ambience already owned by that source background route/u);

  assert.match(design, /Every stage\/event registers its background, all portraits reachable in that event, mission-object states, locked enemy\/boss states, VFX, battle audio, event audio, UI icons, fonts, and ending\/credits\/epilogue assets/u);
  assert.match(design, /after the gate opens, required fetches are zero/u);
  assert.match(handoff, /Return to Sol only for: \(1\) a true contradiction[\s\S]*\(4\) a technically impossible acceptance contract/u);
});

test("runtime derivatives are required implementation work without reopening character identity", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  for (const source of [design, handoff]) {
    assert.match(source, /RUNTIME_SPRITE_SCOPE_CLOSED/u);
    assert.match(source, /PRODUCT_DESIGN_CHANGE: 0/u);
    assert.match(source, /new character identity, character design, or identity-master candidate/u);
    assert.match(source, /runtime derivative/u);
    assert.match(source, /Phase 4/u);
  }
  assert.doesNotMatch(handoff, /There is no image-generation task/u);
  assert.match(handoff, /Producing the finite battle sprites\/atlases, event portraits, boss entrance\/idle\/attack\/hit\/phase\/death states/u);
  assert.match(handoff, /newly invented substitute identity-master candidate is forbidden/u);
  assert.match(handoff, /Do not enter Phase 4 until every required runtime character\/stage\/mission image is complete/u);
});

test("all 16 playable sprite statuses are finite and match the current production manifest", async () => {
  const [design, handoff, spriteManifest] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(SPRITE_MANIFEST_SOURCE, "utf8"),
  ]);
  const expected = new Map([
    ["Hachi", "REUSE_COMPLETE"],
    ["Paisen", "DERIVE_RUNTIME_REQUIRED"],
    ["Kumaverson", "REUSE_COMPLETE"],
    ["Babayaga", "REUSE_COMPLETE"],
    ["Nao", "REUSE_COMPLETE"],
    ["Mizuchi", "REUSE_COMPLETE"],
    ["Monkey", "REUSE_COMPLETE"],
    ["Crazy King", "REUSE_COMPLETE"],
    ["Raider", "REUSE_COMPLETE"],
    ["Tatara", "REUSE_COMPLETE"],
    ["Gantetsu", "REUSE_COMPLETE"],
    ["Mayo-chan", "REUSE_COMPLETE"],
    ["Zakimiya", "REUSE_COMPLETE"],
    ["TKY", "REUSE_COMPLETE"],
    ["MrsChiha", "REUSE_COMPLETE"],
    ["Miyamoto Musashi", "REUSE_COMPLETE"],
  ]);
  const section = design.match(/### 17\.7 Runtime sprite scope closure([\s\S]+?)### 17\.8/u)?.[1] ?? "";
  const actual = new Map(
    [...section.matchAll(/^\| ([^|]+?) \| `[^`]+`(?: \/ `[^`]+`)? \| `(REUSE_COMPLETE|DERIVE_RUNTIME_REQUIRED|NEW_RUNTIME_SPRITE_REQUIRED)` \|/gmu)]
      .map((match) => [match[1].trim(), match[2]]),
  );
  assert.deepEqual(actual, expected);
  assert.match(section, /`NEW_RUNTIME_SPRITE_REQUIRED` playable units: none/u);
  assert.match(section, /Paisen's approved-identity atlas/u);
  assert.match(section, /legacy `hit`\/`death` alias/u);
  assert.match(handoff, /Phase 2 target: Paisen only, completed before Phase 3 begins/u);

  for (const kind of [
    "scout", "ranger", "medic", "brute", "gunner", "guardian", "engineer", "zakimiya", "tky",
    "mrs-chiha", "miyamoto-musashi", "mayo-chan", "mayo-chan-feral", "crazy-king", "kumaverson", "babayaga",
  ]) {
    const escaped = kind.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    assert.match(spriteManifest, new RegExp(`(?:${escaped}|"${escaped}"):\\s*explicitAtlasManifestEntry`, "u"));
  }
  assert.match(spriteManifest, /brawler: legacyManifestEntry\("brawler", "right"\)/u);
  assert.match(spriteManifest, /hit: 5,[\s\S]*death: 5,/u);
  for (const state of ["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]) {
    assert.match(spriteManifest, new RegExp(`"${state.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`), `missing ${state}`);
  }
});
