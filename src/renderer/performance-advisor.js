'use strict';
(()=>{
 let loading=null;
 const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;};
 const gib=value=>typeof value==='number'&&Number.isFinite(value)?`${new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(value/1024**3)} GB`:'No disponible';
 const names={graphics:'Abrir Gráficos de Windows',display:'Abrir Pantalla avanzada',gameMode:'Abrir Modo Juego',startup:'Abrir Aplicaciones de inicio',power:'Abrir Energía de Windows'};
 function fact(list,label,value){const item=node('div');item.append(node('dt',label),node('dd',value));list.append(item);}
 async function openLink(button,method,id){
  button.disabled=true;
  try{const result=await window.api[method](id);if(result.simulated)showToast(result.message,'info');}
  catch(error){showToast(error.message,'error');}
  finally{button.disabled=false;}
 }
 function render(panel,report){
  const facts=panel.querySelector('.performance-facts');facts.replaceChildren();facts.hidden=false;
  const data=report.facts;
  fact(facts,'Memoria disponible / instalada',`${gib(data.memory.availableBytes)} / ${gib(data.memory.totalBytes)}`);
  fact(facts,'Pantallas · frecuencia actual',data.displays.map(item=>`${item.label}: ${item.refreshRateHz==null?'Hz no disponibles':item.refreshRateHz+' Hz'}`).join(' · ')||'No disponible');
  fact(facts,'GPU · controlador',data.gpus.map(item=>`${item.name} · ${item.driverVersion||'Versión no disponible'}`).join(' · ')||'No disponible');
  fact(facts,'Espacio libre en unidades locales',data.disks.map(item=>`${item.drive} ${gib(item.freeBytes)} libres`).join(' · ')||'No disponible');
  const list=panel.querySelector('.performance-recommendations');list.replaceChildren();
  for(const recommendation of report.recommendations.filter(item=>item.category===panel.dataset.performanceCategory)){
   const row=node('li');row.append(node('h3',recommendation.title),node('p',recommendation.summary));
   row.append(node('p',(recommendation.observation==='measured'?'Dato observado: ':'Revisión manual: ')+recommendation.evidence,'performance-evidence'));
   const details=node('details'),steps=node('ol');details.append(node('summary','Ver pasos y cómo comparar'));
   for(const step of recommendation.steps)steps.append(node('li',step));details.append(steps);row.append(details);
   const actions=node('div',null,'performance-actions');
   if(recommendation.settingsId){const button=node('button',names[recommendation.settingsId]||'Abrir Configuración','btn-action-secondary');button.type='button';button.addEventListener('click',()=>openLink(button,'openPerformanceSettings',recommendation.settingsId));actions.append(button);}
   for(const sourceId of recommendation.sourceIds||[recommendation.sourceId]){
    const label={photoshopScratch:'Guía: discos de trabajo',premiereDecoding:'Guía: decodificación'}[sourceId]||'Leer guía oficial';
    const source=node('button',label,'btn-action-secondary');source.type='button';source.setAttribute('aria-label',`${label}: ${recommendation.title}`);source.addEventListener('click',()=>openLink(source,'openPerformanceSource',sourceId));actions.append(source);
   }
   row.append(actions);list.append(row);
  }
  const status=panel.querySelector('.performance-status');status.dataset.error=String(report.partial);
  const observedAt=report.observedAt?new Date(report.observedAt):null;
  const time=observedAt&&!Number.isNaN(observedAt.getTime())?`Revisión local a las ${new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(observedAt)}. `:'Hora de lectura no disponible. ';
  status.textContent=time+(report.partial?report.warnings.join(' '):'Las recomendaciones requieren comparar el mismo juego o proyecto; no representan un aumento de FPS medido.');
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const panels=[...document.querySelectorAll('[data-performance-category]')];
  for(const panel of panels)panel.querySelector('.performance-analyze').addEventListener('click',async()=>{
   if(loading)return;
   for(const current of panels){current.querySelector('.performance-analyze').disabled=true;const status=current.querySelector('.performance-status');status.textContent='Consultando datos locales del equipo…';status.dataset.error='false';current.setAttribute('aria-busy','true');}
   loading=window.api.getPerformanceReport();
   try{const report=await loading;for(const current of panels)render(current,report);}
   catch(error){for(const current of panels){current.querySelector('.performance-status').textContent=`No se pudo completar la revisión: ${error.message} Puedes volver a intentarlo.`;current.querySelector('.performance-status').dataset.error='true';}}
   finally{loading=null;for(const current of panels){current.querySelector('.performance-analyze').disabled=false;current.querySelector('.performance-analyze').textContent=current.querySelector('.performance-recommendations').childElementCount?'Actualizar revisión':'Reintentar revisión';current.removeAttribute('aria-busy');}}
  });
 });
})();
