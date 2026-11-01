'use strict';
const { execFile } = require('node:child_process');
const {cleanClixml}=require('./systemInfo');
const {windowsPowerShellExecutable,windowsPowerShellEnvironment}=require('./windowsEnvironment');
const {powerShellArguments}=require('./powerShellTransport');

// Application-owned scripts; renderer input is data, never executable text.
function runPowerShell(script, input = {}, { timeout = 20000 } = {}) {
  if (process.platform !== 'win32') return Promise.reject(new Error('Esta herramienta requiere Windows.'));
  const source = `$ErrorActionPreference = 'Stop'\n$ProgressPreference = 'SilentlyContinue'\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$data = ConvertFrom-Json $env:APEX_INPUT\ntry {\n${script}\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
  return new Promise((resolve, reject) => {
    const child = execFile(windowsPowerShellExecutable(), powerShellArguments(), {
      windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', env: windowsPowerShellEnvironment({APEX_INPUT:JSON.stringify(input)})
    }, (error, stdout, stderr) => {
      const failure=cleanClixml(stderr),output=cleanClixml(stdout);
      if (error||failure) return reject(new Error(error?.killed ? 'La consulta superó el tiempo de espera. Vuelve a intentarlo.' : (failure.split(/\r?\n/)[0] || 'Windows no pudo completar la operación.')));
      try { resolve(output ? JSON.parse(output.replace(/^\uFEFF/, '').trim()) : null); }
      catch { reject(new Error('Windows devolvió una respuesta no válida. No se confirmó la operación.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(source, 'utf8');
  });
}
module.exports = { runPowerShell };
