import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const url='http://127.0.0.1:4173';let server;
try{await fetch(url);}catch{server=spawn(process.execPath,['server.mjs'],{stdio:'ignore'});for(let i=0;i<40;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}}
let browser;const errors=[],results=[];
function check(value,message){if(!value)throw new Error(message);results.push(message);console.log('PASS '+message);}
try{
  for(const channel of ['msedge','chrome',undefined]){try{browser=await playwright.chromium.launch({headless:true,...(channel?{channel}:{})});break;}catch{}}
  if(!browser)throw new Error('Install Chrome/Edge or Playwright Chromium to run browser checks.');
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};observe(page);
  await page.addInitScript(()=>{window.registeredTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.registeredTools[tool.name]=tool;}}});});
  async function load(p=page){await p.goto(url+'/?test=1');await p.waitForFunction(()=>window.__mergeDebug?.state().ready);}
  const state=()=>page.evaluate(()=>window.__mergeDebug.state());
  async function fixture(fn,arg){return page.evaluate(({code,arg})=>{const d=window.__mergeDebug;d.reset();d.setGameSpeed(1);return new Function('d','arg',code)(d,arg);},{code:fn.toString().replace(/^[^{]*\{/,'').replace(/\}\s*$/,''),arg});}
  await load();
  check((await state()).levels===11,'all eleven preloaded characters and contours');
  check((await state()).audio===undefined,'no WebAudio context before user gesture');
  await page.click('#game',{position:{x:150,y:160}});await page.waitForTimeout(150);
  check((await state()).audio==='running','WebAudio unlocks on user input');
  const combo=await fixture(function(d){const counts=[];for(let i=0;i<12;i++){d.clear();d.spawn(1,175,430);d.spawn(1,175,445);d.advance(350);counts.push(d.state().chain);}return {counts,state:d.state()};});
  check(combo.counts.every((n,i)=>n===i+1),'twelve consecutive physical merges');
  check(combo.state.chain===12&&combo.state.feedback.comboMultiplier===4&&combo.state.score===630,'combo starts at 1.25 and score uses current multiplier');
  const consumed=combo.state.rewards.log.filter(e=>e.kind==='merge').flatMap(e=>e.consumed);
  check(new Set(consumed).size===24,'each consumed actor merges exactly once');
  const decay=await page.evaluate(()=>{const d=window.__mergeDebug;d.clear();d.advance(2200);const first=d.state();d.advance(26000);return {first,last:d.state()};});
  check(decay.first.chain===11&&decay.first.feedback.comboMultiplier===3.75&&decay.last.chain===0&&decay.last.feedback.comboMultiplier===1,'combo decays one layer per 2200ms and returns to 1x');
  check(decay.last.feedback.particles===0&&decay.last.feedback.emitterParticles===0&&decay.last.feedback.echoes===0,'effect particles and snapshots expire without leaks');
  const simultaneous=await fixture(function(d){for(const x of [90,280]){d.spawn(1,x,400);d.spawn(1,x,415);}d.advance(350);return d.state();});
  check(simultaneous.chain===2&&simultaneous.bodyCount===2&&simultaneous.score===55,'two separate pairs merge in the same simulation interval');
  const cascade=await fixture(function(d){for(const x of [150,185]){d.spawn(1,x,435);d.spawn(1,x,450);}d.advance(1800);return d.state();});
  check(cascade.rewards.log.filter(e=>e.kind==='merge').length>=3&&cascade.bodies.some(b=>b.level===3),'multi-actor chain reaction reaches next tier');
  const wall=await fixture(function(d){const rows=[];for(const side of ['left','right'])for(const level of [1,2,4,6,9,11]){d.reset();const w=d.state().world;const id=d.spawn(level,side==='left'?-100:w.width+100,280,{angle:.7});const born=d.state().details.find(a=>a.id===id).outline;d.advance(1200);const a=d.state().details.find(a=>a.id===id);rows.push({side,level,born,after:a?.outline,corrections:d.state().wallDebug});}return rows;});
  check(wall.every(r=>r.born.minX>=13.49&&r.born.maxX<365),'all rotated spawn silhouettes are contained before physics starts');
  check(wall.every(r=>r.after&&r.after.maxY>550&&r.after.minX>11.5),'left and right edge characters fall, including formerly stuck level six');
  check(wall.every(r=>r.corrections.length===0),'normal wall scenes need no runtime position correction');
  const high=await fixture(function(d){d.spawn(1,60,550);d.spawn(6,180,340);d.spawn(6,180,355);d.advance(2900);return d.state();});
  check(high.highest===7&&high.rewards.log.some(e=>e.kind==='clear-done'&&e.count>0)&&!high.rewards.presentation,'high-tier first appearance and downward clear complete');
  await fixture(function(d){d.spawn(8,180,300);d.spawn(8,180,315);d.advance(2800);});
  await page.click('#restart');await page.click('#modal-actions .primary');
  const gift=await state();check(gift.score===128000&&gift.bodies.some(a=>a.level===8)&&gift.rewards.frenzyRemaining===0,'actual emperor merge grants one next-round gift without false frenzy');
  const frenzy=await fixture(function(d){d.rewardSeed({points:49990,layers:16,bonus:16});d.awardTest(20);d.advance(1500);return d.state();});
  check(frenzy.rewards.frenzyRemaining>0&&frenzy.feedback.comboMultiplier===10,'score milestone starts double frenzy and preserves 10x cap');
  const auto=await fixture(function(d){d.rewardSeed({layers:29,bonus:16});d.spawn(3,70,500);d.spawn(3,290,500);d.spawn(1,180,400);d.spawn(1,180,415);d.advance(1700);return d.state();});
  check(auto.rewards.claimed.includes(30)&&auto.rewards.log.some(e=>e.kind==='merge'&&e.automatic)&&!auto.rewards.batch,'30-combo automatic pairing executes once and completes');
  await page.evaluate(()=>window.__mergeDebug.previewScore(123456789012,true));
  check(await page.evaluate(()=>document.querySelector('#score .score-reels').getBoundingClientRect().width<=document.querySelector('#score').getBoundingClientRect().width),'large score digits fit inside the score panel');
  const edgeMerge=await fixture(function(d){const rows=[];for(const side of ['left','right']){d.reset();const x=side==='left'?14:d.state().world.width-14;d.spawn(3,x,420);d.spawn(3,x,435);d.advance(350);rows.push(d.state());}return rows;});
  check(edgeMerge.every(r=>r.chain===1&&r.details.every(a=>a.outline.minX>11.5)),'merges against either wall produce contained new bodies');
  const visual=await fixture(function(d){d.spawn(1,180,430);d.spawn(1,180,445);d.advance(20);const start=d.state();const area=start.details[0].area;const id=start.details[0].id;d.advance(250);const end=d.state();return {start,end,area,endArea:end.details.find(a=>a.id===id)?.area};});
  check(visual.start.feedback.echoes===2&&visual.start.bodies[0].birthScale===0,'old sprites compress while physical replacement is already complete');
  check(visual.area===visual.endArea&&visual.end.bodies[0].birthScale>1,'spring overshoot changes only visual scale, never collider area');
  const physicsBefore=await state();await page.setViewportSize({width:430,height:932});await page.waitForTimeout(100);const physicsAfter=await state();
  check(JSON.stringify(physicsBefore.walls)===JSON.stringify(physicsAfter.walls)&&physicsBefore.world.width===physicsAfter.world.width,'resize preserves physical boundaries and their body IDs');
  await fixture(function(d){d.clear();d.spawn(4,180,250);});
  const lowFps=await page.evaluate(()=>{const d=window.__mergeDebug;const a=d.state().engineTime;d.advanceFrame(1000);return d.state().engineTime-a;});
  check(lowFps>40&&lowFps<51,'1000ms slow frame advances only clamped fixed substeps');
  const cap=await fixture(function(d){for(let i=0;i<18;i++){d.clear();d.spawn(1,175,430);d.spawn(1,175,445);d.advance(100);}const s=d.state();return {total:s.feedback.particles+s.feedback.emitterParticles,rings:s.feedback.rings,s};});
  check(cap.total<=150&&cap.rings<=30,'particle and shockwave limits survive burst merges');
  await fixture(function(d){d.clear();d.setPause('capture',true);});
  const pausedBefore=await state();await page.waitForTimeout(180);const pausedAfter=await state();check(pausedBefore.time===pausedAfter.time,'paused game clock remains frozen');
  await page.evaluate(()=>window.__mergeDebug.setPause('capture',false));
  await page.click('#pause');check(await page.locator('#modal-title').innerText()==='已暂停','pause dialog keeps existing controls');
  await page.locator('#volume').fill('0.35');check((await state()).volume===.35,'volume slider updates saved master gain');await page.click('#modal-actions .primary');
  await page.click('#sound');await page.waitForTimeout(30);check(!(await state()).soundOn&&(await state()).feedback.voices===0,'mute clears active voices');
  await page.click('#sound');await page.waitForTimeout(60);check((await state()).soundOn,'sound can resume');
  const landing=await page.evaluate(()=>{const d=window.__mergeDebug;d.landingSound(.5);d.landingSound(7);d.landingSound(7);return d.state().soundEvents.filter(e=>e.kind==='landing');});
  check(landing.length===1,'landing rejects weak contact and throttles duplicate sound');await page.waitForTimeout(100);
  await page.evaluate(()=>window.__mergeDebug.landingSound(10));const landed=(await state()).soundEvents.filter(e=>e.kind==='landing');
  check(landed.length===2&&landed[1].at-landed[0].at>=80,'collision sound cooldown is 80ms in real time');
  await page.click('#gallery-button');check(await page.locator('.gallery button').count()===11,'collection still contains all eleven characters');await page.click('#modal-close');
  await page.click('#speed-toggle');await page.click('[id="speed-2"]');check(await page.locator('#speed-toggle').innerText()==='2.0× ▴','speed controls retained');
  await page.click('#leaderboard-button');await page.fill('#ranking-name','奶油玩家');await page.click('#ranking-form button');check((await page.locator('#ranking-list').innerText()).includes('奶油玩家'),'local leaderboard retained');await page.click('#modal-close');
  check(await page.evaluate(()=>Object.keys(window.registeredTools).length===2),'structured tools still register');
  check(await page.evaluate(()=>{try{window.registeredTools.drop_character.execute({x:-1});return false;}catch{return true;}}),'structured drop rejects invalid input');
  await fixture(function(d){d.clear();const id=d.spawn(11,180,100);d.freeze(id);d.unlockAudio();});
  await page.waitForFunction(()=>window.__mergeDebug.state().audio==='running');
  await page.evaluate(()=>window.__mergeDebug.advance(4600));
  check((await state()).dead&&await page.locator('#modal-title').innerText()==='本局已结算','natural overflow triggers game over');
  check((await state()).soundEvents.some(e=>e.kind==='gameOver'),'game over cue is triggered once');
  await page.click('#modal-actions .primary');const restart=await state();check(!restart.dead&&restart.score===0&&restart.chain===0&&restart.pending===0&&restart.bodyCount===0,'restart clears actors, queued merges and combo clock');
  check(restart.feedback.particles===0&&restart.feedback.echoes===0&&restart.feedback.voices===0,'restart removes old visual and audio work');
  await fixture(function(d){d.spawn(1,175,430);d.spawn(1,175,445);d.advance(350);});const best=(await state()).best;await page.reload();await page.waitForFunction(()=>window.__mergeDebug?.state().ready);
  check((await state()).best===best&&(await state()).volume===.35,'refresh retains high score and sound volume');
  // Genuine touch input through Chromium, so pointer capture/cancel is exercised.
  const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});observe(phone);await load(phone);
  const cdp=await phone.context().newCDPSession(phone);const box=await phone.locator('#game').boundingBox();const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,radiusX:2,radiusY:2,force:1,id:1}]});
  await touch('touchStart',box.x+box.width/2,box.y+100);await touch('touchMove',box.x-60,box.y+100);await phone.waitForTimeout(750);
  check(await phone.evaluate(()=>window.__mergeDebug.state().dropCount===0),'holding and dragging touch does not auto-drop');
  const aimed=await phone.evaluate(()=>window.__mergeDebug.state());check(aimed.aim>12,'touch aim is clamped inside the left wall');
  await touch('touchEnd');await phone.waitForTimeout(30);check(await phone.evaluate(()=>window.__mergeDebug.state().dropCount===1),'touch release creates exactly one character');
  await touch('touchStart',box.x+100,box.y+120);await touch('touchCancel');await phone.waitForTimeout(100);check(await phone.evaluate(()=>window.__mergeDebug.state().dropCount===1),'cancelled gesture never drops');
  await phone.waitForTimeout(450);for(let i=0;i<6;i++){await touch('touchStart',box.x+box.width/2,box.y+120);await touch('touchEnd');}
  check(await phone.evaluate(()=>window.__mergeDebug.state().dropCount<=2),'rapid touch respects cooldown without duplicate listeners');
  for(const size of [[375,667],[390,844],[393,852],[430,932],[844,390]]){
    await phone.setViewportSize({width:size[0],height:size[1]});await phone.waitForTimeout(60);
    const layout=await phone.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();const buttons=['#pause','#sound','#restart','#speed-toggle','#gallery-button','#feedback-button','#help'].map(s=>{const b=document.querySelector(s).getBoundingClientRect();return {width:b.width,height:b.height,top:b.top,bottom:b.bottom};});const hud=document.querySelector('.score-block').getBoundingClientRect(),combo=document.querySelector('#combo').getBoundingClientRect();return {width:document.documentElement.scrollWidth,vw:innerWidth,vh:innerHeight,r:{top:r.top,bottom:r.bottom,width:r.width,height:r.height},buttons,hudBottom:hud.bottom,comboTop:combo.top};});
    check(layout.width<=layout.vw+1&&layout.r.top>=0&&layout.r.bottom<=layout.vh+1,`complete centered playfield at ${size.join('×')}`);
    check(layout.buttons.every(b=>b.width>=43.9&&b.height>=43.9&&b.top>=0&&b.bottom<=layout.vh+1),`44px touch targets stay visible at ${size.join('×')}`);
    check(layout.hudBottom<=layout.comboTop+1,`score and combo do not overlap at ${size.join('×')}`);
    await phone.screenshot({path:`tests/artifacts/mobile-${size.join('x')}.png`});
  }
  const css=fs.readFileSync('dist/styles.css','utf8');check(['top','bottom','left','right'].every(side=>css.includes('env(safe-area-inset-'+side+')'))&&css.includes('100dvh')&&!css.includes('100vh'),'Safari dynamic viewport and all four safe areas handled');
  const reducedPage=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});observe(reducedPage);await load(reducedPage);
  const restrained=await reducedPage.evaluate(()=>{const d=window.__mergeDebug;d.spawn(1,175,430);d.spawn(1,175,445);d.advance(130);return d.state();});
  check(restrained.reduced&&restrained.feedback.particles<=2&&restrained.bodies[0].birthScale<=1,'reduced-motion mode has minimal particles and no spring overshoot');
  await page.setViewportSize({width:1280,height:850});await fixture(function(d){d.clear();for(const [x,l] of [[70,1],[140,2],[240,3],[290,1]]){d.setCurrent(l);d.setAim(x);d.drop();d.advance(800);}d.setPause('capture',true);});await page.screenshot({path:'tests/artifacts/desktop.png'});
  check(errors.length===0,'no JavaScript errors or missing asset responses');
  fs.writeFileSync('tests/artifacts/results.json',JSON.stringify({checks:results.length,results,wallFixtures:wall,limitations:['Chromium/Edge verified; real iPhone Safari and device FPS remain unverified.']},null,2));
  console.log(`${results.length} browser checks passed.`);
} finally {await browser?.close();server?.kill();}


