'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyPayload } = require('../scripts/verify-release');

function fixture(t) {
  const base = path.resolve(__dirname, '../scratch/distribution-tests');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'payload-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(base + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const files = new Map();
  for (const directory of ['src/main', 'src/preload', 'src/renderer']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
    files.set(path.normalize(directory + '/entry.js'), Buffer.from('local code'));
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'appicon.ico', 'appicon.png']) files.set(name, Buffer.from(name));
  files.set('package.json', Buffer.from(JSON.stringify({ name: 'apex-pc-optimizer', version: '1.0.0', main: 'src/main/entry.js', license: 'MIT' })));
  for (const [file, content] of files) fs.writeFileSync(path.join(root, file), content);
  return { root, files, asar: { extractFile: (_archive, file) => { if (!files.has(file)) throw new Error('Missing file: ' + file); return files.get(file); } } };
}

test('release payload verification accepts the exact code, resources and version', t => {
  const f = fixture(t);
  assert.deepEqual(verifyPayload(f.root, 'fixture.asar', f.asar), { version: '1.0.0', filesMatched: 7 });
});
test('release verification rejects a package with a different version or license', t => {
  const f = fixture(t);
  f.files.set('package.json', Buffer.from(JSON.stringify({ name: 'apex-pc-optimizer', version: '0.9.0', main: 'src/main/entry.js', license: 'MIT' })));
  assert.throws(() => verifyPayload(f.root, 'fixture.asar', f.asar), /version/);
  f.files.set('package.json', Buffer.from(JSON.stringify({ name: 'apex-pc-optimizer', version: '1.0.0', main: 'src/main/entry.js', license: 'Other' })));
  assert.throws(() => verifyPayload(f.root, 'fixture.asar', f.asar), /license/);
});
test('release verification rejects stale source and missing packaged assets', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'src/main/entry.js'), 'new code');
  assert.throws(() => verifyPayload(f.root, 'fixture.asar', f.asar), /fuente final/);
  f.files.delete('appicon.png');
  assert.throws(() => verifyPayload(f.root, 'fixture.asar', f.asar), /Missing file/);
});
