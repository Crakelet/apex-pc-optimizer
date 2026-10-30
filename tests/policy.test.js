'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, trustedSender } = require('../src/main/ipcPolicy');
const { validateHost, summarize } = require('../src/main/networkTools');
const { isNewerVersion, allowedExternal, parseRelease } = require('../src/main/updateService');
test('IP, IPv6 and domain validation rejects shell syntax and URLs', () => {
  for (const host of ['1.1.1.1', '::1', 'google.com', 'localhost', 'some-host.example']) assert.equal(validateHost(host), host);
  for (const host of ['', ' https://test.com', 'test.com:443', 'a";$(whoami)', 'a b', '-target', 'a/b', 'x'.repeat(254), null]) assert.throws(() => validateHost(host));
});
test('five real samples retain zero and missing values', () => {
  assert.deepEqual(summarize([0, 10, null, 20, 30]), { sent: 5, received: 4, loss: 20, min: 0, max: 30, mean: 15, variation: 10 });
  assert.equal(summarize([null, null, null, null, null]).mean, null);
});
test('IPC allows only known IDs, channels, parameter shapes and official URLs', () => {
  assert.doesNotThrow(() => validateRequest('settings:apply', ['game-mode', { keyExists: false, exists: false, kind: null, value: null }]));
  for (const [channel, args] of [['apply-tweak', ['game_dvr']], ['settings:apply', ['bcdedit']], ['app:info', ['extra']], ['settings:apply', [{ id: 'game-mode' }]], ['network:ping', ['x;Remove-Item']], ['window:control', ['destroy']], ['external:open', ['https://example.com']]]) assert.throws(() => validateRequest(channel, args));
});
test('IPC sender must be the exact main frame of the current window', () => {
  const frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { webContents: contents };
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window, frame.url), true);
  assert.equal(trustedSender({ sender: contents, senderFrame: { url: frame.url } }, window, frame.url), false);
  assert.equal(trustedSender({ sender: {}, senderFrame: frame }, window, frame.url), false);
});
test('update versions compare stable semver numerically', () => {
  assert.equal(isNewerVersion('v1.10.0', '1.9.9'), true); assert.equal(isNewerVersion('1.0.0', '1.0.0'), false);
  for (const invalid of ['1.0.1-beta', '1.0', 'latest', 'garbage', 'v01.0.0']) assert.equal(isNewerVersion(invalid, '1.0.0'), false);
});
test('external links cannot redirect to another host, repository or download', () => {
  assert.equal(allowedExternal('https://github.com/Crakelet/apex-pc-optimizer/releases/tag/v1.0.1'), true);
  for (const url of ['http://github.com/Crakelet/apex-pc-optimizer', 'https://github.com.evil.com/Crakelet/apex-pc-optimizer', 'https://github.com/evil/repo', 'https://user@github.com/Crakelet/apex-pc-optimizer', 'file:///C:/test.exe', 'https://github.com/Crakelet/apex-pc-optimizer?redirect=evil', 'https://github.com/Crakelet/apex-pc-optimizer/releases/download/v1.0.0/test.exe']) assert.equal(allowedExternal(url), false);
});
test('drafts, prereleases and foreign release pages are not stable updates', () => {
  const release = { tag_name: 'v1.0.1', html_url: 'https://github.com/Crakelet/apex-pc-optimizer/releases/tag/v1.0.1', draft: false, prerelease: false };
  assert.equal(parseRelease(release, '1.0.0').updateAvailable, true);
  assert.equal(parseRelease(release, '1.0.1').updateAvailable, false);
  assert.throws(() => parseRelease({ ...release, draft: true })); assert.throws(() => parseRelease({ ...release, prerelease: true })); assert.throws(() => parseRelease({ ...release, html_url: 'https://evil.com' }));
});
