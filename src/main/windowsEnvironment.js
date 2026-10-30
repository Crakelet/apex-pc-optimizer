'use strict';
const path=require('node:path');
function value(environment,name,fallback){
 const key=Object.keys(environment).find(item=>item.toLowerCase()===name.toLowerCase());
 return key&&typeof environment[key]==='string'&&environment[key]?environment[key]:fallback;
}
function windowsPowerShellExecutable(environment=process.env){
 return path.win32.join(value(environment,'SystemRoot','C:\\Windows'),'System32','WindowsPowerShell','v1.0','powershell.exe');
}
function windowsPowerShellEnvironment(extra={},base=process.env){
 const environment={...base,...extra};
 // Only our Windows PowerShell child receives this path. A parent PowerShell 7
 // session can otherwise inject incompatible built-in module assemblies.
 for(const key of Object.keys(environment))if(key.toLowerCase()==='psmodulepath')delete environment[key];
 environment.PSModulePath=[
  path.win32.join(value(base,'SystemRoot','C:\\Windows'),'System32','WindowsPowerShell','v1.0','Modules'),
  path.win32.join(value(base,'ProgramW6432',value(base,'ProgramFiles','C:\\Program Files')),'WindowsPowerShell','Modules')
 ].join(';');
 return environment;
}
module.exports={windowsPowerShellExecutable,windowsPowerShellEnvironment};
