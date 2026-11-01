'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { RestorationManager, canonical } = require('../../src/main/restorationStore');
const { runPowerShell } = require('../../src/main/systemInfo');

// Native integration only writes inside a new disposable HKCU fixture GUID.
// No services, devices, BCD, energy, caches or application settings are touched.
const FIXTURE_PREFIX = 'HKCU:\\Software\\ApexPCOptimizer\\Tests\\';
const FIXTURE_PATH = /^HKCU:\\Software\\ApexPCOptimizer\\Tests\\[a-f0-9-]{36}$/i;
const SET_FIXTURE = `
if ($data.path -notmatch '^HKCU:\\\\Software\\\\ApexPCOptimizer\\\\Tests\\\\[a-f0-9-]{36}$') { throw 'Fixture path rejected.' }
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($data.path.Substring(6))
try {
  $key.SetValue('Sibling', 'KEEP', [Microsoft.Win32.RegistryValueKind]::String)
  if ($data.value.exists) {
    $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], [string]$data.value.kind)
    $value = switch ([string]$data.value.kind) {
      'DWord' { [int]::Parse([string]$data.value.value, [Globalization.CultureInfo]::InvariantCulture) }
      'QWord' { [long]::Parse([string]$data.value.value, [Globalization.CultureInfo]::InvariantCulture) }
      'MultiString' { ,([string[]]$data.value.value) }
      'Binary' { ,([Convert]::FromBase64String([string]$data.value.value)) }
      default { [string]$data.value.value }
    }
    $key.SetValue('Target', $value, $kind)
  } else { $key.DeleteValue('Target', $false) }
} finally { $key.Close() }
'OK'
`;
const CLEAN_FIXTURE = `
if ($data.path -notmatch '^HKCU:\\\\Software\\\\ApexPCOptimizer\\\\Tests\\\\[a-f0-9-]{36}$') { throw 'Fixture path rejected.' }
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($data.path.Substring(6), $false)
'OK'
`;
async function execute(script, data) {
  const result = await runPowerShell(script, data);
  assert.equal(result.success, true, result.output);
  return result;
}
function resourcesFor(key) {
  assert.match(key, FIXTURE_PATH);
  return { registry: [{ path: key, name: 'Target' }], registryInterfaces: [], services: [], bcd: [], tcp: [], adapterRss: false, adapterPatterns: [], power: null };
}
async function fixture(t) {
  const key = FIXTURE_PREFIX + randomUUID();
  const scratch = path.resolve(__dirname, '../../scratch/native-integration');
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'fixture-'));
  assert.ok(directory.startsWith(scratch + path.sep));
  t.after(async () => {
    assert.match(key, FIXTURE_PATH);
    await execute(CLEAN_FIXTURE, { path: key });
    assert.ok(directory.startsWith(scratch + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const resources = resourcesFor(key);
  const manager = new RestorationManager({ file: path.join(directory, 'history.json') });
  const script = `Set-ItemProperty -LiteralPath '${key}' -Name Target -Value 'Apex fixture applied' -Type String -Force -ErrorAction Stop; 'OK'`;
  const check = `if ((Get-ItemProperty -LiteralPath '${key}' -Name Target -ErrorAction Stop).Target -eq 'Apex fixture applied') { 'true' } else { 'false' }`;
  return { key, resources, manager, directory, script, check };
}

test('active Windows restoration engine round-trips exact synthetic registry values across restart', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  const values = [
    { exists: false, kind: null, value: null },
    { exists: true, kind: 'DWord', value: '0' },
    { exists: true, kind: 'DWord', value: '-1' },
    { exists: true, kind: 'QWord', value: '-9223372036854775808' },
    { exists: true, kind: 'String', value: 'texto " citado $(NO_EJECUTAR) ; & áéíóú' },
    { exists: true, kind: 'ExpandString', value: '%TEMP%\\Apex $(NO_EJECUTAR)' },
    { exists: true, kind: 'MultiString', value: ['uno', 'dos " ; $(NO_EJECUTAR)', 'áéíóú'] },
    { exists: true, kind: 'Binary', value: Buffer.from([0, 1, 127, 128, 255]).toString('base64') }
  ];
  for (const value of values) {
    await execute(SET_FIXTURE, { path: f.key, value });
    const before = await f.manager.capture(f.resources);
    assert.equal(before.registry[0].exists, value.exists);
    assert.equal(before.registry[0].kind, value.kind);
    assert.deepEqual(before.registry[0].value, value.value);
    const applied = await f.manager.apply('fixture:target', f.resources, f.script, f.check);
    assert.equal(applied.success, true, applied.message);
    const restarted = new RestorationManager({ file: f.manager.file });
    const restored = await restarted.revert('fixture:target', f.resources);
    assert.equal(restored.success, true, restored.message);
    assert.equal(canonical(await restarted.capture(f.resources)), canonical(before));
    const sibling = await execute(`(Get-ItemProperty -LiteralPath $data.path -Name Sibling -ErrorAction Stop).Sibling`, { path: f.key });
    assert.equal(sibling.output.trim(), 'KEEP');
  }
});

test('active engine preserves a synthetic external edit and rejects a native failure honestly', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  await execute(SET_FIXTURE, { path: f.key, value: { exists: true, kind: 'String', value: 'original' } });
  assert.equal((await f.manager.apply('fixture:target', f.resources, f.script, f.check)).success, true);
  await execute(SET_FIXTURE, { path: f.key, value: { exists: true, kind: 'String', value: 'external edit' } });
  const before = await f.manager.capture(f.resources);
  const conflict = await f.manager.revert('fixture:target', f.resources);
  assert.equal(conflict.success, false); assert.equal(conflict.conflict, true);
  assert.equal(canonical(await f.manager.capture(f.resources)), canonical(before));
  const failed = await f.manager.apply('fixture:failure', f.resources, "throw 'Fallo deliberado de fixture'", f.check);
  assert.equal(failed.success, false); assert.match(failed.message, /Fallo deliberado/);
  assert.equal(canonical(await f.manager.capture(f.resources)), canonical(before));
});
