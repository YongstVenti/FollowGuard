(async()=>{
 if(document.getElementById('ae-relations-root'))return;
 const base=chrome.runtime.getURL(''),{detectedAccount,listPage}=await import(base+'identity.js');
 const host=document.createElement('div');host.id='ae-relations-root';host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483646';const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>:host{font:12px/1.5 system-ui}.dock{position:absolute;pointer-events:auto;width:56px;height:56px}.launch{display:block;width:56px;height:56px;background:#080808;padding:0;border:1px solid #ffffff70;border-radius:17px;box-shadow:0 0 2px #ffffff70,0 0 14px #ffffff25;cursor:pointer;user-select:none}.launch:hover{box-shadow:0 0 18px #ffffff40}.launch img{width:100%;height:100%;border-radius:16px;pointer-events:none}.indicator{position:absolute;display:flex;align-items:center;gap:5px;padding:4px 8px;border:1px solid #ffffff25;border-radius:20px;background:#101010ed;color:#f5f5f5;font-size:10px;white-space:nowrap;pointer-events:none;backdrop-filter:blur(8px)}.indicator i{width:5px;height:5px;background:#66d996;border-radius:50%}.indicator[data-state=idle]{background:#101010ed;color:#ddd}.indicator[data-state=idle] i{background:#999}[hidden]{display:none!important}button:focus-visible{outline:2px solid white;outline-offset:3px}.hint{position:fixed;right:20px;bottom:20px;background:#fff;color:#222;border-radius:10px;padding:12px;max-width:280px;pointer-events:none}</style><div class="dock"><button class="launch" title="AE · 打开浏览器弹窗（位置固定）" aria-label="打开蓝标关系弹窗"><img alt="黑白 AE 标志"></button></div><div class="indicator" hidden><i></i><span></span></div><div class="hint" role="status" hidden></div>`;
 document.documentElement.append(host);shadow.querySelector('img').src=base+'icons/mark.svg';const dock=shadow.querySelector('.dock'),launch=shadow.querySelector('button'),indicator=shadow.querySelector('.indicator');let config={},closed=false,pageState=null,frame=0,hintTimer;
 async function send(message){if(!chrome.runtime?.id)throw new Error('扩展已更新，请刷新 X 页面');const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'连接失败');return r.data;}
 function hint(text){const el=shadow.querySelector('.hint');el.hidden=false;el.textContent=text;clearTimeout(hintTimer);hintTimer=setTimeout(()=>{el.hidden=true;},5000);}
 function stop(){closed=true;clearInterval(timer);observer.disconnect();cancelAnimationFrame(frame);indicator.hidden=true;launch.title='扩展已更新，请刷新 X 页面';}
 function defaultPosition(){for(const n of document.querySelectorAll('button,[role="button"],a[aria-label],a[href*="/i/grok"]')){if(!/grok/i.test([n.getAttribute('aria-label'),n.getAttribute('data-testid'),n.getAttribute('title'),n.getAttribute('href')].join(' ')))continue;const r=n.getBoundingClientRect();if(r.left<innerWidth-160||r.top<innerHeight/2||r.width<24||r.width>90||r.height<24||r.height>90)continue;return {x:r.left+(r.width-56)/2,y:r.top-68};}return {x:innerWidth-80,y:innerHeight-228};}
 function place(){
  dock.hidden=config.showLauncher===false;
  const d=defaultPosition();dock.style.left=Math.max(12,Math.min(innerWidth-68,d.x))+'px';dock.style.top=Math.max(12,Math.min(innerHeight-68,d.y))+'px';
  const list=listPage(location.pathname);indicator.hidden=closed||config.showIndicator===false||!list;if(indicator.hidden)return;
  const column=document.querySelector('main [data-testid="primaryColumn"],main,[role="main"]');if(!column){indicator.hidden=true;return;}
  const r=column.getBoundingClientRect();
  const following=[...column.querySelectorAll('[role="tab"],a[href]')].find(node=>{const rect=node.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return false;const href=node.getAttribute('href');if(href){try{if(new URL(href,location.href).pathname.toLowerCase()==='/'+list.owner+'/following')return true;}catch{}}return node.getAttribute('role')==='tab'&&/^(?:Following|正在关注|关注)$/i.test(node.textContent.trim());});
  const tab=following?.getBoundingClientRect();
  const heading=[...column.querySelectorAll('h1,h2,[role="heading"]')].find(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.height>0&&box.bottom>0&&(!tab||box.bottom<=tab.top);});
  const title=heading?.getBoundingClientRect();
  // Align with the account-row action column, not the navigation tab above it.
  const actions=[...column.querySelectorAll('button,[role="button"]')].filter(node=>{if(!node.closest('[data-testid="UserCell"],[data-testid="cellInnerDiv"]'))return false;const rect=node.getBoundingClientRect();return rect.width>20&&rect.width<250&&rect.height>0&&rect.height<90&&rect.bottom>0&&rect.top<innerHeight&&(/(?:^|-)(?:un)?follow$/.test(node.dataset.testid||'')||/^(?:Following|Follow(?: back)?|Unfollow|已关注|正在关注|关注|回关|取消关注)(?:\s|$)/i.test(node.getAttribute('aria-label')||node.textContent.trim()));});
  const followingActions=actions.filter(node=>/(?:^|-)unfollow$/.test(node.dataset.testid||'')||/^(?:Following|Unfollow|已关注|正在关注|取消关注)(?:\s|$)/i.test(node.getAttribute('aria-label')||node.textContent.trim()));
  const centers=(followingActions.length?followingActions:actions).map(node=>{const rect=node.getBoundingClientRect();return rect.left+rect.width/2;}).sort((a,b)=>a-b);
  const actionX=centers.length?centers[Math.floor(centers.length/2)]:r.right-88;


  const own=list.owner===detectedAccount(),running=config.enabled!==false&&own&&pageState?.ready;const text=config.enabled===false?'已暂停':running?'AE 运行中':own?'AE 已连接':'AE 仅查看';
  indicator.dataset.state=running?'running':'idle';indicator.querySelector('span').textContent=text;indicator.title=pageState?.reason||'骗关者清除器';const box=indicator.getBoundingClientRect(),centerX=actionX,centerY=title?title.top+title.height/2:Math.max(24,r.top+24);indicator.style.left=Math.max(12,Math.min(innerWidth-box.width-12,centerX-box.width/2))+'px';indicator.style.top=Math.max(8,Math.min(innerHeight-box.height-8,centerY-box.height/2))+'px';
 }
 function schedule(){if(closed||frame)return;frame=requestAnimationFrame(()=>{frame=0;place();});}
 launch.onclick=async()=>{if(closed){hint('扩展已更新，请刷新 X 页面');return;}try{await send({type:'OPEN_POPUP'});}catch(e){hint(e.message);}};
 async function refresh(){if(closed)return;try{config=await send({type:'PUBLIC_SETTINGS'});place();}catch{stop();}}
 chrome.runtime.onMessage.addListener((m,sender)=>{if(sender.id===chrome.runtime.id&&m.type==='REFRESH_SETTINGS')refresh();});
 document.addEventListener('ae-relations-state',event=>{pageState=event.detail;schedule();});window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.addEventListener('popstate',schedule);
 const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});const timer=setInterval(refresh,4000);place();refresh();
})();
