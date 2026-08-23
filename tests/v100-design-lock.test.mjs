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
  assert.match(design, /Revision: `r13`/u);
  assert.match(design, /Status: `DESIGN_LOCKED`/u);
  assert.match(handoff, /Canonical Design Lock: `V100-SOL-DL-001 r13`/u);
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
  assert.match(projectState, /current Design Lock：`V100-SOL-DL-001 r13`/u);
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

test("r12-r13 lock SOL actionability and target-ownership closure with one final Producer checkpoint", async () => {
  const [design, handoff, projectState] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(PROJECT_STATE, "utf8"),
  ]);
  const r12 = design.match(/## 28\. Revision r12([\s\S]+?)(?=## 29\. Revision r13)/u)?.[1] ?? "";
  const r13 = design.match(/## 29\. Revision r13([\s\S]*)$/u)?.[1] ?? "";
  const activeHandoff = handoff.match(/## 22\. Revision r13([\s\S]*)$/u)?.[1] ?? "";
  const currentProcess = projectState.match(/## 4\. 実行体制 — V1 SOL single-owner override([\s\S]+?)## 5\./u)?.[1] ?? "";
  const currentCursor = projectState.match(/## 6\. Version 1\.0\.0 execution cursor — r13 Section 29([\s\S]+?)### Post-V1/u)?.[1] ?? "";

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
  assert.match(activeHandoff, /ROLE_LOCK`: `SOL_DESIGN`[\s\S]*then `SOL_REMEDIATION`/u);
  assert.match(activeHandoff, /Issue-locked r13 publication/u);
  assert.match(activeHandoff, /actual stage ID `stage-mugarian-executive-lab`/u);
  assert.match(activeHandoff, /targetOwnershipHistory/u);
  assert.match(activeHandoff, /maximum 96/u);
  assert.match(activeHandoff, /proofActorHumanTargetFromHistory/u);
  assert.match(activeHandoff, /Generic source-target edges[\s\S]*never substitutes/u);
  assert.match(activeHandoff, /Stage 25 fresh 3\/3/u);
  assert.match(activeHandoff, /ordered trio fresh 3\/3/u);
  assert.match(r13, /QA_HARNESS_TARGET_OWNERSHIP_HISTORY \/ LIVE_ONLY_CONTACT_CHECKPOINT \+ ATTACK_HISTORY_WITHOUT_SIDE_KIND_TARGET_ATTRIBUTION \/ DESIGN_CHANGE_REQUIRED/u);
  for (const source of [r13, activeHandoff, projectState, currentCursor]) {
    assert.match(source, /PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP \/ MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY \+ NO_GENERIC_SUBSTITUTION \/ DESIGN_CHANGE_REQUIRED/u);
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
  for (const source of [r12, r13, activeHandoff, currentCursor]) {
    assert.match(source, /workflow-restoration promotion HEAD|workflow-only iteration-3 HEAD/u);
    assert.match(source, /remain `2`|remain iteration 2|iteration 3|`2`を維持/u);
  }
  assert.doesNotMatch(currentProcess, /-> LUNA_IMPLEMENTATION|`PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`|`PRODUCER_FINAL_ACCEPTANCE`/u);
  assert.doesNotMatch(currentCursor, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(currentCursor, /SAME_GATE_REPEAT_COUNT`: `1`/u);
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
