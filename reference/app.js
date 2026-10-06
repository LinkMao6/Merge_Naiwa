import { createRewardParticles } from './reward-particles.js?v=1.2.0';
import { placeMergedBody, overlapDepth, birthScale } from './merge-placement.js?v=1.2.0';
import { createScoreCounter } from './score-counter.js?v=1.2.0';
import { createCommunity } from './community.js?v=1.3.5';
import { createRoundInheritance, mergeScore, highClearSnapshot } from './round-rules.js?v=1.3.5';
import { assertSpriteImage } from './sprite-validation.js?v=1.3.5';
/* 合成奶蛙. Physics uses precomputed alpha contours, never circle proxies. */
const {Engine, Bodies, Body, Composite, Events, Vertices, Sleeping} = window.Matter;
const $ = id => document.getElementById(id);
const canvas=$('game'), ctx=canvas.getContext('2d'), modal=$('modal');
const MODEL_SCALE=.9*.9*1.25; // 125% of the v1.2.5 character dimensions.
const SIZES=[46,64,76,91,110,126,144,167,191,222,255].map(size=>size*MODEL_SCALE);
// Angel sprite crop aspect ratio; regression checks keep this aligned with geometry.
const ANGEL_WIDTH=SIZES[9]*(1095/1120);
// Inner height is 85% of v1.2.6; inner width is 1.6 upright angels.
// Keep the existing outer margins and scale presentation uniformly on resize.
const LEFT=12,RIGHT=LEFT+ANGEL_WIDTH*1.6,W=RIGHT+12;
const FLOOR=12+681*.85,H=FLOOR+29,LINE=132,STEP=1000/120;
let walls=[];
const CHAIN_WINDOW=2200;
const MAX_COMBO_MULTIPLIER=5;
const ACCENTS=['#91a86d','#dcac35','#e77c67','#748896','#d79b34','#7c87af','#57796b','#d6a233','#ba7533','#879fd0','#b494df'];
const NAMES=['奶莱姆蛙','野生蛋奶蛙','爱心奶蛙','嘉豪奶蛙','奶蛙','奶蛙博士','暴徒奶蛙','奶蛙王','奶蛙帝','奶蛙天使','奶蛙上帝'];
const SHORT=NAMES;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rewardParticles=createRewardParticles({reduced});
document.documentElement.dataset.runningBuild='1.3.5';
const scoreCounter=createScoreCounter($('score'),{reduced});
const testMode=new URLSearchParams(location.search).get('test')==='1';
// Geometry and sprite pixels must use the same revision after resizing.
const SPRITE_REVISION='384-r1';
const engine=Engine.create({enableSleeping:true,positionIterations:8,velocityIterations:6});
engine.gravity.y=1.15;
let stages=[],images=[],ready=false,dead=false,godReached=false,score=0,best=0,highest=1;
let roundSettled=false,roundGeneration=0,peakChain=0,lastSettlement=null,toastRemaining=0;
let aim=W/2,current=1,next=1,time=0,lastDrop=-1000,chainDecayAt=Infinity,chain=0,comboBonus=0,dropCount=0;
let dangerTime=0,shake=0,flash=0,particles=[],rings=[],texts=[],pending=[];
let echoes=[],milestoneUntil=0,lastImpactSound=-9999,lastWarning=-1;
let previousFrame=0,accumulator=0,frameId=0,pointerId=null,modalKind='';
let holdElapsed=0,holdRepeated=false;
const pauses=new Set(), actors=new Map(), keys=new Set();
let soundOn=true,audio=null,hostMuted=false,audioBus=null;
const voices=new Set(),debutVoices=new Set();
let laughDebut=null,laughDebuted=false;
let presentation=null,autoBatch=null,rewardQueue=[],frenzyRemaining=0,frenzyCapacity=0,nextScoreNode=50000,pendingFrenzy=0;
const celebratedLevels=new Set(),claimedChainNodes=new Set();
let rewardLog=[],scoreLedger=[],rewardPulses=[],fragments=[];
function trace(kind,data={}){if(testMode){rewardLog.push({kind,...data});if(rewardLog.length>5000)rewardLog.shift();}}

const laughFrames=new Image();laughFrames.src='animations/classic-laugh.webp';
function debutAge(){return laughDebut?Math.max(0,(time-laughDebut.start)/1000):0;}
function startLaughDebut(){
  if(laughDebuted)return;
  laughDebuted=true;laughDebut={start:time};
  debutSound();
  // First appearance gets the animation instead of a second overlapping banner.
  milestoneUntil=0;$('milestone').classList.remove('show');
}

const storagePrefix=testMode?'naiwa:merge:test:':'naiwa:merge:';
function readStorage(key,fallback){try{const v=localStorage.getItem(storagePrefix+key);return v===null?fallback:JSON.parse(v);}catch{return fallback;}}
function writeStorage(key,value){try{localStorage.setItem(storagePrefix+key,JSON.stringify(value));}catch{$('storage-status').textContent='当前浏览器无法保存纪录';}}
let gameSpeed=1;
function setGameSpeed(value){
  if(![1,1.5,2].includes(value))return;
  gameSpeed=value;writeStorage('speed',value);
  for(const speed of [1,1.5,2])$('speed-'+speed).setAttribute('aria-pressed',String(speed===value));
  $('speed-toggle').textContent=`${value.toFixed(1)}× ▴`;
  document.documentElement.style.setProperty('--game-duration-scale',String(1/value));
}
setGameSpeed(readStorage('speed',1));
function closeSpeedMenu(){ $('speed-menu').hidden=true;$('speed-toggle').setAttribute('aria-expanded','false'); }
for(const speed of [1,1.5,2])$('speed-'+speed).onclick=()=>{setGameSpeed(speed);closeSpeedMenu();$('speed-toggle').focus();};
$('speed-toggle').onclick=()=>{const open=$('speed-menu').hidden;$('speed-menu').hidden=!open;$('speed-toggle').setAttribute('aria-expanded',String(open));if(open)$('speed-'+gameSpeed).focus();};
document.addEventListener('click',event=>{if(!$('speed-picker').contains(event.target))closeSpeedMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('speed-menu').hidden){closeSpeedMenu();$('speed-toggle').focus();}});
document.addEventListener('focusin',event=>{if(!$('speed-picker').contains(event.target))closeSpeedMenu();});
const saved=readStorage('best',0); best=Number.isSafeInteger(saved)&&saved>=0?saved:0;
const roundInheritance=createRoundInheritance({readStorage,writeStorage});
soundOn=readStorage('sound',true)!==false;
function stopAudio(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();debutVoices.clear();}
function audioState(){if(!audio)return Promise.resolve();if(pauses.size||dead||!soundOn||hostMuted){stopAudio();return audio.suspend().catch(()=>{});}return audio.resume().catch(()=>{});}
function unlockAudio(){if(!audio){const C=window.AudioContext||window.webkitAudioContext;if(C){try{audio=new C();audioBus=audio.createDynamicsCompressor();audioBus.threshold.value=-18;audioBus.ratio.value=8;audioBus.connect(audio.destination);}catch{audio=null;audioBus=null;}}}audioState();}
function tone(freq,delay=0,duration=.18,volume=.06,type='sine',end=freq*.8,featured=false){
  if(!audio||audio.state!=='running'||!soundOn||hostMuted||pauses.size||voices.size>=20)return;
  delay/=gameSpeed;duration/=gameSpeed;
  const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+delay;
  if(!featured&&debutVoices.size)volume*=.3;
  osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  osc.connect(gain);gain.connect(audioBus);voices.add(osc);if(featured)debutVoices.add(osc);osc.onended=()=>{voices.delete(osc);debutVoices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.02);
}
function debutSound(){
  if(!audio||audio.state!=='running'||!soundOn||hostMuted||pauses.size)return;
  // Clear short merge voices so the first-appearance accent always has room.
  stopAudio();
  tone(170,0,.38,.24,'sine',42,true);
  tone(740,0,.08,.07,'triangle',110,true);
  tone(155,.04,.3,.075,'triangle',1240,true);
  [261.63,329.63,392,523.25].forEach((f,i)=>tone(f,.13+i*.085,.36,.09,'triangle',f,true));
  [523.25,659.25,783.99].forEach(f=>tone(f,.5,.65,.055,'sine',f,true));
  tone(1567.98,.64,.36,.035,'sine',1567.98,true);
}
function mergeSound(level){
  const base=245*2**((level-2+Math.min(chain-1,5)*.7)/12);
  tone(145,0,.11,.055,'sine',65); // A soft low transient gives the merge weight.
  tone(base,0,.17,.09,'sine',base*1.8);
  [1.5,2,2.5].slice(0,level>=8?3:chain>1?2:1).forEach((n,i)=>tone(base*n,.045+i*.06,.25,.045,'triangle',base*n));
  if(level>=8)tone(base*.5,.04,.42,.045,'sine',base*.5);
}
function setPause(reason,value){if(value)pauses.add(reason);else pauses.delete(reason);keys.clear();pointerId=null;accumulator=0;document.documentElement.classList.toggle('game-paused',pauses.size>0);$('board-status').textContent=dead?'本局已结算':pauses.size?'游戏已暂停':'游戏进行中';return audioState();}
const sdk=null; // Standalone distribution: no hall or external SDK dependency.
const playRegion=document.querySelector('.play-region');
function rebuildWalls(){
  for(const wall of walls)Composite.remove(engine.world,wall);
  const options={isStatic:true,friction:.65,restitution:.18};
  walls=[Bodies.rectangle(LEFT-25,H/2,50,H+300,options),Bodies.rectangle(RIGHT+25,H/2,50,H+300,options),Bodies.rectangle(W/2,FLOOR+30,W+100,60,options)];Composite.add(engine.world,walls);
}
function fitStage(){
  const scale=Math.min(playRegion.clientWidth/W,playRegion.clientHeight/H);
  if(scale<=0)return;
  // Resizing changes presentation only: never move walls or live physics bodies.
  $('stage').style.width=W*scale+'px';$('stage').style.height=H*scale+'px';
  resize();
}
new ResizeObserver(fitStage).observe(playRegion);fitStage();
function updateSound(){const enabled=soundOn&&!hostMuted;$('sound').setAttribute('aria-pressed',String(enabled));$('sound').setAttribute('aria-label',enabled?'关闭音效':'打开音效');$('sound-icon').src=enabled?'icons/volume-up-fill.svg':'icons/volume-mute-fill.svg';}
updateSound();$('best').textContent=best.toLocaleString();

function dims(level){const s=stages[level-1],r=s.sourceRect,scale=SIZES[level-1]/Math.max(r[2],r[3]);return {w:r[2]*scale,h:r[3]*scale,scale};}
function spawn(level,x,y,{angle=0,merged=false}={}){
  const s=stages[level-1],d=dims(level),[sx,sy,sw,sh]=s.sourceRect;
  const restitution=level<=3?.42:level<=7?.34:.28;
  const parts=s.parts.map(poly=>{
    const v=poly.map(([px,py])=>({x:(px-sx-sw/2)*d.scale,y:(py-sy-sh/2)*d.scale}));
    const c=Vertices.centre(v);
    return Bodies.fromVertices(c.x,c.y,[v],{friction:.48,frictionStatic:.7,restitution,density:.002,slop:.025},false,0,0);
  });
  const body=Body.create({parts,friction:.5,frictionStatic:.7,restitution,frictionAir:.008,sleepThreshold:75});
  const offset={...body.position};
  Body.setPosition(body,{x:x+offset.x,y:y+offset.y});
  if(angle)Body.setAngle(body,angle);
  const a={body,level,d,offset,born:time,visualBorn:time,merged,impact:-9999,impactAngle:0,impactStrength:0,locked:false};
  body.plugin.naiwa=a;actors.set(body.id,a);Composite.add(engine.world,body);
  return a;
}
function visualCenter(a){const c=Math.cos(a.body.angle),s=Math.sin(a.body.angle);return {x:a.body.position.x-a.offset.x*c+a.offset.y*s,y:a.body.position.y-a.offset.x*s-a.offset.y*c};}
function randomLevel(){const n=Math.random();return n<.48?1:n<.82?2:3;}
function clampAim(){if(!ready)return;const d=dims(current);aim=Math.max(LEFT+d.w/2+2,Math.min(RIGHT-d.w/2-2,aim));}
function updateNext(){const s=stages[next-1];$('next-image').src=images[next-1].src;$('next-image').alt=s.name;$('next-name').textContent=s.name;$('next-level').textContent='LV. '+String(next).padStart(2,'0');$('next-block').hidden=false;}
function drop(){
  if(!ready||dead||pauses.size||presentation||autoBatch||rewardQueue.length||time-lastDrop<430)return false;
  unlockAudio();clampAim();const a=spawn(current,aim,64);Body.setVelocity(a.body,{x:0,y:1});
  if(current>highest)highest=current;
  lastDrop=time;dropCount++;current=next;next=dropCount===1?1:randomLevel();updateNext();clampAim();
  if(!reduced)rings.push({x:aim,y:64,life:260,max:260,level:1,drop:true});
  tone(310,0,.1,.055,'sine',115);return true;
}
// Compound bodies emit multiple contacts. Gate by actor and time, and use both
// sides of the pair so wall/body ordering cannot swallow landing feedback.
function impactFeedback(event){
  for(const pair of event.pairs){
    const a=actors.get(pair.bodyA.parent.id),b=actors.get(pair.bodyB.parent.id);
    if((!a&&!b)||a===b||(a&&b&&a.level===b.level&&a.level<11))continue;
    const normal=pair.collision.normal,va=pair.bodyA.parent.velocity,vb=pair.bodyB.parent.velocity;
    const speed=Math.abs((va.x-vb.x)*normal.x+(va.y-vb.y)*normal.y);
    if(speed<1.25)continue;
    let fresh=false;
    for(const actor of [a,b])if(actor&&time-actor.impact>120){actor.impact=time;actor.impactAngle=Math.atan2(normal.y,normal.x);actor.impactStrength=Math.min(.24,.045+speed*.014);fresh=true;}
    if(!fresh)continue;
    const support=pair.collision.supports.find(Boolean);
    if(support)dust(support.x,support.y,Math.min(8,Math.ceil(speed)));
    if(time-lastImpactSound>65&&voices.size<8){tone(130+Math.min(speed,12)*5,0,.075,Math.min(.045,.008+speed*.003),'sine',65);lastImpactSound=time;}
  }
}
function queuePairs(event){
  for(const pair of event.pairs){
    const ba=pair.bodyA.parent,bb=pair.bodyB.parent,a=actors.get(ba.id),b=actors.get(bb.id);
    if(!a||!b||a===b||a.locked||b.locked||a.level!==b.level||a.level===11)continue;
    a.locked=b.locked=true;pending.push([a,b]);
  }
}
Events.on(engine,'collisionStart',impactFeedback);Events.on(engine,'collisionStart',queuePairs);Events.on(engine,'collisionActive',queuePairs);
function popClass(id){const e=$(id);e.classList.remove('show');void e.offsetWidth;e.classList.add('show');}
// Keep multiplier charge separate so excess displayed layers cannot buffer decay.
function baseMultiplier(){return 1+comboBonus*.25;}
function comboMultiplier(){return baseMultiplier()*(frenzyRemaining>0?2:1);}
function updateCombo(){
  $('combo-title').innerHTML=`<span class="layer-count">${chain}</span> 层连击`;
  $('combo-multiplier').textContent='×'+comboMultiplier().toFixed(2);
  $('combo-note').textContent=frenzyRemaining>0?'双倍狂欢 · 最高 10 倍':baseMultiplier()===MAX_COMBO_MULTIPLIER?'倍率已满 · 超时逐层下降':'合成加一层 · 超时减一层';
  $('combo').classList.toggle('show',chain>0);$('combo').classList.toggle('hot',chain>=4);
  $('combo').setAttribute('aria-label',chain?`${chain} 层连击，${comboMultiplier()} 倍得分`:'等待合成');
}
function decayCombo(){
  if(!chain||time<chainDecayAt)return;
  // Keep the deadline anchored so a long frame cannot skip or extend a layer.
  while(chain>0&&time>=chainDecayAt){chain--;comboBonus=Math.max(0,comboBonus-1);chainDecayAt+=CHAIN_WINDOW;}
  if(!chain)chainDecayAt=Infinity;
  updateCombo();
}
function dust(x,y,count){if(reduced)return;for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*1.8,vy:-Math.random(),life:350,max:350,r:1+Math.random()*2,color:'#c7b876'});}
function burst(x,y,level){
  if(!reduced){for(let i=0;i<Math.min(56,12+level*3+chain*2);i++){const t=Math.random()*Math.PI*2,v=1.3+Math.random()*(2.5+level*.2);particles.push({x,y,vx:Math.cos(t)*v,vy:Math.sin(t)*v-1,life:550+Math.random()*300,max:850,r:2+Math.random()*3,star:i%4===0,color:[ACCENTS[level-1],'#edbf46','#fff4b1'][i%3]});}rings.push({x,y,life:500,max:500,level});shake=Math.max(shake,Math.min(7,level>=8?5:chain>=3?3.5:1.2));flash=Math.max(flash,level>=8?.11:0);}
  if(!reduced&&navigator.vibrate&&soundOn&&!hostMuted)navigator.vibrate(level>=8?[20,25,35]:12);
}
// Read actual transformed convex vertices. Matter bounds include velocity padding.
function outlineLimits(actor){
  let minY=Infinity,maxY=-Infinity;
  for(const part of actor.body.parts.slice(1))for(const v of part.vertices){minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
  return {minY,maxY};
}
function removeActor(actor){
  if(!actors.has(actor.body.id))return false;
  Composite.remove(engine.world,actor.body);actors.delete(actor.body.id);
  pending=pending.filter(pair=>{if(!pair.includes(actor))return true;for(const member of pair)if(member!==actor)member.locked=false;return false;});
  return true;
}
function award(amount,kind,data={}){
  if(!amount)return;
  score+=amount;scoreCounter.set(score);
  if(score>best){best=score;writeStorage('best',best);$('best').textContent=best.toLocaleString();$('new-best').hidden=false;}
  sdk?.score(score);
  if(testMode)scoreLedger.push({kind,amount,total:score,...data});
  while(score>=nextScoreNode){pendingFrenzy++;trace('frenzy-earned',{node:nextScoreNode});nextScoreNode+=50000;}
}
function showReward(title,detail=''){$('reward-title').textContent=title;$('reward-detail').textContent=detail;$('reward-detail').hidden=!detail;$('reward-banner').hidden=false;}
function updateFrenzy(){
  const active=frenzyRemaining>0;
  $('frenzy').classList.toggle('active',active);$('frenzy').setAttribute('aria-hidden',String(!active));
  $('frenzy-time').textContent=Math.ceil(frenzyRemaining/1000)+'s';
  $('frenzy-meter').style.transform=`scaleX(${frenzyCapacity?frenzyRemaining/frenzyCapacity:0})`;
  $('stage').classList.toggle('frenzy-active',active);
}
function sweepSound(){
  if(!audio||audio.state!=='running'||!soundOn||hostMuted||pauses.size||voices.size>=20)return;
  const duration=.43,source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),t=audio.currentTime;
  const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  source.buffer=buffer;filter.type='bandpass';filter.Q.value=.8;filter.frequency.setValueAtTime(220,t);filter.frequency.exponentialRampToValueAtTime(2200,t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.17,t+.09);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  source.connect(filter);filter.connect(gain);gain.connect(audioBus);voices.add(source);debutVoices.add(source);
  source.onended=()=>{voices.delete(source);debutVoices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(t);source.stop(t+duration);
}
function rewardSound(kind,index=0){
  if(kind==='clear-hit'){tone(120,0,.12,.1,'sine',38,true);tone(620*2**(Math.min(index,8)/12),0,.16,.09,'triangle',1040,true);return;}
  stopAudio();
  if(kind==='clear-charge'){sweepSound();tone(120,0,.28,.14,'sine',45,true);return;}
  const root=kind==='frenzy'?196:kind==='pair'?220:130.81;
  tone(root*2,0,.095,.045,'triangle',root*4,true);
  tone(kind==='pair'?155:95,.085,.3,kind==='pair'?.13:.2,'sine',38,true);
  tone(1050,.08,.075,.08,'triangle',140,true);
  [1,1.25,1.5,2].forEach((n,i)=>tone(root*2*n,.1+i*.045,.5,.065,'triangle',root*2*n,true));
  tone(root*4,.25,.55,.045,'sine',root*4,true);
}
function rewardImpact(kind,x=W/2,y=H*.42,level=7){
  const strength=kind==='pair'?4.2:kind==='clear-hit'?3.8:kind==='clear-charge'?3.5:kind==='frenzy'?8:7;
  rewardPulses.push({kind,x,y,level,strength,age:0,duration:kind==='clear-hit'?320:760});
  trace('reward-impact',{effect:kind,strength,x,y});
  if(kind!=='clear-hit')rewardSound(kind);
  if(!reduced&&kind!=='clear-charge'){
    const count=kind==='clear-hit'?12:kind==='pair'?20:42;
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2,v=(kind==='clear-hit'?2:4)+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:600,max:600,r:1.4+Math.random()*2,star:i%3===0,color:i%3?'#c79835':'#fff0a5'});}
  }
}
function shatter(actor){
  if(reduced)return;
  const point=visualCenter(actor);rewardParticles.emit(point.x,point.y,Math.max(actor.d.w,actor.d.h));
  const c=visualCenter(actor),angle=actor.body.angle,cos=Math.cos(angle),sin=Math.sin(angle),rect=stages[actor.level-1].sourceRect;
  // Cut the actual character sprite into visible fragments, with no new assets.
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){
    const ox=(col-2)*actor.d.w/5,oy=(row-2)*actor.d.h/5,dx=ox*cos-oy*sin,dy=ox*sin+oy*cos,a=Math.atan2(dy,dx)+(Math.random()-.5)*.5,speed=2.2+Math.random()*3.5;
    fragments.push({level:actor.level,x:c.x+dx,y:c.y+dy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-2,angle,spin:(Math.random()-.5)*.22,w:actor.d.w/5,h:actor.d.h/5,source:[rect[0]+col*rect[2]/5,rect[1]+row*rect[3]/5,rect[2]/5,rect[3]/5],life:440,max:440});
  }
  fragments=fragments.slice(-350);trace('shatter',{id:actor.body.id,level:actor.level});
}
function clearWave(p){const t=Math.max(0,Math.min(1,(p.elapsed/p.duration-.18)/.62));return p.line+(FLOOR-p.line)*t*t;}
function clearAlpha(actor){const p=presentation;if(reduced||p?.kind!=='high'||p.phase!=='clear')return 1;return p.hitTimes?.has(actor.body.id)?0:1;}
function setPresentation(value){texts=[];presentation={elapsed:0,...value};$('reward-banner').dataset.kind=value.kind;$('reward-banner').dataset.phase=value.phase||'';trace(value.kind,{phase:value.phase,level:value.level,node:value.node});}
function startHigh(actor,multiplier,mergeGain){
  milestoneUntil=0;$('milestone').classList.remove('show');
  const level=actor.level,{line,targets}=highClearSnapshot(actor,actors.values(),outlineLimits);
  const first=!celebratedLevels.has(level);celebratedLevels.add(level);
  const data={kind:'high',phase:first?'cheer':'clear',duration:first?900:520,actor,level,line,targets,multiplier,mergeGain,clearGain:0};
  trace('clear-snapshot',{level,line,targets:targets.map(a=>a.body.id),multiplier});
  setPresentation(data);
  if(first){const bonus=2*(2**level*5);award(bonus,'first',{level});trace('first-bonus',{level,bonus});rewardImpact('cheer',...Object.values(visualCenter(actor)),level);showReward(SHORT[level-1]+'，首次登场！','首次奖励 +'+bonus.toLocaleString());}
  else{rewardImpact('clear-charge',W/2,line,level);showReward('清场');}
}
function queueChainReward(){
  if(chain<30)return;
  const node=Math.floor((chain-30)/50)*50+30;
  if(node&& !claimedChainNodes.has(node)){claimedChainNodes.add(node);rewardQueue.push(node);trace('pair-earned',{node});}
}
function mergeActors(a,b,automatic=false){
  if(!actors.has(a.body.id)||!actors.has(b.body.id)||a===b||a.level!==b.level||a.level>=11)return false;
  const p=visualCenter(a),q=visualCenter(b),level=a.level+1,d=dims(level);
  let x=Math.max(LEFT+d.w/2+1,Math.min(RIGHT-d.w/2-1,(p.x+q.x)/2));
  let y=Math.min(FLOOR-d.h/2-2,(p.y+q.y)/2);
  if(!reduced&&!automatic)echoes.push(...[a,b].map(actor=>({level:actor.level,...visualCenter(actor),angle:actor.body.angle,d:actor.d,tx:x,ty:y,life:150,max:150})));
  removeActor(a);removeActor(b);
  const n=spawn(level,x,y,{merged:true});
  const placement=placeMergedBody(n.body,[...actors.values()].filter(a=>a!==n).map(a=>a.body),{left:LEFT,right:RIGHT,floor:FLOOR});
  trace('merge-placement',{level,...placement});n.placement=placement;
  ({x,y}=visualCenter(n));Body.setVelocity(n.body,{x:0,y:-1.65});
  for(const other of actors.values())if(Math.hypot(other.body.position.x-x,other.body.position.y-y)<d.w+80)Sleeping.set(other.body,false);
  chain++;peakChain=Math.max(peakChain,chain);comboBonus=Math.min(16,comboBonus+(chain>1?1:0));chainDecayAt=time+CHAIN_WINDOW;
  roundInheritance.recordMerge(level);
  const multiplier=comboMultiplier(),gained=mergeScore(level,multiplier);
  award(gained,'merge',{level,multiplier,automatic});trace('merge',{level,automatic,consumed:[a.body.id,b.body.id],created:n.body.id});
  queueChainReward();burst(x,y,level);if(automatic)rewardImpact('pair',x,y,level);else mergeSound(level);updateCombo();
  if(level>highest){highest=level;if(level>=5){$('milestone').innerHTML=`<small>${level>=8?'高阶觉醒':'新形态解锁'} · LV. ${String(level).padStart(2,'0')}</small><strong>${stages[level-1].name}</strong>`;milestoneUntil=time+(level>=8?2800:2200);popClass('milestone');}$('announcement').textContent='合成了'+stages[level-1].name;}
  if(level===5)startLaughDebut();
  if(level===11&&!godReached){godReached=true;$('announcement').textContent='奶蛙上帝降临，继续挑战更高分';}
  if(level>=7)startHigh(n,multiplier,gained);
  else texts.push({x:Math.max(70,Math.min(W-70,x)),y,text:'+'+gained,color:ACCENTS[level-1],life:1100,max:1100});
  return true;
}
function selectAutoPairs(node){
  const descending=node%100===30,limit=descending?3:5;
  const available=[...actors.values()].filter(a=>a.level<11&&!a.locked).sort((a,b)=>(descending?b.level-a.level:a.level-b.level)||outlineLimits(b).maxY-outlineLimits(a).maxY||a.body.id-b.body.id);
  const pairs=[];
  for(let i=0;i<available.length-1&&pairs.length<limit;){
    if(available[i].level===available[i+1].level){const pair=[available[i],available[i+1]];pair.forEach(a=>a.locked=true);pairs.push(pair);i+=2;}else i++;
  }
  return pairs;
}
function pumpRewards(){
  if(presentation)return;
  if(pendingFrenzy){
    const nodes=pendingFrenzy;pendingFrenzy=0;frenzyRemaining+=nodes*15000;frenzyCapacity=frenzyRemaining;
    setPresentation({kind:'frenzy',duration:750});showReward('双倍狂欢',`得分 ×2 · 增加 ${nodes*15} 秒`);
    rewardImpact('frenzy',W/2,H*.42,9);updateFrenzy();updateCombo();trace('frenzy-start',{nodes,remaining:frenzyRemaining});return;
  }
  if(autoBatch){
    while(autoBatch.index<autoBatch.pairs.length){
      const pair=autoBatch.pairs[autoBatch.index++];
      if(pair.some(a=>!actors.has(a.body.id))){pair.forEach(a=>a.locked=false);trace('pair-cancelled',{ids:pair.map(a=>a.body.id)});continue;}
      setPresentation({kind:'pair',duration:500,pair,centers:pair.map(visualCenter),node:autoBatch.node});
      showReward(`${autoBatch.node} 层连击奖励`,`${autoBatch.index} / ${autoBatch.pairs.length} 对`);return;
    }
    const finished=autoBatch;trace('batch-end',{node:finished.node});autoBatch=null;setPresentation({kind:'batch-end',duration:500});showReward('自动合成完成',`${finished.completed} 对 · +${(score-finished.startScore).toLocaleString()} 分`);rewardImpact('batch-end',W/2,H*.42,8);return;
  }
  if(rewardQueue.length){
    const node=rewardQueue.shift(),pairs=selectAutoPairs(node);autoBatch={node,pairs,index:0,completed:0,startScore:score};
    trace('batch-selected',{node,pairs:pairs.map(pair=>pair.map(a=>({id:a.body.id,level:a.level,bottom:outlineLimits(a).maxY})))});
    if(!pairs.length){autoBatch=null;setPresentation({kind:'empty',duration:600,node});showReward(`${node} 层连击！`,'当前没有可配对的奶蛙');return;}
    pumpRewards();return;
  }
  $('reward-banner').hidden=true;
}
function finishPresentation(){
  const p=presentation;presentation=null;
  if(p.kind==='pair'&&mergeActors(...p.pair,true)&&autoBatch)autoBatch.completed++;
  if(p.kind==='high'){
    if(p.phase==='cheer'){
      setPresentation({...p,elapsed:0,phase:'clear',duration:520});showReward('清场');rewardImpact('clear-charge',W/2,p.line,p.level);return;
    }
    if(p.phase==='clear'){
      let total=0,count=0;
      for(const a of p.targets)if(actors.has(a.body.id)){
        const amount=Math.round(2**(a.level+1)*5*p.multiplier);
        removeActor(a);award(amount,'clear',{id:a.body.id,level:a.level,multiplier:p.multiplier});total+=amount;count++;
      }
      trace('clear-done',{count,total,line:p.line});rewardImpact('clear-end',W/2,Math.min(FLOOR-20,p.line+80),p.level);
      setPresentation({...p,elapsed:0,phase:'score',duration:650,clearGain:total});showReward(`清场 ${count} 只`,'+'+(p.mergeGain+total).toLocaleString()+' 分');return;
    }
    trace('score-fly-done',{level:p.level});
  }
  pumpRewards();
}
function advancePresentation(dt){
  if(!presentation)return;
  for(const a of actors.values()){a.visualBorn-=dt;a.impact-=dt;}
  tickFeedback(dt);
  presentation.elapsed+=dt;
  if(presentation.kind==='pair'&&!presentation.shattered&&presentation.elapsed>=presentation.duration*.65){presentation.shattered=true;for(const a of presentation.pair){shatter(a);const c=visualCenter(a);rewardImpact('clear-hit',c.x,c.y,a.level);}rewardSound('clear-hit',0);}
  if(presentation.kind==='high'&&presentation.phase==='clear'){
    const p=presentation;p.hitTimes??=new Map();const wave=clearWave(p);
    for(const actor of p.targets)if(!p.hitTimes.has(actor.body.id)&&visualCenter(actor).y<=wave){p.hitTimes.set(actor.body.id,p.elapsed);const c=visualCenter(actor);rewardImpact('clear-hit',c.x,c.y,actor.level);shatter(actor);rewardSound('clear-hit',p.hitTimes.size);trace('clear-hit',{id:actor.body.id});}
  }
  if(presentation.elapsed>=presentation.duration)finishPresentation();
}
function resolveMerges(){
  // Resolve high-tier contacts first in the same physics tick so their snapshot
  // can reserve low-tier contacts before those queued pairs are consumed.
  pending.sort((a,b)=>b[0].level-a[0].level);
  while(pending.length&&!presentation&&!autoBatch&&!rewardQueue.length){
    const [a,b]=pending.shift();
    if(!mergeActors(a,b)){a.locked=b.locked=false;continue;}
    pumpRewards();
  }
}
function settleRound(reason){
  if(roundSettled)return null;
  roundSettled=true;
  roundInheritance.settle();
  if(!dropCount&&!score&&!actors.size)return null;
  const record={score,highest,peakChain,drops:dropCount,duration:Math.round(time/1000),reason,endedAt:Date.now()};
  lastSettlement=record;
  const history=readStorage('rounds',[]);
  writeStorage('rounds',[record,...(Array.isArray(history)?history:[])].slice(0,20));
  writeStorage('lastRound',record);
  community.autoSubmit();
  // End the old SDK round before reset emits started and score(0).
  sdk?.gameover({score,result:reason==='overflow'?'lost':'completed'});
  return record;
}
function settleAndRestart(){
  if(!ready)return;
  const record=settleRound('manual');reset();
  if(record){$('settlement-toast').textContent=`已结算 ${record.score.toLocaleString()} 分 · 新一局开始`;$('settlement-toast').hidden=false;toastRemaining=3000;}
}
function finish(){
  if(dead)return;
  settleRound('overflow');dead=true;updateFrenzy();stopAudio();audioState();
  showModal('over','本局已结算',`<img class="modal-hero" src="${images[highest-1].src}" alt="${stages[highest-1].name}"><span class="result-label">本局得分</span><strong class="modal-score">${score.toLocaleString()}</strong><div class="result-detail"><span>最高形态<b>${SHORT[highest-1]}</b></span><span>最高连击<b>${peakChain} 层</b></span><span>个人最高<b>${best.toLocaleString()}</b></span></div><p class="settlement-note">场地已满，本局成绩已记录。</p>`,[{text:'再来一局',run:reset}]);
}
function step(dt){
  pumpRewards();
  if(presentation){advancePresentation(dt);return;}
  if(frenzyRemaining>0){frenzyRemaining=Math.max(0,frenzyRemaining-dt);updateFrenzy();if(!frenzyRemaining){trace('frenzy-end');updateCombo();tone(660,0,.3,.025,'sine',440);}}
  time+=dt;decayCombo();Engine.update(engine,dt);resolveMerges();
  if(presentation)return;
  if(laughDebut&&debutAge()>=4.2)laughDebut=null;
  if(keys.has('ArrowLeft'))aim-=dt*.28;if(keys.has('ArrowRight'))aim+=dt*.28;clampAim();
  if(pointerId!==null){holdElapsed+=dt;if(holdElapsed>=300){holdRepeated=true;drop();}}
  if(keys.has(' '))drop();
  let risky=false;
  for(const a of actors.values()){
    if(time-a.born>1300&&a.body.bounds.min.y<LINE&&(a.body.isSleeping||a.body.speed<1.5))risky=true;
    if(a.body.position.y>H+200){actors.delete(a.body.id);Composite.remove(engine.world,a.body);}
  }
  dangerTime=risky?dangerTime+dt:Math.max(0,dangerTime-dt*3);
  $('danger').hidden=dangerTime<250;$('danger-count').textContent=Math.max(1,Math.ceil((3200-dangerTime)/1000));
  const warning=dangerTime>=250?Math.ceil((3200-dangerTime)/1000):-1;
  if(warning!==lastWarning){if(warning>=0)tone(440+(3-warning)*70,0,.12,.035,'sine',360);lastWarning=warning;}
  const remaining=chain?Math.max(0,(chainDecayAt-time)/CHAIN_WINDOW):0;
  $('combo-meter').style.transform=`scaleX(${remaining})`;
  if(time>=milestoneUntil)$('milestone').classList.remove('show');
  if(dangerTime>=3200){finish();return;}
  tickFeedback(dt);
}
function tickFeedback(dt){
  rewardParticles.update(dt);
  for(const p of rewardPulses)p.age+=dt;rewardPulses=rewardPulses.filter(p=>p.age<p.duration).slice(-20);
  const rate=dt/(1000/60);
  for(const f of fragments){f.x+=f.vx*rate;f.y+=f.vy*rate;f.vy+=.15*rate;f.angle+=f.spin*rate;f.life-=dt;}fragments=fragments.filter(f=>f.life>0);
  for(const p of particles){p.x+=p.vx*rate;p.y+=p.vy*rate;p.vy+=.045*rate;p.life-=dt;}
  particles=particles.filter(p=>p.life>0).slice(-250);for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);for(const t of texts)t.life-=dt;texts=texts.filter(t=>t.life>0);for(const e of echoes)e.life-=dt;echoes=echoes.filter(e=>e.life>0);shake*=.89;flash*=.93;
}
function reset(){
  if(!ready)return;pauses.delete('capture');closeModal();dead=false;godReached=false;roundSettled=false;roundGeneration++;peakChain=0;toastRemaining=0;$('settlement-toast').hidden=true;pauses.delete('manual');actors.clear();Composite.clear(engine.world,false);Engine.clear(engine);
  walls=[];rebuildWalls();
  presentation=null;autoBatch=null;rewardQueue=[];frenzyRemaining=0;frenzyCapacity=0;nextScoreNode=50000;pendingFrenzy=0;celebratedLevels.clear();claimedChainNodes.clear();rewardLog=[];scoreLedger=[];rewardPulses=[];fragments=[];rewardParticles.reset();$('reward-banner').hidden=true;$('reward-fly').hidden=true;updateFrenzy();
  stopAudio();laughDebut=null;laughDebuted=false;score=0;highest=1;time=0;lastDrop=-1000;chainDecayAt=Infinity;chain=0;comboBonus=0;dropCount=0;current=1;next=1;dangerTime=0;shake=0;flash=0;particles=[];rings=[];texts=[];echoes=[];pending=[];milestoneUntil=0;lastImpactSound=-9999;lastWarning=-1;aim=W/2;accumulator=0;pointerId=null;
  const gift=roundInheritance.startRound();
  $('new-best').hidden=true;sdk?.started();
  if(gift){
    const actor=spawn(gift.level,W/2,FLOOR-dims(gift.level).h/2-2);
    Body.translate(actor.body,{x:0,y:FLOOR-2-outlineLimits(actor).maxY});
    // Opening score is a baseline, not newly crossed frenzy milestones.
    nextScoreNode=(Math.floor(gift.score/50000)+1)*50000;
    highest=gift.level;celebratedLevels.add(gift.level);award(gift.score,'inheritance',{level:gift.level});
    $('announcement').textContent=`继承${SHORT[gift.level-1]}，初始得分 ${gift.score.toLocaleString()}`;
  }
  scoreCounter.set(score,{immediate:true});$('danger').hidden=true;updateCombo();$('combo-meter').style.transform='scaleX(0)';$('milestone').classList.remove('show');updateNext();sdk?.score(score);setPause('manual',false);
}

function roundedRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function drawSprite(level,x,y,w,h,alpha=1){const r=stages[level-1].sourceRect;ctx.globalAlpha=alpha;ctx.drawImage(images[level-1],...r,x,y,w,h);ctx.globalAlpha=1;}
function drawLaughDebut(){
  const overlay=$('classic-debut'),age=debutAge();
  overlay.hidden=!laughDebut||age>=4.2||dead;
  if(overlay.hidden)return;
  overlay.style.opacity=Math.min(1,age/.1,(4.2-age)/.25);
  if(laughFrames.complete&&laughFrames.naturalWidth){
    const frame=reduced?36:Math.min(100,Math.floor(age*24));
    $('debut-animation').getContext('2d').drawImage(laughFrames,(frame%11)*320,Math.floor(frame/11)*180,320,180,0,0,320,180);
  }
}
function drawRewardEffects(){
  if(reduced)return;
  ctx.save();
  for(const p of rewardPulses){
    const t=p.age/p.duration,impact=Math.max(0,(t-.1)/.9),fade=(1-impact)**2;
    if(p.kind==='frenzy'||p.kind==='cheer'){ctx.fillStyle=`rgba(36,28,12,${.12*fade})`;ctx.fillRect(LEFT,0,RIGHT-LEFT,FLOOR);}
    const radius=(p.kind==='clear-hit'?45:p.kind==='pair'?85:190)*(1-(1-impact)**3)+8;
    ctx.globalAlpha=fade;ctx.strokeStyle='#d6a441';ctx.lineWidth=(p.kind==='pair'?4:7)*(1-impact)+.5;
    ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f5d785';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,radius*.78,0,Math.PI*2);ctx.stroke();
    if(p.kind!=='clear-charge'&&p.kind!=='clear-hit')for(let i=0;i<18;i++){const a=i*Math.PI/9,r=radius*.9;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);ctx.lineTo(p.x+Math.cos(a)*(r+25*(1-impact)),p.y+Math.sin(a)*(r+25*(1-impact)));ctx.stroke();}
    if(p.kind==='frenzy'){ctx.textAlign='center';ctx.fillStyle='#b98522';ctx.font=`800 ${78+18*Math.sin(Math.min(1,t*3)*Math.PI/2)}px "Barlow Condensed",sans-serif`;ctx.fillText('×2',p.x,p.y+30);}
  }
  if(presentation?.kind==='pair'){
    const [a,b]=presentation.centers,t=presentation.elapsed/presentation.duration;
    ctx.globalAlpha=.5+.4*t;ctx.strokeStyle='#c89c3b';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.lineDashOffset=-t*45;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,Math.min(a.y,b.y)-28,b.x,b.y);ctx.stroke();
  }
  ctx.restore();
}
function drawRewards(){
  const p=presentation;$('reward-fly').hidden=!(p?.kind==='high'&&p.phase==='score');
  if(!p)return;
  const progress=Math.min(1,p.elapsed/p.duration);
  if(p.kind==='high'&&p.phase==='clear'){
    ctx.save();const wave=clearWave(p);
    ctx.shadowColor='#d6a639';ctx.shadowBlur=18;ctx.strokeStyle='#c58f21';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(LEFT,wave);ctx.lineTo(RIGHT,wave);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#fff2c4';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  if(p.kind==='high'&&p.phase==='score'){
    const stage=canvas.getBoundingClientRect(),target=$('score').getBoundingClientRect(),k=reduced?1:1-(1-progress)**2;
    const from={x:stage.left+stage.width/2,y:stage.top+Math.min(H-35,p.line)*stage.height/H};
    const to={x:target.left+target.width/2,y:target.top+target.height/2};
    const fly=$('reward-fly');fly.textContent='+'+(p.mergeGain+p.clearGain).toLocaleString();fly.style.transform=`translate(${from.x+(to.x-from.x)*k}px,${from.y+(to.y-from.y)*k}px) translate(-50%,-50%) scale(${1-.35*k})`;fly.style.opacity=String(1-progress*.5);
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
  // Boundary positions exactly match the existing physics walls and floor.
  ctx.lineWidth=1;ctx.strokeStyle='#bdbdbd';ctx.beginPath();ctx.moveTo(LEFT,12);ctx.lineTo(LEFT,FLOOR);ctx.lineTo(RIGHT,FLOOR);ctx.lineTo(RIGHT,12);ctx.stroke();
  ctx.beginPath();ctx.moveTo(LEFT-6,FLOOR);ctx.lineTo(RIGHT+6,FLOOR);ctx.stroke();
  ctx.save();if(!reduced&&!pauses.size){if(shake>.1)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);const punch=rewardPulses.reduce((n,p)=>Math.max(n,p.age<85?0:p.strength*Math.max(0,1-(p.age-85)/330)**2),0);ctx.translate(Math.sin(rewardPulses.at(-1)?.age*.11||0)*punch,Math.cos(rewardPulses.at(-1)?.age*.085||0)*punch*.6);}
  ctx.setLineDash([5,7]);ctx.strokeStyle=dangerTime>0?'#b75846':'#c6c6c6';ctx.beginPath();ctx.moveTo(LEFT+8,LINE);ctx.lineTo(RIGHT-8,LINE);ctx.stroke();ctx.setLineDash([]);
  if(dangerTime>=250){ctx.fillStyle=`rgba(201,86,62,${.025+Math.min(.1,dangerTime/30000)})`;ctx.fillRect(LEFT+11,LINE,RIGHT-LEFT-22,Math.min(80,dangerTime/35));}
  if(ready){
    if(!dead&&!presentation){const d=dims(current),cooldown=Math.min(1,(time-lastDrop)/430);
      let aimBottom=FLOOR-6;for(const a of actors.values())if(aim>=a.body.bounds.min.x&&aim<=a.body.bounds.max.x)aimBottom=Math.min(aimBottom,a.body.bounds.min.y-5);
      const aimTop=72+d.h/2;for(let y=aimTop;y<aimBottom;y+=14){ctx.fillStyle=`rgba(150,150,150,${.5*(1-(y-aimTop)/Math.max(1,aimBottom-aimTop))+.08})`;ctx.beginPath();ctx.arc(aim,y,1.8,0,Math.PI*2);ctx.fill();}
      drawSprite(current,aim-d.w/2,64-d.h/2,d.w,d.h,cooldown<1?.35+.35*cooldown:1);}
    for(const a of actors.values()){
      const birthAge=time-a.visualBorn;
      if(a.merged&&birthAge<650&&!reduced){const c=visualCenter(a),r=a.d.w*(.65+birthAge/1300),glow=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,r);glow.addColorStop(0,ACCENTS[a.level-1]+'66');glow.addColorStop(1,ACCENTS[a.level-1]+'00');ctx.globalAlpha=1-birthAge/650;ctx.fillStyle=glow;ctx.fillRect(c.x-r,c.y-r,r*2,r*2);ctx.globalAlpha=1;}
      ctx.save();
      let px=a.body.position.x,py=a.body.position.y;
      if(presentation?.kind==='high'&&presentation.phase==='cheer'&&!reduced){const t=Math.max(0,(presentation.elapsed-90)/810);py-=Math.abs(Math.sin(t*Math.PI*2))*Math.exp(-t*2)*22;}
      // Remote pairs burst in place. Solid sprites never travel through the pile.
      const pairing=presentation?.kind==='pair'&&presentation.pair.includes(a);
      const pairFade=pairing&&presentation.shattered?0:1;
      if(!reduced&&((presentation?.kind==='pair'&&presentation.pair.includes(a))||(presentation?.kind==='high'&&presentation.targets.includes(a)))){ctx.shadowColor='#e3b84c';ctx.shadowBlur=14;}
      ctx.translate(px,py);ctx.rotate(a.body.angle);if(pairing&&!reduced){const t=Math.min(1,presentation.elapsed/(presentation.duration*.65));ctx.scale(1-.1*t,1-.14*t);}
      const impactAge=time-a.impact;
      if(impactAge>=0&&impactAge<420&&!reduced){const t=impactAge/420,squash=Math.sin(t*Math.PI*3)*Math.exp(-3.2*t)*1.5*a.impactStrength,angle=a.impactAngle-a.body.angle;ctx.rotate(angle);ctx.scale(1-Math.max(0,squash),1-Math.max(0,-squash));ctx.rotate(-angle);}
      const age=time-a.visualBorn,s=a.merged&&!reduced?birthScale(age):1;ctx.scale(s,s);
      const clearing=presentation?.kind==='high'&&presentation.phase==='clear'&&presentation.targets.includes(a);
      if(clearing&&!reduced){const gap=visualCenter(a).y-clearWave(presentation),charge=Math.max(0,Math.min(1,1-gap/65));ctx.scale(1-.08*charge,1-.18*charge);}
      drawSprite(a.level,-a.d.w/2-a.offset.x,-a.d.h/2-a.offset.y,a.d.w,a.d.h,clearing?clearAlpha(a):pairFade);ctx.restore();
      if(testMode&&window.__mergeDebug?.outlines){ctx.strokeStyle='#d53';for(const p of a.body.parts.slice(1)){ctx.beginPath();p.vertices.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.stroke();}}
    }
  }
  for(const e of echoes){const k=1-e.life/e.max,s=1-k*.55;ctx.save();ctx.translate(e.x+(e.tx-e.x)*k,e.y+(e.ty-e.y)*k);ctx.rotate(e.angle);drawSprite(e.level,-e.d.w*s/2,-e.d.h*s/2,e.d.w*s,e.d.h*s,(1-k)*.5);ctx.restore();}
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life/200);ctx.fillStyle=p.color;ctx.beginPath();if(p.star){for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?p.r*.4:p.r*1.6;const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}else ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  for(const r of rings){const k=1-r.life/r.max;ctx.globalAlpha=(1-k)**2;ctx.strokeStyle=r.drop?'#bdac6f':ACCENTS[r.level-1];ctx.lineWidth=(r.drop?2:4)*(1-k);ctx.beginPath();ctx.arc(r.x,r.y,(1-(1-k)**3)*(r.drop?25:28+r.level*6)+8,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;ctx.lineWidth=1;
  for(const f of fragments){const k=1-f.life/f.max;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.globalAlpha=Math.min(1,f.life/160);const size=1-k*.5;ctx.drawImage(images[f.level-1],...f.source,-f.w*size/2,-f.h*size/2,f.w*size,f.h*size);ctx.restore();}
  rewardParticles.draw(ctx);drawRewardEffects();
  for(const t of texts){ctx.globalAlpha=Math.min(1,t.life/350);ctx.textAlign='center';ctx.font='900 25px system-ui';ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle='#fffdf0';const y=t.y-(reduced?32:(1-t.life/t.max)*58+18);ctx.strokeText(t.text,t.x,y);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,y);}ctx.globalAlpha=1;ctx.textAlign='left';ctx.lineWidth=1;
  if(flash>.005){ctx.fillStyle=`rgba(255,232,134,${flash})`;ctx.fillRect(0,0,W,H);}
  ctx.restore();
  drawLaughDebut();drawRewards();
  if(pauses.size&&ready&&!modal.open&&!(testMode&&pauses.has('capture'))){ctx.fillStyle='#ffffffb9';ctx.fillRect(0,0,W,H);ctx.fillStyle='#333';ctx.font='700 20px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('游戏已暂停',W/2,H/2);ctx.textAlign='left';}
}
function advanceFrame(elapsed){
  const scaled=Math.max(0,Math.min(50,elapsed))*gameSpeed;
  if(!pauses.size){scoreCounter.tick(scaled);if(toastRemaining>0){toastRemaining=Math.max(0,toastRemaining-scaled);if(!toastRemaining)$('settlement-toast').hidden=true;}}
  if(ready&&!dead&&!pauses.size){
    accumulator+=scaled;
    // Keep the physics step fixed; 2x advances twice as many stable substeps.
    let count=0;while(accumulator>=STEP&&count++<12&&!dead&&!pauses.size){accumulator-=STEP;step(STEP);}
  }else accumulator=0;
}
function frame(now){const elapsed=previousFrame?now-previousFrame:0;previousFrame=now;advanceFrame(elapsed);draw();frameId=requestAnimationFrame(frame);}
function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
resize();window.addEventListener('resize',resize);
function point(event){const r=canvas.getBoundingClientRect();aim=(event.clientX-r.left)/r.width*W;clampAim();}
document.addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard-input'));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('selectstart',e=>e.preventDefault());
canvas.addEventListener('dragstart',e=>e.preventDefault());
// Safari long-press selection is separate from touch-action. Cancel native
// gestures only on the playfield; form inputs and dialog scrolling stay native.
canvas.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{passive:false});
canvas.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(!ready||dead||pauses.size||pointerId!==null||e.button!==0||e.isPrimary===false)return;e.preventDefault?.();pointerId=e.pointerId;holdElapsed=0;holdRepeated=false;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});point(e);unlockAudio();});
canvas.addEventListener('pointermove',e=>{if(pointerId===e.pointerId||e.pointerType==='mouse')point(e);});
canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointerId)return;point(e);pointerId=null;if(!holdRepeated)drop();});
canvas.addEventListener('pointercancel',e=>{if(e.pointerId===pointerId)pointerId=null;});canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===pointerId)pointerId=null;});
document.addEventListener('keydown',e=>{document.documentElement.classList.add('keyboard-input');if(modal.open)return;if(e.target.closest('button,a,input'))return;if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();keys.add(e.key);if(e.key===' '&&!e.repeat)drop();}if(e.key.toLowerCase()==='p'&&!e.repeat)pauseMenu();});
document.addEventListener('keyup',e=>keys.delete(e.key));
document.addEventListener('visibilitychange',()=>setPause('hidden',document.hidden));window.addEventListener('blur',()=>{keys.clear();pointerId=null;});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);stopAudio();audio?.close();sdk?.destroy();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  const rect=button.getBoundingClientRect();
  button.style.setProperty('--tap-x',(e.detail?e.clientX-rect.left:rect.width/2)+'px');
  button.style.setProperty('--tap-y',(e.detail?e.clientY-rect.top:rect.height/2)+'px');
  button.classList.remove('ui-tap');void button.offsetWidth;button.classList.add('ui-tap');
},true);
document.addEventListener('animationend',e=>{if(e.animationName==='button-release')e.target.classList.remove('ui-tap');});
function showModal(kind,title,html,buttons){modalKind=kind;setPause('modal',true);$('modal-title').textContent=title;$('modal-eyebrow').textContent=kind==='over'?'本局记录':kind==='restart'?'保存成绩 · 开始新局':'';$('modal-body').innerHTML=html;$('modal-actions').replaceChildren();for(const [i,b] of buttons.entries()){const btn=document.createElement('button');btn.className=i?'secondary':'primary';btn.textContent=b.text;btn.onclick=b.run;$('modal-actions').append(btn);}$('modal-close').hidden=kind==='over';if(!modal.open)modal.showModal();const content=modal.querySelector('.modal-content');content.classList.remove('ui-enter');void content.offsetWidth;content.classList.add('ui-enter');}
function closeModal(){if(modal.open)modal.close();modalKind='';setPause('modal',false);canvas.focus({preventScroll:true});}
modal.addEventListener('cancel',e=>{e.preventDefault();if(modalKind!=='over')closeModal();});$('modal-close').onclick=()=>{if(modalKind!=='over')closeModal();};
function pauseMenu(){if(!ready||dead)return;showModal('pause','已暂停',`<img class="modal-hero" src="${images[2].src}" alt=""><p>游戏已暂停，计时已冻结。</p>`,[{text:'继续游戏',run:closeModal},{text:'玩法说明',run:()=>$('help').click()}]);}
function requestRestart(){
  if(!ready)return;
  const generation=roundGeneration;
  showModal('restart','结算这一局？',`<span class="result-label">本局得分</span><strong class="modal-score">${score.toLocaleString()}</strong><p>记录本局成绩后，开始新的一局。<br>个人最高纪录会保留。</p>`,[{text:'结算并开始新局',run:()=>{if(roundGeneration===generation&&modalKind==='restart')settleAndRestart();}},{text:'接着玩',run:closeModal}]);
}
$('pause').onclick=pauseMenu;$('restart').onclick=requestRestart;
$('sound').onclick=()=>{soundOn=!soundOn;writeStorage('sound',soundOn);updateSound();unlockAudio();};
$('help').onclick=()=>{if(!ready)return;showModal('help','玩法说明',`<div class="help-list"><p><strong>点击投放 · 长按连投</strong><br>手机拖动瞄准、松手投放；按住投放区即可在冷却结束后持续投放，松手停止。电脑也可按住空格连投。</p><p><strong>倍速 → 全局加速</strong><br>可选 1.0×、1.5×、2.0×。下落、投放冷却、连击衰减、双倍持续时间、满场倒计时与奖励演出统一加速；例如 2.0× 下，15 秒双倍对应现实 7.5 秒。暂停时全部冻结。</p><p><strong>同级相碰 → 进化</strong><br>每次随机出现前 3 级奶蛙。第 11 级是最终形态，达成后继续游戏，不会通关结算。</p><p><strong>接连合成 → 连击加分</strong><br>层数可以持续累计。首次为 1 倍，之后每次合成加 0.25 倍，最高 5 倍；每 2.2 秒无合成，层数减一、倍率减 0.25，最低 1 倍。额外层数不会延缓倍率下降。</p><p><strong>高阶登场 → 向下清场</strong><br>合成 7–11 级时，从该奶蛙轮廓中线向下清场，清除完整轮廓位于中线下方的低阶奶蛙并加分。每局每个高阶首次登场有额外奖励。</p><p><strong>合成高阶 → 下一局继承</strong><br>按本局实际合成的最高阶领取一次：奶蛙帝 → 奶蛙王 + 128,000 分；奶蛙天使 → 奶蛙帝 + 256,000 分；奶蛙上帝 → 奶蛙天使 + 512,000 分。下一局仅赠送一只对应角色；继承本身不触发清场或首次奖励，也不会自动续到再下一局。</p><p><strong>每 5 万分 → 双倍狂欢</strong><br>每个节点增加 15 秒，时间可叠加；合成与清场得分翻倍，最高 10 倍。暂停和奖励演出不消耗时间。</p><p><strong>连击节点 → 自动配对</strong><br>30、130、230……层：从高等级到低等级，最多合成 3 对。80、180、280……层：从低等级到高等级，最多合成 5 对。同等级优先底部，同一节点每局只奖励一次。</p><p><strong>满场结算</strong><br>奶蛙在警戒线上方停留超过 3.2 秒会自动结算。也可主动选择“结算并重新开始”，记录成绩后开始新局。两种结算都会自动提交个人最高分；修改昵称后离开输入框，会同步更改已有排行榜记录的名字。</p></div>`,[{text:'开始游戏',run:closeModal}]);};
function gallery(level){if(!ready)return;if(level){const s=stages[level-1];showModal('gallery',s.name,`<img class="gallery-detail" src="${images[level-1].src}" alt="${s.name}"><p>LV. ${String(level).padStart(2,'0')} ${level===11?'· 最终形态':'· 两只同级奶蛙，进化下一阶'}</p>`,[{text:'继续游戏',run:closeModal},{text:'全部图鉴',run:()=>gallery()}]);return;}showModal('gallery','奶蛙图鉴',`<div class="gallery">${stages.map((s,i)=>`<button data-level="${s.level}"><img src="${images[i].src}" alt=""><small>LV. ${String(s.level).padStart(2,'0')}</small><b>${s.name}</b></button>`).join('')}</div>`,[{text:'继续游戏',run:closeModal}]);$('modal-body').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>gallery(Number(b.dataset.level)));}
$('gallery-button').onclick=()=>gallery();
const community=createCommunity({showModal,closeModal,getScore:()=>best,readStorage,writeStorage});
$('leaderboard-button').onclick=()=>community.leaderboard();
$('feedback-button').onclick=()=>community.feedback();
// Deterministic visual QA fixture; never available in a normal player page.
function previewDesign(){
  if(!testMode||!ready)return;
  reset();
  [[4,65,665],[2,123,674],[1,175,696],[3,240,673],[5,333,648],[7,206,586],[4,296,542],[5,103,557],[3,175,490],[1,280,693],[3,337,475],[1,46,595],[2,57,532],[5,210,380],[4,110,390],[2,305,375],[3,220,250],[1,90,250],[2,140,170]].forEach(([level,x,y])=>spawn(level,x,132+(y-132)*(FLOOR-132)/(711-132)));
  for(let i=0;i<240;i++)step(STEP);
  particles=[];rings=[];texts=[];echoes=[];shake=0;flash=0;laughDebut=null;milestoneUntil=0;$('milestone').classList.remove('show');setPause('capture',true);
  score=21730;best=46395;chain=18;comboBonus=16;chainDecayAt=time+900;current=3;next=3;highest=7;$('new-best').hidden=true;
  scoreCounter.set(21730,{immediate:true});$('best').textContent='46,395';updateNext();updateCombo();$('combo-meter').style.transform='scaleX(.65)';
}
async function init(){
  try{
    const response=await fetch('geometry-'+SPRITE_REVISION+'.json');if(!response.ok)throw new Error('角色轮廓加载失败');stages=(await response.json()).map((s,i)=>({...s,name:NAMES[i]}));
    let loaded=0,loadFailed=false;images=await Promise.all(stages.map(s=>new Promise((resolve,reject)=>{
      const im=new Image(),fail=error=>{loadFailed=true;reject(error);};
      im.onload=()=>{try{assertSpriteImage(s,im);if(!loadFailed)$('loading-detail').textContent=`奶蛙已集合 ${++loaded} / 11`;resolve(im);}catch(error){fail(error);}};
      im.onerror=()=>fail(new Error(s.name+'图片加载失败'));im.src='./assets/naiwa/'+SPRITE_REVISION+'/'+s.sprite;
    })));
    ready=true;$('loading').hidden=true;sdk?.ready();reset();
    if(testMode&&new URLSearchParams(location.search).has('debut')){startLaughDebut();laughDebut.start=time-1500;setPause('capture',true);}
    if(testMode)window.__mergeDebug={outlines:false,state:()=>({ready,levels:stages.length,score,best,highest,current,next,dead,godReached,roundSettled,lastSettlement,peakChain,time,paused:[...pauses],chain,dangerTime,feedback:{emitterParticles:rewardParticles.count,fragments:fragments.length,rewardPulses:rewardPulses.map(p=>({kind:p.kind,age:p.age,strength:p.strength})),particles:particles.length,echoes:echoes.length,rings:rings.length,voices:voices.size,debut:{active:!!laughDebut,sfxVoices:debutVoices.size,seen:laughDebuted,age:debutAge(),started:laughDebut?.start,framesReady:!!laughFrames.naturalWidth},comboMultiplier:comboMultiplier(),comboRemaining:chain?Math.max(0,chainDecayAt-time):0,milestoneUntil},rewards:{presentation:presentation?{kind:presentation.kind,phase:presentation.phase,elapsed:presentation.elapsed,line:presentation.line,targets:presentation.targets?.map(a=>a.body.id),pair:presentation.pair?.map(a=>a.body.id),shattered:presentation.shattered}:null,frenzyRemaining,pendingFrenzy,nextScoreNode,baseMultiplier:baseMultiplier(),celebrated:[...celebratedLevels],claimed:[...claimedChainNodes],queued:[...rewardQueue],batch:!!autoBatch,log:rewardLog,ledger:scoreLedger},world:{width:W,height:H,floor:FLOOR,line:LINE},bodyCount:actors.size,bodies:[...actors.values()].map(a=>({id:a.body.id,level:a.level,position:{...a.body.position},velocity:{...a.body.velocity},angle:a.body.angle,bounds:a.body.bounds,placement:a.placement,birthScale:birthScale(time-a.visualBorn),locked:a.locked,outline:outlineLimits(a),parts:a.body.parts.length,area:a.body.area,width:a.d.w,height:a.d.h,impact:a.impact,impactAngle:a.impactAngle,impactStrength:a.impactStrength})),audio:audio?.state,soundOn,hostMuted}),overlapReport:()=>[...actors.values()].map(a=>({id:a.body.id,level:a.level,depth:overlapDepth(a.body,[...actors.values()].filter(b=>b!==a).map(b=>b.body))})),rewardSeed:({points=0,layers=0,bonus=0,frenzy=0,seen=[]}={})=>{score=points;scoreCounter.set(score,{immediate:true});chain=layers;peakChain=layers;comboBonus=bonus;chainDecayAt=time+CHAIN_WINDOW;frenzyRemaining=frenzy;frenzyCapacity=frenzy;nextScoreNode=(Math.floor(score/50000)+1)*50000;seen.forEach(l=>celebratedLevels.add(l));updateCombo();updateFrenzy();},awardTest:amount=>award(amount,'test'),previewDesign,previewScore:(value,immediate=false)=>scoreCounter.set(value,{immediate}),spawn:(level,x,y,options)=>spawn(level,x,y,options).body.id,drop,reset,setPause,velocity:(id,v)=>Body.setVelocity(actors.get(id).body,v),clear:()=>{for(const a of actors.values())Composite.remove(engine.world,a.body);actors.clear();pending=[];},freeze:id=>{const a=actors.get(id);Body.setStatic(a.body,true);a.born=time-2000;},advance:ms=>{for(let t=0;t<ms&&!dead&&!pauses.size;t+=STEP)step(STEP);},setCurrent:l=>{current=l;clampAim();},setAim:x=>{aim=x;clampAim();},parts:id=>actors.get(id)?.body.parts.slice(1).map(p=>p.vertices.map(v=>({x:v.x,y:v.y}))),finish};
  }catch(error){$('loading-detail').textContent=error.message;const b=document.createElement('button');b.textContent='重新加载';b.onclick=()=>location.reload();$('loading').append(b);sdk?.error(error.message);console.error(error);}
}
frameId=requestAnimationFrame(frame);init();
