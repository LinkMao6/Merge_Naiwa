export const EMPEROR_LEVEL=9;
export const EMPEROR_START_SCORE=128000;
export function mergeScore(level,multiplier=1){return Math.round(2**level*5*multiplier);}

// The highest actual emperor-or-higher merge earns one lower-tier opening gift.
// Consume the persisted gift when starting a round, including after a page reload.
export function createRoundInheritance({readStorage,writeStorage}){
  const validLevel=level=>Number.isInteger(level)&&level>=EMPEROR_LEVEL&&level<=11;
  const saved=readStorage('emperorNextRound',false);
  // Migrate the old boolean emperor reward without losing an already earned gift.
  let pending=saved===true?EMPEROR_LEVEL:validLevel(saved)?saved:0,earned=0,settled=false;
  return {
    recordMerge(level){if(!settled&&validLevel(level))earned=Math.max(earned,level);},
    settle(){
      if(settled)return;
      settled=true;pending=earned;writeStorage('emperorNextRound',pending||false);
    },
    startRound(){
      const gift=pending?{level:pending-1,score:EMPEROR_START_SCORE*2**(pending-EMPEROR_LEVEL)}:null;
      pending=0;earned=0;settled=false;writeStorage('emperorNextRound',false);
      return gift;
    },
  };
}

export function highClearSnapshot(actor,candidates,outlineLimits){
  const outline=outlineLimits(actor),line=(outline.minY+outline.maxY)/2;
  const targets=[...candidates].filter(a=>a!==actor&&a.level<actor.level&&outlineLimits(a).minY>line);
  return {line,targets};
}
