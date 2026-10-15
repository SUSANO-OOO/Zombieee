// Offline source/routing proof. This never starts a browser, game or audio.
// Software-rendered pose boards are not native play or naturalness acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { alphaBounds, decodeRgbaPng, hasTransparentPerimeter } from '../tests/image-asset-helpers.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const argument = flag => { const index = process.argv.indexOf(flag); return index < 0 ? null : process.argv[index + 1]; };
const stage = path.resolve(argument('--stage') ?? '');
const relative = path.relative(path.join(ROOT, 'output'), stage);
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Pass a private --stage under output');
const canvasModule = argument('--canvas-module');
assert.ok(canvasModule, 'Pass the installed canvas module explicitly');
const { createCanvas, loadImage } = await import(pathToFileURL(path.resolve(canvasModule)).href);
const out = path.join(stage, argument('--proof-name') ?? 'proof-r1');
await fs.mkdir(out);
const load = name => import(pathToFileURL(path.join(stage, 'app', name)).href);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const combat = await load('combatPresentation.js');
const sprites = await load('spriteManifest.js');
const joints = await load('v177JointPresentation.js');
const { V177_PAISEN_PHOTO_SPRITES: data } = await load('v177PaisenPhotoSpriteData.js');
const { v100UsesHumanWalk, v100HumanWalkFrame } = await load('v100HumanWalk.js');
const { v102CombatMotionSample } = await load('v102CombatMotion.js');
const { v177PaisenPhotoComboJointPose } = await load('v177PaisenPhotoCombo.js');
const { v100BrawlerComboPose, v100BrawlerComboTiming } = await load('v100BrawlerCombo.js');
const { MANUAL_ABILITY_REGISTRY } = await load('manualAbilities.js');
const corpsePose = await load('v102CorpsePose.js');
const gore = await load('v102CombatGore.js');
const { allyCorpseVisualCue } = await load('corpseVisuals.js');
const definition = MANUAL_ABILITY_REGISTRY.brawler;
assert.equal(sprites.spriteSheetPath('brawler'), data.sixPath);
assert.equal(sprites.V100_SPRITE_MANIFEST.paisen.path, data.sevenPath);
assert.equal(joints.V177_JOINT_ATLASES.brawler.path, data.jointPath);
const images = new Map(), bytes = new Map();
for (const [asset, digest] of [[data.sixPath, data.sixSha256], [data.sevenPath, data.sevenSha256], [data.jointPath, data.jointSha256]]) {
  const raw = await fs.readFile(path.join(stage, 'public', asset));
  assert.equal(hash(raw), digest); bytes.set(asset, raw); images.set(asset, await loadImage(raw));
}
const decoded = new Map([[data.sixPath, decodeRgbaPng(bytes.get(data.sixPath))],
  [data.sevenPath, decodeRgbaPng(bytes.get(data.sevenPath))]]);
for (const kind of ['brawler', 'paisen']) for (const direction of ['right', 'left']) for (const state of sprites.SPRITE_STATES) {
  const frame = kind === 'brawler' ? sprites.spriteFrameFor(kind, state, direction) : sprites.v100SpriteFrameFor(kind, state, direction);
  assert.deepEqual(alphaBounds(decoded.get(frame.path), frame.sourceRect), frame.contentRect, kind + '/' + state + '/' + direction);
  assert.ok(hasTransparentPerimeter(decoded.get(frame.path), frame.sourceRect, 16));
}
const primary = await import(pathToFileURL(path.join(ROOT, 'app/v177JointPresentation.js')).href);
assert.deepEqual(Object.keys(joints.V177_JOINT_ATLASES).sort(), Object.keys(primary.V177_JOINT_ATLASES).sort());
for (const [kind, atlas] of Object.entries(primary.V177_JOINT_ATLASES)) {
  if (kind !== 'brawler') assert.deepEqual(joints.V177_JOINT_ATLASES[kind], atlas, 'Other rig changed: ' + kind);
}
const preserved = ['gameRules.js', 'manualAbilities.js', 'v100Registry.js', 'v100BattleAdapter.js', 'v100StageRuntime.js', 'v102CombatGore.js'];
for (const name of preserved) assert.deepEqual(await fs.readFile(path.join(stage, 'app', name)), await fs.readFile(path.join(ROOT, 'app', name)));

const presentation = { locomotionPhase: .37, locomotionSettle: 1 };
const routes = [];
for (const state of combat.COMBAT_ANIMATION_STATES) for (const direction of ['right', 'left']) for (const progress of [0, .2, .5, .8, 1]) {
  const clip = combat.animationClipFor('brawler', state);
  const sample = combat.sampleAnimationClip('brawler', state, clip.durationSeconds * progress);
  const plan = joints.v177JointPose('brawler', sample, presentation);
  const frame = sprites.spriteFrameFor('brawler', sample.spriteState, direction);
  assert.equal(frame.path, data.sixPath);
  assert.equal(joints.v177JointPose('brawler', sample, presentation, { ownedPose: true }), null);
  assert.equal(v100UsesHumanWalk('brawler', sample), false, 'Old polygon masks must not cut the new body');
  routes.push({ state, direction, progress, sourceState: sample.spriteState,
    joint: Boolean(plan), asset: plan ? data.jointPath : frame.path });
}
assert.equal(new Set(routes.map(route => route.state)).size, 21);

function draw(ctx, sample, direction, plan) {
  const frame = plan ? v100HumanWalkFrame(sprites.spriteFrameFor('brawler', 'walk-a', 'right'), direction)
    : sprites.spriteFrameFor('brawler', sample.spriteState, direction);
  const width = 394 * .4, height = 757 * .4;
  const pose = !plan && sample.pose ? sample.pose : { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  ctx.save(); const sign = direction === 'left' ? -1 : 1;
  ctx.translate(pose.offsetX * sign, pose.offsetY); ctx.rotate(pose.rotationRadians * sign);
  ctx.scale(pose.scaleX, pose.scaleY); ctx.globalAlpha *= pose.opacity;
  if (frame.flipX) ctx.scale(-1, 1);
  if (plan) assert.ok(joints.drawV177JointPose(ctx, images.get(data.jointPath), 'brawler', plan,
    -width * frame.anchorX, -height * frame.anchorY, width, height));
  else for (const slice of frame.drawSlices ?? [{ x: 0, y: 0, w: frame.w, h: frame.h }]) {
    ctx.drawImage(images.get(frame.path), frame.x + slice.x, frame.y + slice.y, slice.w, slice.h,
      -width * frame.anchorX + width * slice.x / frame.w,
      -height * frame.anchorY + height * slice.y / frame.h, width * slice.w / frame.w, height * slice.h / frame.h);
  }
  ctx.restore();
}
const boards = [];
for (let page = 0; page < 3; page++) {
  const board = createCanvas(1470, 660), ctx = board.getContext('2d');
  ctx.fillStyle = '#c7d0d6'; ctx.fillRect(0, 0, 1470, 660);
  for (const [column, state] of combat.COMBAT_ANIMATION_STATES.slice(page * 7, page * 7 + 7).entries()) {
    for (const [row, direction] of ['right', 'left'].entries()) {
      const clip = combat.animationClipFor('brawler', state);
      const sample = v102CombatMotionSample('brawler', combat.sampleAnimationClip('brawler', state, clip.durationSeconds * .5),
        { side: 'human', attack: 0, attackWindup: 0, abilityWindup: 0, ownedPose: false });
      const plan = joints.v177JointPose('brawler', sample, presentation);
      ctx.save(); ctx.fillStyle = '#172531'; ctx.font = '15px Arial';
      ctx.fillText(state + ' / ' + direction, column * 210 + 8, row * 330 + 22);
      ctx.translate(column * 210 + 105, row * 330 + 305); draw(ctx, sample, direction, plan); ctx.restore();
    }
  }
  const name = 'all21-source-poses-' + (page + 1) + '.png'; await fs.writeFile(path.join(out, name), board.toBuffer('image/png'), { flag: 'wx' }); boards.push(name);
}

const atlas = joints.V177_JOINT_ATLASES.brawler;
const source = JSON.parse(await fs.readFile(path.join(stage, 'source/parts.json'), 'utf8'));
const point = (matrix, [x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function matrices(plan) {
  const raw = [], ctx = { save() {}, restore() {}, translate() {}, scale() {}, transform(...matrix) { raw.push(matrix); }, drawImage() {} };
  assert.ok(joints.drawV177JointPose(ctx, { naturalWidth: 512 }, 'brawler', plan, 0, 0, 394, 757));
  return new Map(atlas.parts.map((part, index) => [part.bone, raw[index]]));
}
const timing = v100BrawlerComboTiming(definition), owned = [];
let jointError = 0;
for (let index = 0; index <= 1000; index++) {
  const time = timing.recoveryEnd * index / 1001;
  const runtime = { sequentialBrawler: true, phase: time < definition.windupSeconds ? 'windup' : time < timing.lastContact ? 'salvo' : 'recovery', abilityElapsed: time };
  const owner = { kind: 'brawler', side: 'human', hp: 100, combatReady: true, stunned: 0,
    manualAbility: runtime, animationPresentation: presentation };
  const plan = v177PaisenPhotoComboJointPose(owner, definition); assert.ok(plan);
  const actual = matrices(plan);
  for (const arm of source.armConstraints) {
    jointError = Math.max(jointError,
      distance(point(actual.get(arm.upperBone), arm.shoulder), point(actual.get(arm.parentBone), arm.shoulder)),
      distance(point(actual.get(arm.upperBone), arm.elbow), point(actual.get(arm.lowerBone), arm.elbow)),
      distance(point(actual.get(arm.lowerBone), arm.wrist), point(actual.get(arm.effectorBone), arm.wrist)));
  }
  const fallback = sprites.spriteFrameFor('brawler', v100BrawlerComboPose(runtime, definition), 'right');
  assert.equal(fallback.path, data.sixPath); owned.push({ time, phase: runtime.phase, attackPhase: plan.attackPhase });
}
assert.ok(jointError < .001, 'Original joint contact threshold is unchanged');

const manualTimes = [0, definition.windupSeconds * .5, definition.windupSeconds * .95,
  timing.contacts[0], timing.contacts[0] + .02, timing.contacts[0] + .05,
  timing.contacts[0] + .08, timing.contacts[1], timing.contacts[1] + .05,
  timing.contacts[Math.floor(timing.contacts.length / 2)], timing.lastContact - .01,
  timing.lastContact, timing.lastContact + .03, timing.recoveryEnd - .001];
for (let page = 0; page < 2; page++) {
  const board = createCanvas(1470, 660), ctx = board.getContext('2d');
  ctx.fillStyle = '#c7d0d6'; ctx.fillRect(0, 0, 1470, 660);
  for (const [column, time] of manualTimes.slice(page * 7, page * 7 + 7).entries()) {
    const runtime = { sequentialBrawler: true, phase: time < definition.windupSeconds ? 'windup'
      : time < timing.lastContact ? 'salvo' : 'recovery', abilityElapsed: time };
    const owner = { kind: 'brawler', side: 'human', hp: 100, combatReady: true, stunned: 0,
      manualAbility: runtime, animationPresentation: presentation };
    const plan = v177PaisenPhotoComboJointPose(owner, definition); assert.ok(plan);
    for (const [row, direction] of ['right', 'left'].entries()) {
      ctx.save(); ctx.fillStyle = '#172531'; ctx.font = '14px Arial';
      ctx.fillText(time.toFixed(3) + 's / ' + direction, column * 210 + 8, row * 330 + 22);
      ctx.fillText(plan.attackPhase, column * 210 + 8, row * 330 + 40);
      ctx.translate(column * 210 + 105, row * 330 + 305);
      draw(ctx, { spriteState: v100BrawlerComboPose(runtime, definition) }, direction, plan);
      ctx.restore();
    }
  }
  const name = 'manual-combo-source-phases-' + (page + 1) + '.png';
  await fs.writeFile(path.join(out, name), board.toBuffer('image/png'), { flag: 'wx' }); boards.push(name);
}

let floorError = 0;
for (const direction of ['right', 'left']) for (const fallDirection of [-1, 1]) for (let index = 0; index <= 1000; index++) {
  const frame = sprites.spriteFrameFor('brawler', 'death', direction), width = 157.6, height = 302.8;
  const pose = corpsePose.v102CorpseFallingPose('brawler', frame, width, height, fallDirection, index / 1000);
  assert.ok(pose, 'The actual corpse path must use the new source-bound outline');
  const record = (await load('v102CorpsePoseData.js')).V102_FALLING_DEATH_FRAMES.find(item => item.kind === 'brawler' && item.direction === direction);
  assert.equal(record.sourceSha256, data.sixSha256);
  const c = Math.cos(pose.rotationRadians), s = Math.sin(pose.rotationRadians);
  const support = Math.max(...record.hull.map(([x, y]) => {
    const px = (x / frame.w - frame.anchorX) * width * (frame.flipX ? -1 : 1);
    const py = (y / frame.h - frame.anchorY) * height;
    return s * px + c * py;
  }));
  floorError = Math.max(floorError, Math.abs(pose.groundOffsetY + support));
}
assert.ok(floorError < 1e-8, 'Original source-floor threshold is unchanged');

const actorSource = await fs.readFile(path.join(stage, 'app/AshfallGame.tsx'), 'utf8');
assert.ok(actorSource.includes('v177PaisenPhotoComboJointPose(f, MANUAL_ABILITY_REGISTRY.brawler)'));
const tree = ts.createSourceFile('AshfallGame.tsx', actorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let raster;
function find(node) {
  if (ts.isIfStatement(node) && node.expression.getText(tree) === 'sprite?.complete && sprite.naturalWidth'
    && node.thenStatement.getText(tree).includes('const corpseFallingPose')) raster = node.thenStatement;
  ts.forEachChild(node, find);
}
find(tree); assert.ok(raster);
const statements = raster.statements;
const first = statements.findIndex(node => node.getText(tree).startsWith('ctx.globalAlpha ='));
const last = statements.findIndex((node, index) => index > first && node.getText(tree) === 'ctx.filter = "none";');
assert.ok(first >= 0 && last > first);
const rasterText = statements.slice(first, last + 1).map(node => node.getText(tree)).join('\n');
const corpseBoard = createCanvas(1600, 660), corpseCtx = corpseBoard.getContext('2d');
corpseCtx.fillStyle = '#c7d0d6'; corpseCtx.fillRect(0, 0, 1600, 660);
for (const [row, direction] of ['right', 'left'].entries()) for (const [column, progress] of [0, .33, .66, 1].entries()) {
  const frame = sprites.spriteFrameFor('brawler', 'death', direction), width = 157.6, height = 302.8;
  const falling = corpsePose.v102CorpseFallingPose('brawler', frame, width, height, 1, progress);
  const corpse = { id: 1, kind: 'brawler', side: 'human', state: 'ally-corpse', x: column * 400 + 135, y: row * 330 + 300, life: 4 };
  corpseCtx.save(); corpseCtx.fillStyle = '#172531'; corpseCtx.font = '15px Arial';
  corpseCtx.fillText('corpse ' + direction + ' / ' + progress, column * 400 + 8, row * 330 + 22);
  vm.runInNewContext(rasterText, { ctx: corpseCtx, corpse, frame, width, height,
    rotationRadians: falling.rotationRadians, groundOffsetY: falling.groundOffsetY,
    allyCue: allyCorpseVisualCue(corpse, 20), ashingProgress: 0, sprite: images.get(data.sixPath),
    g: { time: 20, definition: { missionConfig: { v100StageNumber: 3 } } }, stageObjects: {},
    v102CorpseSeverPlan: gore.v102CorpseSeverPlan, beginV102CorpseSever: gore.beginV102CorpseSever,
    endV102CorpseSever: gore.endV102CorpseSever,
    v100ImageSampler: { draw: (ctx, ...args) => ctx.drawImage(...args) },
  });
  corpseCtx.restore();
}
await fs.writeFile(path.join(out, 'source-bound-corpse-phases.png'), corpseBoard.toBuffer('image/png'), { flag: 'wx' });
boards.push('source-bound-corpse-phases.png');
const proof = { at: new Date().toISOString(), privateOnly: true, productionRuntimeAdopted: false,
  all21PhotoIdentitySourceCovered: true, ordinarySamples: routes.length, directions: 2, routes,
  oldPolygonFallbackDisabled: true, manualComboSourceSamples: owned.length, manualJointError: jointError,
  jointThresholdPx: .001, corpseSourceFloorSamples: 4004, corpseSourceFloorError: floorError,
  corpseSourceFloorThreshold: 1e-8, oldBossRecordsPreserved: 6,
  sourcePngHashes: { six: data.sixSha256, seven: data.sevenSha256, joint: data.jointSha256 },
  originalCoreAndGoreFilesPreserved: preserved, boards, actualCorpseRasterSourceSha256: hash(Buffer.from(rasterText)),
  softwareRenderer: 'offline @napi-rs/canvas; source routing, real joint draw APIs and extracted corpse raster block; image sampler shim',
  actualFullGameRun: false, nativeAccepted: false, animationNaturalnessAccepted: false, wholeGameAccepted: false };
await fs.writeFile(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ privateOnly: true, states: 21, ordinarySamples: routes.length,
  manualSamples: owned.length, manualJointError: jointError, corpseSourceFloorError: floorError,
  boards, out, nativeAccepted: false, wholeGameAccepted: false }));
