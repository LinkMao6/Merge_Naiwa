import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve('dist');
const hostIndex=process.argv.indexOf('--host');
const host=hostIndex<0?'127.0.0.1':process.argv[hostIndex+1];
if(!['127.0.0.1','0.0.0.0'].includes(host))throw new Error('Use --host 127.0.0.1 or --host 0.0.0.0');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);return res.end();}
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(file===root||fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-cache');
  fs.createReadStream(file).pipe(res);
});
server.listen(4173,host,()=>{
  const localUrl='http://127.0.0.1:4173';console.log('Local: '+localUrl);
  if(host==='0.0.0.0')console.log('LAN enabled: use this computer\'s LAN IP on your phone.');
  if(process.argv.includes('--open')){
    if(process.platform==='win32')spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"Start-Process 'http://127.0.0.1:4173'"],{windowsHide:true,stdio:'ignore'}).on('error',()=>{});
    else spawn(process.platform==='darwin'?'open':'xdg-open',[localUrl],{stdio:'ignore'}).on('error',()=>{});
  }
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 4173 is already in use. Open http://127.0.0.1:4173 or stop the earlier game server.':error.message);process.exitCode=1;});
