'use strict';

// Keep the process command line readable. Owned application scripts use stdin to
// stay below Windows' command-line limit; caller input stays separate JSON data.
// PowerShell still parses/scans the script normally, including through AMSI.
const STDIN_BOOTSTRAP = "[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false); $apexScript = [Console]::In.ReadToEnd(); & ([scriptblock]::Create($apexScript))";
function powerShellArguments() {
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', STDIN_BOOTSTRAP];
}
module.exports = { powerShellArguments };
