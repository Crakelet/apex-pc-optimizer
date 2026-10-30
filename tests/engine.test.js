'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { OptimizerEngine, JournalStore } = require('../src/main/safeEngine');
const { SimulatedRegistryAdapter } = require('../src/main/registryAdapter');
const { getSetting } = require('../src/main/safeCatalog');
const absent = { keyExists: false, exists: false, kind: null, value: null };
function fixture(t, initial = absent) {
  const root = path.join(__dirname, '../scratch/unit-tests');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'apex-unit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new JournalStore(path.join(directory, 'history.json'));
  const adapter = new SimulatedRegistryAdapter([['game-mode', initial]]);
  return { engine: new OptimizerEngine({ store, adapter, simulated: true }), store, adapter };
}
test('empty history cannot revert arbitrary settings', async t => {
  const { engine, adapter } = fixture(t); let writes = 0; adapter.write = async () => { writes++; };
  assert.deepEqual(engine.history(), []); await assert.rejects(engine.revert('missing')); assert.equal(writes, 0);
});
for (const before of [absent, { keyExists: true, exists: false, kind: null, value: null }, { keyExists: true, exists: true, kind: 'DWord', value: 0 }, { keyExists: true, exists: true, kind: 'DWord', value: 4294967295 }]) {
  test(`exact original restored: ${JSON.stringify(before)}`, async t => {
    const { engine, adapter, store } = fixture(t, before); const write = adapter.write.bind(adapter);
    adapter.write = async (setting, value) => { assert.deepEqual(store.read().entries[0].before, before); return write(setting, value); };
    await engine.apply('game-mode', before); const id = engine.history()[0].id;
    // A fresh engine uses the persisted backup rather than defaults.
    const restarted = new OptimizerEngine({ adapter, store, simulated: true });
    await restarted.revert(id); assert.deepEqual(await adapter.read(getSetting('game-mode')), before);
    assert.equal(restarted.history()[0].status, 'reverted');
  });
}
test('existing desired value is skipped and never adopted', async t => {
  const { engine } = fixture(t, { keyExists: true, exists: true, kind: 'DWord', value: 1 });
  assert.equal((await engine.apply('game-mode', { keyExists: true, exists: true, kind: 'DWord', value: 1 })).status, 'skipped'); assert.equal(engine.history().length, 0);
});
test('backup failure prevents Windows writes', async t => {
  const { engine, store, adapter } = fixture(t); let writes = 0;
  store.write = () => { throw new Error('disk full'); }; adapter.write = async () => { writes++; };
  await assert.rejects(engine.apply('game-mode', absent), /disk full/); assert.equal(writes, 0);
});
test('failed operation retains original and does not claim success', async t => {
  const { engine, adapter } = fixture(t); adapter.write = async () => { throw new Error('access denied'); };
  await assert.rejects(engine.apply('game-mode', absent), /access denied/); assert.equal(engine.history()[0].status, 'failed'); assert.deepEqual(engine.history()[0].before, absent);
});
test('verification failure is not success', async t => {
  const { engine, adapter } = fixture(t); adapter.write = async () => {};
  await assert.rejects(engine.apply('game-mode', absent), /no confirmó/); assert.equal(engine.history()[0].status, 'failed');
});
test('duplicate apply cannot replace the original backup', async t => {
  const { engine } = fixture(t); await engine.apply('game-mode', absent);
  await assert.rejects(engine.apply('game-mode', absent), /respaldo activo/); assert.equal(engine.history().length, 1);
});
test('external change blocks restore without overwriting it', async t => {
  const { engine, adapter } = fixture(t); await engine.apply('game-mode', absent);
  const external = { keyExists: true, exists: true, kind: 'DWord', value: 42 }; adapter.values.set('game-mode', external);
  await assert.rejects(engine.revert(engine.history()[0].id), /no lo sobrescribirá/); assert.deepEqual(await adapter.read(getSetting('game-mode')), external);
});
test('corrupt history fails closed', async t => {
  const { engine, store, adapter } = fixture(t); fs.writeFileSync(store.file, '{broken'); let writes = 0; adapter.write = async () => { writes++; };
  await assert.rejects(engine.apply('game-mode')); assert.equal(writes, 0);
});
test('concurrent operation is rejected', async t => {
  const { engine, adapter } = fixture(t); const read = adapter.read.bind(adapter); let release;
  adapter.read = async item => { await new Promise(resolve => { release = resolve; }); adapter.read = read; return read(item); };
  const pending = engine.apply('game-mode', absent); await assert.rejects(engine.apply('menu-delay', absent), /en curso/); release(); await pending;
});
test('interrupted prepared record remains recoverable', async t => {
  const { engine, store } = fixture(t); await engine.apply('game-mode', absent);
  const saved = store.read(); saved.entries[0].status = 'prepared'; store.write(saved);
  await engine.revert(saved.entries[0].id); assert.equal(engine.history()[0].status, 'reverted');
});
test('a value changed after preview is not overwritten or adopted as the original', async t => {
  const { engine, adapter } = fixture(t);
  const expected = await adapter.read(getSetting('game-mode'));
  const external = { keyExists: true, exists: true, kind: 'DWord', value: 42 }; adapter.values.set('game-mode', external);
  await assert.rejects(engine.apply('game-mode', expected), /cambió desde/);
  assert.deepEqual(await adapter.read(getSetting('game-mode')), external); assert.equal(engine.history().length, 0);
});
