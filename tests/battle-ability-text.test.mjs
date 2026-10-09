import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { observePlayerAbilityText } from '../scripts/player-ability-text-audit.mjs';

test('every manual ability emits numerical amounts without activation names', async () => {
  const game = await readFile(new URL('../app/AshfallGame.tsx', import.meta.url), 'utf8');
  const source = ts.createSourceFile('AshfallGame.tsx', game, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let manualLoop;
  const find = node => {
    if (ts.isForOfStatement(node) && node.expression.getText(source) === 'abilityStep.events') manualLoop = node;
    ts.forEachChild(node, find);
  };
  find(source);
  assert.ok(manualLoop, 'The production manual ability timeline is bound');
  const texts = [];
  const collect = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'addDamageText') texts.push(node.arguments[3].getText(source));
    ts.forEachChild(node, collect);
  };
  collect(manualLoop);
  assert.ok(texts.length >= 10, 'All damage and healing branches are inspected');
  for (const text of texts) {
    assert.doesNotMatch(text, /[\u3040-\u30ff\u3400-\u9fff]/, text);
    assert.match(text, /Math\.round\((?:damage|healing|structureDamage)\)/, text);
  }
});

test('canvas audit detects old labels while preserving actual drawing and damage numbers', () => {
  const originalCanvas = globalThis.CanvasRenderingContext2D;
  const calls = [];
  class FakeCanvas {
    canvas = { isConnected: true };
    fillText(...args) { calls.push(args); }
  }
  globalThis.CanvasRenderingContext2D = FakeCanvas;
  try {
    observePlayerAbilityText();
    const ctx = new FakeCanvas();
    ctx.fillText('フィニッシュ', 1, 2);
    ctx.fillText('緊急処置 +70', 3, 4);
    ctx.fillText('40', 5, 6);
    ctx.fillText('+70', 7, 8);
    ctx.fillText('床汚染', 9, 10);
    assert.equal(calls.length, 5);
    assert.deepEqual(globalThis.__PLAYER_ABILITY_TEXT_PROOF__, {
      forbidden: ['フィニッシュ', '緊急処置 +70'], numericDraws: 2, observedDraws: 5,
    });
  } finally {
    if (originalCanvas) globalThis.CanvasRenderingContext2D = originalCanvas;
    else delete globalThis.CanvasRenderingContext2D;
    delete globalThis.__PLAYER_ABILITY_TEXT_PROOF__;
  }
});
