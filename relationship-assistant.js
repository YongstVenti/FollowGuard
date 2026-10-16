(async()=>{
  if(window.__echoBlueRelationshipAssistant)return;window.__echoBlueRelationshipAssistant=true;
  let base;try{base=chrome.runtime.getURL('');}catch{return;}
  const {handleOf,listScope,isBlueColor,relationshipMark}=await import(base+'relationship-core.js').catch(()=>({}));if(!handleOf)return;
  const {detectedAccount,listPage}=await import(base+'identity.js');
  let config={enabled:true,tintRows:true},identity='',running=false,closed=false,lastPoll=0,lastSnapshot=0,snapshot=null,lastSnapshotWrite=0,scheduled,lastRowCount=0,lastCounts={follow:0,unfollow:0,check:0};
  // Native paint stays attached to X's own row, and creates no click-catching overlay.
  const rowStyle=document.createElement('style');rowStyle.id='echo-blue-row-style';
  rowStyle.textContent='body[data-ae-relations-layout] [data-testid=UserCell]{padding-bottom:32px!important;position:relative}[data-echo-blue-kind]{box-shadow:inset 5px 0 var(--echo-blue-accent),inset 0 0 0 2px var(--echo-blue-accent)!important;border-radius:9px}[data-echo-blue-kind][data-echo-blue-tint]{box-shadow:inset 5px 0 var(--echo-blue-accent),inset 0 0 0 2px var(--echo-blue-accent),inset 0 0 0 9999px var(--echo-blue-tint)!important}[data-echo-blue-static]{position:relative!important}[data-echo-blue-kind]::after{content:attr(data-echo-blue-label);position:absolute;bottom:3px;right:7px;background:var(--echo-blue-accent);color:white;padding:1px 8px;border-radius:5px;font:600 11px/1.6 system-ui;pointer-events:none;z-index:1;white-space:nowrap}[data-echo-blue-kind=follow]{--echo-blue-accent:#0969c7;--echo-blue-tint:rgba(29,155,240,.13)}[data-echo-blue-kind=unfollow]{--echo-blue-accent:#b94724;--echo-blue-tint:rgba(219,92,51,.13)}[data-echo-blue-kind=check]{--echo-blue-accent:#d39512;--echo-blue-tint:rgba(255,208,64,.13)}[data-echo-blue-kind=check]::after{color:#342500}';
  document.documentElement.append(rowStyle);
  const painted=new Set();
  let notes=Object.create(null),lastNotesPoll=0;
  const noteHosts=new Map();
  function clearNoteHosts(){for(const host of noteHosts.values())host.remove();noteHosts.clear();}
  const pendingMarks=new Map();
  function drawNotes(rows){
    const next=new Set();for(const cell of rows){const state=stateOf(cell);if(!state?.button)continue;next.add(cell);let host=noteHosts.get(cell);
      if(!host||host.parentElement!==cell){host?.remove();host=document.createElement('span');host.className='ae-person-note';const shadow=host.attachShadow({mode:'open'});
        shadow.innerHTML='<style>:host{position:absolute;z-index:2;line-height:0}button{display:flex;align-items:center;justify-content:center;width:var(--ae-size);height:var(--ae-size);padding:0;border:var(--ae-border);border-radius:50%;color:var(--ae-fg);background:var(--ae-bg);cursor:pointer;box-sizing:border-box}button:hover{box-shadow:inset 0 0 0 999px #88888815}button[aria-pressed=true]{background:var(--ae-fg);color:var(--ae-inverse);border-color:var(--ae-fg)}svg{width:46%;height:46%;pointer-events:none}button[aria-pressed=true] .cloth{fill:currentColor}button:disabled{cursor:wait;opacity:.7}button:focus-visible{outline:2px solid var(--ae-fg);outline-offset:4px}</style><button type="button" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V3"/><path class="cloth" d="M5 4c5-4 9 4 14 0v10c-5 4-9-4-14 0z"/></svg></button>';
        shadow.querySelector('button').addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();const handle=host.dataset.handle;if(pendingMarks.has(handle))return;pendingMarks.set(handle,!notes[handle]?.marked);renderLocal();try{notes=await send({type:'TOGGLE_MARK',handle});lastNotesPoll=Date.now();}catch(error){host.shadowRoot.querySelector('button').title=error.message;}finally{pendingMarks.delete(handle);renderLocal();}});
        cell.append(host);noteHosts.set(cell,host);
      }
      host.dataset.handle=state.handle;const button=host.shadowRoot.querySelector('button'),note=notes[state.handle],marked=pendingMarks.has(state.handle)?pendingMarks.get(state.handle):!!note?.marked;
      button.setAttribute('aria-pressed',String(marked));button.disabled=pendingMarks.has(state.handle);button.title=(marked?'已标注 @':'标注 @')+state.handle+(note?.text?' · '+note.text:'')+'（点击'+(marked?'熄灭':'点亮')+'旗帜）';button.setAttribute('aria-label',(marked?'取消标注 @':'标注 @')+state.handle);
      const action=state.button.getBoundingClientRect(),row=cell.getBoundingClientRect(),size=action.height;
      host.style.left=(action.left-row.left-cell.clientLeft-size-16)+'px';host.style.top=(action.top-row.top-cell.clientTop)+'px';host.style.setProperty('--ae-size',size+'px');const textColor=getComputedStyle(cell).color.match(/[\d.]+/g)||[],dark=Number(textColor[0])*.2126+Number(textColor[1])*.7152+Number(textColor[2])*.0722>128;
      host.style.setProperty('--ae-fg',dark?'#eff3f4':'#0f1419');host.style.setProperty('--ae-bg','transparent');host.style.setProperty('--ae-border','1px solid '+(dark?'#536471':'#cfd9de'));host.style.setProperty('--ae-inverse',dark?'#0f1419':'#fff');
    }
    for(const [cell,host]of noteHosts)if(!next.has(cell)){host.remove();noteHosts.delete(cell);}
  }

  function clearCell(cell){for(const name of ['kind','label','handle','static','tint'])cell.removeAttribute('data-echo-blue-'+name);}
  function clearMarks(){for(const cell of painted)clearCell(cell);painted.clear();lastCounts={follow:0,unfollow:0,check:0};}
  function scene(){const page=listPage(location.pathname),who=account(),ownList=!!page&&who===page.owner;return {connected:!!page,account:who,list:page?.kind||'',owner:page?.owner||'',ownList,enabled:config.enabled!==false,ready:ownList&&lastRowCount>0,counts:ownList?lastCounts:{follow:0,unfollow:0,check:0},reason:closed?'扩展已更新，请刷新页面':!page?'当前不是关注或粉丝列表':!who?'等待识别左下角登录账号':!ownList?'已连接他人列表，仅在本人名单标注':config.enabled===false?'标注已暂停':lastRowCount?'正在标注可见蓝标账号':'已连接，等待名单加载'};}
  function publish(){document.dispatchEvent(new CustomEvent('ae-relations-state',{detail:scene()}));}
  function disconnect(){document.body.removeAttribute('data-ae-relations-layout');closed=true;clearNoteHosts();clearInterval(timer);cancelAnimationFrame(scheduled);observer.disconnect();clearMarks();publish();}
  async function send(message){try{if(!chrome.runtime?.id)throw new Error('Extension context invalidated');const result=await chrome.runtime.sendMessage(message);if(!result?.ok)throw new Error(result?.error||'连接失败');return result.data;}catch(error){try{if(!chrome.runtime?.id||/context invalidated/i.test(error.message))disconnect();}catch{disconnect();}throw error;}}
  const visible=element=>{if(!element?.isConnected||getComputedStyle(element).visibility==='hidden')return false;const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight;};
  const account=()=>detectedAccount();
  const current=()=>({account:account(),scope:listScope(location.pathname,account())});
  function regionLabel(node){const ids=(node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);return [node.getAttribute('aria-label')||'',...ids.map(id=>document.getElementById(id)?.textContent||'')].join(' ').trim();}
  const recommendation=/who to follow|you might like|suggested|recommended|推荐关注|推荐用户|你可能喜欢|为你推荐/i;
  function cells(scope){
    const pattern=scope==='followers'?/\bfollowers\b|粉丝|关注者/i:/\bfollowing\b|正在关注|关注列表|(?:^|[：:\s])关注$/i;
    // X uses both aria-label and aria-labelledby timelines; some layouts have neither.
    // The verified own-list route already establishes scope, so the primary column is
    // a read-only fallback. Never include right-rail recommendations or modal users.
    const main=document.querySelector('main,[role="main"]');if(!main)return [];
    const column=main.querySelector('[data-testid="primaryColumn"]')||main;
    const sections=[...column.querySelectorAll('section,[role="region"]')].filter(section=>pattern.test(regionLabel(section))&&!recommendation.test(regionLabel(section)));
    const roots=sections.length?sections:[column];
    return [...new Set(roots.flatMap(root=>[...root.querySelectorAll('[data-testid="UserCell"]'),...root.querySelectorAll('[data-testid="cellInnerDiv"]')].filter(cell=>cell.matches('[data-testid="UserCell"]')||!cell.querySelector('[data-testid="cellInnerDiv"],[data-testid="UserCell"]'))))].filter(cell=>{
      if(!visible(cell)||cell.closest('aside,[role="dialog"],[role="alertdialog"],[data-testid="UserRecommendations"],[data-testid="follow-recommendations"]'))return false;
      for(let parent=cell.parentElement;parent&&parent!==column;parent=parent.parentElement)if(recommendation.test(regionLabel(parent)))return false;
      const root=roots.find(root=>root.contains(cell));return ![...root.querySelectorAll('h1,h2,h3,[role="heading"]')].some(heading=>!heading.closest('aside')&&recommendation.test(heading.textContent)&&!!(heading.compareDocumentPosition(cell)&Node.DOCUMENT_POSITION_FOLLOWING));
    });
  }
  function belongsToCell(node,cell){const owner=node.closest('[data-testid="UserCell"]');return owner?owner===cell:cell.contains(node)&&!cell.querySelector('[data-testid="UserCell"]');}
  function stateOf(cell){
    const links=[...cell.querySelectorAll('a[href]')].filter(link=>belongsToCell(link,cell)&&!link.closest('[data-testid="UserDescription"],.ae-person-note'));
    const handle=links.map(link=>handleOf(link.getAttribute('href')?.match(/^\/([a-z0-9_]+)\/?$/i)?.[1])).find(Boolean);if(!handle)return null;
    const buttons=[...cell.querySelectorAll('button,[role="button"]')].filter(button=>belongsToCell(button,cell)&&visible(button));
    let button,following='unknown';for(const item of buttons){const label=(item.getAttribute('aria-label')||item.innerText||'').trim(),handles=label.toLowerCase().match(/@[a-z0-9_]+/g),testid=item.dataset.testid||'';if(handles&&!handles.includes('@'+handle))continue;if(/pending|requested|已请求|请求中/i.test(label))continue;if(/(?:^|-)unfollow$/.test(testid)||/^(?:Following|已关注|正在关注)(?:\s|$)/i.test(label)){button=item;following='following';break;}if(/(?:^|-)follow$/.test(testid)||/^(?:Follow(?: back)?|关注|回关)(?:\s|$)/i.test(label)){button=item;following='not-following';}}
    // The UserCell itself is frequently a button/role=button. Its verified icon
    // remains part of the identity, rather than an action icon to be excluded.
    const badges=[...cell.querySelectorAll('svg[data-testid="icon-verified"],svg[aria-label="Verified account"],svg[aria-label="认证账号"]')].filter(badge=>belongsToCell(badge,cell)&&!badge.closest('[data-testid="UserDescription"]')&&visible(badge));
    const blue=badges.some(badge=>{const link=badge.closest('a[href]');if(link&&!links.includes(link))return false;if(link&&handleOf(link.getAttribute('href')?.match(/^\/([a-z0-9_]+)\/?$/i)?.[1])!==handle)return false;const fill=getComputedStyle(badge.querySelector('path')||badge).fill;return isBlueColor(fill)||(!fill||fill==='none')&&isBlueColor(getComputedStyle(badge).color);});
    let indicator=[...cell.querySelectorAll('[data-testid="userFollowIndicator"]')].filter(visible).map(item=>item.innerText.trim()).join(' ');
    if(!indicator)indicator=[...cell.querySelectorAll('span')].filter(item=>visible(item)&&!item.closest('[data-testid="UserDescription"]')&&/^(?:Follows you|关注了你|正在关注你)$/i.test(item.innerText.trim())).map(item=>item.innerText.trim()).join(' ');
    const followsYou=/\bfollows you\b|关注了你|正在关注你/i.test(indicator)?'follows':/does not follow you|doesn.t follow you|未关注你|没有关注你|不关注你/i.test(indicator)?'not-follows':'unknown';
    return {handle,button,following,blue,followsYou};
  }
  function draw(rows,where){const counts={follow:0,unfollow:0,check:0},next=new Set();
    for(const cell of rows){const state=stateOf(cell);if(!state)continue;const mark=relationshipMark({...where,...state,snapshot,highlightFollowers:config.blueHighlightFollowers,highlightFollowing:config.blueHighlightFollowing});if(!mark)continue;counts[mark.kind]++;next.add(cell);cell.setAttribute('data-echo-blue-kind',mark.kind);cell.setAttribute('data-echo-blue-label',mark.label);cell.setAttribute('data-echo-blue-handle',state.handle);cell.toggleAttribute('data-echo-blue-tint',config.tintRows!==false);if(!cell.hasAttribute('data-echo-blue-static')&&getComputedStyle(cell).position==='static')cell.setAttribute('data-echo-blue-static','');}
    for(const cell of painted)if(!next.has(cell))clearCell(cell);
    painted.clear();for(const cell of next)painted.add(cell);
    lastCounts=counts;
  }
  // Keep visual work independent of slower storage messages, especially during virtual scrolling.
  function renderLocal(){
    const page=listPage(location.pathname);if(!closed&&page&&config.enabled!==false&&!document.hidden){const rows=cells(page.kind==='following'?'following':'followers');document.body.toggleAttribute('data-ae-relations-layout',true);drawNotes(rows);}else clearNoteHosts();
    const where=current(),valid=!closed&&!!where.scope&&config.enabled!==false&&(config.blueHighlightFollowers||config.blueHighlightFollowing);
    document.body.toggleAttribute('data-ae-relations-layout',valid||(!closed&&!!page&&config.enabled!==false));
    if(!valid||document.hidden||[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some(visible)){clearMarks();lastRowCount=0;return;}
    const key=where.account+':'+where.scope+':'+location.pathname;
    if(identity!==key){identity=key;snapshot=null;lastSnapshot=0;lastSnapshotWrite=0;clearMarks();}
    const rows=cells(where.scope);lastRowCount=rows.length;draw(rows,where);
  }
  async function tick(){if(closed||running)return;running=true;try{
    if(Date.now()-lastNotesPoll>4000){notes=await send({type:'NOTES_STATE'});lastNotesPoll=Date.now();}
    if(Date.now()-lastPoll>4000){config=await send({type:'PUBLIC_SETTINGS'});lastPoll=Date.now();}
    const where=current(),key=where.account+':'+where.scope+':'+location.pathname;lastRowCount=0;if(!where.scope||config.enabled===false||!config.blueHighlightFollowers&&!config.blueHighlightFollowing||document.hidden){clearMarks();return;}
    if(identity!==key){identity=key;snapshot=null;lastSnapshot=0;lastSnapshotWrite=0;}
    if([...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some(visible)){clearMarks();return;}
    const rows=cells(where.scope);lastRowCount=rows.length;if(!rows.length){clearMarks();return;}
    draw(rows,where);
    if(where.scope==='followers'&&/^\/[a-z0-9_]+\/followers\/?$/i.test(location.pathname)&&Date.now()-lastSnapshotWrite>4000){lastSnapshotWrite=Date.now();try{await send({type:'FOLLOWER_SNAPSHOT_ADD',account:where.account,handles:rows.map(cell=>stateOf(cell)?.handle).filter(Boolean)});}catch{}}
    if(Date.now()-lastSnapshot>4000){lastSnapshot=Date.now();try{const context=await send({type:'RELATIONSHIP_CONTEXT',account:where.account});if(key===current().account+':'+current().scope+':'+location.pathname)snapshot=context.snapshot;}catch{snapshot=null;}}
    if(closed||config.enabled===false){clearMarks();return;}
    if(key!==current().account+':'+current().scope+':'+location.pathname){clearMarks();schedule();return;}
    if([...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some(visible)){clearMarks();return;}
    draw(cells(where.scope),where);

  }catch{clearMarks();}finally{running=false;renderLocal();publish();}}
  function schedule(){if(closed||scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;renderLocal();publish();tick().catch(()=>{});});}
  const observer=new MutationObserver(mutations=>{if(mutations.every(m=>m.target.closest?.('.ae-person-note')||m.type==='childList'&&[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType===1&&n.classList?.contains('ae-person-note'))))return;clearMarks();schedule();});observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','data-testid','style','class','href']});
  document.addEventListener('scroll',()=>{renderLocal();publish();schedule();},true);document.addEventListener('visibilitychange',schedule);window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(sender.id!==chrome.runtime.id)return;if(message.type==='PAGE_STATE'){reply(scene());return;}if(message.type==='REFRESH_SETTINGS'){lastPoll=0;send({type:'PUBLIC_SETTINGS'}).then(value=>{config=value;lastPoll=Date.now();send({type:'NOTES_STATE'}).then(value=>{notes=value;lastNotesPoll=Date.now();renderLocal();});renderLocal();schedule();publish();reply(true);},()=>reply(false));return true;}});
  const timer=setInterval(()=>{renderLocal();publish();tick().catch(()=>{});},1000);tick().catch(()=>{});
})();
