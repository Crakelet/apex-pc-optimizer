'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, createHash } = require('node:crypto');
const { runPowerShell } = require('./powerShell');
const { assertGameClosed } = require('./gameSession');
const LIMIT = 8 * 1024 * 1024;
const PRIORITY_PATH = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\';
const REGISTRY = Object.fromEntries(Object.entries({ val_cpu_priority: 'VALORANT-Win64-Shipping.exe', fn_cpu_priority: 'FortniteClient-Win64-Shipping.exe', cs2_cpu_priority: 'cs2.exe', apex_cpu_priority: 'r5apex.exe', cod_cpu_priority: 'cod.exe' }).map(([id, exe]) => [id, { hive: 'LocalMachine', relative: PRIORITY_PATH + exe + '\\PerfOptions', name: 'CpuPriorityClass', kind: 'DWord', value: 3 }]));
for (const [id, exe] of [['cs2_disable_fse', 'cs2.exe'], ['cod_disable_fse', 'cod.exe']]) REGISTRY[id] = { hive: 'CurrentUser', relative: 'Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers', name: exe, executable: exe, kind: 'String', value: '~ DISABLEDXMAXIMIZEDWINDOWEDMODE' };
REGISTRY.cs2_game_dvr_off = { hive: 'CurrentUser', relative: 'System\\GameConfigStore', name: 'GameDVR_FSEBehaviorMode', kind: 'DWord', value: 2 };
const FILE_SETTINGS = {
  val_fullscreen: { PreferredFullscreenMode: '0', FullscreenMode: '0', LastConfirmedFullscreenMode: '0' }, val_disable_vsync: { bUseVSync: 'False' }, val_disable_dynamic_res: { bUseDynamicResolution: 'False' }, val_disable_hdr: { bUseHDRDisplayOutput: 'False' }, val_multithreaded_rendering: { bMultithreadedRendering: 'True' },
  val_unlock_fps: { FrameRateLimit: '0.000000', bLimitFramerate: 'False', bLimitFramerateOnBattery: 'False', bLimitFramerateInMenu: 'False', bLimitFramerateInBackground: 'False' }, val_show_fps: { 'EAresIntSettingName::PlayerPerfShowClientFps': '1' },
  val_low_shadows: { 'sg.ShadowQuality': '0' }, val_low_textures: { 'sg.TextureQuality': '0' }, val_low_effects: { 'sg.EffectsQuality': '0' }, val_low_postprocessing: { 'sg.PostProcessQuality': '0' }, val_low_shading: { 'sg.ShadingQuality': '0' }, val_low_foliage: { 'sg.FoliageQuality': '0' }, val_low_antialiasing: { 'sg.AntiAliasingQuality': '0' }, val_disable_vignette: { bEnableBloom: 'False', bEnableDistortion: 'False' },
  fn_disable_vsync: { bUseVSync: 'False' }, fn_disable_grass: { bShowGrass: 'False' }, fn_disable_raytracing: { bRayTracing: 'False', bEnableRaytracingShadows: 'False', bEnableRaytracingReflections: 'False' }, fn_low_shadows_effects: { 'sg.ShadowQuality': '0', 'sg.EffectsQuality': '0', 'sg.PostProcessQuality': '0', 'sg.FoliageQuality': '0', 'sg.GlobalIlluminationQuality': '0', 'sg.ReflectionQuality': '0' },
  apex_csm_shadows_off: { 'setting.csm_enabled': '0' }, apex_ragdolls_zero: { 'setting.ragdoll_maxcount': '0' }
};
function dataDirectory() { try { const { app } = require('electron'); if (app?.getPath) return app.getPath('userData'); } catch {} return path.join(os.homedir(), '.apex-pc-optimizer'); }
function storeFile() { return path.join(dataDirectory(), 'game-backups-v1.json'); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function readStore() {
  try { const data = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); if (data.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > 2000) throw new Error('El historial de juegos no es válido.'); return data; }
  catch (error) { if (error.code === 'ENOENT') return { schema: 1, entries: [] }; throw error; }
}
function saveStore(data) {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  const temporary = storeFile() + '.' + randomUUID() + '.tmp';
  let fd;
  try { fd = fs.openSync(temporary, 'wx'); fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; fs.renameSync(temporary, storeFile()); }
  finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function configRoot(id) {
  if (id.startsWith('val_')) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'VALORANT', 'Saved', 'Config');
  if (id.startsWith('fn_')) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'FortniteGame', 'Saved', 'Config', 'WindowsClient');
  if (id.startsWith('apex_')) return path.join(os.homedir(), 'Saved Games', 'Respawn', 'Apex', 'local');
  throw new Error('Configuración de juego no reconocida.');
}
function configName(id) { return id === 'val_show_fps' ? 'RiotUserSettings.ini' : id.startsWith('apex_') ? 'videoconfig.txt' : 'GameUserSettings.ini'; }
function ensureSafeFile(id, file) {
  const root = path.resolve(configRoot(id)), full = path.resolve(file), relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(full) !== configName(id)) throw new Error('La ruta no corresponde a una configuración autorizada del juego.');
  let current = full;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('No se modifican configuraciones que atraviesen enlaces o uniones de directorio.');
    current = path.dirname(current);
  }
  const stat = fs.statSync(full);
  if (!stat.isFile() || stat.size > LIMIT) throw new Error('El archivo de configuración no es compatible o supera 8 MB.');
  return full;
}
function configFiles(id) {
  const root = configRoot(id), found = [];
  function walk(directory, depth) {
    if (depth > 6 || found.length >= 100 || !fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink()) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && id.startsWith('val_')) walk(file, depth + 1);
      else if (entry.isFile() && entry.name === configName(id)) found.push(ensureSafeFile(id, file));
    }
  }
  walk(root, 0); return found;
}
function profileFailure(message, code = 'PROFILE_SELECTION_REQUIRED') { const error = new Error(message); error.code = code; return error; }
function normalizedFile(file) { return path.resolve(file).toLowerCase(); }
function configProfiles() {
  return configFiles('val_disable_vsync').map(file => {
    const stat = fs.statSync(file);
    return {file,id:hash(normalizedFile(file)),modified:stat.mtimeMs,modifiedAt:stat.mtime.toISOString(),readOnly:(stat.mode & 0o222) === 0};
  }).sort((a,b) => b.modified-a.modified || normalizedFile(a.file).localeCompare(normalizedFile(b.file)));
}
function getConfigProfiles() {
  return configProfiles().map((profile,index) => {
    const folder = path.basename(path.dirname(profile.file));
    const platform = /^Windows(?:Client)?$/i.test(folder) ? (/Client/i.test(folder) ? 'WindowsClient' : 'Windows') : 'Configuración';
    return {id:profile.id,label:`Perfil ${index+1} · ${platform}`,modifiedAt:profile.modifiedAt,readOnly:profile.readOnly};
  });
}
function selectedProfile(profileId) {
  const profiles = configProfiles();
  if (profileId !== null) {
    if (typeof profileId !== 'string' || !/^[a-f0-9]{64}$/.test(profileId)) throw profileFailure('El perfil seleccionado no es válido. Actualiza la lista y elige un perfil de VALORANT.','PROFILE_NOT_FOUND');
    const profile = profiles.find(item => item.id === profileId);
    if (!profile) throw profileFailure('El perfil seleccionado ya no está disponible. Actualiza la lista y vuelve a elegirlo. No se modificó la configuración.','PROFILE_NOT_FOUND');
    return profile;
  }
  if (profiles.length > 1) throw profileFailure('Hay varios perfiles de VALORANT. Selecciona el perfil y la carpeta de configuración antes de aplicar un ajuste. No se modificó ningún perfil.');
  return profiles[0] || null;
}
function selectedConfigFiles(id, profileId = null) {
  if (!id.startsWith('val_')) return configFiles(id);
  const profile = selectedProfile(profileId);
  if (id !== 'val_show_fps') return profile ? [profile.file] : [];
  // RiotUserSettings can be next to the selected GameUserSettings or at the
  // shared Config root. Never search another account to fill a missing file.
  const scoped = profile ? path.join(path.dirname(profile.file),configName(id)) : null;
  if (scoped && fs.existsSync(scoped)) return [ensureSafeFile(id,scoped)];
  const global = path.join(configRoot(id),configName(id));
  return fs.existsSync(global) ? [ensureSafeFile(id,global)] : [];
}
function assertWritableFile(id,file) {
  ensureSafeFile(id,file);
  if ((fs.statSync(file).mode & 0o222) === 0) throw profileFailure('El archivo de configuración está marcado como solo lectura. Apex no retira ese atributo. Revisa el archivo del perfil elegido antes de volver a intentarlo.','CONFIG_READ_ONLY');
  fs.accessSync(file,fs.constants.W_OK);
  fs.accessSync(path.dirname(file),fs.constants.W_OK);
}
function decode(buffer) {
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return { text: buffer.subarray(2).toString('utf16le'), encoding: 'utf16le', bom: Buffer.from([0xFF, 0xFE]) };
  const bom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF ? 3 : 0;
  const text = buffer.subarray(bom).toString('utf8');
  if (text.includes('\uFFFD')) throw new Error('La codificación del archivo no es compatible. Se conservó sin cambios.');
  return { text, encoding: 'utf8', bom: buffer.subarray(0, bom) };
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function propertyPattern(id, key) { return id.startsWith('apex_') ? new RegExp('(^[ \\t]*"' + escapeRegex(key) + '"[ \\t]*")([^"\\r\\n]*)(")', 'gmi') : new RegExp('(^[ \\t]*' + escapeRegex(key) + '[ \\t]*=[ \\t]*)([^\\r\\n]*)', 'gmi'); }
function transformed(id, buffer) {
  const decoded = decode(buffer); let text = decoded.text;
  for (const [key, value] of Object.entries(FILE_SETTINGS[id] || {})) {
    const pattern = propertyPattern(id, key);
    if (!pattern.test(text)) throw profileFailure('El perfil elegido no contiene la preferencia «' + key + '». Puede usar otra versión o guardar este ajuste en otra ubicación. Cámbialo desde las opciones del juego; Apex no añadirá claves supuestas.','CONFIG_PREFERENCE_UNAVAILABLE');
    pattern.lastIndex = 0; text = text.replace(pattern, (_match, prefix, _old, suffix) => prefix + value + (id.startsWith('apex_') ? suffix : ''));
  }
  return Buffer.concat([decoded.bom, Buffer.from(text, decoded.encoding)]);
}
function fileApplied(id, buffer) {
  const decoded = decode(buffer);
  return Object.entries(FILE_SETTINGS[id] || {}).every(([key, value]) => { const match = propertyPattern(id, key).exec(decoded.text); return match && match[2].trim().toLowerCase() === value.toLowerCase(); });
}
function writeFileAtomic(file, value) {
  const temporary = file + '.apex-' + randomUUID() + '.tmp'; let fd;
  try { fd = fs.openSync(temporary, 'wx'); fs.writeFileSync(fd, value); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; fs.renameSync(temporary, file); }
  finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
async function registrySnapshots(ids, names = {}) {
  const targets = ids.filter(id => REGISTRY[id]).map(id => ({ id, ...REGISTRY[id], targetName: names[id] || null }));
  if (!targets.length) return {};
  const result = await runPowerShell([
    '$records = @()',
    'foreach ($item in $data.targets) {',
    '$name = [string]$item.name',
    'if ($item.executable) {',
    '$name = [string]$item.targetName',
    'if (-not $name) { $running = Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension([string]$item.executable)) -ErrorAction SilentlyContinue | Select-Object -First 1; if ($running) { try { $name = $running.Path } catch {} } }',
    'if (-not [IO.Path]::IsPathRooted($name)) { $records += @{ id = $item.id; snapshot = $null }; continue }',
    '}',
    '$base = if ($item.hive -eq "LocalMachine") { [Microsoft.Win32.Registry]::LocalMachine } else { [Microsoft.Win32.Registry]::CurrentUser }',
    '$key = $base.OpenSubKey([string]$item.relative)',
    'try {',
    '$exists = $null -ne $key -and $key.GetValueNames() -contains $name; $kind = $null; $value = $null',
    'if ($exists) { $kind = $key.GetValueKind($name).ToString(); $value = $key.GetValue($name); if ($kind -eq "DWord") { $value = [long]$value -band 0xFFFFFFFFL } }',
    '$records += @{ id = $item.id; snapshot = @{ keyExists = ($null -ne $key); exists = $exists; kind = $kind; value = $value; targetName = $name } }',
    '} finally { if ($key) { $key.Close() } }',
    '}',
    '@{ records = $records } | ConvertTo-Json -Depth 6 -Compress'
  ].join('\n'), { targets });
  return Object.fromEntries(result.records.map(item => [item.id, item.snapshot]));
}
function sameSnapshot(a, b) { return a.exists === b.exists && (!a.exists || (a.kind === b.kind && a.value === b.value)); }
function validSnapshot(item) { return item && typeof item.exists === 'boolean' && typeof item.keyExists === 'boolean' && (!item.exists ? item.kind === null && item.value === null : item.kind === 'DWord' ? Number.isInteger(item.value) && item.value >= 0 && item.value <= 4294967295 : item.kind === 'String' && typeof item.value === 'string' && item.value.length <= 32768); }
async function registryWrite(id, snapshot, targetName = null) {
  if (!validSnapshot(snapshot)) throw new Error('El respaldo de registro del juego no es compatible.');
  const target = { ...REGISTRY[id] };
  if (target.executable) {
    if (!targetName || !path.win32.isAbsolute(targetName) || path.win32.basename(targetName).toLowerCase() !== target.executable.toLowerCase()) throw new Error('La ruta del ejecutable respaldado no corresponde al juego.');
    target.name = targetName;
  }
  await runPowerShell([
    '$base = if ($data.target.hive -eq "LocalMachine") { [Microsoft.Win32.Registry]::LocalMachine } else { [Microsoft.Win32.Registry]::CurrentUser }',
    'if ($data.snapshot.exists) {',
    '$key = $base.CreateSubKey([string]$data.target.relative)',
    'try {',
    '$kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], [string]$data.snapshot.kind)',
    '$value = if ($data.snapshot.kind -eq "DWord") { [BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]$data.snapshot.value), 0) } else { [string]$data.snapshot.value }',
    '$key.SetValue([string]$data.target.name, $value, $kind)',
    '} finally { $key.Close() }',
    '} else {',
    '$key = $base.OpenSubKey([string]$data.target.relative, $true)',
    'if ($key) { try { $key.DeleteValue([string]$data.target.name, $false) } finally { $key.Close() } }',
    '}',
    '@{ success = $true } | ConvertTo-Json -Compress'
  ].join('\n'), { target, snapshot });
}
let busy = false;
function failureResult(error) {
  if (['EPERM','EACCES','EBUSY'].includes(error?.code)) return { success: false, code: 'FILE_ACCESS_DENIED', message: 'Windows no permitió acceder a la configuración del juego o guardar su respaldo. Cierra el juego, revisa si el archivo está marcado como solo lectura y comprueba los permisos y los avisos del antivirus. Conserva los respaldos antes de volver a intentarlo.' };
  if (error?.code === 'ENOENT') return { success: false, code: 'CONFIG_NOT_FOUND', message: 'El archivo de configuración dejó de estar disponible. Inicia el juego para generar sus ajustes, ciérralo y vuelve a intentarlo.' };
  return { success: false, ...(error?.code ? {code:error.code}:{}), message: error?.message || 'No se pudo completar el ajuste del juego.' };
}
async function apply(id, profileId = null) {
  if (busy) return { success: false, message: 'Ya hay un cambio de juego en curso.' };
  busy = true;
  try {
    if (!REGISTRY[id] && !FILE_SETTINGS[id]) throw new Error('Ajuste de juego no reconocido.');
    if (FILE_SETTINGS[id]) await assertGameClosed(id);
    const store = readStore();
    if (store.entries.length >= 2000) throw new Error('El historial de juegos alcanzó su límite. Conserva los respaldos y contacta con soporte.');
    if (store.entries.some(item => item.id === id && item.status !== 'reverted')) throw new Error('Este ajuste ya conserva un respaldo activo. Restáuralo antes de aplicarlo otra vez.');
    const entry = { id, at: new Date().toISOString(), status: 'prepared', kind: REGISTRY[id] ? 'registry' : 'files' };
    if (REGISTRY[id]) {
      entry.before = (await registrySnapshots([id]))[id];
      if (!entry.before && REGISTRY[id].executable) throw new Error('Abre el juego para que Apex localice su ejecutable. No se escribirá una regla con una ruta supuesta.');
      if (!validSnapshot(entry.before)) throw new Error('El valor anterior no tiene un formato compatible para respaldarlo.');
      entry.targetName = entry.before.targetName;
      entry.after = { keyExists: true, exists: true, kind: REGISTRY[id].kind, value: REGISTRY[id].value };
      if (sameSnapshot(entry.before, entry.after)) return { success: true, skipped: true, message: 'La preferencia ya tenía ese valor. No se atribuyó a Apex.' };
      store.entries.push(entry); saveStore(store);
      if (!sameSnapshot((await registrySnapshots([id], { [id]: entry.targetName }))[id], entry.before)) throw new Error('La preferencia cambió durante la revisión. No se sobrescribió.');
      await registryWrite(id, entry.after, entry.targetName);
      if (!sameSnapshot((await registrySnapshots([id], { [id]: entry.targetName }))[id], entry.after)) throw new Error('Windows no confirmó el cambio de juego. El respaldo sigue guardado.');
    } else {
      const files = selectedConfigFiles(id,profileId);
      if (!files.length) throw new Error('No se encontró la configuración del juego. Inícialo una vez para generarla.');
      const prepared = files.map(file => { const before = fs.readFileSync(file), after = transformed(id, before); return { file, before, after }; });
      if (prepared.every(item => item.before.equals(item.after))) return { success: true, skipped: true, message: 'La configuración ya tenía los valores solicitados. No se modificó.' };
      for (const item of prepared) if (!item.before.equals(item.after)) assertWritableFile(id,item.file);
      entry.files = prepared.map(item => ({ file: item.file, before: item.before.toString('base64'), afterHash: hash(item.after) }));
      store.entries.push(entry); saveStore(store);
      for (const item of prepared) {
        ensureSafeFile(id, item.file);
        if (!fs.readFileSync(item.file).equals(item.before)) throw new Error('La configuración cambió mientras se preparaba. No se sobrescribió ese archivo.');
        writeFileAtomic(item.file, item.after);
        if (hash(fs.readFileSync(item.file)) !== hash(item.after)) throw new Error('No se pudo verificar la configuración escrita.');
      }
    }
    entry.status = 'applied'; saveStore(store); return { success: true, message: 'Configuración aplicada y verificada. Se guardó su contenido original para restaurarlo.' };
  } catch (error) { return failureResult(error); } finally { busy = false; }
}
async function revert(id) {
  if (busy) return { success: false, message: 'Ya hay una operación de juego en curso.' };
  busy = true;
  try {
    if (FILE_SETTINGS[id]) await assertGameClosed(id);
    const store = readStore(), entry = [...store.entries].reverse().find(item => item.id === id && item.status !== 'reverted');
    if (!entry) throw new Error('No hay un respaldo original de este ajuste creado por Apex. No se aplicaron valores supuestos.');
    if (REGISTRY[id] && entry.kind === 'registry') {
      if (!validSnapshot(entry.before) || !validSnapshot(entry.after)) throw new Error('El respaldo no es válido.');
      const current = (await registrySnapshots([id], { [id]: entry.targetName }))[id];
      if (!sameSnapshot(current, entry.before)) {
        if (!sameSnapshot(current, entry.after)) throw new Error('Otra aplicación cambió la preferencia. No se sobrescribió.');
        await registryWrite(id, entry.before, entry.targetName);
      }
      if (!sameSnapshot((await registrySnapshots([id], { [id]: entry.targetName }))[id], entry.before)) throw new Error('No se pudo verificar la restauración del registro.');
    } else if (FILE_SETTINGS[id] && entry.kind === 'files' && Array.isArray(entry.files) && entry.files.length > 0 && entry.files.length <= 100) {
      for (const item of entry.files) {
        ensureSafeFile(id, item.file);
        if (typeof item.before !== 'string' || item.before.length > LIMIT * 1.4 || !/^[a-f0-9]{64}$/.test(item.afterHash)) throw new Error('El respaldo del archivo no es válido.');
        const current = fs.readFileSync(item.file), before = Buffer.from(item.before, 'base64');
        if (!current.equals(before) && hash(current) !== item.afterHash) throw new Error('El archivo cambió después de este ajuste. Deshaz primero los ajustes posteriores o revisa los cambios externos; no se sobrescribió.');
        if (!current.equals(before)) assertWritableFile(id,item.file);
      }
      for (const item of entry.files) { const before = Buffer.from(item.before, 'base64'); if (!fs.readFileSync(item.file).equals(before)) writeFileAtomic(item.file, before); if (!fs.readFileSync(item.file).equals(before)) throw new Error('No se confirmó la restauración del archivo.'); }
    } else throw new Error('El respaldo no corresponde a una operación compatible.');
    entry.status = 'reverted'; entry.revertedAt = new Date().toISOString(); saveStore(store);
    return { success: true, message: 'Configuración original restaurada y verificada.' };
  } catch (error) { return failureResult(error); } finally { busy = false; }
}
async function statuses(ids, profileId = null) {
  if (profileId !== null && ids.some(id => id.startsWith('val_') && FILE_SETTINGS[id])) selectedProfile(profileId);
  let registry = {};
  const names = {}, fileLists = new Map(), fileBuffers = new Map();
  try { for (const entry of readStore().entries) if (entry.status !== 'reverted' && REGISTRY[entry.id]?.executable && path.win32.isAbsolute(entry.targetName || '') && path.win32.basename(entry.targetName).toLowerCase() === REGISTRY[entry.id].executable.toLowerCase()) names[entry.id] = entry.targetName; } catch { /* A damaged backup is not imported as a valid one. */ }
  try { registry = await registrySnapshots(ids, names); } catch { /* Unreadable is unknown, not a fabricated success. */ }
  const result = {};
  for (const id of ids) {
    try {
      if (REGISTRY[id]) result[id] = registry[id] ? sameSnapshot(registry[id], { exists: true, kind: REGISTRY[id].kind, value: REGISTRY[id].value }) : false;
      else if (FILE_SETTINGS[id]) {
        const cacheKey = configRoot(id) + '|' + configName(id);
        if (!fileLists.has(cacheKey)) fileLists.set(cacheKey, selectedConfigFiles(id,profileId));
        const files = fileLists.get(cacheKey);
        result[id] = files.length > 0 && files.every(file => { if (!fileBuffers.has(file)) fileBuffers.set(file, fs.readFileSync(file)); return fileApplied(id, fileBuffers.get(file)); });
      }
      else result[id] = false;
    } catch { result[id] = false; }
  }
  return result;
}
function ownership(ids, profileId = null) {
  const allowed=new Set(ids), result={}, selected=new Map();
  if (profileId !== null) selectedProfile(profileId);
  readStore().entries.forEach((entry,index)=>{
    if (!allowed.has(entry.id)) return;
    if (profileId !== null && entry.kind === 'files' && entry.id.startsWith('val_')) {
      if (!selected.has(entry.id)) selected.set(entry.id,new Set(selectedConfigFiles(entry.id,profileId).map(normalizedFile)));
      if (!Array.isArray(entry.files) || !entry.files.some(item => typeof item.file === 'string' && selected.get(entry.id).has(normalizedFile(item.file)))) return;
    }
    if(allowed.has(entry.id)&&['prepared','applied','failed'].includes(entry.status))result[entry.id]={hasBackup:true,backupOrder:index+1,backupStatus:entry.status,backupAt:entry.at};
  });
  return result;
}
async function revertProfile(ids) {
  try {
    const owned=ownership(ids), ordered=Object.keys(owned).sort((a,b)=>owned[b].backupOrder-owned[a].backupOrder), results=[];
    for(const id of ordered){
      const result=await revert(id);results.push({id,...result});
      if(!result.success)return{success:false,partial:results.length>1,results,message:`Se restauraron ${results.filter(item=>item.success).length} de ${ordered.length} ajustes guardados. Se detuvo la restauración: ${result.message}`};
    }
    return{success:true,results,skipped:ordered.length===0,message:ordered.length?`Se restauraron ${ordered.length} ajustes propios en el orden de sus respaldos.`:'No hay cambios guardados por Apex para este juego. No se modificó su configuración.'};
  }catch(error){return{success:false,results:[],message:error.message};}
}
module.exports = { apply, revert, revertProfile, ownership, statuses, getConfigProfiles, transformed, fileApplied, REGISTRY, FILE_SETTINGS, sameSnapshot, validSnapshot };
