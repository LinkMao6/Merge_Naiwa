import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=spawn(process.execPath,['server.mjs'],{stdio:'ignore'});let browser;
try {
 for(let i=0;i<40;i++){try{await fetch('http://127.0.0.1:4173');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const load=async()=>{await page.goto('http://127.0.0.1:4173/?test=1');await page.waitForFunction(()=>window.__mergeDebug?.state().ready);};await load();
 await page.evaluate(()=>{localStorage.clear();});await load();
 await page.click('#gallery-button');await page.click('[data-level="11"]');assert.equal(await page.locator('#select-pet').isDisabled(),true);await page.click('#modal-close');
 await page.evaluate(()=>window.__mergeDebug.unlock(2));await page.click('#gallery-button');await page.click('[data-level="2"]');await page.click('#select-pet');assert.equal(await page.locator('#select-pet').innerText(),'当前宠物 ✓');await page.click('#modal-close');await load();assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().selectedId),2);
 await page.evaluate(()=>localStorage.setItem('naiwa:independent:test:best','1000000'));await load();
 const actual=await page.evaluate(()=>{const d=window.__mergeDebug;d.clear();const a=d.spawn(1,180,400),b=d.spawn(1,180,415);d.advance(350);return {pet:d.petState(),game:d.state()};});assert.equal(actual.pet.variant,'self');assert.equal(actual.game.score,25);assert.equal(actual.game.bodyCount,1);
 await page.evaluate(()=>{const d=window.__mergeDebug;d.petAdvance(3000);d.petReact('COMBO',{chain:8});});assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'EXCITED');
 await page.evaluate(()=>{const d=window.__mergeDebug;d.reset();d.petReact('NEAR_GAME_OVER',{active:true});});assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'SCARED');await page.evaluate(()=>window.__mergeDebug.petReact('NEAR_GAME_OVER',{active:false}));assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'IDLE');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().paused),true);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().paused),false);
 await page.evaluate(()=>{const d=window.__mergeDebug;d.petSelect(1);d.petAdvance(3000);});
 const button=page.locator('.pet-body'),r=await button.boundingBox();const before=await page.evaluate(()=>window.__mergeDebug.state().dropCount);
 await page.mouse.click(r.x+r.width/2,r.y+r.height/2);assert.ok(await page.evaluate(()=>window.__mergeDebug.petState().clickCount)>0);
 await page.evaluate(()=>window.__mergeDebug.petAdvance(3000));
 await page.mouse.move(r.x+r.width/2,r.y+r.height*.25);await page.mouse.down();await page.waitForTimeout(380);await page.mouse.move(r.x+8,r.y+r.height*.25);await page.mouse.move(r.x+r.width-8,r.y+r.height*.25);await page.mouse.up();assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'PETTING');assert.equal(await page.evaluate(()=>window.__mergeDebug.state().dropCount),before);
 await page.click('#pause');const paused=await page.evaluate(()=>{const d=window.__mergeDebug,a=d.petState();d.petAdvance(5000);return {a,b:d.petState()};});assert.deepEqual(paused.a,paused.b);await page.click('#modal-close');
 await page.evaluate(()=>{const d=window.__mergeDebug;d.petReact('GAME_OVER');d.reset();});assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'IDLE');
 for(const size of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:393,height:852},{width:844,height:390}]){await page.setViewportSize(size);await page.waitForTimeout(80);const boxes=await page.evaluate(()=>{const r=id=>{const b=document.querySelector(id).getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};};return {pet:r('.pet-body'),game:r('#stage'),hud:r('.hud'),combo:r('.combo'),footer:r('.game-actions')};});assert.ok(boxes.pet.x>=boxes.game.right-1);assert.ok(boxes.pet.bottom<=size.height);assert.ok(boxes.pet.x>=0);}
 await page.setViewportSize({width:390,height:844});const touch=await page.context().newCDPSession(page),b=await button.boundingBox();const dispatch=(type,x)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y:b.y+b.height*.25,id:1}]});
 await page.evaluate(()=>window.__mergeDebug.petAdvance(3000));await dispatch('touchStart',b.x+b.width/2);await page.waitForTimeout(390);await dispatch('touchMove',b.x+5);await dispatch('touchMove',b.x+b.width-5);await dispatch('touchEnd');assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().state),'PETTING');
 await dispatch('touchStart',b.x+b.width/2);await dispatch('touchCancel');assert.equal(await page.evaluate(()=>window.__mergeDebug.state().dropCount),before);
 const nodes=await page.locator('#pet-companion *').count();await page.evaluate(()=>{const d=window.__mergeDebug;d.petAdvance(3000);for(let i=0;i<20;i++)d.petClick();});assert.equal(await page.locator('#pet-companion *').count(),nodes);assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().variant),'dodge');
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('naiwa:independent:test:pet',JSON.stringify({selectedId:999}));});await load();assert.equal(await page.evaluate(()=>window.__mergeDebug.petState().selectedId),1);assert.deepEqual(await page.evaluate(()=>window.__mergeDebug.collection()),[1]);
 fs.mkdirSync('tests/artifacts',{recursive:true});await page.screenshot({path:'tests/artifacts/pet-mobile.png'});await page.setViewportSize({width:1280,height:850});await page.screenshot({path:'tests/artifacts/pet-desktop.png'});assert.deepEqual(errors,[]);
 console.log('PASS pet collection, persistence, invalid save, mouse/touch petting, cancel, pause/restart, 20-click reuse, and five responsive layouts');
}finally{await browser?.close();server.kill();}
