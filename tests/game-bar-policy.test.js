'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {TWEAKS_DATA} = require('../src/main/tweaksData');
const {getResources, getResourcesForRestore} = require('../src/main/restorationResources');
const {RestorationManager, CAPTURE_SCRIPT, RESTORE_SCRIPT} = require('../src/main/restorationStore');
const {OptimizerEngine} = require('../src/main/optimizerEngine');

const tweak = TWEAKS_DATA.find(item => item.id === 'game_bar_presence');
function snapshot(resources, enabled) {
  return {registry:resources.registry.map(item => item.name === 'Debugger'
    ? {...item,exists:enabled,kind:enabled?'String':null,value:enabled?'C:\\Windows\\System32\\systray.exe':null}
    : {...item,exists:true,kind:'DWord',value:enabled?'0':'1'}),services:[],bcd:[],adapters:[],tcp:[],rss:[],power:null};
}
function fixture(t, legacy = false) {
  const base = path.resolve(__dirname, '../scratch/game-bar-policy-tests');
  fs.mkdirSync(base, {recursive:true});
  const directory = fs.mkdtempSync(path.join(base,'owned-'));
  t.after(() => { assert.ok(path.resolve(directory).startsWith(base + path.sep)); fs.rmSync(directory,{recursive:true,force:true}); });
  const resources = getResources(tweak.id, {legacyGameBar:legacy});
  const before = snapshot(resources,false), after = snapshot(resources,true);
  let state = structuredClone(legacy ? after : before);
  const calls = [];
  const runner = async (script,input) => {
    calls.push({script,input});
    if (script === CAPTURE_SCRIPT) { assert.deepEqual(input.resources,resources); return {success:true,output:JSON.stringify(state)}; }
    if (script === RESTORE_SCRIPT) { state = structuredClone(input.snapshot); return {success:true,output:'OK'}; }
    if (script === tweak.applyScript) { state = structuredClone(after); return {success:true,output:'OK'}; }
    if (script === tweak.checkScript) return {success:true,output:'true'};
    throw new Error('Only fixture-owned actions are allowed.');
  };
  const restoration = new RestorationManager({file:path.join(directory,'history.json'),runner});
  if (legacy) fs.writeFileSync(restoration.file,JSON.stringify({schema:1,entries:[{id:'tweak:game_bar_presence',status:'applied',at:'2026-10-28T12:00:00.000Z',before,after}]}));
  return {before,after,resources,calls,restoration,engine:new OptimizerEngine({userDataPath:directory,runner,restoration}),getState:()=>structuredClone(state)};
}

test('Game Bar action uses only capture preferences, without execution redirects or process termination', () => {
  assert.equal(tweak.free,true);
  assert.deepEqual(getResources(tweak.id).registry.map(item=>item.name),['AllowGameDVR','GameDVR_Enabled']);
  for (const script of [tweak.applyScript,tweak.checkScript,tweak.revertScript]) assert.doesNotMatch(script,/Debugger|Image File Execution Options|systray|Stop-Process|Remove-Item\b/i);
  assert.equal((tweak.applyScript.match(/Set-ItemProperty/g)||[]).length,2);
  assert.doesNotMatch(tweak.description,/inyecta|cada proceso/i);
});

test('new Game Bar application and restoration never capture or write the historical debugger target', async t => {
  const f = fixture(t);
  assert.equal((await f.engine.applyTweak(tweak.id)).success,true);
  assert.equal(f.restoration.active('tweak:game_bar_presence').before.registry.length,2);
  assert.equal((await f.engine.revertTweak(tweak.id)).success,true);
  assert.deepEqual(f.getState(),f.before);
  const restored = f.calls.find(call=>call.script === RESTORE_SCRIPT);
  assert.equal(restored.input.snapshot.registry.length,2);
  assert.ok(f.calls.filter(call=>call.input?.resources).every(call=>call.input.resources.registry.every(item=>item.name !== 'Debugger')));
});

test('an exact owned historical Game Bar backup still restores its original debugger value', async t => {
  const f = fixture(t,true);
  assert.equal((await f.engine.revertTweak(tweak.id)).success,true);
  assert.deepEqual(f.getState(),f.before);
  assert.equal(f.restoration.read().entries[0].status,'reverted');
  assert.equal(f.calls.filter(call=>call.script === RESTORE_SCRIPT).length,1);
  assert.equal(f.calls.find(call=>call.script === RESTORE_SCRIPT).input.snapshot.registry[0].exists,false);
});

test('historical compatibility recognizes only the exact closed target set and matching active owner', () => {
  const resources = getResources(tweak.id,{legacyGameBar:true});
  const record = {id:'tweak:game_bar_presence',status:'applied',before:snapshot(resources,false),after:snapshot(resources,true)};
  assert.equal(getResourcesForRestore(tweak.id,record).registry.length,3);
  for (const alter of [
    item=>{item.id='tweak:other';},
    item=>{item.status='reverted';},
    item=>{item.before.registry[0].path += '\\Other';},
    item=>{item.after.registry[0].name='Other';},
    item=>{item.before.registry[0]=item.before.registry[1];}
  ]) {
    const changed = structuredClone(record); alter(changed);
    assert.equal(getResourcesForRestore(tweak.id,changed).registry.length,2);
  }
  assert.throws(()=>getResources('game_mode_windows',{legacyGameBar:true}),/no corresponde/);
});

test('forged historical Game Bar targets fail before any mocked capture or write', async t => {
  const f = fixture(t,true);
  const history = f.restoration.read();
  history.entries[0].before.registry[0].path = 'HKLM:\\SOFTWARE\\Other';
  fs.writeFileSync(f.restoration.file,JSON.stringify(history));
  assert.equal((await f.engine.revertTweak(tweak.id)).success,false);
  assert.equal(f.calls.length,0);
  assert.deepEqual(f.getState(),f.after);
});
