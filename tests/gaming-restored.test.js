'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateHost, summarize } = require('../src/main/networkTools');
const { transformed, FILE_SETTINGS, REGISTRY } = require('../src/main/gameBackupStore');
const { GAMES_DATA } = require('../src/main/gameOptimizer');
function loadIsolated(t, options = {}) {
  const root = path.resolve(__dirname, '../scratch/gaming-tests'); fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'fixture-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const module = { exports: {} };
  const sessionCalls = [];
  const filename = path.resolve(__dirname, '../src/main/gameBackupStore.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, Buffer, process: { env: { ...process.env, LOCALAPPDATA: directory } }, require(name) {
    if (name === 'electron') return { app: { getPath: () => path.join(directory, 'user-data') } };
    if (name === 'node:os') return { homedir: () => directory };
    if (name === './powerShell') return { runPowerShell: async () => { throw new Error('Windows execution is forbidden in this test.'); } };
    if (name === './gameSession') return { assertGameClosed: id => require('../src/main/gameSession').assertGameClosed(id, {runner: async (...args) => { sessionCalls.push(args); if(options.sessionError)throw options.sessionError;return options.sessionResult || {checked:true,running:[]}; }}) };
    if (name === 'node:fs' && options.renameError) return {...fs,renameSync(){throw options.renameError;}};
    return require(name);
  } }, { filename });
  const configs = path.join(directory, 'VALORANT', 'Saved', 'Config', 'profile'); fs.mkdirSync(configs, { recursive: true });
  return { store: module.exports, file: path.join(configs, 'GameUserSettings.ini'), directory, sessionCalls, history:path.join(directory,'user-data','game-backups-v1.json') };
}
function addConfig(fixture,relative,content) {
  const file=path.join(fixture.directory,'VALORANT','Saved','Config',relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);return file;
}
function profileId(fixture,file) { return require('node:crypto').createHash('sha256').update(path.resolve(file).toLowerCase()).digest('hex'); }
test('all original game tools have a supported declarative operation and no executable default revert', () => {
  const tweaks = GAMES_DATA.flatMap(game => game.tweaks);
  assert.equal(tweaks.length, 29);
  for (const tweak of tweaks) { assert.ok(FILE_SETTINGS[tweak.id] || REGISTRY[tweak.id]); assert.equal(tweak.revertScript, undefined); }
});
test('configuration transform preserves BOM, line endings and unrelated options', () => {
  const input = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('[Settings]\r\nbUseVSync=True\r\nOtherSetting=keep\r\n')]);
  const output = transformed('val_disable_vsync', input);
  assert.equal(output.subarray(0, 3).toString('hex'), 'efbbbf');
  assert.equal(output.subarray(3).toString(), '[Settings]\r\nbUseVSync=False\r\nOtherSetting=keep\r\n');
});
test('game changes back up bytes, restore in reverse order and refuse to overwrite later changes', async t => {
  const { store, file } = loadIsolated(t);
  const original = Buffer.from('[Settings]\r\nbUseVSync=True\r\nbUseHDRDisplayOutput=True\r\nKeep=áéí\r\n'); fs.writeFileSync(file, original);
  assert.equal((await store.apply('val_disable_vsync')).success, true);
  assert.equal((await store.apply('val_disable_hdr')).success, true);
  const conflict = await store.revert('val_disable_vsync'); assert.equal(conflict.success, false); assert.match(conflict.message, /posteriores/);
  assert.equal((await store.revert('val_disable_hdr')).success, true);
  assert.equal((await store.revert('val_disable_vsync')).success, true); assert.ok(fs.readFileSync(file).equals(original));
});
test('a file changed outside Apex is preserved and its backup retained', async t => {
  const { store, file } = loadIsolated(t); fs.writeFileSync(file, 'bUseVSync=True\n');
  assert.equal((await store.apply('val_disable_vsync')).success, true);
  fs.appendFileSync(file, 'ExternalSetting=42\n'); const changed = fs.readFileSync(file);
  assert.equal((await store.revert('val_disable_vsync')).success, false); assert.ok(fs.readFileSync(file).equals(changed));
});

test('game profile restores only owned records in actual apply order',async t=>{
 const {store,file}=loadIsolated(t),original=Buffer.from('bUseVSync=True\nbUseHDRDisplayOutput=True\nKeep=1\n');fs.writeFileSync(file,original);
 await store.apply('val_disable_hdr');await store.apply('val_disable_vsync');
 const metadata=store.ownership(['val_fullscreen','val_disable_hdr','val_disable_vsync']);
 assert.equal(metadata.val_fullscreen,undefined);assert.ok(metadata.val_disable_vsync.backupOrder>metadata.val_disable_hdr.backupOrder);
 const result=await store.revertProfile(['val_disable_vsync','val_fullscreen','val_disable_hdr']);
 assert.equal(result.success,true);assert.deepEqual(Array.from(result.results,item=>item.id),['val_disable_vsync','val_disable_hdr']);assert.ok(fs.readFileSync(file).equals(original));
 assert.equal(Object.keys(store.ownership(['val_disable_hdr','val_disable_vsync'])).length,0);
 assert.equal((await store.revertProfile(['val_fullscreen'])).skipped,true);
});

test('game profile stops on an external conflict and keeps remaining backups',async t=>{
 const {store,file}=loadIsolated(t);fs.writeFileSync(file,'bUseVSync=True\nbUseHDRDisplayOutput=True\n');
 await store.apply('val_disable_hdr');await store.apply('val_disable_vsync');fs.appendFileSync(file,'External=42\n');const changed=fs.readFileSync(file);
 const result=await store.revertProfile(['val_disable_hdr','val_disable_vsync']);
 assert.equal(result.success,false);assert.equal(result.results.length,1);assert.equal(Object.keys(store.ownership(['val_disable_hdr','val_disable_vsync'])).length,2);assert.ok(fs.readFileSync(file).equals(changed));
});
test('unsupported or missing game preference fails before changing the file', async t => {
  const { store, file } = loadIsolated(t); const original = Buffer.from('Other=1\n'); fs.writeFileSync(file, original);
  assert.equal((await store.apply('val_disable_vsync')).success, false); assert.ok(fs.readFileSync(file).equals(original));
});

test('an open game blocks configuration application before any file or history writes', async t => {
  const {store,file,history,sessionCalls}=loadIsolated(t,{sessionResult:{checked:true,running:['VALORANT-Win64-Shipping']}});
  const original=Buffer.from('bUseVSync=True\n');fs.writeFileSync(file,original);
  const result=await store.apply('val_disable_vsync');
  assert.equal(result.success,false);assert.equal(result.code,'GAME_RUNNING');assert.match(result.message,/Cierra VALORANT/);
  assert.ok(fs.readFileSync(file).equals(original));assert.equal(fs.existsSync(history),false);assert.equal(sessionCalls.length,1);
});

test('an unavailable process query fails closed before any configuration or history writes', async t => {
  const {store,file,history}=loadIsolated(t,{sessionError:new Error('private process error')});
  const original=Buffer.from('bUseVSync=True\n');fs.writeFileSync(file,original);
  const result=await store.apply('val_disable_vsync');
  assert.equal(result.code,'GAME_STATUS_UNAVAILABLE');assert.match(result.message,/No se pudo comprobar/);assert.doesNotMatch(result.message,/private/);
  assert.ok(fs.readFileSync(file).equals(original));assert.equal(fs.existsSync(history),false);
});

test('an open game blocks restoring a saved configuration without changing its backup', async t => {
  const state={checked:true,running:[]};
  const {store,file,history}=loadIsolated(t,{sessionResult:state});fs.writeFileSync(file,'bUseVSync=True\n');
  assert.equal((await store.apply('val_disable_vsync')).success,true);
  const applied=fs.readFileSync(file),backup=fs.readFileSync(history);state.running.push('VALORANT-Win64-Shipping');
  const result=await store.revert('val_disable_vsync');
  assert.equal(result.code,'GAME_RUNNING');assert.ok(fs.readFileSync(file).equals(applied));assert.ok(fs.readFileSync(history).equals(backup));
});

test('filesystem access failures report recovery steps without exposing a personal path', async t => {
  const denied=Object.assign(new Error('EPERM C:\\Users\\private\\config.ini'),{code:'EPERM'});
  const {store,file}=loadIsolated(t,{renameError:denied});const original=Buffer.from('bUseVSync=True\n');fs.writeFileSync(file,original);
  const result=await store.apply('val_disable_vsync');
  assert.equal(result.code,'FILE_ACCESS_DENIED');assert.match(result.message,/solo lectura/);assert.match(result.message,/antivirus/);assert.doesNotMatch(result.message,/private/);
  assert.ok(fs.readFileSync(file).equals(original));
});

test('VALORANT profile inventory has stable opaque ids, sorted dates and no account paths',async t=>{
  const f=loadIsolated(t),older=addConfig(f,'account-private-1/Windows/GameUserSettings.ini','bUseVSync=True\n');
  const newer=addConfig(f,'account-private-2/WindowsClient/GameUserSettings.ini','bUseVSync=True\n');
  fs.utimesSync(older,new Date('2026-01-01'),new Date('2026-01-01'));fs.utimesSync(newer,new Date('2026-02-01'),new Date('2026-02-01'));
  fs.chmodSync(older,0o444);
  try{
    const profiles=f.store.getConfigProfiles();assert.equal(profiles.length,2);assert.equal(profiles[0].id,profileId(f,newer));assert.equal(profiles[1].id,profileId(f,older));
    assert.equal(profiles[0].label,'Perfil 1 · WindowsClient');assert.equal(profiles[1].label,'Perfil 2 · Windows');assert.equal(profiles[1].readOnly,true);
    for(const item of profiles)assert.match(item.id,/^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(profiles),/account-private|GameUserSettings|gaming-tests|file|directory/);
  }finally{fs.chmodSync(older,0o666);}
});

test('several VALORANT profiles require an explicit selection before backing up or writing',async t=>{
  const f=loadIsolated(t),first=addConfig(f,'a/Windows/GameUserSettings.ini','bUseVSync=True\n'),second=addConfig(f,'b/WindowsClient/GameUserSettings.ini','Other=1\n');
  const result=await f.store.apply('val_disable_vsync');assert.equal(result.code,'PROFILE_SELECTION_REQUIRED');assert.match(result.message,/Selecciona/);
  assert.equal(fs.readFileSync(first,'utf8'),'bUseVSync=True\n');assert.equal(fs.readFileSync(second,'utf8'),'Other=1\n');assert.equal(fs.existsSync(f.history),false);
});

test('an explicit VALORANT profile never transforms or adopts another account configuration',async t=>{
  const f=loadIsolated(t),selected=addConfig(f,'a/WindowsClient/GameUserSettings.ini','bUseVSync=True\n'),other=addConfig(f,'b/Windows/GameUserSettings.ini','Other=1\n');
  const selectedId=profileId(f,selected),otherId=profileId(f,other);fs.chmodSync(other,0o444);
  try{
    assert.equal((await f.store.apply('val_disable_vsync',selectedId)).success,true);assert.equal(fs.readFileSync(selected,'utf8'),'bUseVSync=False\n');assert.equal(fs.readFileSync(other,'utf8'),'Other=1\n');
    assert.equal((await f.store.statuses(['val_disable_vsync'],selectedId)).val_disable_vsync,true);assert.equal((await f.store.statuses(['val_disable_vsync'],otherId)).val_disable_vsync,false);
    assert.equal(f.store.ownership(['val_disable_vsync'],selectedId).val_disable_vsync.hasBackup,true);assert.equal(f.store.ownership(['val_disable_vsync'],otherId).val_disable_vsync,undefined);
    assert.equal(f.store.ownership(['val_disable_vsync']).val_disable_vsync.hasBackup,true);
    assert.equal((await f.store.revert('val_disable_vsync')).success,true);assert.equal(fs.readFileSync(selected,'utf8'),'bUseVSync=True\n');
  }finally{fs.chmodSync(other,0o666);}
});

test('forged or stale profile identifiers cannot select or write a different configuration',async t=>{
  const f=loadIsolated(t),file=addConfig(f,'a/Windows/GameUserSettings.ini','bUseVSync=True\n'),id=profileId(f,file);
  for(const invalid of ['f'.repeat(64),'../GameUserSettings.ini',{},''])assert.equal((await f.store.apply('val_disable_vsync',invalid)).code,'PROFILE_NOT_FOUND');
  await assert.rejects(()=>f.store.statuses(['val_disable_vsync'],'f'.repeat(64)),/no está disponible/);
  fs.unlinkSync(file);assert.equal((await f.store.apply('val_disable_vsync',id)).code,'PROFILE_NOT_FOUND');assert.equal(fs.existsSync(f.history),false);
});

test('read-only selected configuration fails preflight without creating a backup or changing attributes',async t=>{
  const f=loadIsolated(t),file=addConfig(f,'a/Windows/GameUserSettings.ini','bUseVSync=True\n');fs.chmodSync(file,0o444);
  try{
    const result=await f.store.apply('val_disable_vsync',profileId(f,file));assert.equal(result.code,'CONFIG_READ_ONLY');assert.match(result.message,/no retira/);
    assert.equal(fs.existsSync(f.history),false);assert.equal(fs.readFileSync(file,'utf8'),'bUseVSync=True\n');assert.equal(fs.statSync(file).mode & 0o222,0);
  }finally{fs.chmodSync(file,0o666);}
});

test('FPS configuration uses only the selected profile or the existing shared root file',async t=>{
  const f=loadIsolated(t),primary=addConfig(f,'a/Windows/GameUserSettings.ini','bUseVSync=True\n');
  addConfig(f,'b/Windows/GameUserSettings.ini','bUseVSync=True\n');
  const key='EAresIntSettingName::PlayerPerfShowClientFps',original=key+'=0\n';
  const scoped=addConfig(f,'a/Windows/RiotUserSettings.ini',original),other=addConfig(f,'b/Windows/RiotUserSettings.ini',original),global=addConfig(f,'RiotUserSettings.ini',original),id=profileId(f,primary);
  assert.equal((await f.store.apply('val_show_fps',id)).success,true);assert.match(fs.readFileSync(scoped,'utf8'),/=1/);assert.equal(fs.readFileSync(other,'utf8'),original);assert.equal(fs.readFileSync(global,'utf8'),original);
  assert.equal((await f.store.revert('val_show_fps')).success,true);fs.unlinkSync(scoped);
  assert.equal((await f.store.apply('val_show_fps',id)).success,true);assert.match(fs.readFileSync(global,'utf8'),/=1/);assert.equal(fs.readFileSync(other,'utf8'),original);
  assert.equal((await f.store.revert('val_show_fps')).success,true);fs.unlinkSync(global);
  const missing=await f.store.apply('val_show_fps',id);assert.equal(missing.success,false);assert.match(missing.message,/No se encontró/);assert.equal(fs.readFileSync(other,'utf8'),original);
});

test('restoration preflights every changed legacy file before restoring any of them',async t=>{
  const f=loadIsolated(t),original=Buffer.from('bUseVSync=True\n');fs.writeFileSync(f.file,original);
  assert.equal((await f.store.apply('val_disable_vsync')).success,true);
  const other=addConfig(f,'second/Windows/GameUserSettings.ini','bUseVSync=False\n'),history=JSON.parse(fs.readFileSync(f.history,'utf8'));
  history.entries[0].files.push({...history.entries[0].files[0],file:other});fs.writeFileSync(f.history,JSON.stringify(history));const beforeHistory=fs.readFileSync(f.history);fs.chmodSync(other,0o444);
  try{
    const result=await f.store.revert('val_disable_vsync');assert.equal(result.code,'CONFIG_READ_ONLY');assert.equal(fs.readFileSync(f.file,'utf8'),'bUseVSync=False\n');assert.equal(fs.readFileSync(other,'utf8'),'bUseVSync=False\n');assert.ok(fs.readFileSync(f.history).equals(beforeHistory));
  }finally{fs.chmodSync(other,0o666);}
});
test('network validation rejects script interpolation and preserves measured zero latency', () => {
  for (const input of ['x";$(Get-Process)', 'https://example.com', 'a b', null]) assert.throws(() => validateHost(input));
  assert.equal(validateHost('::1'), '::1'); assert.equal(summarize([0, 0, null, 2, 4]).min, 0);
});
test('unknown DNS providers including inherited property names fail before contacting Windows', async () => {
  const { setDnsProvider } = require('../src/main/networkTools');
  for (const provider of ['toString', '__proto__', 'unlisted', null, {}]) assert.equal((await setDnsProvider(provider)).success, false);
});
test('memory cleaner rejects malformed process identifiers without contacting Windows', async () => {
  const memory = require('../src/main/memoryCleanerService');
  for (const id of [null, -1, NaN, '42;evil', 2.3]) assert.equal((await memory.optimizeSingleProcess(id)).success, false);
  assert.throws(() => memory.setAutoCleanConfig({ thresholdPercent: NaN }));
  assert.throws(() => memory.setAutoCleanConfig({ intervalSeconds: 1 }));
  assert.equal(memory.setAutoCleanConfig({ enabled: false, thresholdPercent: 85, intervalSeconds: 60 }).enabled, false);
});
