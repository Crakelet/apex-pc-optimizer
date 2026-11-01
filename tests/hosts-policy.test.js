'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { windowsPowerShellExecutable, windowsPowerShellEnvironment } = require('../src/main/windowsEnvironment');

function load() {
  const filename = path.join(__dirname, '../src/main/advancedToolsService.js');
  const realRequire = createRequire(filename), calls = [], module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, console, Buffer,
    require: name => name === './systemInfo' ? { runPowerShell: async (script, input) => { calls.push({ script, input }); return { success: true, output: 'OK' }; } } : realRequire(name)
  });
  return { api: module.exports, calls };
}

test('HOSTS privacy catalog excludes update, Defender and certificate services', () => {
  const { api } = load();
  assert.ok(api.hostsPolicy.domains.includes('bingads.microsoft.com'));
  for (const domain of [
    'fe3.delivery.mp.microsoft.com', 'FE3CR.DELIVERY.MP.MICROSOFT.COM.',
    'download.windowsupdate.com', 'sls.update.microsoft.com',
    'definitionupdates.microsoft.com', 'x.wdcp.microsoft.com', 'x.wdcpalt.microsoft.com',
    'x.wd.microsoft.com', 'settings-win.data.microsoft.com', 'vortex-win.data.microsoft.com',
    'crl.microsoft.com', 'ctldl.windowsupdate.com', 'cs1.wpc.v0cdn.net'
  ]) {
    assert.ok(!api.hostsPolicy.domains.includes(domain));
    assert.throws(() => api.hostsPolicy.validateDomains([domain]), /protegido/);
  }
  assert.throws(() => api.hostsPolicy.validateDomains(['name\n0.0.0.0 other']), /no válido/);
  assert.throws(() => api.hostsPolicy.validateDomains(['bingads.microsoft.com', 'BINGADS.MICROSOFT.COM.']), /duplicados/);
});

test('HOSTS compiled domains travel as data and keep historical markers and backup path', async () => {
  const { api, calls } = load();
  await api.applyHostsShield();
  assert.deepEqual(Array.from(calls[0].input.domains), Array.from(api.hostsPolicy.domains));
  assert.ok(calls[0].script.includes('hosts.apex_backup'));
  assert.ok(calls[0].script.includes('# APEX_OPTIMIZER_TELEMETRY_BLOCK'));
  for (const domain of api.hostsPolicy.domains) assert.ok(!calls[0].script.includes(domain));
});

test('HOSTS explicit refresh migrates old Apex blocks and preserves unrelated entries and backup', { skip: process.platform !== 'win32' }, async t => {
  const { api, calls } = load();
  await api.applyHostsShield(); await api.revertHostsShield();
  const scratch = path.resolve(__dirname, '../scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(scratch, 'hosts-policy-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(fixture)), scratch);
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  const folder = path.join(fixture, 'System32/drivers/etc');
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'hosts'), backup = file + '.apex_backup';
  const prefix = '# Existing user rules\r\n127.0.0.1 localhost\r\n10.10.1.2 intranet.example\r\n';
  const suffix = '10.10.1.3 later.example\r\n';
  const oldBlock = '# APEX_OPTIMIZER_TELEMETRY_BLOCK\r\n0.0.0.0 fe3.delivery.mp.microsoft.com\r\n0.0.0.0 settings-win.data.microsoft.com\r\n0.0.0.0 bingads.microsoft.com\r\n# END_APEX_OPTIMIZER_TELEMETRY_BLOCK\r\n';
  fs.writeFileSync(file, prefix + oldBlock + suffix);
  const originalBackup = Buffer.from('# Original backup from an older version\r\n127.0.0.1 localhost\r\n');
  fs.writeFileSync(backup, originalBackup);
  function execute(call) {
    // Redirect the two target paths into the test-owned fixture without changing
    // SystemRoot itself, which .NET uses when loading its own assemblies.
    // ipconfig is a local function, so no actual DNS command can run.
    const scopedScript = call.script.replaceAll('Join-Path $env:SystemRoot', 'Join-Path $env:APEX_HOSTS_FIXTURE');
    assert.ok(!scopedScript.includes('$env:SystemRoot'));
    const wrapper = "$ErrorActionPreference='Stop'; function global:ipconfig { $script:mockedDnsCalls++ }; $script:mockedDnsCalls=0; $data=ConvertFrom-Json $env:APEX_HOSTS_TEST_INPUT; try {\n" + scopedScript + "\nif ($script:mockedDnsCalls -ne 1) { throw 'Expected mock DNS invocation' }; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
    return spawnSync(windowsPowerShellExecutable(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', wrapper], {
      input: '', encoding: 'utf8', timeout: 15000, windowsHide: true,
      env: windowsPowerShellEnvironment({ APEX_HOSTS_FIXTURE: fixture, APEX_HOSTS_TEST_INPUT: JSON.stringify(call.input || {}) })
    });
  }
  const applied = execute(calls[0]);
  assert.equal(applied.status, 0, applied.stderr || applied.error?.message);
  const migrated = fs.readFileSync(file, 'utf8');
  assert.ok(migrated.startsWith(prefix)); assert.ok(migrated.endsWith(suffix));
  assert.ok(!migrated.includes('fe3.delivery.mp.microsoft.com'));
  assert.ok(!migrated.includes('settings-win.data.microsoft.com'));
  assert.ok(migrated.includes('0.0.0.0 bingads.microsoft.com'));
  assert.deepEqual(fs.readFileSync(backup), originalBackup);
  const repeated = execute(calls[0]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), migrated);
  const restored = execute(calls[1]);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), prefix + suffix);
  assert.deepEqual(fs.readFileSync(backup), originalBackup);
  for (const broken of [prefix + oldBlock.replace('# END_APEX_OPTIMIZER_TELEMETRY_BLOCK\r\n', ''), prefix + oldBlock + oldBlock]) {
    fs.writeFileSync(file, broken);
    for (const call of calls) {
      const result = execute(call);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /incompleto o repetido/);
      assert.equal(fs.readFileSync(file, 'utf8'), broken);
      assert.deepEqual(fs.readFileSync(backup), originalBackup);
    }
  }
});
