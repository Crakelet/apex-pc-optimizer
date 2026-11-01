'use strict';
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { runPowerShell } = require('./powerShell');
const PROVIDERS = Object.freeze({ cloudflare: ['1.1.1.1', '1.0.0.1'], google: ['8.8.8.8', '8.8.4.4'], quad9: ['9.9.9.9', '149.112.112.112'] });
function dataDirectory() { try { const { app } = require('electron'); if (app?.getPath) return app.getPath('userData'); } catch {} return path.join(os.homedir(), '.apex-pc-optimizer'); }
function validateHost(value) {
  if (typeof value !== 'string' || !value || value.length > 253 || value !== value.trim()) throw new Error('Introduce una IP o dominio sin URL, puerto ni espacios.');
  if (net.isIP(value)) return value;
  if (!value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('El destino no es una IP o un dominio válido.');
  return value;
}
function summarize(samples) {
  const valid = samples.filter(value => Number.isFinite(value) && value >= 0), differences = [];
  for (let i = 1; i < samples.length; i++) if (Number.isFinite(samples[i]) && Number.isFinite(samples[i - 1])) differences.push(Math.abs(samples[i] - samples[i - 1]));
  return { sent: samples.length, received: valid.length, loss: Math.round((samples.length - valid.length) / samples.length * 100), min: valid.length ? Math.min(...valid) : null, max: valid.length ? Math.max(...valid) : null, mean: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null, variation: differences.length ? Math.round(differences.reduce((a, b) => a + b, 0) / differences.length * 10) / 10 : null };
}
async function measure(host) {
  validateHost(host);
  const result = await runPowerShell([
    '$ping = New-Object System.Net.NetworkInformation.Ping',
    '$samples = @()',
    'try { for ($i = 0; $i -lt 5; $i++) {',
    'try { $reply = $ping.Send([string]$data.host, 1500); if ($reply.Status -eq "Success") { $samples += [long]$reply.RoundtripTime } else { $samples += $null } } catch { $samples += $null }',
    'if ($i -lt 4) { Start-Sleep -Milliseconds 150 }',
    '} } finally { $ping.Dispose() }',
    '@{ samples = $samples } | ConvertTo-Json -Compress'
  ].join('\n'), { host }, { timeout: 15000 });
  if (!Array.isArray(result?.samples) || result.samples.length !== 5 || result.samples.some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error('La prueba no devolvió muestras válidas.');
  return { samples: result.samples, ...summarize(result.samples) };
}
async function runPingBenchmark(targetHost = null) {
  const hosts = targetHost ? [{ name: targetHost, host: validateHost(targetHost) }] : [{ name: 'Cloudflare · ICMP', host: '1.1.1.1' }, { name: 'Google DNS · ICMP', host: '8.8.8.8' }, { name: 'Web de Riot Games · ICMP', host: 'playvalorant.com' }, { name: 'Tienda Steam · ICMP', host: 'store.steampowered.com' }];
  const results = [];
  for (const item of hosts) {
    try { const result = await measure(item.host); results.push({ ...item, ...result, latencyMs: result.mean, protocol: 'ICMP', status: result.received ? 'Medido' : 'Sin respuesta', note: 'No representa el ping de una partida. Un destino puede bloquear ICMP.' }); }
    catch (error) { results.push({ ...item, latencyMs: null, protocol: 'ICMP', status: 'No disponible', error: error.message }); }
  }
  return results;
}
let dnsBusy = false;
async function setDnsProvider(provider) {
  if (typeof provider !== 'string' || (!Object.hasOwn(PROVIDERS, provider) && !['dhcp', 'original'].includes(provider))) return { success: false, message: 'Proveedor DNS no válido.' };
  if (dnsBusy) return { success: false, message: 'Ya hay un cambio DNS en curso.' };
  dnsBusy = true;
  try {
    const file = path.join(dataDirectory(), 'dns-backup-v1.json');
    const current = await runPowerShell([
      '$items = @()',
      'foreach ($adapter in @(Get-NetAdapter -Physical | Where-Object Status -eq "Up")) {',
      '$dns = Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4',
      '$key = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\" + $adapter.InterfaceGuid.ToString("B")',
      '$static = (Get-ItemProperty -LiteralPath $key -Name NameServer -ErrorAction SilentlyContinue).NameServer',
      '$items += @{ index = [int]$adapter.ifIndex; guid = $adapter.InterfaceGuid.ToString(); servers = @($dns.ServerAddresses); automatic = [string]::IsNullOrWhiteSpace($static) }',
      '}',
      '@{ interfaces = $items } | ConvertTo-Json -Depth 5 -Compress'
    ].join('\n'));
    if (!current?.interfaces?.length) return { success: false, message: 'No se detectaron adaptadores físicos activos. No se modificaron los DNS.' };
    if (!fs.existsSync(file) && provider !== 'original') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = file + '.' + randomUUID() + '.tmp'; let fd;
      try {
        fd = fs.openSync(temporary, 'wx');
        fs.writeFileSync(fd, JSON.stringify({ schema: 1, at: new Date().toISOString(), interfaces: current.interfaces }, null, 2));
        fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
        fs.renameSync(temporary, file);
      } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
    let targets = current.interfaces.map(item => ({ ...item, automatic: provider === 'dhcp', servers: PROVIDERS[provider] || [] }));
    if (provider === 'original') {
      if (!fs.existsSync(file)) return { success: false, message: 'No hay una configuración DNS original guardada por Apex.' };
      const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (backup.schema !== 1 || !Array.isArray(backup.interfaces) || !backup.interfaces.length) throw new Error('El respaldo DNS no es válido.');
      targets = backup.interfaces;
    }
    for (const item of targets) if (!/^[a-f0-9-]{36}$/i.test(item.guid) || !Number.isInteger(item.index) || typeof item.automatic !== 'boolean' || !Array.isArray(item.servers) || item.servers.some(server => net.isIP(server) !== 4)) throw new Error('El respaldo DNS contiene una interfaz no válida.');
    const result = await runPowerShell([
      '$results = @()',
      'foreach ($item in $data.interfaces) {',
      '$adapter = Get-NetAdapter | Where-Object { $_.InterfaceGuid.ToString() -eq [string]$item.guid } | Select-Object -First 1',
      'if (-not $adapter) { throw "Una interfaz del respaldo ya no está disponible. No se sustituyó por otra." }',
      '$record = Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4',
      'if ($item.automatic) { Set-DnsClientServerAddress -InputObject $record -ResetServerAddresses }',
      'else { Set-DnsClientServerAddress -InputObject $record -ServerAddresses ([string[]]$item.servers) }',
      '$actual = @((Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4).ServerAddresses)',
      'if (-not $item.automatic -and (($actual -join ",") -ne ($item.servers -join ","))) { throw "Windows no confirmó los DNS solicitados." }',
      '$results += @{ guid = [string]$item.guid; servers = $actual }',
      '}',
      'Clear-DnsClientCache',
      '@{ success = $true; interfaces = $results } | ConvertTo-Json -Depth 5 -Compress'
    ].join('\n'), { interfaces: targets });
    return { success: result.success === true, message: provider === 'dhcp' ? 'DNS configurado en automático (DHCP). Esto no equivale a recuperar una configuración estática anterior.' : provider === 'original' ? 'Configuración DNS guardada restaurada en sus interfaces originales.' : 'DNS ' + provider.toUpperCase() + ' configurado y verificado. Se conservó un respaldo anterior.', interfaces: result.interfaces };
  } catch (error) { return { success: false, message: error.message }; } finally { dnsBusy = false; }
}
async function runAction(script, message) { try { await runPowerShell(script + '\n@{ success = $true } | ConvertTo-Json -Compress'); return { success: true, message }; } catch (error) { return { success: false, message: error.message }; } }
function flushDnsCache() { return runAction('Clear-DnsClientCache', 'Caché DNS limpiada.'); }
function resetWinsockCatalog() { return runAction('netsh winsock reset | Out-Null\nif ($LASTEXITCODE -ne 0) { throw "No se pudo restablecer Winsock." }\nnetsh int ip reset | Out-Null\nif ($LASTEXITCODE -ne 0) { throw "No se pudo restablecer TCP/IP." }', 'Winsock y TCP/IP restablecidos. Reinicia el equipo; puede requerirse reconfigurar ajustes manuales de red.'); }
function restartAdapters() { return runAction('$adapters = @(Get-NetAdapter -Physical | Where-Object Status -eq "Up")\nif (-not $adapters.Count) { throw "No hay adaptadores físicos activos." }\n$adapters | Restart-NetAdapter -Confirm:$false', 'Adaptadores físicos activos reiniciados.'); }
module.exports = { validateHost, summarize, runPingBenchmark, setDnsProvider, flushDnsCache, resetWinsockCatalog, restartAdapters };
