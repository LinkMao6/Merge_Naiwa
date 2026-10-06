import fs from 'node:fs';
import path from 'node:path';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
let checked=0;
for(const file of walk('dist')){
  if(!/\.(html|css|js)$/.test(file)||file.includes('vendor'))continue;
  const text=fs.readFileSync(file,'utf8'),refs=[];
  if(file.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g))refs.push(m[1]);
  if(file.endsWith('.css'))for(const m of text.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))refs.push(m[1]);
  if(file.endsWith('.js'))for(const m of text.matchAll(/(?:from\s+|import\s*)['"](\.\/?[^'"]+)['"]/g))refs.push(m[1]);
  for(const ref of refs){if(/^(?:https?:|data:|#)/.test(ref))continue;const target=path.resolve(path.dirname(file),ref.split('?')[0]);if(!fs.existsSync(target))throw new Error(`Missing asset: ${file} -> ${ref}`);checked++;}
}
const stages=JSON.parse(fs.readFileSync('dist/geometry-384-r1.json','utf8'));
if(stages.length!==11)throw new Error('Expected 11 stages');
for(const stage of stages){const p=path.join('dist/assets/naiwa/384-r1',stage.sprite);const bytes=fs.readFileSync(p);if(bytes.readUInt32BE(16)!==stage.imageSize[0]||bytes.readUInt32BE(20)!==stage.imageSize[1])throw new Error('Sprite dimensions mismatch: '+p);}
fs.writeFileSync('dist/.nojekyll','');
console.log(`Static build ready: ${checked} asset references and 11 PNG/geometry pairs checked.`);
