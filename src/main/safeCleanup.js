'use strict';

// Shared by the restored cleaners. Only regenerated files are candidates; never traverse junctions.
const CLEANUP_SCRIPT = String.raw`
function Get-ApexCacheFiles {
  param([string]$Root, [string]$Filter = '*')
  if (-not $Root -or -not (Test-Path -LiteralPath $Root)) { return }
  $protected = '(?i)(^|[\\/])(AutoRecover|BlenderAutosaves|Auto[- ]?Save|Recovery|UnsavedFiles|Projects|Backups)([\\/]|$)'
  $rootItem = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
  if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $rootItem.FullName -match $protected) { return }
  $stack = New-Object 'System.Collections.Generic.Stack[string]'
  $stack.Push($rootItem.FullName)
  $cutoff = (Get-Date).AddDays(-1)
  while ($stack.Count -gt 0) {
    $directory = $stack.Pop()
    foreach ($item in @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction SilentlyContinue)) {
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.FullName -match $protected) { continue }
      if ($item.PSIsContainer) { $stack.Push($item.FullName); continue }
      if ($item.Name -notlike $Filter -or $item.LastWriteTime -gt $cutoff) { continue }
      if ($item.Name -match '(?i)autosave|autorecover|unsaved|recovery' -or $item.Extension -match '(?i)^\.(psd|psb|ai|indd|blend|prproj|aep|aepx|drp|dra|c4d|clip|kra|mp4|mov|mkv|wav|flac|mp3|png|jpg|jpeg|tif|tiff|dng|exr|svg)$') { continue }
      $item
    }
  }
}
function Remove-ApexCache {
  param([string]$Root, [string]$Filter = '*')
  [long]$removedBytes = 0
  foreach ($file in @(Get-ApexCacheFiles -Root $Root -Filter $Filter)) {
    try {
      $size = $file.Length
      Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop
      if (-not (Test-Path -LiteralPath $file.FullName)) { $removedBytes += $size }
    } catch { Write-Verbose ('No se eliminó: ' + $file.FullName) }
  }
  $removedBytes
}
`;

module.exports = { CLEANUP_SCRIPT };
