'use strict';
const https = require('node:https');
const { version } = require('../../package.json');
const REPOSITORY = 'Crakelet/apex-pc-optimizer';
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;
function versionParts(value) { const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value)); return match ? match.slice(1).map(Number) : null; }
function isNewerVersion(remote, local) {
  const a = versionParts(remote), b = versionParts(local);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
function allowedExternal(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname === 'github.com' && !url.search && !url.hash &&
      (url.pathname === `/${REPOSITORY}` || url.pathname === `/${REPOSITORY}/releases` || /^\/Crakelet\/apex-pc-optimizer\/releases\/tag\/v?\d+\.\d+\.\d+$/.test(url.pathname));
  } catch { return false; }
}
function parseRelease(release, current = version) {
  if (!release || release.draft || release.prerelease || !versionParts(release.tag_name) || release.html_url !== `https://github.com/${REPOSITORY}/releases/tag/${release.tag_name}` || !allowedExternal(release.html_url)) throw new Error('La publicación no cumple el formato de una versión estable oficial.');
  return { currentVersion: current, latestVersion: release.tag_name.replace(/^v/, ''), updateAvailable: isNewerVersion(release.tag_name, current), releaseUrl: release.html_url, message: isNewerVersion(release.tag_name, current) ? 'Hay una versión estable disponible. Revisa sus cambios y descarga el formato que usas.' : 'Usas la versión estable más reciente publicada.' };
}
function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: 'api.github.com', path: `/repos/${REPOSITORY}/releases/latest`, headers: { 'User-Agent': `ApexPCOptimizer/${version}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' }, timeout: 8000 }, res => {
      if (res.statusCode === 404) { res.resume(); return resolve({ currentVersion: version, updateAvailable: false, releaseUrl: RELEASES_URL, message: 'Todavía no hay una versión estable pública en GitHub Releases.' }); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(res.statusCode === 403 || res.statusCode === 429 ? 'GitHub limitó las consultas. Inténtalo más tarde.' : `GitHub no pudo comprobar las actualizaciones (${res.statusCode}).`)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024) req.destroy(new Error('La respuesta de GitHub supera el límite permitido.')); });
      res.on('error', reject);
      res.on('end', () => { try { resolve(parseRelease(JSON.parse(data))); } catch (error) { reject(error); } });
    });
    req.on('timeout', () => req.destroy(new Error('GitHub no respondió a tiempo. Puedes volver a intentarlo.')));
    req.on('error', error => reject(new Error(error.message.includes('GitHub') ? error.message : 'No se pudo conectar con GitHub. Revisa tu conexión.')));
  });
}
module.exports = { REPOSITORY, RELEASES_URL, isNewerVersion, allowedExternal, parseRelease, checkForUpdates };
