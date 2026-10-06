import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
for(const file of [...walk('dist'),...walk('scripts'),...walk('tests'),'server.mjs','verify.mjs'].filter(f=>/\.(mjs|js)$/.test(f)&&!f.includes('vendor'))){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);process.exit(r.status);}}
console.log('Syntax checks passed for all project scripts.');
