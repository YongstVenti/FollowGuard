import {handleOf,listScope} from './relationship-core.js';
let queue=Promise.resolve();
const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
const read=async()=>{const saved=(await chrome.storage.local.get('relationshipAssistant')).relationshipAssistant||{};return {snapshots:Object.assign(Object.create(null),saved.snapshots||{}),history:Array.isArray(saved.history)?saved.history:[],leases:Object.assign(Object.create(null),saved.leases||{})};};
const write=state=>chrome.storage.local.set({relationshipAssistant:state});
export function relationshipMessage(message,{own,onX,sender,settings}){return serial(async()=>{
  if(!own&&!onX)throw new Error('来源不受支持');
  // sender.url stays at the initial document URL after X history navigation.
  // sender.tab.url is the current URL supplied by Chrome, not by the page.
  const state=await read(),now=Date.now(),account=handleOf(message.account),page=onX?new URL(sender.tab?.url||sender.url):null;
  if(message.type==='SET_RELATIONSHIP_OPTIONS'){if(!own)throw new Error('仅工作台可更改标注开关');const current=await settings();current.blueAutoFollow=false;current.blueAutoUnfollow=false;for(const key of ['enabled','showLauncher','showIndicator','tintRows','blueHighlightFollowers','blueHighlightFollowing'])if(typeof message[key]==='boolean')current[key]=message[key];await chrome.storage.local.set({settings:current});return true;}
  if(message.type==='RELATIONSHIP_STATE'){if(!own)throw new Error('仅工作台可读取完整记录');return state;}
  if(['RELATIONSHIP_CLAIM','RELATIONSHIP_RESULT'].includes(message.type))throw new Error('当前仅提供关系标注，不支持自动关注或取关');
  if(message.type==='RESET_FOLLOWERS_SNAPSHOT'||message.type==='COMPLETE_FOLLOWERS_SNAPSHOT'){
    if(!own||!account)throw new Error('请先在本人粉丝列表收集名单');const snapshot=state.snapshots[account];
    if(message.type==='RESET_FOLLOWERS_SNAPSHOT')delete state.snapshots[account];
    else {if(!snapshot?.handles.length||snapshot.truncated||now-snapshot.updatedAt>300000)throw new Error('名单为空、已截断或最近五分钟未更新，请重新浏览并收集完整列表');snapshot.completeAt=now;}
    await write(state);return true;
  }
  if(!onX||sender.frameId>0||!['https://x.com','https://twitter.com'].includes(page.origin)||!account||!listScope(page.pathname,account))throw new Error('仅支持当前账号本人的关注或粉丝列表');
  if(message.type==='FOLLOWER_SNAPSHOT_ADD'){
    if(!/^\/[a-z0-9_]+\/followers\/?$/i.test(page.pathname))throw new Error('仅从完整 Followers 分类收集，不使用认证粉丝等子列表');
    let snapshot=state.snapshots[account];if(!snapshot||now-snapshot.updatedAt>1800000)snapshot={handles:[],startedAt:now,updatedAt:now,completeAt:null,truncated:false};
    const handles=new Set(snapshot.handles);for(const value of (Array.isArray(message.handles)?message.handles:[]).slice(0,100)){const item=handleOf(value);if(item)handles.add(item);}
    snapshot.truncated=handles.size>20000;snapshot.handles=[...handles].slice(0,20000);snapshot.updatedAt=now;state.snapshots[account]=snapshot;
    state.snapshots=Object.fromEntries(Object.entries(state.snapshots).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,5));await write(state);return {count:snapshot.handles.length,completeAt:snapshot.completeAt,truncated:snapshot.truncated};
  }
  if(message.type==='RELATIONSHIP_CONTEXT')return {snapshot:state.snapshots[account]||null,history:state.history.filter(row=>row.account===account).slice(0,10)};
  throw new Error('未知关注助手操作');
});}
