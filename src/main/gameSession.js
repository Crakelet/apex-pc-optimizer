'use strict';
const {runPowerShell}=require('./powerShell');

// Fixed game processes only. Launchers, anti-cheat and unrelated processes are
// never terminated or inspected beyond the process-name query below.
const GAME_PROCESSES=Object.freeze({
 val_:Object.freeze({name:'VALORANT',processes:Object.freeze(['VALORANT','VALORANT-Win64-Shipping'])}),
 fn_:Object.freeze({name:'Fortnite',processes:Object.freeze(['FortniteClient-Win64-Shipping','FortniteClient-Win64-Shipping_BE','FortniteClient-Win64-Shipping_EAC','FortniteClient-Win64-Shipping_EAC_EOS'])}),
 apex_:Object.freeze({name:'Apex Legends',processes:Object.freeze(['r5apex','r5apex_dx12'])})
});
const SESSION_SCRIPT=`
$running = @(Get-Process -ErrorAction Stop | Where-Object { @($data.names) -contains $_.ProcessName } | Select-Object -ExpandProperty ProcessName -Unique)
@{ checked = $true; running = $running } | ConvertTo-Json -Depth 3 -Compress
`;
function failure(message,code){const error=new Error(message);error.code=code;return error;}
async function assertGameClosed(id,{runner=runPowerShell}={}){
 const prefix=typeof id==='string'?Object.keys(GAME_PROCESSES).find(item=>id.startsWith(item)):null;
 const game=prefix?GAME_PROCESSES[prefix]:null;
 if(!game)throw failure('No se pudo identificar el juego para comprobar su cierre. No se modificó la configuración.','GAME_STATUS_UNAVAILABLE');
 let result;
 try{result=await runner(SESSION_SCRIPT,{names:[...game.processes]},{timeout:10000});}
 catch{throw failure(`No se pudo comprobar si ${game.name} está cerrado. Vuelve a intentarlo antes de cambiar o restaurar sus archivos. No se modificó la configuración.`,'GAME_STATUS_UNAVAILABLE');}
 if(!result||result.checked!==true||!Array.isArray(result.running)||result.running.some(name=>typeof name!=='string'||!game.processes.some(allowed=>allowed.toLowerCase()===name.toLowerCase())))throw failure(`Windows no confirmó si ${game.name} está cerrado. Vuelve a intentarlo. No se modificó la configuración.`,'GAME_STATUS_UNAVAILABLE');
 if(result.running.length)throw failure(`Cierra ${game.name} antes de cambiar o restaurar sus archivos de configuración y vuelve a intentarlo. El juego puede sobrescribir los ajustes mientras está abierto. No se modificó la configuración.`,'GAME_RUNNING');
}
module.exports={assertGameClosed,GAME_PROCESSES,SESSION_SCRIPT};
