'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {powerShellArguments} = require('../src/main/powerShellTransport');
const {runPowerShell:runText} = require('../src/main/systemInfo');
const {runPowerShell:runJson} = require('../src/main/powerShell');

test('PowerShell command line is constant and readable, with no encoded payload or policy override', () => {
  const args = powerShellArguments();
  assert.deepEqual(args.slice(0,4), ['-NoLogo','-NoProfile','-NonInteractive','-Command']);
  assert.match(args[4], /Console\]::In\.ReadToEnd\(\)/);
  assert.ok(args.join(' ').length < 500);
  assert.doesNotMatch(args.join(' '), /EncodedCommand|ExecutionPolicy|Bypass|base64/i);
  args.push('changed');
  assert.equal(powerShellArguments().length, 5);
});

const native = {skip:process.platform !== 'win32', timeout:30000};
const padding = '# ' + 'application-owned comment '.repeat(2200) + '\n';
const input = {text:'Diseño 🎨 — edición 日本語', literal:'"; $(throw "user data executed"); ` \\'};

test('text runner preserves Unicode, multiline functions and >32 KiB scripts through stdin', native, async () => {
  const result = await runText(padding + `
    function Read-FixtureValue {
      return [PSCustomObject]@{ text = $data.text; literal = $data.literal }
    }
    Read-FixtureValue | ConvertTo-Json -Compress
  `, input);
  assert.equal(result.success, true, result.output);
  assert.deepEqual(JSON.parse(result.output), input);
});

test('JSON runner supports long Unicode scripts and keeps caller strings as inert JSON data', native, async () => {
  const result = await runJson(padding + `
    function Read-FixtureValue {
      return [PSCustomObject]@{ text = $data.text; literal = $data.literal }
    }
    Read-FixtureValue | ConvertTo-Json -Compress
  `, input);
  assert.deepEqual(result, input);
});

test('text runner reports native errors instead of claiming successful completion', native, async () => {
  const failure = await runText('throw "Fallo de fixture: edición"');
  assert.equal(failure.success, false);
  assert.match(failure.output, /Fallo de fixture: edición/);
  const exit = await runText('cmd.exe /c exit 7');
  assert.equal(exit.success, false);
  assert.match(exit.output, /herramienta de Windows devolvió un error/);
});

test('JSON runner rejects PowerShell failures and malformed responses', native, async () => {
  await assert.rejects(runJson('throw "Fallo JSON de fixture: edición"'), /Fallo JSON de fixture: edición/);
  await assert.rejects(runJson("'not JSON'"), /respuesta no válida/);
});

test('both runners retain their process timeout', native, async () => {
  const result = await runText('Start-Sleep -Seconds 10', {}, {timeout:1200});
  assert.equal(result.success, false);
  assert.match(result.output, /tiempo de espera/);
  await assert.rejects(runJson('Start-Sleep -Seconds 10', {}, {timeout:1200}), /tiempo de espera/);
});
