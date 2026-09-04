import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import yaml from "js-yaml";
import { DIAGNOSTIC_SOURCE_HEAD, DIAGNOSTIC_CASES, DIAGNOSTIC_STATES, runDiagnostic, runDiagnosticEntrypoint, persistObservation } from "../../scripts/v100-mission-oracle-diagnostic.mjs";

const current = await readFile("app/AshfallGame.tsx", "utf8");
const original = execFileSync("git", ["show", `${DIAGNOSTIC_SOURCE_HEAD}:app/AshfallGame.tsx`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
function nodeFor(source, name, property = false) {
  const parsed = ts.createSourceFile("app.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  function visit(node) {
    if ((property ? ts.isPropertyAssignment(node) : ts.isFunctionDeclaration(node)) && node.name?.getText(parsed) === name) hits.push(node);
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.equal(hits.length, 1, name);
  return { node: hits[0], parsed, text: hits[0].getText(parsed) };
}
function scrub(source) {
  const nodes = [nodeFor(source, "stationMissionFinalCanvasAudit"), nodeFor(source, "getStationMissionFinalCanvasAudit", true)]
    .sort((a,b) => b.node.getStart(b.parsed) - a.node.getStart(a.parsed));
  for (const entry of nodes) source = source.slice(0, entry.node.getStart(entry.parsed)) + "QA_AUDIT_BOUNDARY" + source.slice(entry.node.end);
  return source;
}
test("every source byte outside the existing QA audit and getter is unchanged", () => {
  assert.equal(scrub(current), scrub(original));
  assert.equal(nodeFor(current,"drawStationMission").text, nodeFor(original,"drawStationMission").text);
  assert.equal(nodeFor(current,"drawWorld").text, nodeFor(original,"drawWorld").text);
  const func = nodeFor(current,"stationMissionFinalCanvasAudit").text;
  const start = func.indexOf("  // DIAGNOSTIC ONLY:");
  const end = func.indexOf("  return {\n    applicable: true,\n    // The final canvas", start);
  assert(start > 0 && end > start);
  const stripped = (func.slice(0,start) + func.slice(end))
    .replace("  includeDiagnostic = false,\n", "")
    .replace("    ...(includeDiagnostic ? { diagnostic } : {}),\n", "");
  assert.equal(stripped, nodeFor(original,"stationMissionFinalCanvasAudit").text);
});

function executeDefault(source, painted, matching) {
  let canvases = 0, draws = 0;
  const expected = new Uint8ClampedArray(40 * 20 * 4);
  const actual = new Uint8ClampedArray(expected.length);
  for (let i=0;i<expected.length;i+=4) {
    expected.set([100,100,100,255],i);
    actual.set(matching ? [100,100,100,painted?255:0] : [0,0,0,painted?255:0], i);
  }
  const context = vm.createContext({ W:40,H:20, STATION_MISSION_TYPES:{SEQUENTIAL_SEAL:"sequential-seal"},
    document: {
      createElement() {
        const index = canvases++;
        return {
          getContext() {
            return {
              drawImage() {},
              getImageData() { return { data: index === 0 ? expected : actual }; },
            };
          },
        };
      },
    },
    drawStationMission(){draws++;}, Math, Number });
  const compiled = ts.transpileModule(nodeFor(source,"stationMissionFinalCanvasAudit").text, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInContext(compiled,context);
  const result = context.stationMissionFinalCanvasAudit({dataset:{dpr:"1"}}, {scale:1,offsetX:0,offsetY:0},
    {definition:{missionType:"sequential-seal"},stageMission:{powerActivated:0}},
    {"station-tunnel-mission-art-source":{complete:true,naturalWidth:1600,naturalHeight:900}});
  return { result:JSON.parse(JSON.stringify(result)),canvases,draws };
}
test("actual default audit executes identically on green and original negative pixel inputs", () => {
  for (const [painted,matching] of [[true,true],[false,true],[true,false]]) {
    const before=executeDefault(original,painted,matching),after=executeDefault(current,painted,matching);
    assert.deepEqual(after,before);assert.equal(after.canvases,2);assert.equal(after.draws,1);
    assert.equal(after.result.pass,painted&&matching);
    assert.equal("diagnostic" in after.result,false);
  }
});

async function withTemporary(action) {
  const directory=await mkdtemp(path.join(os.tmpdir(),"v100-oracle-unit-"));
  try {return await action(directory);} finally {
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+"v100-oracle-unit-"));
    await rm(directory,{recursive:true,force:true});
  }
}
test("finite driver executes four contexts once and stops on its first infrastructure error", async () => withTemporary(async directory => {
  assert.equal(DIAGNOSTIC_CASES.length,4);assert.equal(DIAGNOSTIC_STATES.length,3);
  const calls=[];
  const result=await runDiagnostic({root:path.join(directory,"complete"),baseUrl:"http://127.0.0.1:4000",buildIdentity:async()=>({diagnostic:true}),
    executeCase:async spec=>{calls.push(spec);return {...spec,observations:DIAGNOSTIC_STATES.map(state=>({state,original:{pass:false}}))};}});
  assert.equal(result.status,"DIAGNOSTIC_COMPLETE_NOT_ACCEPTANCE");assert.equal(result.acceptance,false);
  assert.equal(result.cases.flatMap(({ observations }) => observations).length,12);
  assert.deepEqual(calls,DIAGNOSTIC_CASES);
  let attempts=0;
  await assert.rejects(runDiagnostic({root:path.join(directory,"failure"),baseUrl:"http://127.0.0.1:4000",buildIdentity:async()=>({}),
    executeCase:async()=>{attempts++;throw new Error("native fixture failure");}}),/native fixture failure/);
  assert.equal(attempts,1);
  const failure=JSON.parse(await readFile(path.join(directory,"failure/report.json"),"utf8"));
  assert.equal(failure.status,"DIAGNOSTIC_INCOMPLETE");assert.equal(failure.acceptance,false);
  await assert.rejects(runDiagnostic({baseUrl:"https://example.com"}),/localhost/);
}));

test("direct and exact canonical-runner imports execute once; test imports and other targets stay inert", async () => {
  const driver = path.resolve("scripts/v100-mission-oracle-diagnostic.mjs");
  const runner = path.resolve("scripts/run-browser-qa-with-server.mjs");
  for (const [argv, expected] of [
    [[process.execPath, driver], true],
    [[process.execPath, runner, driver], true],
    [[process.execPath, runner, "scripts/another-qa.mjs"], false],
    [[process.execPath, path.resolve("tests/diagnostic-only/v100-mission-oracle-diagnostic.test.mjs")], false],
    [[process.execPath], false],
  ]) {
    let count = 0;
    assert.equal(await runDiagnosticEntrypoint({ argv, execute: async () => { count++; } }), expected);
    assert.equal(count, expected ? 1 : 0);
  }
  await assert.rejects(runDiagnosticEntrypoint({ argv: [process.execPath, runner, driver],
    execute: async () => { throw new Error("entrypoint fixture failure"); } }), /entrypoint fixture failure/);
  const runnerSource = await readFile(runner, "utf8");
  assert(runnerSource.includes("const target = process.argv[2]"));
  assert(runnerSource.includes("await import(pathToFileURL(path.resolve(target)).href)"));
  assert((await readFile(driver, "utf8")).endsWith("await runDiagnosticEntrypoint();\n"));
});

test("zero, duplicated, reordered or wrong-case observations fail closed and persist incomplete status", async () => withTemporary(async directory => {
  for (const [name, states, wrongCase] of [
    ["zero", [], false], ["duplicate", ["start", "start", "power-3"], false],
    ["reordered", ["power-1", "start", "power-3"], false],
    ["wrong-case", DIAGNOSTIC_STATES, true],
  ]) {
    let count = 0;
    const root = path.join(directory, name);
    await assert.rejects(runDiagnostic({ root, baseUrl: "http://127.0.0.1:4000", buildIdentity: async () => ({}),
      executeCase: async spec => { count++; return { ...spec, engine: wrongCase ? "other" : spec.engine,
        observations: states.map(state => ({ state })) }; } }));
    assert.equal(count, 1);
    const report = JSON.parse(await readFile(path.join(root, "report.json"), "utf8"));
    assert.equal(report.status, "DIAGNOSTIC_INCOMPLETE");
    assert.equal(report.acceptance, false);
    assert.equal(report.cases.length, 0);
  }
}));

test("original red and all raw image bytes persist without requiring a later screenshot", async () => withTemporary(async directory => {
  const encoded="data:image/png;base64,"+Buffer.from("fixture-bytes").toString("base64");
  const images=Object.fromEntries(["expectedWorld","finalBackProjected","actualBacking","directNativeReference","expectedOnlyRoundTrip"].map(name=>[name,encoded]));
  await persistObservation(directory,"start",{pass:false,finalNearMatchRatio:.6358677,diagnostic:{diagnosticOnly:true,acceptance:false,images}});
  const result=JSON.parse(await readFile(path.join(directory,"start-observation.json"),"utf8"));
  assert.equal(result.original.pass,false);assert.equal(result.original.finalNearMatchRatio,.6358677);
  assert.equal(Object.keys(result.diagnostic.images).length,5);
  await assert.rejects(persistObservation(directory,"start",{diagnostic:{diagnosticOnly:true,acceptance:false,images}}),/EEXIST/);
}));

test("diagnostic workflow is isolated, pinned, finite and cannot deploy or invoke acceptance", async () => {
  const workflow=yaml.load(await readFile(".github/workflows/v100-mission-oracle-diagnostic.yml","utf8"));
  assert.deepEqual(workflow.on,{push:{branches:["codex/v100-mission-oracle-ea6"]}});
  assert.deepEqual(workflow.permissions,{contents:"read"});assert.deepEqual(Object.keys(workflow.jobs),["diagnostic"]);
  const job=workflow.jobs.diagnostic;assert.equal(job["runs-on"],"macos-15-intel");assert.equal(job["timeout-minutes"],25);
  assert.equal(job.steps.filter(step=>step.run?.includes("run-browser-qa-with-server")).length,1);
  assert(job.steps.some(step=>step.run==="node scripts/verify-playwright-container-runtime.mjs --macos"));
  assert(job.steps.some(step=>step.with?.["node-version"]==="22.13.0"));
  assert(!job.steps.some(step=>step.run?.includes("qa:v100-phase-g")));
});
