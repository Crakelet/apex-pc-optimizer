'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {OperationJournal}=require('../src/main/operationJournal');
const {operationLabel}=require('../src/main/releaseSummary');
function fixture(t){const directory=path.resolve(__dirname,'../scratch/journal-tests',randomUUID());fs.mkdirSync(directory,{recursive:true});t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return path.join(directory,'activity.json');}
test('activity survives restart with the real outcome and without tool arguments',t=>{
 const file=fixture(t),seen=[],journal=new OperationJournal({file,notify:value=>seen.push(value)});
 journal.record({phase:'started',channel:'assign-gpu-design-app',args:['C:\\Private\\secret.exe']},'Preferencia GPU');
 assert.equal(seen[0].current.status,'running');
 journal.record({phase:'finished',channel:'assign-gpu-design-app',result:{success:false,message:'No se pudo verificar; conserva el respaldo.'}});
 const restarted=new OperationJournal({file});
 assert.equal(restarted.snapshot().current,null);assert.equal(restarted.snapshot().history[0].status,'failed');
 assert.match(restarted.snapshot().history[0].message,/conserva el respaldo/);
 assert.equal(fs.readFileSync(file,'utf8').includes('secret.exe'),false);
});
test('an unfinished operation is reported as unconfirmed after restart',t=>{
 const file=fixture(t),journal=new OperationJournal({file});
 journal.record({phase:'started',channel:'apply-tweak'},'Aplicar ajuste');
 const state=new OperationJournal({file}).snapshot();
 assert.equal(state.current,null);assert.equal(state.history[0].status,'interrupted');assert.match(state.history[0].message,/antes de repetir/);
});
test('corrupt activity is preserved and notification errors cannot change an operation result',t=>{
 const file=fixture(t);fs.writeFileSync(file,'damaged activity');
 const journal=new OperationJournal({file,notify:()=>{throw new Error('listener failed');}});
 assert.doesNotThrow(()=>{journal.record({phase:'started',channel:'apply-tweak'},'Ajuste');journal.record({phase:'finished',channel:'apply-tweak',result:{success:true,message:'Verificado'}});});
 assert.equal(journal.snapshot().history[0].status,'success');assert.ok(journal.snapshot().warning);assert.equal(fs.readFileSync(file,'utf8'),'damaged activity');
});
test('activity labels use bundled tweak names rather than untrusted input',()=>{
 assert.match(operationLabel('apply-tweak',['game_mode_windows']),/Modo Juego/);
 assert.equal(operationLabel('assign-gpu-design-app',['C:\\Private\\secret.exe']),'Asignar preferencia GPU');
 assert.equal(operationLabel('apply-tweak',['<img src=x>']).includes('<img'),false);
});
