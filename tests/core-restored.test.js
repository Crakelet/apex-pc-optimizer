'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { RestorationManager, CAPTURE_SCRIPT, RESTORE_SCRIPT, validateSnapshot } = require('../src/main/restorationStore');
const { getResources } = require('../src/main/restorationResources');
const { OptimizerEngine, cleanScript } = require('../src/main/optimizerEngine');
const { normalizeRegistryCreation } = require('../src/main/systemInfo');
const { runPowerShell } = require('../src/main/systemInfo');
const { TWEAKS_DATA } = require('../src/main/tweaksData');
const { SNAPPY_UI_TWEAKS } = require('../src/main/snappyUiService');

function fixture(t, id = 'game_mode_windows') {
  const directory = path.join(__dirname, '../scratch/restored-tests', randomUUID());
  fs.mkdirSync(directory, { recursive: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const resources = getResources(id);
  const initial = { registry: resources.registry.map(item => ({ ...item, exists: true, kind: 'DWord', value: '0' })), services: [], bcd: [], adapters: [], tcp: [], rss: [], power: null };
  let state = structuredClone(initial), writes = 0;
  const runner = async (script, input) => {
    if (script === CAPTURE_SCRIPT) return { success: true, output: JSON.stringify(state) };
    if (script === RESTORE_SCRIPT) { state = structuredClone(input.snapshot); writes++; return { success: true, output: 'OK' }; }
    if (script === 'CHECK') return { success: true, output: 'true' };
    assert.equal(fs.existsSync(path.join(directory, 'history.json')), true, 'backup must exist before applying');
    state.registry.forEach(item => { item.value = '1'; }); writes++;
    return { success: true, output: 'OK' };
  };
  const manager = new RestorationManager({ file: path.join(directory, 'history.json'), runner });
  return { directory, resources, initial, manager, runner, getState: () => structuredClone(state), setState: value => { state = value; }, getWrites: () => writes };
}
test('all original catalog and Snappy entries retain free access and have backup descriptors', () => {
  assert.equal(TWEAKS_DATA.length, 50);
  for (const tweak of TWEAKS_DATA) {
    assert.equal(tweak.free, true);
    if (tweak.category !== 'clean') assert.doesNotThrow(() => getResources(tweak.id));
  }
  for (const tweak of SNAPPY_UI_TWEAKS) { assert.equal(tweak.free, true); assert.doesNotThrow(() => getResources(tweak.id)); }
});
test('restored engine reverts only owned records, never 45 default scripts', async t => {
  const f = fixture(t);
  const engine = new OptimizerEngine({ userDataPath: f.directory, runner: f.runner, restoration: f.manager });
  assert.equal((await engine.revertAll()).success, true); assert.equal(f.getWrites(), 0);
});

test('restore point creation requires a newly verified Windows sequence rather than an optimistic OK',async t=>{
 const f=fixture(t);let output='OK',request;
 const engine=new OptimizerEngine({userDataPath:f.directory,restoration:f.manager,runner:async(script,input,options)=>{request={script,input,options};return{success:true,output};}});
 assert.equal((await engine.createRestorePoint('Apex_Verification')).success,false);
 output='{"sequenceNumber":17}';const confirmed=await engine.createRestorePoint('Apex_Verification');
 assert.equal(confirmed.success,true);assert.equal(confirmed.sequenceNumber,17);assert.equal(request.input.description,'Apex_Verification');assert.equal(request.options.timeout,180000);
 output='{"sequenceNumber":"not-confirmed"}';assert.equal((await engine.createRestorePoint('Apex_Verification')).success,false);
});
test('original values survive process restart and restoration', async t => {
  const f = fixture(t);
  const result = await f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK');
  assert.equal(result.success, true);
  const restarted = new RestorationManager({ file: f.manager.file, runner: f.runner });
  assert.equal((await restarted.revert('tweak:game_mode_windows', f.resources)).success, true);
  assert.deepEqual(f.getState(), f.initial);
});
test('a foreign change blocks restore instead of overwriting user configuration', async t => {
  const f = fixture(t); await f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK');
  const external = f.getState(); external.registry[0].value = '42'; f.setState(external);
  const result = await f.manager.revert('tweak:game_mode_windows', f.resources);
  assert.equal(result.conflict, true); assert.deepEqual(f.getState(), external);
});

test('overlapping later tweaks must be restored first even when both wrote the same value', async t => {
  const f = fixture(t);
  assert.equal((await f.manager.apply('tweak:first', f.resources, 'APPLY', 'CHECK')).success, true);
  assert.equal((await f.manager.apply('snappy:later', f.resources, 'APPLY', 'CHECK')).success, true);
  const writes = f.getWrites();
  const blocked = await f.manager.revert('tweak:first', f.resources);
  assert.equal(blocked.success, false); assert.equal(blocked.conflict, true); assert.equal(blocked.blockedBy, 'snappy:later');
  assert.equal(f.getWrites(), writes, 'the older restore must never erase a newer adjustment');
  assert.equal((await f.manager.revert('snappy:later', f.resources)).success, true);
  assert.equal((await f.manager.revert('tweak:first', f.resources)).success, true);
  assert.deepEqual(f.getState(), f.initial);
});

test('a forged dynamic adapter backup cannot target another adapter property', async t => {
  const f = fixture(t);
  const resources = { registry: [], services: [], bcd: [], tcp: [], rss: [], registryInterfaces: [], adapterPatterns: ['*EEE'], adapterRss: false, power: null };
  const state = { registry: [], services: [], bcd: [], tcp: [], rss: [], power: null, adapters: [{ name: 'Ethernet', keyword: '*EEE', value: ['0'] }] };
  let writes = 0;
  const manager = new RestorationManager({ file: f.manager.file, runner: async script => {
    if (script === CAPTURE_SCRIPT) return { success: true, output: JSON.stringify(state) };
    if (script === 'CHECK') return { success: true, output: 'true' };
    writes++; return { success: true, output: 'OK' };
  } });
  assert.equal((await manager.apply('tweak:adapter', resources, 'APPLY', 'CHECK')).success, true);
  const history = manager.read(); history.entries[0].before.adapters[0].keyword = '*Unrelated';
  fs.writeFileSync(manager.file, JSON.stringify(history));
  assert.equal((await manager.revert('tweak:adapter', resources)).conflict, true);
  assert.equal(writes, 1);
});

test('corrupt history fails before capture or mutation', async t => {
  const f = fixture(t); let calls = 0;
  fs.writeFileSync(f.manager.file, JSON.stringify({ schema: 1, entries: [null] }));
  const manager = new RestorationManager({ file: f.manager.file, runner: async () => { calls++; throw Error('must not execute'); } });
  await assert.rejects(manager.apply('tweak:test', f.resources, 'APPLY', 'CHECK'), /historial/);
  assert.equal(calls, 0);
});
test('duplicate apply cannot replace the original backup', async t => {
  const f = fixture(t); await f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK');
  const record = f.manager.read().entries[0];
  assert.equal((await f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK')).success, false);
  assert.deepEqual(f.manager.read().entries[0].before, record.before);
});
test('failed apply remains failed with a durable original backup', async t => {
  const f = fixture(t);
  const badRunner = async (script, input) => script === 'FAIL' ? { success: false, output: 'Access denied' } : f.runner(script, input);
  const manager = new RestorationManager({ file: f.manager.file, runner: badRunner });
  assert.equal((await manager.apply('tweak:game_mode_windows', f.resources, 'FAIL', 'CHECK')).success, false);
  assert.deepEqual(manager.read().entries[0].before, f.initial);
  assert.equal(manager.read().entries[0].status, 'failed');
});
test('backup persistence failure prevents the mutation', async t => {
  const f = fixture(t); const rename = fs.renameSync;
  fs.renameSync = () => { throw new Error('disk full'); };
  try { await assert.rejects(f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK'), /disk full/); }
  finally { fs.renameSync = rename; }
  assert.equal(f.getWrites(), 0);
});
test('a concurrent edit after the first snapshot is not overwritten', async t => {
  const f = fixture(t); let captures = 0;
  const runner = async (script, input) => {
    if (script === CAPTURE_SCRIPT && ++captures === 2) { const state = f.getState(); state.registry[0].value = '77'; f.setState(state); }
    return f.runner(script, input);
  };
  const manager = new RestorationManager({ file: f.manager.file, runner });
  const result = await manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK');
  assert.equal(result.success, false); assert.equal(f.getWrites(), 0); assert.equal(f.getState().registry[0].value, '77');
});
test('tampered backup cannot target keys outside the compiled resource list', async t => {
  const f = fixture(t); await f.manager.apply('tweak:game_mode_windows', f.resources, 'APPLY', 'CHECK');
  const journal = f.manager.read(); journal.entries[0].before.registry[0].path = 'HKLM:\\SOFTWARE\\Other';
  fs.writeFileSync(f.manager.file, JSON.stringify(journal));
  await assert.rejects(f.manager.revert('tweak:game_mode_windows', f.resources), /ajeno/);
  assert.equal(f.getWrites(), 1);
});
test('check statuses is a single read-only process and does not adopt settings', async t => {
  const f = fixture(t); let calls = 0;
  const engine = new OptimizerEngine({ userDataPath: f.directory, restoration: f.manager, runner: async script => { calls++; assert.match(script, /ConvertTo-Json/); return { success: true, output: JSON.stringify({ game_dvr: true }) }; } });
  const statuses = await engine.checkAllStatuses();
  assert.equal(statuses.game_dvr, true); assert.equal(calls, 1); assert.deepEqual(engine.state.appliedTweaks, {});
});

test('corrupt optional UI state preserves the file and does not block launch or weaken backups', async t => {
  const f = fixture(t); const stateFile = path.join(f.directory, 'tweaks-state-v1.json');
  const damaged = '{damaged metadata'; fs.writeFileSync(stateFile, damaged);
  const checkScript = TWEAKS_DATA.find(item => item.id === 'game_mode_windows').checkScript;
  const runner = async (script, input) => script === checkScript ? { success: true, output: 'true' } : f.runner(script, input);
  const restoration = new RestorationManager({ file: f.manager.file, runner });
  const engine = new OptimizerEngine({ userDataPath: f.directory, runner, restoration });
  assert.match(engine.stateWarning, /auxiliar/); assert.deepEqual(engine.state.appliedTweaks, {});
  assert.equal((await engine.applyTweak('game_mode_windows')).success, true);
  assert.equal(fs.readFileSync(stateFile, 'utf8'), damaged);
  assert.equal((await engine.revertTweak('game_mode_windows')).success, true);
  assert.equal(fs.readFileSync(stateFile, 'utf8'), damaged);
  fs.writeFileSync(f.manager.file, '{damaged recovery history');
  const writes = f.getWrites();
  assert.equal((await engine.applyTweak('game_mode_windows')).success, false);
  assert.equal(f.getWrites(), writes);
});
test('registry creation preserves existing keys without rewriting filesystem creation', () => {
  assert.match(normalizeRegistryCreation('New-Item -Path "HKCU:\\Software\\Test" -Force'), /^New-ApexRegistryKey/);
  assert.match(normalizeRegistryCreation('$p = "HKLM:\\SOFTWARE\\Test"\nNew-Item -Path $p -Force'), /New-ApexRegistryKey -Path \$p/);
  assert.equal(normalizeRegistryCreation('$file = "C:\\Temp"\nNew-Item -Path $file -Force'), '$file = "C:\\Temp"\nNew-Item -Path $file -Force');
});
test('cleaners use conservative confirmed deletion and do not run historical recursive removal', () => {
  for (const tweak of TWEAKS_DATA.filter(item => item.category === 'clean')) {
    const script = cleanScript(tweak.id);
    assert.match(script, /Remove-ApexCache/); assert.doesNotMatch(script, /Remove-Item[^\n]*-Recurse/);
    assert.match(script, /freedBytes/);
  }
});
test('restored PowerShell scripts parse without executing any Windows change', { skip: process.platform !== 'win32' }, async () => {
  const scripts = [CAPTURE_SCRIPT, RESTORE_SCRIPT,
    ...TWEAKS_DATA.flatMap(tweak => tweak.category === 'clean' ? [cleanScript(tweak.id)] : [tweak.applyScript, tweak.checkScript]),
    ...SNAPPY_UI_TWEAKS.flatMap(tweak => [tweak.applyScript, tweak.checkScript])];
  const batches = []; let batch = [], size = 0;
  for (const script of scripts) { if (size + script.length > 11000 && batch.length) { batches.push(batch); batch = []; size = 0; } batch.push(script); size += script.length; }
  if (batch.length) batches.push(batch);
  for (const source of batches) {
    const result = await runPowerShell(`
      $allErrors = @()
      foreach ($text in @($data.scripts)) {
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$null, [ref]$errors) | Out-Null
        $allErrors += @($errors | ForEach-Object { $_.Message })
      }
      @{ errors = $allErrors } | ConvertTo-Json -Compress
    `, { scripts: source });
    assert.equal(result.success, true, result.output);
    assert.deepEqual(JSON.parse(result.output).errors, []);
  }
});
