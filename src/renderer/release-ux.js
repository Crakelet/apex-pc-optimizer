'use strict';
(()=>{
 let activityWarning=null;
 const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;};
 const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Fecha no disponible':new Intl.DateTimeFormat(document.documentElement.lang||'es',{dateStyle:'short',timeStyle:'short'}).format(parsed);};
 const statuses={running:'En curso',success:'Completado',failed:'Revisar resultado',interrupted:'Sin resultado confirmado',prepared:'Preparado · revisar',applied:'Guardado',reverted:'Restaurado'};
 function renderActivity(state){
  activityWarning=state.warning;
  const current=state.current,last=state.history?.[0],banner=document.getElementById('operation-banner');
  if(current||last){
   banner.hidden=false;banner.dataset.status=(current||last).status;
   document.getElementById('operation-banner-label').textContent=(current?'En curso: ':'')+(current||last).label;
   document.getElementById('operation-banner-message').textContent=(current||last).message;
   document.getElementById('btn-dismiss-operation').hidden=!!current;
  }else{banner.hidden=true;}
  const list=document.getElementById('operation-history');list.replaceChildren();
  for(const record of state.history||[]){
   const item=node('li',null,'release-record');
   const content=node('div');content.append(node('strong',record.label),node('p',record.message),node('time',date(record.startedAt)));
   item.append(content,node('span',statuses[record.status]||'Revisar',`record-status status-${record.status}`));list.append(item);
  }
  if(!list.childElementCount)list.append(node('li','Todavía no hay acciones manuales registradas. Los diagnósticos no aplican cambios.','release-empty'));
 }
 async function loadRecovery(){
  const list=document.getElementById('recovery-summary'),warning=document.getElementById('recovery-warning');
  const button=document.getElementById('btn-refresh-recovery');button.disabled=true;
  try{
   const result=await window.api.getRecoverySummary();list.replaceChildren();
   for(const entry of result.entries){
    const item=node('li',null,'release-record'),content=node('div');
    content.append(node('strong',entry.title),node('p','Restauración: '+entry.group),node('time',date(entry.updatedAt)));
    item.append(content,node('span',statuses[entry.status]||'Revisar',`record-status status-${entry.status}`));list.append(item);
   }
   if(!result.entries.length)list.append(node('li','No hay cambios de ajustes o juegos guardados por Apex. La configuración que ya existía en Windows no se atribuye a la app.','release-empty'));
   warning.textContent=[result.warning,activityWarning].filter(Boolean).join(' ');warning.hidden=!warning.textContent;
   const restore=document.getElementById('btn-revert-all-main');
   if(restore)restore.disabled=!result.entries.some(entry=>entry.group==='Ajustes generales y Snappy');
  }catch(error){warning.textContent=error.message;warning.hidden=false;list.replaceChildren(node('li','No se pudo leer la lista. Conserva los respaldos y vuelve a intentarlo.','release-empty'));}
  finally{button.disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  document.getElementById('btn-dismiss-operation').addEventListener('click',()=>{document.getElementById('operation-banner').hidden=true;});
  document.getElementById('btn-refresh-recovery').addEventListener('click',loadRecovery);
  document.getElementById('btn-restore-session').addEventListener('click',async event=>{
   const button=event.currentTarget;
   const confirmed=await promptActionConfirmation({title:'Restaurar prioridades de sesión',subtitle:'Recupera las prioridades que Ascensión guardó antes de modificarlas.',badgeText:'Restauración de sesión',details:['Comprueba la identidad y hora de inicio de cada proceso.','Los procesos terminados se omiten. Si hay una prioridad cambiada fuera de Apex, conserva el respaldo y avisa.'],confirmText:'Restaurar prioridades'});
   if(!confirmed)return;
   button.disabled=true;
   try{const result=await window.api.toggleWindowsAscension(false);showToast(result.message,'success');}
   catch(error){showToast(error.message,'error');}
   finally{button.disabled=false;await loadRecovery();}
  });
  document.querySelector('[data-tab="backup"]').addEventListener('click',loadRecovery);
  if(typeof window.api?.onOperationState==='function')window.api.onOperationState(state=>{renderActivity(state);if(!state.current)void loadRecovery();});
  try{renderActivity(await window.api.getOperationState());}catch(error){activityWarning=error.message;}
  await loadRecovery();
 });
})();
