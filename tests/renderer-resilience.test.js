'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function renderer(api={}) {
  const elements=new Map(),events={},toasts=[];
  function element(id, text='') {
    const attributes=new Map(),listeners={},classes=new Set();
    const node={id,textContent:text,disabled:false,hidden:false,style:{},listeners,
      classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),toggle(value,on){if(on)classes.add(value);else classes.delete(value);},contains:value=>classes.has(value)},
      setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key),getAttribute:key=>attributes.get(key),
      addEventListener:(type,callback)=>{listeners[type]=callback;},
      append(...children){for(const child of children)if(child.id)elements.set(child.id,child);},
      prepend(child){if(child.id)elements.set(child.id,child);},focus(){}};
    if(id)elements.set(id,node);
    return node;
  }
  const content=element('content'),body=element('body');body.dataset={};
  const document={body,getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],querySelector:selector=>selector==='.content-viewport'?content:null,
    createElement:()=>element(),addEventListener:(type,callback)=>{events[type]=callback;}};
  const context=vm.createContext({document,window:{api,addEventListener(){}},console,setTimeout,clearTimeout,requestAnimationFrame:()=>{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/renderer.js'),'utf8'),context);
  context.showToast=(message,type)=>toasts.push({message,type});
  const loadGames=context.loadGames;
  context.loadGames=async()=>true;
  return {context,element,elements,toasts,events,body,loadGames};
}

test('a failed action releases its control and never reports success',async()=>{
  const r=renderer(),button=r.element('run','Aplicar');
  await r.context.runButtonTask(button,'Aplicando…',async()=>{throw new Error('Acceso denegado');});
  assert.equal(button.disabled,false);assert.equal(button.textContent,'Aplicar');assert.equal(button.getAttribute('aria-busy'),undefined);
  assert.deepEqual(r.toasts,[{message:'Acceso denegado',type:'error'}]);
});

test('a busy button cannot dispatch the same operation twice',async()=>{
  const r=renderer(),button=r.element('run','Aplicar');let finish,calls=0;
  const pending=new Promise(resolve=>{finish=resolve;});
  const first=r.context.runButtonTask(button,'Esperando…',async()=>{calls++;await pending;return{success:true};});
  assert.equal(button.disabled,true);
  await r.context.runButtonTask(button,'Esperando…',async()=>{calls++;});
  assert.equal(calls,1);finish();await first;assert.equal(button.disabled,false);
});

test('game apply stops at the failed adjustment and reports completed work',async()=>{
  const calls=[],r=renderer({applyGameTweak:async id=>{calls.push(id);if(id==='second')throw new Error('Configuración no encontrada');return{success:true};}});
  const button=r.element('profile','Aplicar perfil');
  const game={id:'fixture',tweaks:[{id:'first',title:'Primero'},{id:'second',title:'Segundo'},{id:'third',title:'Tercero'}]};
  await r.context.runGameBatch(button,game);
  assert.deepEqual(calls,['first','second']);assert.equal(button.disabled,false);
  assert.equal(r.toasts.at(-1).type,'error');assert.match(r.toasts.at(-1).message,/1 ajustes aplicados/);assert.match(r.toasts.at(-1).message,/Segundo/);
  assert.equal(r.toasts.some(item=>item.type==='success'),false);
});

test('individual game failure shows the backend reason, clears progress and releases its checkbox',async()=>{
 let dismissed=0,refreshed=0;
 const r=renderer({applyGameTweak:async()=>{throw new Error('Cierra VALORANT antes de cambiar sus archivos.');}});
 const originalToast=r.context.showToast;
 r.context.showToast=(message,type)=>{originalToast(message,type);return()=>{dismissed++;};};
 r.context.loadGames=async()=>{refreshed++;return true;};
 const input=r.element('game-switch');input.checked=true;
 const result=await r.context.runSingleGameTweak(input,'val_disable_vsync',true,r.element('card'));
 assert.equal(result,null);assert.equal(input.checked,false);assert.equal(input.disabled,false);
 assert.match(r.toasts.at(-1).message,/Cierra VALORANT/);assert.equal(r.toasts.at(-1).type,'error');
 assert.equal(dismissed,1);assert.equal(refreshed,1);assert.equal(r.toasts.some(item=>item.type==='success'),false);
});

test('individual game actions pass the selected profile and refresh ownership for immediate restoration',async()=>{
 const calls=[],r=renderer({applyGameTweak:async(...args)=>{calls.push(args);return{success:true,message:'Guardado'};},revertGameTweak:async id=>{calls.push([id]);return{success:true,message:'Restaurado'};}});
 let refreshes=0;r.context.loadGames=async()=>{refreshes++;return true;};
 const input=r.element('game-switch'),card=r.element('game-card');input.checked=true;
 await r.context.runSingleGameTweak(input,'val_disable_vsync',true,card,'a'.repeat(64));
 assert.deepEqual(calls[0],['val_disable_vsync','a'.repeat(64)]);assert.equal(card.classList.contains('active'),true);
 input.checked=false;await r.context.runSingleGameTweak(input,'val_disable_vsync',false,card);
 assert.deepEqual(calls[1],['val_disable_vsync']);assert.equal(card.classList.contains('active'),false);assert.equal(refreshes,2);
});

test('batch game edits require an explicit profile when multiple files exist',async()=>{
 let calls=0;const r=renderer({applyGameTweak:async()=>{calls++;return{success:true};}});
 await r.context.runGameBatch(r.element('profile','Aplicar'),{id:'valorant',configProfiles:[{id:'a'},{id:'b'}],tweaks:[{id:'val_disable_vsync',configFile:true}]});
 assert.equal(calls,0);assert.match(r.toasts.at(-1).message,/Selecciona un perfil/);
});

test('game selector changes are passed to the read-only loader without losing selection',async()=>{
 const calls=[],profileId='b'.repeat(64),r=renderer({getGamesList:async id=>{calls.push(id);return[{id:'valorant',selectedConfigProfileId:id,configProfiles:[{id}],tweaks:[]}];}});
 r.context.renderGames=()=>{};
 vm.runInContext(`selectedValProfileId='${profileId}'`,r.context);
 assert.equal(await r.loadGames(),true);assert.deepEqual(calls,[profileId]);
});

test('game apply keeps observed preferences and avoids adopting them as new changes',async()=>{
  const calls=[],r=renderer({applyGameTweak:async id=>{calls.push(id);return{success:true};}});
  const game={id:'fixture',tweaks:[{id:'existing',isApplied:true},{id:'new',title:'Nuevo'}]};
  const result=await r.context.runGameBatch(r.element('profile','Aplicar'),game);
  assert.deepEqual(calls,['new']);assert.equal(result.applied,1);assert.equal(result.skipped,1);
});

test('game restoration uses the history-aware bulk endpoint and unlocks after conflicts',async()=>{
  const calls=[],r=renderer({revertGameProfile:async id=>{calls.push(id);throw new Error('Restaurados 1 de 2; conflicto externo');},revertGameTweak:async()=>{throw new Error('No catalog-order restore');}});
  const button=r.element('restore','Restaurar');
  await r.context.runGameBatch(button,{id:'fixture',tweaks:[{id:'a'},{id:'b'}]},true);
  assert.deepEqual(calls,['fixture']);assert.equal(button.disabled,false);assert.match(r.toasts.at(-1).message,/1 de 2/);
});

test('Apex shortcuts remain usable after failed requests and honor cancellation',async()=>{
  let mutations=0;
  const r=renderer({getDiskCleanupStatus:async()=>({items:{}}),applyTweak:async()=>{mutations++;throw new Error('Cache en uso');},applySnappyUiTweak:async()=>{mutations++;throw new Error('Sin permiso');}});
  const shader=r.element('btn-clean-shaders-apex','Limpiar'),menus=r.element('btn-zero-delay-apex','Aplicar');
  r.context.promptActionConfirmation=async()=>true;r.context.renderBiosGuides=async()=>{};r.context.setupSnappyUiSuite=()=>{};
  r.context.initApexProView();
  await shader.listeners.click();await menus.listeners.click();
  assert.equal(shader.disabled,false);assert.equal(menus.disabled,false);assert.equal(mutations,2);
  r.context.promptActionConfirmation=async()=>false;
  await shader.listeners.click();await menus.listeners.click();
  assert.equal(mutations,2);assert.equal(r.toasts.some(item=>item.type==='success'),false);
});

test('an unavailable runtime displays a retry path instead of an inert empty shell',async()=>{
  const r=renderer({getAppInfo:async()=>{throw new Error('IPC no disponible');}});
  await r.context.initializeAppContent();
  const banner=r.elements.get('startup-recovery-banner');
  assert.equal(banner.hidden,false);assert.match(r.elements.get('startup-recovery-message').textContent,/IPC no disponible/);
  assert.equal(r.body.dataset.ready,'false');
});
