'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scanDesignExecutables,DESIGN_DISCOVERY_SCRIPT}=require('../src/main/designTools');
const file=name=>({name,isSymbolicLink:()=>false,isFile:()=>true,isDirectory:()=>false});
const folder=(name,link=false)=>({name,isSymbolicLink:()=>link,isFile:()=>false,isDirectory:()=>true});
function fakeIo(tree){const reads=[];return{reads,lstat:async()=>({isSymbolicLink:()=>false,isFile:()=>true}),readdir:async directory=>{reads.push(directory);return tree[directory]||[];}};}
test('creative discovery walks each selected directory once for all executable names',async()=>{
 const io=fakeIo({'C:\\Apps':[folder('Adobe'),folder('Blender')],'C:\\Apps\\Adobe':[file('Photoshop.exe'),file('Illustrator.exe')],'C:\\Apps\\Blender':[file('BLENDER.EXE')]});
 const result=await scanDesignExecutables(['C:\\Apps','C:\\Apps\\Adobe'],{}, {fs:io});
 assert.equal(result.paths['photoshop.exe'],'C:\\Apps\\Adobe\\Photoshop.exe');assert.ok(result.paths['blender.exe']);assert.equal(io.reads.filter(value=>value==='C:\\Apps\\Adobe').length,1);assert.equal(result.partial,false);
});
test('creative discovery reports incomplete search and never follows links or network roots',async()=>{
 const io=fakeIo({'C:\\Apps':[folder('Linked',true),folder('Child')],'C:\\Apps\\Child':[file('Figma.exe')]});
 const result=await scanDesignExecutables(['\\\\server\\apps','C:\\Apps'],{}, {fs:io,maxDirectories:1});
 assert.equal(result.partial,true);assert.deepEqual(io.reads,['C:\\Apps']);assert.equal(result.paths['figma.exe'],undefined);
});
test('a slow filesystem response stops discovery at its deadline without inventing apps',async()=>{
 const io={lstat:async()=>({isSymbolicLink:()=>false}),readdir:async()=>new Promise(()=>{})};
 const began=Date.now(),result=await scanDesignExecutables(['C:\\Apps'],{}, {fs:io,maxMilliseconds:25});
 assert.equal(result.partial,true);assert.deepEqual(result.paths,{});assert.ok(Date.now()-began<1000);
});
test('a junction ancestor cannot become trusted through another overlapping root',async()=>{
 const reads=[],io={lstat:async value=>({isSymbolicLink:()=>value==='C:\\Mapped'}),readdir:async value=>{reads.push(value);return[file('Figma.exe')];}};
 const result=await scanDesignExecutables(['C:\\Mapped\\Vendor','C:\\Mapped\\Vendor\\Child'],{}, {fs:io});
 assert.equal(result.partial,true);assert.deepEqual(reads,[]);assert.deepEqual(result.paths,{});
});
test('metadata reads target known app registrations and avoid broad recursive scans',()=>{
 assert.ok(DESIGN_DISCOVERY_SCRIPT.includes('DisplayName'));assert.ok(DESIGN_DISCOVERY_SCRIPT.includes('$visitedKeys -ge 2500'));assert.ok(DESIGN_DISCOVERY_SCRIPT.includes('DriveType]::Fixed'));assert.equal(/Get-ChildItem|\-Recurse/.test(DESIGN_DISCOVERY_SCRIPT),false);
});
test('creative metadata PowerShell parses without executing discovery', {skip:process.platform!=='win32'},()=>{
 const {execFileSync}=require('node:child_process'),directory=path.resolve(__dirname,'../scratch');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'design-discovery-parse.ps1');fs.writeFileSync(file,DESIGN_DISCOVERY_SCRIPT);
 const parser="$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile($env:APEX_DESIGN_PARSE,[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e.Message;exit 1};'Parsed'";
 const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(parser,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,APEX_DESIGN_PARSE:file}});assert.match(output,/Parsed/);
});
