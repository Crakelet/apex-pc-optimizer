'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
function load(name, result = { success: true, output: '0' }, overrides = {}) {
  const filename = path.join(__dirname, '../src/main', name), realRequire = createRequire(filename), calls = [];
  const module = { exports: {} };
  const mockedRequire = id => Object.hasOwn(overrides, id) ? overrides[id] : id === './systemInfo' ? { runPowerShell: async (script, input) => { calls.push({ script, input }); return typeof result === 'function' ? result(script, input) : result; } } : realRequire(id);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: mockedRequire, console, process, Buffer, __dirname: path.dirname(filename), __filename: filename });
  return { api: module.exports, calls };
}
test('restored power, MSI and network tools never mask executor failures', async () => {
  const { api, calls } = load('apexProEngine.js', { success: false, output: 'denegado' });
  for (const name of ['applyApexPowerPlan', 'applyMsiModeGpu', 'applyAdvancedNetworkStack']) assert.equal((await api[name]()).success, false);
  assert.ok(calls.every(call => call.script.includes('\n')));
  assert.ok(calls.every(call => !call.script.includes('script.replace')));
  assert.ok(!calls[1].script.includes('DevicePriority'));
});
test('creative cleanup excludes scratch/recovery and requires closed apps', async () => {
  const { api, calls } = load('designTools.js', { success: true, output: '{"SizeMB":0,"Count":0}' });
  const result = await api.cleanCreativeMediaCache();
  assert.equal(result.success, true); assert.equal(result.sizeMB, 0);
  const script = calls[0].script;
  assert.ok(script.includes('Cierra las aplicaciones creativas'));
  assert.ok(!script.includes("Path = (Join-Path $env:TEMP 'BlenderAutosaves')"));
  assert.ok(!script.includes("$ar = Join-Path $_.FullName 'AutoRecover'"));
  assert.ok(!script.includes("'Adobe\\After Effects'"));
  assert.ok(script.indexOf('Remove-Item -LiteralPath $f.FullName') < script.indexOf('$deletedBytes += $length'));
});
test('creative GPU assignment delegates executable paths to the scoped backup manager', async () => {
  const seen = [];
  const { api, calls } = load('designTools.js', { success: true, output: 'OK' }, { './designGpuBackup': { assign: async value => { seen.push(value); return { success: true }; } } });
  const exePath = 'C:\\Tools\\name$(Write-Output malicious).exe';
  assert.equal((await api.assignGpuToDesignApp(exePath)).success, true);
  assert.equal(seen[0], exePath);
  assert.equal(calls.length, 0);
});
test('failed cleaners return failure and zero, rather than invented success', async () => {
  const { api } = load('advancedToolsService.js', { success: false, output: 'acceso denegado' });
  for (const name of ['cleanDiscordCache','cleanBrowserCaches','cleanCrashDumps','cleanNpmCache','cleanAllAppCaches']) {
    const result = await api[name](); assert.equal(result.success, false); assert.equal(result.freedMB, 0);
  }
});
test('startup toggles preserve source and send names as structured data', async () => {
  const { api, calls } = load('advancedToolsService.js', { success: true, output: 'OK' });
  const result = await api.toggleStartupProgram('App$(text)', 'HKLM\\Run', false);
  assert.equal(result.success, true); assert.equal(calls[0].input.location, 'HKLM\\Run');
  assert.ok(!calls[0].script.includes('App$(text)'));
  assert.equal((await api.toggleStartupProgram('App', 'Unknown', false)).success, false);
  assert.equal((await api.toggleStartupProgram('../escape', 'StartupFolder', false)).success, false);
});
test('USB state remains unknown when Windows has no matching response', async () => {
  const { api } = load('hardwareDiagnosticsService.js', { success: true, output: '{"IsLowLatency":null,"RawVal":null}' });
  const result = await api.getUsbLatencyStatus();
  assert.equal(result.success, false); assert.equal(result.isLowLatencyEnabled, null);
  assert.ok(!result.statusLabel.includes('1000Hz'));
});
test('shared cleanup skips junctions, recovery, projects and source media', () => {
  const { CLEANUP_SCRIPT } = require('../src/main/safeCleanup');
  for (const token of ['ReparsePoint', 'AutoRecover', 'BlenderAutosaves', 'UnsavedFiles', 'Projects', 'AddDays(-1)', 'mp4', 'psd']) assert.ok(CLEANUP_SCRIPT.includes(token));
  assert.ok(CLEANUP_SCRIPT.indexOf('Remove-Item -LiteralPath') < CLEANUP_SCRIPT.indexOf('$removedBytes += $size'));
  assert.ok(!CLEANUP_SCRIPT.includes('Remove-Item -Recurse'));
});
test('custom debloat rejects unknown IDs before requesting a script', async () => {
  const { api, calls } = load('systemAudit.js');
  assert.equal((await api.executeCustomDebloat(['not-known'])).success, false); assert.equal(calls.length, 0);
});
test('restored PowerShell templates parse without executing their contents', { skip: process.platform !== 'win32' }, async () => {
  const templates = [];
  for (const [name, methods, output] of [
    ['apexProEngine.js', ['applyApexPowerPlan','applyMsiModeGpu','applyAdvancedNetworkStack'], '0'],
    ['designTools.js', ['getDesignCacheSummary','cleanCreativeMediaCache'], '{"SizeMB":0,"Count":0}'],
    ['advancedToolsService.js', ['getStartupPrograms','cleanDiscordCache','cleanBrowserCaches','cleanAllAppCaches'], '[]'],
    ['hardwareDiagnosticsService.js', ['getHardwareReport','getUsbLatencyStatus'], '{"RAM":{},"Storage":{},"IsLowLatency":null}'],
    ['systemAudit.js', ['runSystemAudit'], '{}']
  ]) {
    const { api, calls } = load(name, { success: true, output });
    for (const method of methods) await api[method]();
    calls.forEach((call, i) => templates.push({ name: name + ':' + i, script: call.script }));
  }
  const startup = load('advancedToolsService.js', { success: true, output: 'OK' });
  await startup.api.toggleStartupProgram('Example', 'HKLM\\Run', false);
  startup.calls.forEach(call => templates.push({ name: 'startup-toggle', script: call.script }));
  const root = path.resolve(__dirname, '../scratch'); fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, 'advanced-ps-templates.json'); fs.writeFileSync(file, JSON.stringify(templates));
  const parser = "$ProgressPreference = 'SilentlyContinue'; $templates = Get-Content -LiteralPath $env:APEX_PARSE_FILE -Raw | ConvertFrom-Json; $bad = @(); foreach ($template in $templates) { $tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseInput($template.script, [ref]$tokens, [ref]$errors) | Out-Null; foreach ($error in $errors) { $bad += ($template.name + ': ' + $error.Message) } }; if ($bad.Count) { $bad | Write-Output; exit 1 }; Write-Output 'PowerShell templates parse correctly'";
  const { execFileSync } = require('node:child_process');
  const out = execFileSync('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(parser,'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, env: { ...process.env, APEX_PARSE_FILE: file }, encoding: 'utf8' });
  assert.match(out, /parse correctly/);
});
