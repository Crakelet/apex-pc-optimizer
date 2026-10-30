'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {Simulation}=require('../src/main/simulation');
const {validateLegacyRequest,READ_ONLY}=require('../src/main/legacyPolicy');
const {createRouter}=require('../src/main/runtimeRouter');
test('test model simulates tools without a Windows executor',()=>{
 const model=new Simulation();
 for(const channel of ['clean-all-memory','clean-browser-caches','purge-ghost-devices','apply-hosts-shield','create-restore-point'])assert.equal(model.mutate(channel,[]).simulated,true);
 model.mutate('apply-tweak',['game_dvr']);assert.equal(model.overlay('get-statuses',{}).game_dvr,true);
 model.mutate('revert-all',[]);assert.equal(model.overlay('get-statuses',{}).game_dvr,false);
 assert.equal(READ_ONLY.has('clean-all-memory'),false);assert.equal(READ_ONLY.has('get-memory-stats'),true);
});
test('restored tools reject malformed inputs before reaching a handler',()=>{
 for(const pair of [['run-ping-benchmark',['x;Get-Process']],['create-restore-point',['$(Get-Process)']],['optimize-single-process',[null]],['set-dns-provider',['unknown']],['assign-gpu-design-app',['C:\\fake.exe\nmalicious']],['set-auto-clean-config',[{enabled:true,thresholdPercent:0}]],['open-external-url',['https://evil.com']]])assert.throws(()=>validateLegacyRequest(...pair));
 assert.doesNotThrow(()=>validateLegacyRequest('apply-tweak',['game_dvr']));assert.doesNotThrow(()=>validateLegacyRequest('run-ping-benchmark',['1.1.1.1']));
});
test('the actual runtime router never calls mutation handlers in test mode',async()=>{
 const router=createRouter({simulated:true});let executed=0;
 for(const channel of ['clean-all-memory','clean-browser-caches','purge-ghost-devices','apply-hosts-shield','create-restore-point','restart-as-admin']){
  const result=await router.invoke(channel,[],()=>{executed++;throw new Error('A Windows handler must never run here');});
  assert.equal(result.simulated,true);
 }
 assert.equal(executed,0);
});

test('every exposed mutation is intercepted before any Windows handler runs',async()=>{
 const fs=require('node:fs');
 const preload=fs.readFileSync(require('node:path').join(__dirname,'../src/preload/preload.js'),'utf8');
 const channels=[...new Set([...preload.matchAll(/invoke\('([^']+)'/g)].map(match=>match[1]))];
 const sample={
  'apply-tweak':['game_dvr'],'revert-tweak':['game_dvr'],'apply-profile':['gaming'],
  'apply-game-tweak':['valorant_test'],'revert-game-tweak':['valorant_test'],'revert-game-profile':['valorant'],
  'execute-audit-action':['disable_hags'],'execute-custom-debloat':[['Microsoft.BingNews']],
  'toggle-windows-ascension':[true],'assign-gpu-design-app':['C:\\Apps\\Editor.exe'],
  'restore-gpu-design-app':['C:\\Apps\\Editor.exe'],'set-dns-provider':['original'],
  'optimize-single-process':[1234],'set-auto-clean-config':[{enabled:true}],
  'toggle-startup-program':[{name:'Editor',location:'HKCU',enable:false}],
  'set-usb-low-latency':[true],'apply-snappy-ui-tweak':['ui_menu_show_delay'],
  'revert-snappy-ui-tweak':['ui_menu_show_delay'],
  'open-performance-source':['windowedGames'],'open-performance-settings':['display']
 };
 const router=createRouter({simulated:true});let executed=0,tested=0;
 for(const channel of channels.filter(channel=>!READ_ONLY.has(channel)&&!['window-control','open-external-url'].includes(channel))){
  const result=await router.invoke(channel,sample[channel]||[],()=>{executed++;throw new Error('Real mutation executed');});
  assert.equal(result.simulated,true,channel);tested++;
 }
 assert.equal(executed,0);assert.ok(tested>=45,'All free tool mutation routes are covered');
});
