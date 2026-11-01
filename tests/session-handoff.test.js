'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareAdminRestart}=require('../src/main/sessionLifecycle');
function fixture({restored=true,launched=true,admin=false}={}){
 const calls=[];
 return{calls,memory:{shutdownSession:async()=>{calls.push('stop-memory');}},telemetry:{shutdownSession:async()=>{calls.push('restore-session');return{success:restored,message:'Conflicto externo'};}},system:{checkIsAdmin:()=>admin,restartAsAdmin:async()=>{calls.push('launch-replacement');return{success:launched,error:'UAC cancelado'};}}};
}
test('elevation prepares and restores the session before launching a replacement',async()=>{
 const f=fixture(),result=await prepareAdminRestart(f);
 assert.deepEqual(f.calls,['stop-memory','restore-session','launch-replacement']);assert.equal(result.handoffStarted,true);
});
test('failed session recovery keeps the original app lock and never launches a second app',async()=>{
 const f=fixture({restored:false}),result=await prepareAdminRestart(f);
 assert.equal(result.success,false);assert.equal(result.handoffStarted,false);assert.deepEqual(f.calls,['stop-memory','restore-session']);
});
test('cancelled elevation cannot bypass normal quit recovery and admin sessions are not restarted',async()=>{
 const cancelled=fixture({launched:false}),result=await prepareAdminRestart(cancelled);
 assert.equal(result.handoffStarted,false);assert.match(result.message,/UAC cancelado/);
 const admin=fixture({admin:true}),existing=await prepareAdminRestart(admin);
 assert.equal(existing.alreadyAdmin,true);assert.equal(existing.handoffStarted,false);assert.deepEqual(admin.calls,[]);
});
