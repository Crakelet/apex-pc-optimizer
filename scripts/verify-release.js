'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const {windowsPowerShellExecutable,windowsPowerShellEnvironment}=require('../src/main/windowsEnvironment');
const {powerShellArguments}=require('../src/main/powerShellTransport');

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function verifyPayload(root, archive, asar = require('@electron/asar')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json'));
  for (const field of ['name', 'version', 'main', 'license']) {
    if (packaged[field] !== manifest[field]) throw new Error(`El paquete tiene ${field} distinto de las fuentes.`);
  }
  const files = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md', 'CODE_SIGNING_POLICY.md', 'appicon.ico', 'appicon.png'];
  for (const directory of ['src/main', 'src/preload', 'src/renderer']) {
    for (const name of fs.readdirSync(path.join(root, directory))) {
      if (/\.(js|html|css)$/.test(name)) files.push(path.join(directory, name));
    }
  }
  for (const file of files) {
    if (!asar.extractFile(archive, path.normalize(file)).equals(fs.readFileSync(path.join(root, file)))) {
      throw new Error(`El paquete no contiene la fuente final: ${file}`);
    }
  }
  return { version: manifest.version, filesMatched: files.length };
}

function readSignatures(directory, names) {
  if (process.platform !== 'win32') throw new Error('La verificación Authenticode final debe ejecutarse en Windows.');
  const script = `$ErrorActionPreference = 'Stop'
    $names = ConvertFrom-Json $env:APEX_RELEASE_FILENAMES
    $results = foreach ($name in $names) {
      $signature = Get-AuthenticodeSignature -LiteralPath (Join-Path $env:APEX_RELEASE_DIRECTORY $name)
      [PSCustomObject]@{ File = $name; Status = [string]$signature.Status }
    }
    ConvertTo-Json -InputObject @($results) -Compress`;
  const output = execFileSync(windowsPowerShellExecutable(), powerShellArguments(), {
    windowsHide: true, timeout: 30000, encoding: 'utf8', input: script,
    env: windowsPowerShellEnvironment({APEX_RELEASE_DIRECTORY:directory,APEX_RELEASE_FILENAMES:JSON.stringify(names)})
  });
  const signatures = JSON.parse(output.trim());
  if (!Array.isArray(signatures) || signatures.length !== names.length || names.some(name => !signatures.some(item => item.File === name && ['Valid', 'NotSigned'].includes(item.Status)))) {
    throw new Error('La firma de uno de los ejecutables es inválida o no pudo comprobarse.');
  }
  return signatures;
}

function verifyRelease({ root = path.resolve(__dirname, '..'), directoryOnly = false } = {}) {
  const directory = path.join(root, 'dist');
  const payload = verifyPayload(root, path.join(directory, 'win-unpacked/resources/app.asar'));
  if (directoryOnly) return { ok: true, ...payload, scope: 'payload' };
  const names = ['Portable', 'Setup'].map(kind => `Apex-PC-Optimizer-v${payload.version}-${kind}-x64.exe`);
  const checksumFile = fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8');
  const checksumLines = checksumFile.trim().split(/\r?\n/);
  if (checksumLines.length !== names.length) throw new Error('El archivo SHA256SUMS debe contener exactamente los dos ejecutables de esta versión.');
  const artifacts = names.map(name => {
    const file = path.join(directory, name);
    const stat = fs.statSync(file);
    const descriptor = fs.openSync(file, 'r');
    const header = Buffer.alloc(2);
    try { fs.readSync(descriptor, header, 0, 2, 0); } finally { fs.closeSync(descriptor); }
    if (!stat.isFile() || stat.size < 1024 * 1024 || header.toString('ascii') !== 'MZ') throw new Error(`Ejecutable incompleto o no válido: ${name}`);
    const sha256 = digest(file);
    if (!checksumLines.includes(`${sha256}  ${name}`)) throw new Error(`La huella SHA-256 no coincide: ${name}`);
    return { file: name, size: stat.size, sha256 };
  });
  const signatures = readSignatures(directory, names);
  const report = { ok: true, version: payload.version, platform: 'windows-x64', filesMatched: payload.filesMatched, artifacts: artifacts.map(item => ({ ...item, signature: signatures.find(signature => signature.File === item.file).Status })) };
  fs.writeFileSync(path.join(directory, 'signatures.json'), JSON.stringify(signatures, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'release-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--directory-only')) throw new Error('Uso: node scripts/verify-release.js [--directory-only]');
    console.log(JSON.stringify(verifyRelease({ directoryOnly: args.includes('--directory-only') }), null, 2));
  } catch (error) { console.error(`Verificación de distribución: ${error.message}`); process.exitCode = 1; }
}
module.exports = { verifyPayload, verifyRelease };
