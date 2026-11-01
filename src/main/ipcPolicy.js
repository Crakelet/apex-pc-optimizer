'use strict';
const { getSetting } = require('./safeCatalog');
const { validateHost } = require('./networkTools');
const { allowedExternal } = require('./updateService');
const { validSnapshot } = require('./registryAdapter');
function validateRequest(channel, args) {
  if (!Array.isArray(args)) throw new Error('Solicitud no válida.');
  if (['app:info', 'diagnostics:system', 'diagnostics:telemetry', 'diagnostics:startup', 'settings:list', 'history:list', 'updates:check'].includes(channel)) {
    if (args.length) throw new Error('Esta consulta no admite parámetros.'); return;
  }
  if (channel === 'settings:apply') {
    if (args.length !== 2 || typeof args[0] !== 'string' || !validSnapshot(args[1])) throw new Error('Revisión del ajuste no válida.');
    getSetting(args[0]); return;
  }
  if (args.length !== 1 || typeof args[0] !== 'string') throw new Error('Parámetros no válidos.');
  if (channel === 'history:revert' && /^[a-f0-9-]{36}$/.test(args[0])) return;
  if (channel === 'network:ping') return void validateHost(args[0]);
  if (channel === 'external:open' && allowedExternal(args[0])) return;
  if (channel === 'window:control' && ['minimize', 'maximize', 'close'].includes(args[0])) return;
  throw new Error('Acción no disponible o parámetro no válido.');
}
function trustedSender(event, window, expectedUrl) {
  return Boolean(window && event.sender === window.webContents && event.senderFrame && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === expectedUrl);
}
module.exports = { validateRequest, trustedSender };
