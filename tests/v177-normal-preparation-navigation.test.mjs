import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import { createDefaultV100Save } from '../app/v100Save.js';
import { upgradeV100Vehicle } from '../app/v100Transactions.js';
import { V100_UNITS, V100_VEHICLE, v100LevelCost } from '../app/v100Registry.js';

// Render the production navigation only: no game, browser or audio is started.
const componentSource = fs.readFileSync(new URL('../app/V100Campaign.tsx', import.meta.url), 'utf8');
const component = ts.createSourceFile('V100Campaign.tsx', componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const navigation = [];
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(component) === 'nav'
    && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
      && attribute.name.getText(component) === 'aria-label'
      && attribute.initializer?.text === 'ステージ準備メニュー')) navigation.push(node);
  ts.forEachChild(node, visit);
}
visit(component);
assert.equal(navigation.length, 1);
const renderNavigation = vm.runInNewContext(ts.transpileModule(
  `(flow, surface, openSurface) => (${navigation[0].getText(component)});`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } },
).outputText, { React });

function preparationFunction(file, bindings) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = new Set(['button', 'preparationTab', 'selectPersonnel', 'plannedFormation', 'prepareEconomy']);
  const declarations = [];
  for (const statement of parsed.statements) {
    if (ts.isFunctionDeclaration(statement) && names.has(statement.name?.text)) declarations.push(statement.getText(parsed));
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (names.has(declaration.name.getText(parsed))) declarations.push('const ' + declaration.getText(parsed) + ';');
    }
  }
  return vm.runInNewContext(declarations.join('\n') + '\nprepareEconomy;', bindings);
}

function preparationFixture(stageNumber, { earnedVehicleUpgrade = false, missingNavigation = false } = {}) {
  let save = createDefaultV100Save({ now: '2026-10-13T00:00:00.000Z' });
  if (earnedVehicleUpgrade) {
    save.caps = 1000;
    for (const id of Object.keys(save.unitLevels)) save.unitLevels[id] = Math.ceil(stageNumber * .8);
  }
  const initialSave = structuredClone(save), clicks = [], report = { transactions: [] };
  let surface = 'campaign';
  const nav = () => renderNavigation({ phase: 'map' }, surface, id => { surface = id; clicks.push(id); });
  const page = {
    getByRole(role, { name, exact }) {
      assert.equal(exact, true, 'native controls must retain their unambiguous accessible names');
      if (role === 'navigation') {
        assert.equal(name, nav().props['aria-label']);
        return { getByRole(childRole, options) {
          assert.equal(childRole, 'button');
          assert.equal(options.exact, true);
          return { async click() {
            assert.equal(missingNavigation, false, 'a missing preparation menu cannot pass');
            const controls = React.Children.toArray(nav().props.children).filter(child => child.props.children === options.name);
            assert.equal(controls.length, 1, 'the requested tab must exist in the actual production navigation');
            controls[0].props.onClick();
          } };
        } };
      }
      return { async click() {
        const cost = V100_VEHICLE.upgradeCosts[save.vehicle.upgradeLevel];
        assert.equal(surface, 'vehicle', 'the native failure map contains no visible legacy preparation buttons');
        assert.equal(name, `HPを強化 / ${cost} CAPS`);
        const result = upgradeV100Vehicle(save, { now: '2026-10-13T00:01:00.000Z' });
        assert.equal(result.applied, true);
        save = result.save;
      } };
    },
    locator() { throw new Error('These navigation cases require no unit purchase or level upgrade'); },
  };
  return {
    bindings: { page, uiClick: locator => locator.click(), saveAt: async () => structuredClone(save), V100_UNITS, V100_VEHICLE, v100LevelCost, report },
    initialSave, clicks, report, get save() { return save; }, get surface() { return surface; },
  };
}

for (const file of ['scripts/v100-normal-campaign-playthrough.mjs', 'scripts/v100-final-normal-playthrough.mjs']) {
  test(`${file}: fresh preparation uses the rendered tabs and preserves the entire save`, async () => {
    const fixture = preparationFixture(1);
    await preparationFunction(file, fixture.bindings)(1);
    assert.deepEqual(fixture.clicks, ['personnel', 'support-vehicle', 'personnel', 'campaign']);
    assert.equal(fixture.surface, 'campaign');
    assert.deepEqual(fixture.save, fixture.initialSave);
    assert.deepEqual(fixture.report.transactions, []);
  });

  test(`${file}: earned vehicle upgrade uses its real tab and production transaction`, async () => {
    const fixture = preparationFixture(5, { earnedVehicleUpgrade: true });
    const expected = upgradeV100Vehicle(fixture.initialSave, { now: '2026-10-13T00:01:00.000Z' });
    assert.equal(expected.applied, true);
    await preparationFunction(file, fixture.bindings)(5);
    assert.deepEqual(fixture.clicks, ['personnel', 'support-vehicle', 'vehicle', 'personnel', 'campaign']);
    assert.deepEqual(fixture.save, expected.save, 'only the ordinary earned-CAPS vehicle transaction may alter the save');
    assert.equal(fixture.report.transactions.length, 1);
    assert.equal(fixture.report.transactions[0].level, 1);
    assert.equal(fixture.report.transactions[0].caps, expected.save.caps);
  });

  test(`${file}: missing actual navigation fails instead of accepting a hidden legacy control`, async () => {
    const fixture = preparationFixture(1, { missingNavigation: true });
    await assert.rejects(preparationFunction(file, fixture.bindings)(1));
    assert.deepEqual(fixture.save, fixture.initialSave);
  });
}
