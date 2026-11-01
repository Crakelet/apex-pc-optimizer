'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateLegacyRequest,READ_ONLY}=require('../src/main/legacyPolicy');
const {createRouter}=require('../src/main/runtimeRouter');
const {SOURCES,SETTINGS_TARGETS}=require('../src/main/performanceAdvisor');

test('performance links only accept compiled source and settings identifiers',()=>{
 for(const [channel,targets]of [['open-performance-source',SOURCES],['open-performance-settings',SETTINGS_TARGETS]]){
  for(const id of Object.keys(targets))assert.doesNotThrow(()=>validateLegacyRequest(channel,[id]));
  for(const args of [[],['__proto__'],['toString'],['https://example.com'],['ms-settings:windowsdefender'],['display','unexpected'],[{}],[null]])assert.throws(()=>validateLegacyRequest(channel,args));
 }
 assert.equal(READ_ONLY.has('get-performance-report'),true);
 assert.doesNotThrow(()=>validateLegacyRequest('get-performance-report',[]));
 assert.throws(()=>validateLegacyRequest('get-performance-report',[{displays:[]}])) ;
});

test('simulated performance links never launch a browser or Windows settings',async()=>{
 const router=createRouter({simulated:true});let calls=0;
 for(const [channel,id]of [['open-performance-source','windowedGames'],['open-performance-settings','display']]){
  const result=await router.invoke(channel,[id],()=>{calls++;throw new Error('External launch forbidden in tests');});
  assert.equal(result.simulated,true);
 }
 assert.equal(calls,0);assert.equal(router.simulation.operations.length,0);
});

test('read-only performance queries coalesce and link failures do not enter tool history',async()=>{
 const events=[],router=createRouter({onOperation:event=>events.push(event)});let calls=0;
 const handler=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,15));return{success:true};};
 await Promise.all([router.invoke('get-performance-report',[],handler),router.invoke('get-performance-report',[],handler)]);
 assert.equal(calls,1);assert.equal(events.length,0);
 await assert.rejects(()=>router.invoke('open-performance-settings',['display'],()=>{throw new Error('Windows unavailable');}),/unavailable/);
 assert.equal(router.busy,false);assert.equal(events.length,0);
});
