'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {windowsPowerShellExecutable,windowsPowerShellEnvironment}=require('../src/main/windowsEnvironment');
test('Windows PowerShell children exclude parent PowerShell 7 modules without changing the parent environment',()=>{
 const base={SystemRoot:'C:\\Windows',ProgramFiles:'C:\\Program Files',PATH:'keep parent PATH',PSModulePath:'C:\\PowerShell7\\Modules;C:\\UserModules',APEX_INPUT:'previous'};
 const original={...base};
 const child=windowsPowerShellEnvironment({APEX_INPUT:'{"safe":"data"}'},base);
 assert.deepEqual(base,original);assert.equal(child.PATH,base.PATH);assert.equal(child.APEX_INPUT,'{"safe":"data"}');
 assert.equal(child.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules;C:\\Program Files\\WindowsPowerShell\\Modules');
 assert.equal(child.PSModulePath.includes('PowerShell7'),false);
});
test('child environment resolves Windows keys case-insensitively and removes duplicate module path keys',()=>{
 const base={SYSTEMROOT:'D:\\Windows',PROGRAMW6432:'D:\\Program Files',ProgramFiles:'D:\\Program Files (x86)',PSMODULEPATH:'bad',PSModulePath:'also bad'};
 const child=windowsPowerShellEnvironment({psmodulepath:'untrusted extra'},base);
 assert.equal(Object.keys(child).filter(key=>key.toLowerCase()==='psmodulepath').length,1);
 assert.equal(windowsPowerShellExecutable(base),'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 assert.equal(child.PSModulePath,'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules;D:\\Program Files\\WindowsPowerShell\\Modules');
});
