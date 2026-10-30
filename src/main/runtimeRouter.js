'use strict';
const {READ_ONLY,validateLegacyRequest}=require('./legacyPolicy');
const {Simulation}=require('./simulation');
const PERFORMANCE_LINKS=new Set(['open-performance-source','open-performance-settings']);
function createRouter({simulated=false,catalog=[],simulation=new Simulation(),onOperation}={}){
 let busy=false;const pending=new Map();
 const emit=async event=>{try{if(typeof onOperation==='function')await onOperation(event);}catch{ /* Journal errors cannot change a tool's result. */ }};
 return{simulation,get busy(){return busy;},async invoke(channel,args,handler){
  validateLegacyRequest(channel,args);
  if(simulated&&channel==='get-admin-status')return{isAdmin:true,simulated:true};
  const mutation=!READ_ONLY.has(channel)&&!['window-control','open-external-url'].includes(channel)&&!PERFORMANCE_LINKS.has(channel);
  // This branch precedes all handler calls. Test mode never executes a Windows mutation.
  if(simulated&&mutation)return simulation.mutate(channel,args,catalog);
  if(simulated&&PERFORMANCE_LINKS.has(channel))return{success:true,simulated:true,message:'Enlace comprobado en simulación. No se abrió ninguna aplicación externa.'};
  if(mutation&&busy)throw new Error('Espera a que termine la operación actual.');
  if(mutation)busy=true;
  if(mutation)await emit({phase:'started',channel,args});
  try{
   let result;
   if(READ_ONLY.has(channel)){
    const key=channel+JSON.stringify(args);
    if(!pending.has(key))pending.set(key,Promise.resolve().then(()=>handler(...args)).finally(()=>pending.delete(key)));
    result=await pending.get(key);
   }else result=await handler(...args);
   if(mutation)await emit({phase:'finished',channel,args,result});
   return simulated?simulation.overlay(channel,result):result;
  }catch(error){
   if(mutation)await emit({phase:'failed',channel,args,error:String(error?.message||error)});
   throw error;
  }finally{if(mutation)busy=false;}
 }};
}
module.exports={createRouter};
