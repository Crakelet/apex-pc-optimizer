'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateLegacyRequest}=require('../src/main/legacyPolicy');
test('game profile selection accepts only an opaque compiled-target identifier',()=>{
 const id='a'.repeat(64);
 for(const args of [[],[id]])assert.doesNotThrow(()=>validateLegacyRequest('get-games-list',args));
 for(const args of [['val_disable_vsync'],['val_disable_vsync',id]])assert.doesNotThrow(()=>validateLegacyRequest('apply-game-tweak',args));
 for(const value of ['C:\\Users\\someone\\file.ini','../file.ini','__proto__','A'.repeat(64),'x',null,{},'a'.repeat(65)]){
  assert.throws(()=>validateLegacyRequest('get-games-list',[value]));
  assert.throws(()=>validateLegacyRequest('apply-game-tweak',['val_disable_vsync',value]));
 }
 assert.throws(()=>validateLegacyRequest('apply-game-tweak',['fn_disable_vsync',id]));
 assert.throws(()=>validateLegacyRequest('get-games-list',[id,id]));
 assert.throws(()=>validateLegacyRequest('apply-game-tweak',['val_disable_vsync',id,id]));
});
