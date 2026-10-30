'use strict';
// Pure in-memory test model. It has no filesystem, shell or Windows dependencies.
class Simulation{
 constructor(){this.tweaks=new Map();this.games=new Map();this.snappy=new Map();this.gpu=new Map();this.ascension=false;this.usb=false;this.auto={enabled:false,thresholdPercent:85,intervalSeconds:60,lastCleaned:null};this.operations=[];}
 mutate(channel,args,catalog=[]){
  this.operations.push({channel,at:new Date().toISOString()});
  if(['apply-tweak','revert-tweak'].includes(channel))this.tweaks.set(args[0],channel==='apply-tweak');
  if(channel==='apply-profile')for(const t of catalog.filter(t=>t.category===args[0]))this.tweaks.set(t.id,true);
  if(channel==='revert-all')for(const id of this.tweaks.keys())this.tweaks.set(id,false);
  if(['apply-game-tweak','revert-game-tweak'].includes(channel))this.games.set(args[0],channel==='apply-game-tweak');
  if(channel==='revert-game-profile'){
   const prefix={valorant:'val_',fortnite:'fn_',cs2:'cs2_',apex_legends:'apex_',call_of_duty:'cod_'}[args[0]];
   for(const id of this.games.keys())if(id.startsWith(prefix))this.games.set(id,false);
  }
  if(['apply-snappy-ui-tweak','revert-snappy-ui-tweak'].includes(channel))this.snappy.set(args[0],channel==='apply-snappy-ui-tweak');
  if(channel==='toggle-windows-ascension')this.ascension=args[0];
  if(channel==='set-usb-low-latency')this.usb=args[0];
  if(['assign-gpu-design-app','restore-gpu-design-app'].includes(channel))this.gpu.set(args[0].toLowerCase(),channel==='assign-gpu-design-app');
  if(channel==='set-auto-clean-config'){Object.assign(this.auto,args[0]);return{...this.auto,simulated:true};}
  return{success:true,simulated:true,message:'Prueba completada en simulación. No se modificó Windows ni se borraron archivos.',active:this.ascension,isLowLatencyEnabled:this.usb,freedMB:0,results:[],alreadyAdmin:channel==='restart-as-admin'};
 }
 overlay(channel,result){
  if(channel==='get-statuses')return{...result,...Object.fromEntries(this.tweaks)};
  if(channel==='get-games-list')return result.map(g=>({...g,tweaks:g.tweaks.map(t=>({...t,isApplied:this.games.has(t.id)?this.games.get(t.id):t.isApplied,hasBackup:this.games.has(t.id)?this.games.get(t.id):t.hasBackup}))}));
  if(channel==='get-snappy-ui-status'){const patch=t=>({...t,isApplied:this.snappy.has(t.id)?this.snappy.get(t.id):t.isApplied});if(Array.isArray(result))return result.map(patch);if(result?.tweaks)return{...result,tweaks:result.tweaks.map(patch)};}
  if(channel==='get-auto-clean-config')return{...this.auto,simulated:true};
  if(channel==='get-memory-stats')return{...result,autoClean:{...this.auto}};
  if(channel==='get-ascension-status')return this.ascension;
  if(channel==='get-realtime-telemetry')return{...result,ascensionActive:this.ascension};
  if(channel==='get-usb-latency-status')return{...result,isLowLatencyEnabled:this.usb,simulated:true};
  if(channel==='detect-design-apps'&&result?.apps)return{...result,apps:result.apps.map(app=>this.gpu.has(app.Path.toLowerCase())?{...app,GpuOptimized:this.gpu.get(app.Path.toLowerCase()),HasGpuBackup:this.gpu.get(app.Path.toLowerCase())}:app)};
  return result;
 }
}
module.exports={Simulation};
