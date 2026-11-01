'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function loadTelemetry(t){
 const root=path.resolve(__dirname,'../scratch/session-lifecycle');fs.mkdirSync(root,{recursive:true});
 const directory=fs.mkdtempSync(path.join(root,'fixture-'));
 t.after(()=>{assert.ok(directory.startsWith(root+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
 const file=path.join(directory,'ascension-priority-backup-v1.json');
 const processes=new Map([[321,{id:321,started:'111111111',priority:'Normal'}]]);const calls=[];let writes=0;
 const runner=async(script,input)=>{
  calls.push({script,input});
  if(script.includes('$items = @()'))return{processes:[...processes.values()].map(item=>({...item}))};
  if(script.includes('$active = 0'))return{active:(input.processes||[]).some(item=>processes.get(item.id)?.started===item.started&&processes.get(item.id)?.priority==='Idle')};
  assert.ok(script.includes('$results = @()'));
  assert.match(script,/StartTime\.ToUniversalTime\(\)\.Ticks\.ToString\(\) -ne \$item.started/);
  assert.match(script,/PriorityClass\.ToString\(\) -ne \$item.priority/);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).processes[0].priority,'Normal','persist exact priority before a write');
  return{results:input.processes.map(item=>{
   const process=processes.get(item.id);
   if(!process||process.started!==item.started)return{id:item.id,success:true,skipped:true};
   if(input.enable?process.priority!==item.priority:process.priority!=='Idle'&&process.priority!==item.priority)return{id:item.id,success:false,error:'external priority conflict'};
   process.priority=input.enable?'Idle':item.priority;writes++;
   return{id:item.id,success:true,skipped:false};
  })};
 };
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/main/telemetryService.js'),'utf8'),{module,exports:module.exports,console,Buffer,process,require(name){
  if(name==='electron')return{app:{getPath:()=>directory}};
  if(name==='./powerShell')return{runPowerShell:runner};
  if(name==='./diagnostics')return{telemetry:async()=>{throw Error('not used');}};
  return require(name);
 }});
 return{api:module.exports,processes,calls,file,getWrites:()=>writes};
}

test('shutdown restores only own active session priorities and clears the completed backup',async t=>{
 const f=loadTelemetry(t);
 const active=await f.api.toggleWindowsAscension(true);assert.equal(active.success,true);assert.equal(f.processes.get(321).priority,'Idle');
 assert.match(f.calls[0].script,/SessionId -eq \$sessionId/);
 const shutdown=await f.api.shutdownSession();assert.equal(shutdown.success,true);assert.equal(f.processes.get(321).priority,'Normal');
 const saved=JSON.parse(fs.readFileSync(f.file,'utf8'));assert.equal(saved.active,false);assert.deepEqual(saved.processes,[]);
 const calls=f.calls.length;assert.equal((await f.api.shutdownSession()).skipped,true);assert.equal(f.calls.length,calls);
});
test('shutdown never changes a reused process ID or an externally changed priority',async t=>{
 const reused=loadTelemetry(t);await reused.api.toggleWindowsAscension(true);
 reused.processes.set(321,{id:321,started:'222222222',priority:'High'});
 assert.equal((await reused.api.shutdownSession()).success,true);assert.equal(reused.processes.get(321).priority,'High');assert.equal(reused.getWrites(),1);
 const changed=loadTelemetry(t);await changed.api.toggleWindowsAscension(true);changed.processes.get(321).priority='AboveNormal';
 const result=await changed.api.shutdownSession();assert.equal(result.success,false);assert.equal(changed.processes.get(321).priority,'AboveNormal');
 assert.equal(JSON.parse(fs.readFileSync(changed.file,'utf8')).active,true);assert.equal(changed.getWrites(),1);
});
test('inactive or damaged session backups never invoke a shutdown executor',async t=>{
 const f=loadTelemetry(t);assert.equal((await f.api.shutdownSession()).skipped,true);assert.equal(f.calls.length,0);
 fs.writeFileSync(f.file,'{damaged');assert.equal((await f.api.shutdownSession()).success,false);assert.equal(f.calls.length,0);assert.equal(fs.readFileSync(f.file,'utf8'),'{damaged');
});

function loadMemory(runner=async()=>({nativeStatus:0,processesTrimmed:1,processesSkipped:0})){
 const callbacks=[],cleared=[],calls=[];const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/main/memoryCleanerService.js'),'utf8'),{module,exports:module.exports,console,Buffer,process,
  setInterval:callback=>{const timer={unref(){}};callbacks.push({callback,timer});return timer;},clearInterval:timer=>cleared.push(timer),
  require(name){if(name==='./powerShell')return{runPowerShell:async(...args)=>{calls.push(args);return runner(...args);}};if(name==='node:os')return{totalmem:()=>1000*1024**2,freemem:()=>100*1024**2};return require(name);}
 });
 return{api:module.exports,callbacks,cleared,calls};
}
test('shutdown cancels automatic RAM timers and stale queued callbacks cannot clean memory',async()=>{
 const f=loadMemory();f.api.setAutoCleanConfig({enabled:true,intervalSeconds:30});
 const old=f.callbacks[0].callback;f.api.setAutoCleanConfig({thresholdPercent:80});await old();assert.equal(f.calls.length,0);
 const current=f.callbacks[1].callback;assert.equal((await f.api.shutdownSession()).success,true);await current();
 assert.equal(f.api.getAutoCleanConfig().enabled,false);assert.equal(f.cleared.length,2);assert.equal(f.calls.length,0);
});
test('shutdown waits for the current RAM operation without starting an additional operation',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const f=loadMemory(async()=>{await pending;return{nativeStatus:0};});
 const action=f.api.purgeStandbyList();let finished=false;
 const shutdown=f.api.shutdownSession().then(result=>{finished=true;return result;});
 await Promise.resolve();assert.equal(finished,false);assert.equal(f.calls.length,1);
 release();assert.equal((await action).success,true);assert.equal((await shutdown).success,true);assert.equal(f.calls.length,1);
});
