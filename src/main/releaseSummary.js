'use strict';
const {TWEAKS_DATA}=require('./tweaksData');
const {SNAPPY_UI_TWEAKS}=require('./snappyUiService');
const {GAMES_DATA}=require('./gameOptimizer');
const gameBackups=require('./gameBackupStore');
const names=new Map([...TWEAKS_DATA,...SNAPPY_UI_TWEAKS,...GAMES_DATA.flatMap(game=>game.tweaks)].map(item=>[item.id,item.title]));
const auditNames={audit_cpu_priority:'Prioridad de aplicaciones en primer plano',audit_telemetry:'Diagnósticos de Windows',audit_copilot_widgets:'Copilot y widgets',audit_ui_delay:'Espera de menús y cierre de servicios'};
const apexNames={power:'Plan de energía Apex',msi:'Preferencia MSI de GPU',network:'Preferencias avanzadas TCP'};
const labels={
 'apply-profile':'Aplicar perfil de ajustes','revert-all':'Restaurar ajustes guardados','create-restore-point':'Crear punto de restauración',
 'set-dns-provider':'Cambiar o restaurar DNS','flush-dns':'Vaciar caché DNS','reset-winsock':'Reparar Winsock','restart-adapters':'Reiniciar adaptadores de red',
 'execute-audit-action':'Aplicar ajuste de auditoría','optimize-all-audit':'Aplicar ajustes de auditoría','execute-custom-debloat':'Desinstalar aplicaciones seleccionadas',
 'toggle-windows-ascension':'Cambiar prioridades de sesión','apply-apex-power-plan':'Activar plan de energía Apex','apply-msi-mode-gpu':'Aplicar preferencia MSI','apply-advanced-network-stack':'Aplicar preferencias TCP','revert-apex-tools':'Restaurar herramientas Apex',
 'purge-standby-ram':'Liberar memoria en espera','clean-creative-media-cache':'Limpiar caché creativa','optimize-graphics-tablet':'Configurar tableta gráfica',
 'assign-gpu-creative-apps':'Asignar preferencias GPU','assign-gpu-design-app':'Asignar preferencia GPU','restore-gpu-design-app':'Restaurar preferencia GPU','apply-all-design-studio':'Aplicar perfil creativo',
 'purge-standby-list':'Liberar memoria en espera','trim-working-sets':'Recortar conjuntos de trabajo','flush-modified-page-list':'Vaciar páginas modificadas','clean-all-memory':'Limpiar memoria','optimize-single-process':'Optimizar memoria de un proceso','set-auto-clean-config':'Configurar limpieza automática',
 'toggle-startup-program':'Cambiar programa de inicio','apply-hosts-shield':'Aplicar filtro HOSTS','revert-hosts-shield':'Restaurar archivo HOSTS','purge-ghost-devices':'Quitar dispositivos desconectados',
 'clean-discord-cache':'Limpiar caché de Discord','clean-browser-caches':'Limpiar cachés de navegadores','clean-crash-dumps':'Limpiar informes de errores','clean-delivery-optimization-cache':'Limpiar Delivery Optimization','clean-npm-cache':'Limpiar caché npm','clean-vscode-cache':'Limpiar caché VS Code','clean-pip-cache':'Limpiar caché pip','clean-gradle-cache':'Limpiar caché Gradle','clean-media-cache':'Limpiar caché multimedia','clean-launchers-cache':'Limpiar cachés de launchers','clean-all-app-caches':'Limpiar cachés de aplicaciones',
 'set-usb-low-latency':'Cambiar suspensión selectiva USB','apply-all-snappy-ui':'Aplicar preferencias Snappy','restart-as-admin':'Reiniciar con permisos de administrador'
};
function operationLabel(channel,args=[]){
 if(['apply-tweak','apply-game-tweak','apply-snappy-ui-tweak','revert-tweak','revert-game-tweak','revert-snappy-ui-tweak'].includes(channel))return(channel.startsWith('revert')?'Restaurar: ':'Aplicar: ')+(names.get(args[0])||'ajuste de Apex');
 if(channel==='revert-game-profile')return'Restaurar ajustes de '+(GAMES_DATA.find(game=>game.id===args[0])?.name||'juego');
 return labels[channel]||'Operación de Apex';
}
function recoverySummary(engine){
 const entries=[], warnings=[];
 if(engine.stateWarning)warnings.push(engine.stateWarning);
 try{
  for(const record of engine.restoration.read().entries){
   if(!['prepared','applied','failed'].includes(record.status))continue;
   const [kind,id]=String(record.id).split(':');
   const title=kind==='audit'?auditNames[id]:kind==='apex'?apexNames[id]:names.get(id);
   if(!title)continue;
   entries.push({id:record.id,title,group:kind==='apex'?'Panel Apex':'Ajustes generales y Snappy',status:record.status,updatedAt:record.at});
  }
 }catch{warnings.push('No se pudo leer el respaldo de ajustes. Conserva el archivo: las operaciones de restauración se detendrán si no pueden validarlo.');}
 try{
  const owned=gameBackups.ownership(GAMES_DATA.flatMap(game=>game.tweaks.map(tweak=>tweak.id)));
  for(const [id,item]of Object.entries(owned))entries.push({id:'game:'+id,title:names.get(id),group:'Panel del juego',status:item.backupStatus,updatedAt:item.backupAt});
 }catch{warnings.push('No se pudo leer el respaldo de juegos. Conserva ese historial antes de volver a aplicar ajustes.');}
 return{success:true,entries:entries.reverse(),warning:warnings.join(' ')||null};
}
module.exports={operationLabel,recoverySummary};
