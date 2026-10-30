'use strict';
const net=require('node:net');
const path=require('node:path');
const {allowedExternal}=require('./updateService');
const {SOURCES,SETTINGS_TARGETS}=require('./performanceAdvisor');
const READ_ONLY=new Set(['get-app-info','get-admin-status','get-specs','get-tweaks','get-statuses','get-games-list','run-system-audit','get-bloat-status','get-realtime-telemetry','get-ascension-status','get-bios-guides','detect-design-apps','get-design-cache-summary','get-memory-stats','get-auto-clean-config','get-startup-programs','get-hosts-shield-status','get-cleaners-status','get-disk-cleanup-status','get-ghost-devices','get-hardware-report','get-usb-latency-status','get-snappy-ui-status','check-for-updates','run-ping-benchmark']);
const IDS=new Set(['apply-tweak','revert-tweak','apply-game-tweak','revert-game-tweak','execute-audit-action','apply-snappy-ui-tweak','revert-snappy-ui-tweak']);
READ_ONLY.add('get-design-gpu-backup-status');
READ_ONLY.add('get-operation-state');
READ_ONLY.add('get-recovery-summary');
READ_ONLY.add('get-performance-report');
function validateLegacyRequest(channel,args){
 if(!Array.isArray(args))throw new Error('Solicitud no válida.');
 const fail=()=>{throw new Error('Parámetros no válidos para esta herramienta.');};
 if(channel==='get-games-list'){if(args.length>1||(args.length===1&&(typeof args[0]!=='string'||! /^[a-f0-9]{64}$/.test(args[0]))))fail();return;}
 if(channel==='apply-game-tweak'){if(args.length<1||args.length>2||typeof args[0]!=='string'||!/^[a-zA-Z][\w-]{0,95}$/.test(args[0])||(args.length===2&&(!args[0].startsWith('val_')||typeof args[1]!=='string'||!/^[a-f0-9]{64}$/.test(args[1]))))fail();return;}
 if(['open-performance-source','open-performance-settings'].includes(channel)){const targets=channel==='open-performance-source'?SOURCES:SETTINGS_TARGETS;if(args.length!==1||typeof args[0]!=='string'||!Object.hasOwn(targets,args[0]))fail();return;}
 if(channel==='run-system-audit'){if(args.length>1||(args[0]!==undefined&&typeof args[0]!=='boolean'))fail();return;}
 if(channel==='run-ping-benchmark'){const h=args[0];if(args.length>1)fail();if(h!=null&&(typeof h!=='string'||h.length>253||!h||(!net.isIP(h)&&!h.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(x)))))fail();return;}
 if(IDS.has(channel)){if(args.length!==1||typeof args[0]!=='string'||!/^[a-zA-Z][\w-]{0,95}$/.test(args[0]))fail();return;}
 if(channel==='create-restore-point'){if(args.length>1||(args[0]!==undefined&&(typeof args[0]!=='string'||!/^[\p{L}\p{N} _.-]{1,100}$/u.test(args[0]))))fail();return;}
 if(channel==='apply-profile'){if(args.length!==1||!['gaming','network','design','services','privacy','clean'].includes(args[0]))fail();return;}
 if(channel==='revert-game-profile'){if(args.length!==1||!['valorant','fortnite','cs2','apex_legends','call_of_duty'].includes(args[0]))fail();return;}
 if(channel==='set-dns-provider'){if(args.length!==1||!['cloudflare','google','quad9','dhcp','original'].includes(args[0]))fail();return;}
 if(['toggle-windows-ascension','set-usb-low-latency'].includes(channel)){if(args.length!==1||typeof args[0]!=='boolean')fail();return;}
 if(['assign-gpu-design-app','restore-gpu-design-app','get-design-gpu-backup-status'].includes(channel)){const p=args[0];if(args.length!==1||typeof p!=='string'||p.length>2048||!path.win32.isAbsolute(p)||!/\.exe$/i.test(p)||/[\r\n\0"`$]/.test(p))fail();return;}
 if(channel==='optimize-single-process'){if(args.length!==1||!Number.isSafeInteger(args[0])||args[0]<=4)fail();return;}
 if(channel==='execute-custom-debloat'){if(args.length!==1||!Array.isArray(args[0])||args[0].length>100||args[0].some(x=>typeof x!=='string'||!/^[\w.-]{1,120}$/.test(x)))fail();return;}
 if(channel==='set-auto-clean-config'){const c=args[0];if(args.length!==1||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['enabled','thresholdPercent','intervalSeconds'].includes(k))||('enabled'in c&&typeof c.enabled!=='boolean')||('thresholdPercent'in c&&(!Number.isFinite(c.thresholdPercent)||c.thresholdPercent<50||c.thresholdPercent>99))||('intervalSeconds'in c&&(!Number.isFinite(c.intervalSeconds)||c.intervalSeconds<15||c.intervalSeconds>86400)))fail();return;}
 if(channel==='toggle-startup-program'){const x=args[0];if(args.length!==1||!x||typeof x.name!=='string'||!x.name||x.name.length>260||/[\r\n\0]/.test(x.name)||typeof x.location!=='string'||x.location.length>2048||typeof x.enable!=='boolean')fail();return;}
 if(channel==='window-control'){if(args.length!==1||!['minimize','maximize','close'].includes(args[0]))fail();return;}
 if(channel==='open-external-url'){if(args.length!==1||!allowedExternal(args[0]))fail();return;}
 if(args.length)fail();
}
module.exports={READ_ONLY,validateLegacyRequest};
