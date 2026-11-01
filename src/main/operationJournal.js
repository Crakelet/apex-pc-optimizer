'use strict';
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {atomicWrite}=require('./restorationStore');
const STATUSES=new Set(['running','success','failed','interrupted']);
class OperationJournal {
 constructor({file,notify=()=>{},clock=()=>new Date().toISOString()}){
  this.file=file;this.notify=notify;this.clock=clock;this.current=null;this.history=[];this.warning=null;
  try{
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   if(data.schema!==1||!Array.isArray(data.history)||data.history.length>100||data.history.some(item=>!item||typeof item.id!=='string'||typeof item.label!=='string'||typeof item.channel!=='string'||!STATUSES.has(item.status)))throw new Error('Formato de historial no compatible.');
   this.history=data.history.map(item=>({...item,status:item.status==='running'?'interrupted':item.status,message:item.status==='running'?'Apex se cerró antes de confirmar el resultado. Revisa el estado y los respaldos antes de repetir la acción.':item.message}));
  }catch(error){if(error.code!=='ENOENT')this.warning='No se pudo leer el historial de actividad. Los respaldos se conservan por separado.';}
 }
 snapshot(){return{current:this.current?{...this.current}:null,history:this.history.map(item=>({...item})),warning:this.warning};}
 save(){
  // A damaged activity file is preserved; it is never used as an authorization or backup.
  if(!this.warning)try{atomicWrite(this.file,{schema:1,history:this.history});}catch{this.warning='No se pudo guardar el historial de actividad. Revisa el resultado de la operación y conserva sus respaldos.';}
  try{this.notify(this.snapshot());}catch{}
 }
 record(event,label){
  if(event.phase==='started'){
   this.current={id:randomUUID(),channel:event.channel,label:String(label||'Operación de Apex').slice(0,180),status:'running',startedAt:this.clock(),finishedAt:null,message:'Espera a que termine y se compruebe el resultado. Puedes minimizar Apex.'};
   this.history.unshift(this.current);this.history=this.history.slice(0,30);this.save();return;
  }
  if(!this.current||this.current.channel!==event.channel)return;
  const result=event.result;
  const failed=event.phase==='failed'||result?.success===false;
  this.current.status=failed?'failed':'success';
  this.current.finishedAt=this.clock();
  this.current.message=String(event.error||result?.message||(failed?'La operación no pudo completarse. Revisa los respaldos antes de repetirla.':'Operación completada.')).slice(0,900);
  this.current=null;this.save();
 }
}
module.exports={OperationJournal};
