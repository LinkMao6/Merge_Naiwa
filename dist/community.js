export function createCommunity({showModal,closeModal,getScore,readStorage,writeStorage}) {
  const $=id=>document.getElementById(id);
  let nickname=readStorage('nickname','');
  const entries=()=>readStorage('localLeaderboard',[]).filter(e=>typeof e.name==='string'&&Number.isFinite(e.score)).sort((a,b)=>b.score-a.score).slice(0,50);
  function save(name) {
    nickname=name.trim().slice(0,32);if(!nickname)return false;
    writeStorage('nickname',nickname);
    const rows=entries(),existing=rows.find(e=>e.name===nickname);
    if(existing)existing.score=Math.max(existing.score,getScore());else rows.push({name:nickname,score:getScore()});
    writeStorage('localLeaderboard',rows.sort((a,b)=>b.score-a.score).slice(0,50));return true;
  }
  function bind(form,input,message) {
    input.value=nickname;
    form.onsubmit=e=>{e.preventDefault();if(save(input.value)){message.textContent='最高成绩已保存到本机排行榜';$('quick-ranking-name').value=nickname;renderRows();}else{message.textContent='请填写昵称';input.focus();}};
  }
  function renderRows() {
    const list=$('ranking-list');if(!list)return;list.replaceChildren();
    const rows=entries();$('ranking-summary').textContent=`本机榜单 · ${rows.length} 位玩家`;
    if(!rows.length){const p=document.createElement('p');p.textContent='暂无成绩，填写昵称即可记录。';list.append(p);}
    rows.forEach((entry,i)=>{const row=document.createElement('li');row.className='ranking-row'+(entry.name===nickname?' is-me':'');for(const [tag,value] of [['span',String(i+1).padStart(2,'0')],['b',entry.name],['strong',entry.score.toLocaleString()]]){const el=document.createElement(tag);el.textContent=value;row.append(el);}list.append(row);});
  }
  function leaderboard() {
    showModal('leaderboard','本机排行榜','<p id="ranking-summary" class="community-note"></p><ol id="ranking-list" class="ranking-list"></ol><form id="ranking-form" class="community-form"><label for="ranking-name">上榜昵称</label><div class="submit-row"><input id="ranking-name" maxlength="32" required placeholder="输入昵称"><button type="submit" class="submit-button">保存成绩</button></div><p class="community-note">成绩保存在此浏览器，多人可轮流使用不同昵称。清除浏览器数据会删除榜单。</p><p id="ranking-message" class="form-message" role="status"></p></form>',[{text:'返回游戏',run:closeModal}]);
    renderRows();bind($('ranking-form'),$('ranking-name'),$('ranking-message'));
  }
  function feedback() {
    showModal('feedback','意见记录','<form id="feedback-form" class="community-form"><label for="feedback-message">记录问题或建议</label><textarea id="feedback-message" rows="6" maxlength="2000" required placeholder="描述你遇到的问题或建议"></textarea><p class="community-note">记录仅保存在此浏览器，可导出交给开发者。</p><button type="submit" class="submit-button">保存并导出</button><p id="feedback-status" class="form-message" role="status"></p></form>',[{text:'返回游戏',run:closeModal}]);
    $('feedback-message').value=readStorage('feedbackDraft','');$('feedback-message').oninput=()=>writeStorage('feedbackDraft',$('feedback-message').value);
    $('feedback-form').onsubmit=e=>{e.preventDefault();const message=$('feedback-message').value.trim();if(!message)return;writeStorage('feedbackDraft',message);const url=URL.createObjectURL(new Blob([message],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='奶蛙意见.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('feedback-status').textContent='已保存，并导出文字文件';};
  }
  bind($('quick-ranking-form'),$('quick-ranking-name'),$('quick-ranking-message'));
  return {leaderboard,feedback,autoSubmit:()=>{if(nickname&&getScore()>0)save(nickname);}};
}
