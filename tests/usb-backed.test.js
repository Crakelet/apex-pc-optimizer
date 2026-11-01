'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load() {
  const filename = path.join(__dirname, '../src/main/hardwareDiagnosticsService.js');
  const realRequire = createRequire(filename), reads = [];
  const module = { exports: {} };
  const mockedRequire = id => id === './systemInfo' ? { runPowerShell: async script => {
    reads.push(script);
    return { success: true, output: '{"IsLowLatency":false,"RawVal":"0x00000001"}' };
  } } : realRequire(id);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: mockedRequire, console, process, Buffer, __dirname: path.dirname(filename), __filename: filename });
  return { api: module.exports, reads };
}

test('USB tool requires the shared backed engine and restores the saved value', async () => {
  const { api, reads } = load(), operations = [];
  const engine = {
    applyTweak: async id => { operations.push(['apply', id]); return { success: true, message: 'Aplicado con respaldo.' }; },
    revertTweak: async id => { operations.push(['restore', id]); return { success: true, message: 'Original restaurado.' }; }
  };
  assert.equal((await api.setUsbLowLatency(true)).success, false);
  assert.equal((await api.setUsbLowLatency('true', engine)).success, false);
  assert.equal(reads.length, 0);
  assert.equal((await api.setUsbLowLatency(true, engine)).success, true);
  assert.equal((await api.setUsbLowLatency(false, engine)).success, true);
  assert.deepEqual(operations, [['apply', 'power_usb_selective'], ['restore', 'power_usb_selective']]);
  assert.ok(reads.every(script => !/\/set(?:ac|dc|active)/i.test(script)));
});

test('USB tool propagates a missing or conflicting backup without querying or writing Windows', async () => {
  const { api, reads } = load();
  const failure = { success: false, message: 'No hay respaldo propio.' };
  const engine = { applyTweak: async () => failure, revertTweak: async () => failure };
  assert.equal(await api.setUsbLowLatency(false, engine), failure);
  assert.equal(reads.length, 0);
});
