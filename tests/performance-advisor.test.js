'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getPerformanceReport, buildReport, SETTINGS_TARGETS, SOURCES, PERFORMANCE_SCRIPT } = require('../src/main/performanceAdvisor');

const GiB = 1024 ** 3;
const memory = { totalBytes: 32 * GiB, availableBytes: 8 * GiB };
const display = { label: 'Panel principal', size: { width: 2560, height: 1440 }, displayFrequency: 144 };
function native() {
  return {
    gpus: [{ Name: 'NVIDIA GeForce RTX', DriverVersion: '32.0.15.0000', AdapterRAM: 4294967295 }],
    disks: [{ DeviceID: 'C:', DriveType: 3, Size: 500 * GiB, FreeSpace: 100 * GiB }],
    preferences: { gameMode: 1, gameModeAllowed: 1, hags: 2 }, warnings: []
  };
}
function report(overrides = {}) { return buildReport({ memory, windows: native(), displays: [display], observedAt: '2026-10-29T12:00:00Z', ...overrides }); }

test('advisor separates observed facts from manual app guidance and registered preferences', () => {
  const result = report();
  assert.equal(result.success, true); assert.equal(result.partial, false);
  assert.equal(result.facts.memory.usedPercent, 75);
  assert.equal(result.facts.displays[0].refreshRateHz, 144);
  assert.equal(result.facts.disks[0].freePercent, 20);
  assert.equal(result.facts.preferences.gameMode.observation, 'registered');
  assert.equal(result.facts.preferences.hags.effectiveStateKnown, false);
  assert.equal(result.facts.gpus[0].AdapterRAM, undefined);
  assert.equal(result.recommendations.find(item => item.id === 'design-blender').observation, 'manual');
  assert.equal(result.recommendations.find(item => item.id === 'design-studio-driver').observation, 'measured');
  assert.equal(result.observedAt, '2026-10-29T12:00:00.000Z');
});

test('unsafe and non-finite measurements are omitted instead of becoming healthy zero readings', () => {
  const windows = native();
  windows.disks = [
    { DeviceID: '\\\\server\\share', DriveType: 3, Size: 100, FreeSpace: 20 },
    { DeviceID: 'D:', DriveType: 4, Size: 100, FreeSpace: 20 },
    { DeviceID: 'E:', DriveType: 3, Size: Infinity, FreeSpace: 20 },
    { DeviceID: 'F:', DriveType: 3, Size: 100, FreeSpace: -2 },
    { DeviceID: 'G:', DriveType: 3, Size: 100, FreeSpace: 101 },
    { DeviceID: 'H:', DriveType: 3, Size: '100', FreeSpace: 20 }
  ];
  const result = report({ windows, memory: { totalBytes: 100, availableBytes: 101 }, displays: [{ displayFrequency: NaN }] });
  assert.equal(result.partial, true); assert.deepEqual(result.facts.disks, []);
  assert.equal(result.facts.memory.usedPercent, null); assert.equal(result.facts.memory.totalBytes, null);
  assert.deepEqual(result.facts.displays, []);
  assert.equal(JSON.stringify(result).includes('Infinity'), false);
  assert.ok(result.warnings.every(value => typeof value === 'string'));
});

test('an absent preference is not reported as a confirmed active Windows feature', () => {
  const windows = native(); windows.preferences = {};
  const result = report({ windows });
  assert.equal(result.facts.preferences.gameMode.value, null);
  assert.equal(result.facts.preferences.gameMode.state, 'not-configured');
  assert.equal(result.facts.preferences.hags.value, null);
  assert.equal(result.facts.preferences.hags.effectiveStateKnown, false);
  windows.preferences = { gameMode: 1, gameModeAllowed: 0, hags: '2' };
  assert.equal(report({ windows }).facts.preferences.gameMode.state, 'disabled');
  assert.equal(report({ windows }).facts.preferences.hags.value, null);
});

test('the advisor reports low free space without claiming to know the selected scratch drive', () => {
  const windows = native(); windows.disks[0].FreeSpace = 9.6 * 5 * GiB;
  const result = report({ windows, memory: { totalBytes: 100, availableBytes: 10 } });
  const photoshop = result.recommendations.find(item => item.id === 'design-photoshop');
  assert.equal(photoshop.priority, 'attention'); assert.equal(photoshop.observation, 'measured');
  assert.match(photoshop.evidence, /no confirma/);
  assert.equal(result.recommendations.find(item => item.id === 'gaming-background').priority, 'attention');
});

test('all destinations resolve from fixed identifiers and every recommendation has a primary source', () => {
  const result = report();
  assert.equal(Object.keys(SETTINGS_TARGETS).length, 5);
  assert.ok(Object.isFrozen(SETTINGS_TARGETS)); assert.ok(Object.isFrozen(SOURCES));
  for (const recommendation of result.recommendations) {
    assert.ok(SOURCES[recommendation.sourceId]);
    if (recommendation.settingsId) assert.ok(SETTINGS_TARGETS[recommendation.settingsId]);
    for (const id of recommendation.sourceIds || []) assert.ok(SOURCES[id]);
    assert.ok(recommendation.steps.length > 1);
    assert.ok(['gaming', 'design'].includes(recommendation.category));
    assert.equal(Object.hasOwn(recommendation, 'url'), false);
  }
  for (const source of Object.values(SOURCES)) {
    const url = new URL(source.url); assert.equal(url.protocol, 'https:'); assert.ok(Object.isFrozen(source));
  }
});

test('native failures preserve useful local readings and guides without exposing child-process error text', async () => {
  let calls = 0;
  const result = await getPerformanceReport({ displays: [display] }, {
    platform: 'win32', memory: () => memory, now: () => '2026-10-29T12:00:00Z',
    runner: async () => { calls++; throw new Error('private C:\\Users\\Someone\\project'); }
  });
  assert.equal(calls, 1); assert.equal(result.success, true); assert.equal(result.partial, true);
  assert.equal(result.facts.memory.usedPercent, 75); assert.equal(result.facts.displays[0].refreshRateHz, 144);
  assert.ok(result.recommendations.length >= 6); assert.equal(JSON.stringify(result).includes('Someone'), false);
});

test('the Windows runner receives one read-only query with a bounded timeout', async () => {
  const calls = [];
  const result = await getPerformanceReport({ displays: [display] }, {
    platform: 'win32', memory: () => memory,
    runner: async (...args) => { calls.push(args); return native(); }
  });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], PERFORMANCE_SCRIPT);
  assert.deepEqual(calls[0][1], {}); assert.equal(calls[0][2].timeout, 12000);
  assert.equal(/Set-Item|New-Item|Remove-Item|Set-Service|Start-Process|Stop-Process|AdapterRAM|Invoke-WebRequest|Get-ChildItem|Recurse/i.test(PERFORMANCE_SCRIPT), false);
  assert.match(PERFORMANCE_SCRIPT, /DriveType=3/); assert.match(PERFORMANCE_SCRIPT, /OperationTimeoutSec 4/);
  assert.equal(result.partial, false);
});

test('unsupported platforms and unavailable OS readings never invoke Windows tools', async () => {
  let calls = 0;
  const result = await getPerformanceReport({}, {
    platform: 'linux', runner: async () => { calls++; }, memory: () => { throw new Error('unavailable'); }, now: () => 'invalid'
  });
  assert.equal(calls, 0); assert.equal(result.partial, true);
  assert.equal(result.facts.memory.observation, 'unavailable'); assert.equal(result.observedAt, null);
});

test('partial native results, singleton CIM records, display bounds and unknown warnings are handled independently', () => {
  const windows = native(); windows.gpus = windows.gpus[0]; windows.disks = windows.disks[0];
  windows.warnings = ['disks-unavailable', 'toString', '__proto__', 'private-message', null, {}];
  const result = report({ windows, displays: [{ size: { width: 1920, height: 1080 }, displayFrequency: 0 }, { displayFrequency: 2000 }] });
  assert.equal(result.facts.gpus.length, 1); assert.equal(result.facts.disks.length, 1);
  assert.equal(result.facts.displays.length, 1); assert.equal(result.facts.displays[0].refreshRateHz, null);
  assert.equal(result.partial, true); assert.ok(result.warnings.every(value => typeof value === 'string'));
  assert.equal(JSON.stringify(result).includes('private-message'), false);
});

test('non-NVIDIA GPUs receive general creative guidance without assuming the Studio driver applies', () => {
  const windows = native(); windows.gpus[0].Name = 'AMD Radeon';
  assert.equal(report({ windows }).recommendations.some(item => item.id === 'design-studio-driver'), false);
});
