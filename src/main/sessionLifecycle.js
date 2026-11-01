'use strict';
async function prepareAdminRestart({memory,telemetry,system}){
 if(system.checkIsAdmin())return{success:true,alreadyAdmin:true,handoffStarted:false};
 try{
  await memory.shutdownSession();
  const restored=await telemetry.shutdownSession();
  if(!restored.success)return{success:false,handoffStarted:false,message:'No se pudo preparar el reinicio. '+restored.message+' Revisa los respaldos de sesión antes de reintentar.'};
  const result=await system.restartAsAdmin();
  if(!result.success)return{...result,handoffStarted:false,message:(result.message||result.error||'Windows canceló el reinicio.')+' La sesión anterior se restauró y la limpieza automática quedó desactivada.'};
  return{...result,handoffStarted:!result.alreadyAdmin};
 }catch(error){return{success:false,handoffStarted:false,message:'No se pudo preparar el reinicio: '+error.message};}
}
module.exports={prepareAdminRestart};
