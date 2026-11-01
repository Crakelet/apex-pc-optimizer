'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { version } = require('../package.json');
const names = ['Portable', 'Setup'].map(kind => `Apex-PC-Optimizer-v${version}-${kind}-x64.exe`);
const lines = names.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join('dist', name))).digest('hex')}  ${name}`);
fs.writeFileSync('dist/SHA256SUMS.txt', `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
