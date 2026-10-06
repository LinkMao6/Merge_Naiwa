export const PET_STATES=['IDLE','LOOKING','HAPPY','EXCITED','SLEEPING','SCARED','SAD','PETTING','ANNOYED'];
export function createPetManager({collection,readStorage,writeStorage,view,random=Math.random}){
  let pendingSelf=false,pendingUnlock=false,pendingCombo=0;
  let selectedId=1,state='IDLE',previousState='IDLE',clock=0,until=0,lastEvent=0,idleAt=6000,sleepAt=30000,cooldown=0,clickAt=-Infinity,clickCount=0,comboBand=0,easterAt=-Infinity,paused=false,danger=false,ended=false,aim=0,look=0,reactions=0,variant='';
  const enter=(next,duration=220,symbols=[],style='')=>{previousState=state;state=next;until=clock+duration;variant=style;reactions++;view.show(state,symbols,style);};
  function reset(){pendingSelf=false;pendingUnlock=false;pendingCombo=0;state='IDLE';previousState='IDLE';until=0;lastEvent=clock;idleAt=clock+4000+random()*5000;sleepAt=clock+20000+random()*20000;cooldown=0;clickAt=-Infinity;clickCount=0;comboBand=0;easterAt=-Infinity;danger=false;ended=false;variant='';view.show(state,[],'');view.cancel?.();}
  function select(id,persist=true){if(!collection.has(id))return false;selectedId=id;reset();view.select(id);if(persist)writeStorage('pet',{selectedId:id});return true;}
  function reload(){collection.reload();const id=readStorage('pet',null)?.selectedId;select(collection.has(id)?id:1,false);}
  reload();
  return {select,reload,reset,get selectedId(){return selectedId;},
    snapshot:()=>({selectedId,state,previousState,paused,danger,ended,clickCount,comboBand,reactions,variant}),
    lookAt(value){aim=Math.max(-1,Math.min(1,value*2-1));},
    setPaused(value){paused=value;view.pause(value);if(value)view.cancel?.();},
    react(type,data={}){
      if(type==='NEAR_GAME_OVER'){if(data.active===false){danger=false;if(state==='SCARED'){state='IDLE';view.show(state,[],'');}}else if(!danger){danger=true;enter('SCARED',900,['！']);}return;}
      if(type==='GAME_OVER'){ended=true;danger=false;enter('SAD',2400,[]);return;}
      if(ended||paused)return;
      if(type==='COMBO_RESET'){comboBand=0;pendingCombo=0;return;}
      lastEvent=clock;sleepAt=clock+20000+random()*20000;
      if(type==='NEW_HIGH_SCORE'){enter('EXCITED',1600,['✨','✨','！'],'record');cooldown=clock+1600;return;}
      if(type==='COMBO'||type==='HIGH_COMBO'){
        const band=data.chain>=8?4:data.chain>=5?3:data.chain>=3?2:1;
        if(band<=comboBand)return;
        if(clock<cooldown&&(variant==='record'||variant==='self'||state==='PETTING'||danger)){pendingCombo=Math.max(pendingCombo,band);return;}
        comboBand=band;
        enter(band>=3?'EXCITED':'HAPPY',band===4?1400:band===3?900:band===2?450:220,band>=3?['✨']:[],band===4?'combo':'');cooldown=clock+400;return;
      }
      if(type==='MERGE'&&data.level===selectedId&&clock-easterAt>=6000&&clock>=cooldown){easterAt=clock;enter('EXCITED',850,['！','？'],'self');cooldown=clock+850;return;}
      if(clock<cooldown||danger){if(type==='NEW_CHARACTER_UNLOCKED')pendingUnlock=true;if(type==='MERGE'&&data.level===selectedId&&clock-easterAt>=6000)pendingSelf=true;return;}
      if(type==='MERGE'||type==='HIGH_LEVEL_MERGE'){enter('HAPPY',220);cooldown=clock+400;}
      else if(type==='NEW_CHARACTER_UNLOCKED'){enter('LOOKING',900,['！']);cooldown=clock+400;}
      else if(type==='DROP'&&state==='SLEEPING'){enter('LOOKING',500,['？']);cooldown=clock+400;}
    },
    click(){if(paused||ended)return;const gap=clock-clickAt;clickCount=gap<1100?clickCount+1:1;clickAt=clock;lastEvent=clock;if(gap<180&&!(clickCount>=6&&variant!=='dodge'))return;
      if(clickCount>=3){enter('ANNOYED',2000,['？'],clickCount>=6?'dodge':'');cooldown=clock+400;}
      else {const n=Math.floor(random()*3);enter(n===0?'HAPPY':n===1?'LOOKING':'ANNOYED',n===2?1500:750,[n===0?'♥':'？'],n===2?'dodge':'');cooldown=clock+400;}
    },
    pet(){if(paused||ended||clock<cooldown)return false;lastEvent=clock;clickCount=0;enter('PETTING',1100,['♥','♥','♥']);cooldown=clock+1100;return true;},
    update(dt){if(paused)return;clock+=Math.max(0,dt);look+=(aim-look)*(1-Math.exp(-dt/300));view.look(look);
      if(until&&clock>=until){until=0;state=danger?'SCARED':'IDLE';view.show(state,[],danger?'worried':'');}
      if(ended||danger||until)return;
      if(clock>=cooldown){
        if(pendingSelf){pendingSelf=false;easterAt=clock;enter('EXCITED',850,['！','？'],'self');cooldown=clock+850;return;}
        if(pendingCombo>comboBand){comboBand=pendingCombo;pendingCombo=0;enter(comboBand>=3?'EXCITED':'HAPPY',comboBand>=3?1400:220,comboBand>=3?['✨']:[],comboBand>=3?'combo':'');cooldown=clock+400;return;}
        if(pendingUnlock){pendingUnlock=false;enter('LOOKING',900,['！']);cooldown=clock+900;return;}
      }
      if(clock>=sleepAt&&clock-lastEvent>=20000){sleepAt=clock+25000;if(random()<.55){enter('SLEEPING',6000,['Z','z']);return;}}
      if(clock>=idleAt){idleAt=clock+4000+random()*5000;enter('LOOKING',900,[],'idle');}
    },
    destroy(){view.destroy?.();}
  };
}

export function createPetView({root,stages,images,reduced,onClick,onPet}){
  root.innerHTML='<div class="pet-bubbles" aria-hidden="true"><i></i><i></i><i></i></div><div class="pet-look"><button class="pet-body" type="button"><canvas></canvas></button></div><span class="pet-platform" aria-hidden="true"></span><small class="pet-caption"></small>';
  const button=root.querySelector('button'),canvas=button.querySelector('canvas'),look=root.querySelector('.pet-look'),bubbles=[...root.querySelectorAll('i')],controller=new AbortController();
  let gesture=null,lastLook='';
  const cancel=()=>{if(gesture&&button.hasPointerCapture(gesture.id))button.releasePointerCapture(gesture.id);gesture=null;};
  button.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false||gesture)return;e.preventDefault();e.stopPropagation();const r=button.getBoundingClientRect();gesture={id:e.pointerId,start:performance.now(),x:e.clientX,distance:0,head:e.clientY<r.top+r.height*.58,petted:false};button.setPointerCapture(e.pointerId);},{signal:controller.signal});
  button.addEventListener('pointermove',e=>{if(gesture?.id!==e.pointerId)return;e.preventDefault();gesture.distance+=Math.abs(e.clientX-gesture.x);gesture.x=e.clientX;if(gesture.head&&!gesture.petted&&performance.now()-gesture.start>350&&gesture.distance>=18)gesture.petted=onPet();},{signal:controller.signal});
  button.addEventListener('pointerup',e=>{if(gesture?.id!==e.pointerId)return;e.preventDefault();const click=!gesture.petted&&gesture.distance<12;cancel();if(click)onClick();},{signal:controller.signal});
  for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,cancel,{signal:controller.signal});
  button.addEventListener('click',e=>{if(e.detail===0)onClick();},{signal:controller.signal});
  return {cancel,
    select(id){const s=stages[id-1],r=s.sourceRect,ratio=r[2]/r[3];canvas.width=Math.round(220*Math.min(1,ratio));canvas.height=Math.round(220*Math.min(1,1/ratio));canvas.getContext('2d').drawImage(images[id-1],...r,0,0,canvas.width,canvas.height);button.style.aspectRatio=String(ratio);button.style.setProperty('--pet-ratio',Math.min(1,ratio));button.setAttribute('aria-label',s.name+'，点击互动，按住头部左右移动可以摸头');root.querySelector('small').textContent=s.name;root.dataset.selected=String(id);},
    show(state,symbols,variant){root.dataset.state=state;root.dataset.variant=variant;button.style.animation='none';void button.offsetWidth;button.style.animation='';bubbles.forEach((b,i)=>{b.textContent=symbols[reduced&&i>0?99:i]||'';b.classList.remove('pop');if(b.textContent){void b.offsetWidth;b.classList.add('pop');}});},
    pause(value){root.classList.toggle('pet-paused',value);},look(value){const next=reduced?'none':`translateX(${(value*2).toFixed(1)}px) rotate(${(value*2.5).toFixed(1)}deg)`;if(next!==lastLook){look.style.transform=next;lastLook=next;}},
    destroy(){cancel();controller.abort();root.replaceChildren();}
  };
}
