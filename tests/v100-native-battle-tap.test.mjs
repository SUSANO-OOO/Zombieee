import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { nativeBattleTap, readNativeBattleControl, normalTacticalInput } from "../scripts/v100-normal-tactical-input.mjs";

function fixture({ unitCard = false, covered = false, disabledAfterScroll = false, uncoverAfterScroll = false } = {}) {
  const calls = [], phases = [];
  let isCovered = covered;
  const element = {
    disabled: false,
    getAttribute: () => null,
    matches: () => unitCard,
    getBoundingClientRect: () => ({ x: 10, y: 20, width: 60, height: 30 }),
  };
  const document = { elementFromPoint: () => ({ closest: () => isCovered ? {} : element }),querySelectorAll:()=>[element] };
  const locator = {
    evaluateAll: async callback => {
      calls.push("observe");
      return vm.runInNewContext(`(${callback.toString()})(elements)`, { document, elements: [element] });
    },
    scrollIntoViewIfNeeded: async ({ timeout }) => {
      calls.push(["scroll", timeout]);
      if (disabledAfterScroll) element.disabled = true;
      if (uncoverAfterScroll) isCovered = false;
    },
  };
  const page = { mouse: Object.fromEntries(["move", "down", "up"].map(name => [name, async (...args) => { calls.push([name, ...args]); }])) };
  page.evaluate=async(callback,selection)=>{calls.push('direct-observe');return vm.runInNewContext(`(${callback.toString()})(selection)`,{document,selection});};
  return { calls, phases, element, locator, page };
}

test("live ability eligibility and hit owner use one read before native move/down/up", async () => {
  const f = fixture();
  assert.equal(await nativeBattleTap(f.page, f.locator, f.phases), true);
  assert.deepEqual(f.calls, ["observe", ["move", 40, 35], ["down"], ["up"]]);
  assert.deepEqual(f.phases.map(phase => phase.name), ["observe-control", "move", "down", "up"]);
  assert.ok(f.phases.every(phase => phase.status === "completed" && phase.endedAt >= phase.startedAt));
});

test("covered, absent, ambiguous and disabled controls cannot receive a pointer", async () => {
  const f = fixture({ covered: true });
  assert.equal(await nativeBattleTap(f.page, f.locator), false);
  assert.deepEqual(f.calls, ["observe"]);
  assert.equal(readNativeBattleControl([]), null);
  assert.equal(readNativeBattleControl([{}, {}]), null);
  assert.equal(readNativeBattleControl([{ disabled: true }]), null);
  assert.equal(readNativeBattleControl([{ disabled: false, getAttribute: () => "true" }]), null);
});

test("unit cards retain the 750 ms scroll and refresh current eligibility afterward", async () => {
  const f = fixture({ unitCard: true, disabledAfterScroll: true });
  assert.equal(await nativeBattleTap(f.page, f.locator, f.phases), false);
  assert.deepEqual(f.calls, ["observe", ["scroll", 750], "observe"]);
  assert.deepEqual(f.phases.map(phase => phase.name), ["observe-control", "scroll-control", "refresh-control"]);
});

test("portrait opt-in uses an already owned fresh centre without a redundant scroll", async () => {
  const f = fixture({ unitCard: true });
  assert.equal(await nativeBattleTap(f.page, f.locator, f.phases, null, { skipVisibleCardScroll: true }), true);
  assert.deepEqual(f.calls, ["observe", ["move", 40, 35], ["down"], ["up"]]);
  assert.deepEqual(f.phases.map(p => p.name), ["observe-control", "move", "down", "up"]);
  const disabled = fixture({ unitCard: true }); disabled.element.disabled = true;
  assert.equal(await nativeBattleTap(disabled.page, disabled.locator, disabled.phases, null, { skipVisibleCardScroll: true }), false);
  assert.deepEqual(disabled.calls, ["observe"]);
  await assert.rejects(nativeBattleTap(f.page, f.locator, [], null, { skipVisibleCardScroll: "true" }), /Invalid visible card scroll option/);
});

test("portrait opt-in keeps the original scroll deadline, refresh and rejection when the centre is hidden", async () => {
  for (const options of [{}, { disabledAfterScroll: true }, { uncoverAfterScroll: true }]) {
    const f = fixture({ unitCard: true, covered: true, ...options });
    const passed = await nativeBattleTap(f.page, f.locator, f.phases, null, { skipVisibleCardScroll: true });
    assert.equal(passed, options.uncoverAfterScroll === true);
    assert.deepEqual(f.calls.slice(0, 3), ["observe", ["scroll", 750], "observe"]);
    assert.deepEqual(f.calls.slice(3), passed ? [["move", 40, 35], ["down"], ["up"]] : []);
  }
});

test("failed native move is recorded and never sends a later down or up", async () => {
  const f = fixture();
  f.page.mouse.move = async () => { throw new Error("native move rejected"); };
  await assert.rejects(nativeBattleTap(f.page, f.locator, f.phases), /native move rejected/);
  assert.deepEqual(f.calls, ["observe"]);
  assert.equal(f.phases.at(-1).name, "move");
  assert.equal(f.phases.at(-1).status, "error");
  assert.match(f.phases.at(-1).error, /native move rejected/);
});

test('known CSS controls keep the fresh hit owner and ordered acknowledgements in one browser call',async()=>{
  const selection={selector:'button.support-btn.medical',index:0};
  const f=fixture();assert.equal(await nativeBattleTap(f.page,f.locator,f.phases,selection),true);
  assert.deepEqual(f.calls,['direct-observe',['move',40,35],['down'],['up']]);
  assert.deepEqual(f.phases.map(p=>p.name),['observe-control','move','down','up']);
  for(const options of [{covered:true},{unitCard:true,disabledAfterScroll:true}]){
    const blocked=fixture(options);assert.equal(await nativeBattleTap(blocked.page,blocked.locator,blocked.phases,selection),false);
    assert.ok(blocked.calls.every(c=>!Array.isArray(c)||!['move','down','up'].includes(c[0])));
  }
  const missing=fixture();assert.equal(await nativeBattleTap(missing.page,missing.locator,missing.phases,{...selection,index:1}),false);
  assert.deepEqual(missing.calls,['direct-observe']);
  await assert.rejects(nativeBattleTap(f.page,f.locator,[],{...selection,index:-1}),/Invalid native control/);
});

test('ordinary deployment uses fixed formation counts and fresh nth owners without a locator count call',async()=>{
  for(const disabledAfterScroll of [false,true]){
    const calls=[],record={number:14,inputs:[]};
    const cards=[0,1].map(index=>({disabled:index===0,dataset:{kind:'guardian'},getAttribute:()=>null,matches:()=>true,
      getBoundingClientRect:()=>({x:10+index*80,y:20,width:60,height:30})}));
    const document={querySelectorAll:()=>cards,elementFromPoint:x=>({closest:()=>cards[x<80?0:1]})};
    const snapshot={time:1,running:true,over:false,won:false,baseHp:1000,baseMaxHp:1000,energy:100,fighters:[],deployQueue:[]};
    const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
    const page={evaluate:async(callback,arg)=>vm.runInNewContext(`(${callback.toString()})(arg)`,{window,document,arg}),
      mouse:Object.fromEntries(['move','down','up'].map(name=>[name,async()=>calls.push(name)])),
      locator(selector){
        if(selector==='button.unit-card[data-kind]')return{evaluateAll:async reader=>reader(cards)};
        if(selector==='button.manual-ability-ready.available[aria-disabled="false"]')return{evaluateAll:async reader=>reader([])};
        assert.equal(selector,'button.unit-card[data-kind="guardian"]');
        return{get count(){throw new Error('redundant locator count');},nth(index){return{scrollIntoViewIfNeeded:async options=>{
          assert.equal(index,1);assert.equal(options.timeout,750);calls.push('scroll');if(disabledAfterScroll)cards[index].disabled=true;
        }};}};
      }};
    await normalTacticalInput(page,record);
    assert.deepEqual(calls,disabledAfterScroll?['scroll']:['scroll','move','down','up']);
    assert.deepEqual(record.inputs,disabledAfterScroll?[]:[{time:1,action:'deploy',kind:'guardian',command:100}]);
  }
});
