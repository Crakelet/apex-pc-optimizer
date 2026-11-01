'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ApexTools, POWER_SCRIPT, POWER_CHECK, NETWORK_SCRIPT, NETWORK_CHECK, DETECT_MSI_SCRIPT } = require('../src/main/apexProEngine');
const { applyAuditMutation, AUDIT_TWEAKS, AUDIT_EXTRAS } = require('../src/main/systemAudit');
const { OptimizerEngine } = require('../src/main/optimizerEngine');
const { RestorationManager, CAPTURE_SCRIPT, RESTORE_SCRIPT } = require('../src/main/restorationStore');
const { getResources } = require('../src/main/restorationResources');
const { SNAPPY_UI_TWEAKS } = require('../src/main/snappyUiService');
const { TWEAKS_DATA } = require('../src/main/tweaksData');
const gpuPath='HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_10DE&DEV_1234\\4&000&0&0019\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties';
function fixture(t) {
  const directory = path.join(__dirname,'../scratch/extended-backups',randomUUID());
  fs.mkdirSync(directory,{recursive:true});t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  let current=null, lastResources, writes=0, detected=[gpuPath];
  const runner=async(script,input)=>{
    if(script===DETECT_MSI_SCRIPT)return {success:true,output:JSON.stringify(detected)};
    if(script===CAPTURE_SCRIPT){
      lastResources=input.resources;
      if(!current)current={registry:lastResources.registry.map(item=>({...item,exists:false,kind:null,value:null})),services:[],bcd:[],adapters:[],rss:[],tcp:lastResources.tcp.map(name=>({name,value:name==='ecn'?'enabled':name==='rss'?'disabled':'restricted'})),power:lastResources.power?{guid:'11111111-1111-1111-1111-111111111111',usbAC:null,usbDC:null}:null};
      return {success:true,output:JSON.stringify(current)};
    }
    if(script===RESTORE_SCRIPT){current=structuredClone(input.snapshot);writes++;return {success:true,output:'OK'};}
    if([POWER_CHECK,NETWORK_CHECK].includes(script)||script.startsWith('$ok ='))return {success:true,output:'true'};
    assert.ok(fs.existsSync(path.join(directory,'history.json')),'persist original before any write');
    writes++;
    if(script===POWER_SCRIPT)current.power.guid='22222222-2222-2222-2222-222222222222';
    else if(script===NETWORK_SCRIPT)current.tcp=current.tcp.map(({name})=>({name,value:name==='rss'?'enabled':name==='ecn'?'disabled':'normal'}));
    else current.registry=current.registry.map(item=>({...item,exists:true,kind:'DWord',value:'1'}));
    return {success:true,output:'OK'};
  };
  const restoration=new RestorationManager({file:path.join(directory,'history.json'),runner});
  return {directory,restoration,runner,tools:new ApexTools({runner,restoration,directory}),getState:()=>structuredClone(current),setState:value=>{current=value;},getWrites:()=>writes,setDetected:value=>{detected=value;}};
}
test('Apex power, TCP and MSI persist and restore exact originals',async t=>{
  for(const kind of ['power','network','msi']){
    const f=fixture(t);
    const applied=await f.tools.apply(kind);assert.equal(applied.success,true,applied.message);
    const record=f.restoration.read().entries[0];assert.equal(record.id,'apex:'+kind);assert.notDeepEqual(record.before,record.after);
    assert.equal((await f.tools.revertAll()).success,true);assert.deepEqual(f.getState(),record.before);assert.equal(f.getWrites(),2);
  }
});
test('Apex duplicate apply preserves its original and external edits block restore',async t=>{
  const f=fixture(t);assert.equal((await f.tools.apply('power')).success,true);
  assert.equal((await f.tools.apply('power')).success,false);assert.equal(f.getWrites(),1);
  const changed=f.getState();changed.power.guid='33333333-3333-3333-3333-333333333333';f.setState(changed);
  const result=await f.tools.revertAll();assert.equal(result.success,false);assert.equal(result.results[0].conflict,true);assert.deepEqual(f.getState(),changed);assert.equal(f.getWrites(),1);
});
test('MSI restore rejects edited destinations and unrecognized detection before writing',async t=>{
  const f=fixture(t);assert.equal((await f.tools.apply('msi')).success,true);
  const history=f.restoration.read();history.entries[0].before.registry[0].path='HKCU:\\Unrelated';fs.writeFileSync(f.restoration.file,JSON.stringify(history));
  assert.equal((await f.tools.revertAll()).success,false);assert.equal(f.getWrites(),1);
  const other=fixture(t);other.setDetected([gpuPath+"'; Remove-Item x"]);assert.equal((await other.tools.apply('msi')).success,false);assert.equal(other.getWrites(),0);
});
test('audit existing tools and DNS delegate to backed implementations',async()=>{
  const calls=[];const engine={applyTweak:async id=>{calls.push(id);return {success:true};}};
  for(const action of Object.keys(AUDIT_TWEAKS))assert.equal((await applyAuditMutation(action,{engine})).success,true);
  assert.deepEqual(calls,Object.values(AUDIT_TWEAKS));
  let dns;
  await applyAuditMutation('set_cloudflare_dns',{engine,network:{setDnsProvider:async provider=>{dns=provider;return {success:true};}}});assert.equal(dns,'cloudflare');
  await assert.rejects(applyAuditMutation('unknown',{engine}),/no reconocida/);
  await assert.rejects(applyAuditMutation('enable_hags',{engine:{applyTweak:async()=>({success:false,message:'denegado'})}}),/denegado/);
});
test('audit distinct settings retain their own compiled snapshots and checks',async()=>{
  const calls=[];const engine={restoration:{apply:async(...args)=>{calls.push(args);return {success:true};}}};
  for(const action of Object.keys(AUDIT_EXTRAS))await applyAuditMutation(action,{engine});
  assert.equal(calls.length,4);
  for(const [id,resources,script,check] of calls){assert.ok(id.startsWith('audit:audit_'));assert.ok(resources.registry.length>0);assert.ok(script.length>10);assert.ok(check.includes("'true'"));}
  const cpu=calls.find(item=>item[0]==='audit:audit_cpu_priority');assert.ok(cpu[2].includes('-Value 38'));
});
test('global restore includes only known audit and Snappy descriptors in reverse order',async t=>{
  const f=fixture(t), calls=[];
  const restoration={read:()=>({entries:[{id:'tweak:game_mode_windows',status:'applied'},{id:'audit:audit_cpu_priority',status:'applied'},{id:'snappy:ui_menu_show_delay',status:'failed'},{id:'audit:arbitrary_path',status:'applied'},{id:'apex:network',status:'applied'}]}),revert:async(id,resources)=>{calls.push({id,resources});return {success:true};}};
  const engine=new OptimizerEngine({userDataPath:f.directory,restoration,runner:async()=>{throw Error('No executor should be used');}});
  assert.equal((await engine.revertAll()).success,true);assert.deepEqual(calls.map(item=>item.id),['snappy:ui_menu_show_delay','audit:audit_cpu_priority','tweak:game_mode_windows']);
});
test('extended PowerShell is parsed without executing any template', {skip:process.platform!=='win32'},()=>{
  const templates=[POWER_SCRIPT,POWER_CHECK,NETWORK_SCRIPT,NETWORK_CHECK,DETECT_MSI_SCRIPT,...Object.values(AUDIT_EXTRAS).flatMap(item=>[item.script,item.check]),TWEAKS_DATA.find(item=>item.id==='design_tablet_stylus_latency_fix').applyScript,TWEAKS_DATA.find(item=>item.id==='design_tablet_stylus_latency_fix').checkScript];
  const file=path.resolve(__dirname,'../scratch/extended-templates.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(templates));
  const {execFileSync}=require('node:child_process');
  const parser="$bad=@();foreach($script in (Get-Content -LiteralPath $env:APEX_EXTENDED_PARSE -Raw|ConvertFrom-Json)){$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors)|Out-Null;foreach($error in $errors){$bad += $error.Message}};if($bad.Count){$bad|Write-Output;exit 1};'Templates parse correctly'";
  const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',parser],{env:{...process.env,APEX_EXTENDED_PARSE:file},encoding:'utf8',windowsHide:true});assert.match(output,/parse correctly/);
});
