'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { DesignGpuManager, PowerShellGpuAdapter, desiredValue, validateExePath } = require('../src/main/designGpuBackup');

const exe = 'C:\\Creative\\Editor.exe';
const absent = () => ({ exists: false, kind: null, value: null });
function fixture(t, before = absent(), hooks = {}) {
  const parent = path.resolve(__dirname, '../scratch'); fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'design-gpu-test-'));
  const file = path.join(directory, 'backups.json');
  t.after(() => { assert.ok(directory.startsWith(parent + path.sep)); fs.rmSync(directory, { recursive: true, force: true }); });
  let current = structuredClone(before); const writes = [];
  const manager = new DesignGpuManager({ file, adapter: {
    read: async () => structuredClone(current),
    write: async (filePath, value, requireExecutable) => {
      const state = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.ok(Object.values(state.records).some(record => record.status === 'prepared' || record.status === 'applied' || record.status === 'failed'));
      writes.push({ filePath, value: structuredClone(value), requireExecutable });
      if (hooks.write) await hooks.write(value);
      current = structuredClone(value);
    }
  } });
  return { manager, file, writes, set: value => { current = structuredClone(value); }, current: () => structuredClone(current) };
}

test('GPU preference is backed before writing and restores exact expanded-string data', async t => {
  const before = { exists: true, kind: 'ExpandString', value: 'OtherFlag=%PATH%;GpuPreference=1;' };
  const f = fixture(t, before);
  assert.equal((await f.manager.assign(exe)).success, true);
  const record = Object.values(JSON.parse(fs.readFileSync(f.file, 'utf8')).records)[0];
  assert.deepEqual(record.before, before); assert.equal(record.status, 'applied');
  assert.deepEqual(f.current(), desiredValue(before));
  assert.equal(f.manager.status(exe).hasBackup, true);
  assert.equal((await f.manager.restore(exe)).success, true);
  assert.deepEqual(f.current(), before);
  assert.equal(f.writes[0].requireExecutable, true); assert.equal(f.writes[1].requireExecutable, false);
  assert.equal(f.manager.status(exe).hasBackup, false);
});

test('a missing original GPU value is restored by deleting only that app value', async t => {
  const f = fixture(t);
  await f.manager.assign(exe); await f.manager.restore(exe);
  assert.deepEqual(f.current(), absent()); assert.equal(f.writes.length, 2);
});

test('an existing high-performance preference is not adopted as an Apex change', async t => {
  const f = fixture(t, { exists: true, kind: 'String', value: 'GpuPreference=2;' });
  const result = await f.manager.assign(exe);
  assert.equal(result.skipped, true); assert.equal(result.hasBackup, false);
  assert.equal(f.writes.length, 0); assert.equal(fs.existsSync(f.file), false);
  await assert.rejects(f.manager.restore(exe), /No hay un respaldo/);
});

test('external GPU changes block assignment and restoration without overwriting them', async t => {
  const f = fixture(t); await f.manager.assign(exe);
  const external = { exists: true, kind: 'String', value: 'GpuPreference=1;Other=outside;' }; f.set(external);
  await assert.rejects(f.manager.assign(exe), /Otra aplicación/);
  await assert.rejects(f.manager.restore(exe), /fuera de Apex/);
  assert.equal(f.writes.length, 1); assert.deepEqual(f.current(), external); assert.equal(f.manager.status(exe).hasBackup, true);
});

test('failed GPU writes keep the original prepared snapshot available', async t => {
  const f = fixture(t, absent(), { write: async () => { throw new Error('denied'); } });
  await assert.rejects(f.manager.assign(exe), /denied/);
  const record = Object.values(JSON.parse(fs.readFileSync(f.file, 'utf8')).records)[0];
  assert.deepEqual(record.before, absent()); assert.equal(record.status, 'failed'); assert.equal(f.manager.status(exe).hasBackup, true);
  assert.equal((await f.manager.restore(exe)).success, true);
});

test('GPU backup records cannot change the permitted target value or executable identity', async t => {
  const f = fixture(t); await f.manager.assign(exe);
  const state = JSON.parse(fs.readFileSync(f.file, 'utf8')), record = Object.values(state.records)[0];
  record.after.value = 'arbitrary'; fs.writeFileSync(f.file, JSON.stringify(state));
  await assert.rejects(f.manager.restore(exe), /cambio permitido/); assert.equal(f.writes.length, 1);
  record.after = desiredValue(record.before); record.exePath = 'C:\\Other\\App.exe'; fs.writeFileSync(f.file, JSON.stringify(state));
  await assert.rejects(f.manager.restore(exe), /respaldo GPU no válido/); assert.equal(f.writes.length, 1);
});

test('GPU paths remain structured data and invalid paths fail before an adapter call', async t => {
  const f = fixture(t);
  for (const value of ['relative.exe', '\\\\server\\share\\app.exe', 'C:\\app.txt', 'C:\\app\n.exe', null]) await assert.rejects(f.manager.assign(value));
  assert.equal(f.writes.length, 0);
  const captures = [], literal = 'C:\\Tools\\name$(Write-Output malicious).exe';
  const adapter = new PowerShellGpuAdapter(async (script, input) => { captures.push({ script, input }); return { success: true, output: JSON.stringify(absent()) }; });
  await adapter.read(literal); await adapter.write(literal, desiredValue(absent()), true);
  assert.equal(captures[0].input.exePath, literal);
  assert.ok(captures.every(item => !item.script.includes('malicious')));
  assert.equal(validateExePath(exe), exe);
});

test('GPU adapter templates parse without executing registry operations', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t), templates = [];
  const adapter = new PowerShellGpuAdapter(async (script) => { templates.push(script); return { success: true, output: JSON.stringify(absent()) }; });
  await adapter.read(exe); await adapter.write(exe, desiredValue(absent()), true);
  const file = path.join(path.dirname(f.file), 'templates.json'); fs.writeFileSync(file, JSON.stringify(templates));
  const parser = "$ProgressPreference = 'SilentlyContinue'; $templates = Get-Content -LiteralPath $env:APEX_GPU_PARSE_FILE -Raw | ConvertFrom-Json; foreach ($script in $templates) { $tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseInput($script, [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors.Message | Write-Output; exit 1 } }; 'Templates parsed'";
  const { execFileSync } = require('node:child_process');
  const result = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(parser, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, env: { ...process.env, APEX_GPU_PARSE_FILE: file }, encoding: 'utf8' });
  assert.match(result, /Templates parsed/);
});

function designFixture(output = '', gpuResult = { success: true, hasBackup: true }) {
  const filename = path.resolve(__dirname, '../src/main/designTools.js'), realRequire = createRequire(filename), module = { exports: {} }, calls = [];
  const metadata={appPaths:{},roots:[],localDrives:['c'],running:[],gpu:{},partial:false};
  if(output){const app=JSON.parse(output);metadata.appPaths['photoshop.exe']=app.Path;if(app.GpuOptimized)metadata.gpu[app.Path.toLowerCase()]='GpuPreference=2;';}
  const fakeFs={...fs,promises:{...fs.promises,lstat:async file=>({isSymbolicLink:()=>false,isFile:()=>/\.exe$/i.test(file)}),readdir:async()=>[]}};
  const mockedRequire = id => id==='fs'?fakeFs:id === './systemInfo' ? { runPowerShell: async () => ({ success: true, output:JSON.stringify(metadata) }) } : id === './designGpuBackup' ? {
    status: () => ({ success: true, hasBackup: true, status: 'applied' }),
    assign: async value => { calls.push(value); return gpuResult; }
  } : realRequire(id);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: mockedRequire, console, process, Buffer,setTimeout,clearTimeout, __dirname: path.dirname(filename), __filename: filename });
  return { api: module.exports, calls };
}

test('design app discovery exposes app-scoped restore state', async () => {
  const f = designFixture(JSON.stringify({ Name: 'Editor', Path: exe, GpuOptimized: true }));
  const result = await f.api.detectInstalledDesignApps();
  assert.equal(result.success, true); assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0].HasGpuBackup, true); assert.equal(result.apps[0].BackupStatus, 'applied');
});

test('design profile and tablet use the initialized backed engine and stop on failure', async () => {
  const f = designFixture(); const ids = [];
  assert.equal((await f.api.optimizeGraphicsTablet()).success, false);
  const tablet = await f.api.optimizeGraphicsTablet({ applyTweak: async id => { ids.push(id); return { success: true }; } });
  assert.equal(tablet.success, true); assert.equal(ids[0], 'design_tablet_stylus_latency_fix');
  ids.length = 0;
  const result = await f.api.applyAllDesignStudioProfile({ applyTweak: async id => { ids.push(id); return { success: ids.length < 2 }; } });
  assert.equal(result.success, false); assert.equal(result.partial, true); assert.equal(ids.length, 2); assert.equal(f.calls.length, 0);
});

test('design profile reports GPU failures after preserving its backed settings', async () => {
  const f = designFixture(JSON.stringify({ Name: 'Editor', Path: exe }), { success: false, message: 'denied' }); const ids = [];
  const result = await f.api.applyAllDesignStudioProfile({ applyTweak: async id => { ids.push(id); return { success: true }; } });
  assert.equal(ids.length, 7); assert.equal(result.success, false); assert.equal(result.partial, true);
  assert.equal(result.results.at(-1).results[0].message, 'denied'); assert.equal(f.calls[0], exe);
});

