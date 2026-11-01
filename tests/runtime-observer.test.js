'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRouter}=require('../src/main/runtimeRouter');
test('real mutation observers receive exactly one ordered completion with validated internal arguments',async()=>{
 const events=[];const router=createRouter({onOperation:async event=>events.push(event)});
 const result={success:true,message:'done'};
 assert.equal(await router.invoke('apply-tweak',['game_dvr'],async()=>result),result);
 assert.deepEqual(events,[{phase:'started',channel:'apply-tweak',args:['game_dvr']},{phase:'finished',channel:'apply-tweak',args:['game_dvr'],result}]);
 assert.equal(router.busy,false);
});
test('observer errors cannot change success or replace a tool error',async()=>{
 const events=[];const router=createRouter({onOperation:event=>{events.push(event.phase);throw Error('journal unavailable');}});
 assert.deepEqual(await router.invoke('revert-all',[],()=>({success:true})),{success:true});
 await assert.rejects(router.invoke('revert-all',[],()=>{throw Error('tool failed');}),/tool failed/);
 assert.deepEqual(events,['started','finished','started','failed']);assert.equal(router.busy,false);
});
test('simulation, read-only recovery endpoints, and invalid requests never journal a mutation',async()=>{
 const events=[];let calls=0;const router=createRouter({simulated:true,onOperation:event=>events.push(event)});
 assert.equal((await router.invoke('revert-all',[],()=>{calls++;})).simulated,true);
 for(const channel of ['get-operation-state','get-recovery-summary'])assert.equal(await router.invoke(channel,[],()=>{calls++;return 'read';}),'read');
 await assert.rejects(router.invoke('apply-tweak',['malformed id'],()=>{calls++;}));
 assert.equal(calls,2);assert.deepEqual(events,[]);
});
test('an in-flight operation still blocks a second mutation while its observer runs',async()=>{
 let release;const started=new Promise(resolve=>{release=resolve;});const events=[];
 const router=createRouter({onOperation:async event=>{events.push(event.phase);if(event.phase==='started')await started;}});
 const first=router.invoke('revert-all',[],()=>({success:true}));
 await assert.rejects(router.invoke('revert-all',[],()=>({success:true})),/Espera/);
 release();await first;assert.deepEqual(events,['started','finished']);assert.equal(router.busy,false);
});
