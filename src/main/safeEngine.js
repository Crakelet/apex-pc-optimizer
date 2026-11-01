'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { SETTINGS, getSetting } = require('./safeCatalog');
const { validSnapshot, sameValue } = require('./registryAdapter');
const ACTIVE = ['prepared', 'applied', 'failed'];
function validateJournal(data) {
  if (!data || data.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > 10000) throw new Error('El historial no es válido. Conserva el archivo y contacta con soporte antes de aplicar cambios.');
  const ids = new Set(), active = new Set();
  for (const entry of data.entries) {
    const setting = getSetting(entry.settingId);
    if (typeof entry.id !== 'string' || !/^[a-f0-9-]{36}$/.test(entry.id) || ids.has(entry.id) || !['prepared', 'applied', 'failed', 'reverted'].includes(entry.status) || !validSnapshot(entry.before) || !validSnapshot(entry.after) || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) throw new Error('Hay un respaldo no válido en el historial. No se aplicarán cambios.');
    if (ACTIVE.includes(entry.status) && active.has(entry.settingId)) throw new Error('El historial contiene operaciones en conflicto.');
    ids.add(entry.id);
    if (ACTIVE.includes(entry.status)) active.add(entry.settingId);
    if (!sameValue(entry.after, { exists: true, kind: setting.kind, value: setting.value })) throw new Error('El destino de un respaldo no coincide con el catálogo.');
  }
  return data;
}
class JournalStore {
  constructor(file) { this.file = file; }
  read() {
    try { return validateJournal(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return { schema: 1, entries: [] }; throw error; }
  }
  write(data) {
    validateJournal(data);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx', process.platform === 'win32' ? 0o666 : 0o600); fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8'); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.file);
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
}
class OptimizerEngine {
  constructor({ adapter, store, simulated = false }) { this.adapter = adapter; this.store = store; this.simulated = simulated; this.busy = false; }
  history() { return this.store.read().entries.map(entry => ({ ...entry, title: getSetting(entry.settingId).title })).reverse(); }
  async catalog() {
    const journal = this.store.read();
    return Promise.all(SETTINGS.map(async setting => {
      const active = journal.entries.find(entry => entry.settingId === setting.id && ACTIVE.includes(entry.status));
      let current = null, error = null;
      try { current = await this.adapter.read(setting); } catch (err) { error = err.message; }
      return { ...setting, current, error, managed: Boolean(active), entryId: active?.id || null, status: active?.status || null, alreadySet: current ? sameValue(current, { exists: true, kind: setting.kind, value: setting.value }) : false };
    }));
  }
  async exclusive(action) {
    if (this.busy) throw new Error('Ya hay una operación en curso. Espera a que termine.');
    this.busy = true;
    try { return await action(); } finally { this.busy = false; }
  }
  async apply(id, expected) {
    return this.exclusive(async () => {
      const setting = getSetting(id), journal = this.store.read();
      if (!validSnapshot(expected)) throw new Error('Revisa el valor actual del ajuste antes de confirmar.');
      if (journal.entries.some(entry => entry.settingId === id && ACTIVE.includes(entry.status))) throw new Error('Este ajuste ya tiene un respaldo activo. Deshazlo antes de volver a aplicarlo.');
      if (journal.entries.length >= 10000) throw new Error('El historial alcanzó su límite. Conserva los respaldos y contacta con soporte.');
      const before = await this.adapter.read(setting), after = { keyExists: true, exists: true, kind: setting.kind, value: setting.value };
      if (!sameValue(before, expected) || before.keyExists !== expected.keyExists) throw new Error('El valor cambió desde que abriste la revisión. Actualiza los ajustes y vuelve a revisarlo; no se modificó Windows.');
      if (sameValue(before, after)) return { status: 'skipped', message: 'La preferencia ya tiene ese valor. No se modificó ni se atribuyó a Apex.' };
      const entry = { id: randomUUID(), settingId: id, at: new Date().toISOString(), status: 'prepared', before, after, simulated: this.simulated };
      journal.entries.push(entry); this.store.write(journal);
      try {
        if (!sameValue(await this.adapter.read(setting), before)) throw new Error('El valor cambió durante la revisión. No se sobrescribió.');
        await this.adapter.write(setting, after);
        if (!sameValue(await this.adapter.read(setting), after)) throw new Error('Windows no confirmó el valor solicitado. Revisa el historial antes de continuar.');
        entry.status = 'applied'; this.store.write(journal);
        return { status: 'applied', message: this.simulated ? 'Cambio simulado y verificado. Windows no se modificó.' : 'Valor guardado y cambio verificado en Windows.' };
      } catch (error) {
        entry.status = 'failed'; entry.error = error.message;
        try { this.store.write(journal); } catch { /* The durable prepared record still contains the backup. */ }
        throw error;
      }
    });
  }
  async revert(entryId) {
    return this.exclusive(async () => {
      const journal = this.store.read(), entry = journal.entries.find(item => item.id === entryId && ACTIVE.includes(item.status));
      if (!entry) throw new Error('No hay un cambio activo con este identificador.');
      const setting = getSetting(entry.settingId), current = await this.adapter.read(setting);
      if (!sameValue(current, entry.before)) {
        if (!sameValue(current, entry.after)) throw new Error('Otra aplicación o Windows cambió este valor. Apex no lo sobrescribirá. Conserva el respaldo y revisa el conflicto.');
        await this.adapter.write(setting, entry.before);
      }
      if (!sameValue(await this.adapter.read(setting), entry.before)) throw new Error('No se pudo verificar la restauración. El respaldo sigue disponible.');
      entry.status = 'reverted'; entry.revertedAt = new Date().toISOString(); delete entry.error; this.store.write(journal);
      return { status: 'reverted', message: this.simulated ? 'Restauración simulada y verificada.' : 'Se restauró el valor original y se verificó el resultado.' };
    });
  }
}
module.exports = { OptimizerEngine, JournalStore, validateJournal };
