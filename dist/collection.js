// One unlock ledger shared by the encyclopedia and companion.
export function createCollection({stages,readStorage,writeStorage,onUnlock=()=>{}}){
  const valid=id=>Number.isInteger(id)&&stages.some(s=>s.level===id);
  let unlocked;
  function load(){
    const saved=readStorage('collection',null);
    unlocked=new Set((Array.isArray(saved?.unlocked)?saved.unlocked:[1]).filter(valid));
    unlocked.add(1);
    if(saved===null){
      const history=readStorage('rounds',[]),last=readStorage('lastRound',null);
      const highest=Math.max(1,...[...(Array.isArray(history)?history:[]),last].map(r=>valid(r?.highest)?r.highest:1));
      for(let id=1;id<=highest;id++)unlocked.add(id);
    }
  }
  load();
  return {has:id=>unlocked.has(id),ids:()=>[...unlocked].sort((a,b)=>a-b),reload:load,
    unlock(id){if(!valid(id)||unlocked.has(id))return false;unlocked.add(id);writeStorage('collection',{version:1,unlocked:[...unlocked]});onUnlock(id);return true;}};
}
