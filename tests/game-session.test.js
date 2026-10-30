'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertGameClosed,GAME_PROCESSES,SESSION_SCRIPT}=require('../src/main/gameSession');

test('game session queries only process names from the compiled list and has a bounded timeout',async()=>{
 const calls=[];
 await assertGameClosed('val_disable_vsync',{runner:async(...args)=>{calls.push(args);return{checked:true,running:[]};}});
 assert.equal(calls.length,1);assert.equal(calls[0][0],SESSION_SCRIPT);assert.deepEqual(calls[0][1],{names:[...GAME_PROCESSES.val_.processes]});assert.equal(calls[0][2].timeout,10000);
 assert.doesNotMatch(SESSION_SCRIPT,/Stop-Process|Terminate|Kill|ExecutablePath|\.Path|Write|Set-|Remove-|Add-Type/i);
 assert.match(SESSION_SCRIPT,/Get-Process -ErrorAction Stop/);
});

test('a running game produces an actionable precondition error without exposing process details',async()=>{
 for(const [id,name]of [['val_show_fps','VALORANT-Win64-Shipping'],['fn_disable_vsync','FortniteClient-Win64-Shipping'],['apex_ragdolls_zero','r5apex']]){
  await assert.rejects(()=>assertGameClosed(id,{runner:async()=>({checked:true,running:[name]})}),error=>error.code==='GAME_RUNNING'&&/Cierra/.test(error.message)&&/No se modificó/.test(error.message));
 }
});

test('unknown games, malformed responses and query failures fail closed',async()=>{
 let calls=0;
 await assert.rejects(()=>assertGameClosed('cs2_unknown',{runner:async()=>{calls++;}}),error=>error.code==='GAME_STATUS_UNAVAILABLE');assert.equal(calls,0);
 for(const result of [null,{},[],{checked:false,running:[]},{checked:true,running:null},{checked:true,running:['unrelated']},{checked:true,running:[null]}])await assert.rejects(()=>assertGameClosed('val_fullscreen',{runner:async()=>result}),error=>error.code==='GAME_STATUS_UNAVAILABLE');
 await assert.rejects(()=>assertGameClosed('val_fullscreen',{runner:async()=>{throw new Error('C:\\private');}}),error=>error.code==='GAME_STATUS_UNAVAILABLE'&&!error.message.includes('private'));
});
