'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanClixml}=require('../src/main/systemInfo');
test('native CLIXML error text survives decoding for actionable Windows failures',()=>{
 const error='#< CLIXML\r\n<Objs Version="1.1.0.1"><S S="Error">Acceso denegado &amp; archivo &quot;Apex&quot;._x000D__x000A_</S><S S="Error">Fallo deliberado de fixture</S></Objs>';
 assert.equal(cleanClixml(error),'Acceso denegado & archivo "Apex".\nFallo deliberado de fixture');
});
test('progress metadata is discarded but ordinary registry JSON stays intact',()=>{
 assert.equal(cleanClixml('#< CLIXML\n<Objs><Obj S="progress">Preparando</Obj></Objs>'),'');
 const json=JSON.stringify({value:'#< CLIXML <Objs>preserve user data</Objs>'});assert.equal(cleanClixml(json),json);
 assert.equal(cleanClixml('#< CLIXML\r\nFallo deliberado de fixture\r\n<Objs><Obj S="progress">Preparando módulos</Obj></Objs>'),'Fallo deliberado de fixture');
 assert.equal(cleanClixml('#< CLIXML\r\n'),'');
});
