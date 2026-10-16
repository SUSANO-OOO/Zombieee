import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { invokeBrowserQaModule } from '../scripts/browser-qa-entry.mjs';

test('an explicit guarded QA hook runs once and is awaited to completion', async () => {
  let calls = 0, completed = false, release;
  const pending = invokeBrowserQaModule({ runBrowserQa: async () => {
    calls++; await new Promise(resolve => { release = resolve; }); completed = true;
  } });
  assert.equal(calls, 1); assert.equal(completed, false);
  release(); assert.equal(await pending, 'explicit-hook'); assert.equal(completed, true);
});

test('legacy imports and direct guarded CLIs retain their existing execution semantics', () => {
  // These tiny Node fixtures write markers only; no server/browser/game runs.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-qa-entry-'));
  const marker = path.join(directory, 'marker.txt'), guarded = path.join(directory, 'guarded.mjs');
  fs.writeFileSync(guarded, `import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
export async function runBrowserQa(){fs.appendFileSync(process.env.ENTRY_MARKER,'hook\\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await runBrowserQa();`);
  const helper = new URL('../scripts/browser-qa-entry.mjs', import.meta.url).href;
  const run = args => {
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true,
      env: { ...process.env, ENTRY_MARKER: marker } });
    assert.equal(child.status, 0, child.stderr);
  };
  run([guarded]); assert.equal(fs.readFileSync(marker, 'utf8'), 'hook\n');
  fs.writeFileSync(marker, '');
  run(['--input-type=module', '--eval', `import {invokeBrowserQaModule} from ${JSON.stringify(helper)};
await invokeBrowserQaModule(await import(${JSON.stringify(pathToFileURL(guarded).href)}));`]);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'hook\n');
  const legacy = path.join(directory, 'legacy.mjs'); fs.writeFileSync(marker, '');
  fs.writeFileSync(legacy, `import fs from 'node:fs';fs.appendFileSync(process.env.ENTRY_MARKER,'legacy\\n');export const legacy=true;`);
  run(['--input-type=module', '--eval', `import {invokeBrowserQaModule} from ${JSON.stringify(helper)};
await invokeBrowserQaModule(await import(${JSON.stringify(pathToFileURL(legacy).href)}));`]);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'legacy\n');
});

test('malformed hooks fail closed and original hook failures propagate unchanged', async () => {
  for (const runBrowserQa of [undefined, false, 'not-a-function']) {
    await assert.rejects(() => invokeBrowserQaModule({ runBrowserQa }), /must be a function/u);
  }
  const original = new Error('Original native QA failure');
  await assert.rejects(() => invokeBrowserQaModule({ runBrowserQa: async () => { throw original; } }), error => error === original);
});

test('the actual owned-server launcher invokes a guarded module after assigning its owned origin', async () => {
  const source = fs.readFileSync(new URL('../scripts/run-browser-qa-with-server.mjs', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('launcher.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statement = tree.statements.find(ts.isTryStatement);
  assert.ok(statement);
  const block = statement.tryBlock.getText(tree);
  const replacements = [...block.matchAll(/\bimport\(/gu)]; assert.equal(replacements.length, 1);
  const body = block.replace(/\bimport\(/gu, 'loadModule(');
  const execute = new Function('waitForServer', 'applyQaOrigin', 'invokeBrowserQaModule',
    'loadModule', 'pathToFileURL', 'path', 'target', 'return (async()=>'+body+')();');
  const events = [], target = 'scripts/guarded-qa-fixture.mjs';
  await execute(async () => { events.push('ready'); return 'http://127.0.0.1:43123/'; },
    origin => { assert.equal(origin, 'http://127.0.0.1:43123/'); events.push('origin'); }, invokeBrowserQaModule,
    async url => { assert.equal(url, pathToFileURL(path.resolve(target)).href); events.push('import');
      return { runBrowserQa: async () => { events.push('hook'); } }; }, pathToFileURL, path, target);
  assert.deepEqual(events, ['ready', 'origin', 'import', 'hook']);
});
