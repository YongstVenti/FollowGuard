import {checkForUpdate} from './updates.js';
import {readNotes,saveNote,toggleMark} from './notes.js';
import {relationshipMessage} from './relationship-state.js';
const ready=(async()=>{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});const {settings:s}=await chrome.storage.local.get('settings');if(s&&(Object.hasOwn(s,'ownAccount')||Object.hasOwn(s,'position'))){delete s.ownAccount;delete s.position;await chrome.storage.local.set({settings:s});}})();
async function settings(){const s=(await chrome.storage.local.get('settings')).settings||{};return {enabled:s.enabled!==false,showLauncher:s.showLauncher!==false,showIndicator:s.showIndicator!==false,tintRows:s.tintRows!==false,blueHighlightFollowers:s.blueHighlightFollowers!==false,blueHighlightFollowing:s.blueHighlightFollowing!==false,blueAutoFollow:false,blueAutoUnfollow:false};}
async function notifySettings(){const tabs=await chrome.tabs.query({});await Promise.allSettled(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type:'REFRESH_SETTINGS'})));}
async function dispatch(message,sender){
 await ready;if(!message||typeof message.type!=='string')throw new Error('无效请求');
 const own=sender.id===chrome.runtime.id&&sender.url?.startsWith(chrome.runtime.getURL('app.html'));
 let onX=false;try{onX=!!sender.tab&&sender.frameId===0&&['https://x.com','https://twitter.com'].includes(new URL(sender.url).origin);}catch{}
 if(!own&&!onX)throw new Error('来源不受支持');
 if(message.type==='PUBLIC_SETTINGS')return settings();
 if(message.type==='CHECK_UPDATE'){if(!own)throw new Error('请从扩展弹窗检查更新');const config=await (await fetch(chrome.runtime.getURL('author.json'))).json();if(!config.repository)throw new Error('更新仓库尚未发布，暂时无法检查');if(!(await chrome.permissions.contains({origins:['https://api.github.com/*']})))throw new Error('尚未允许连接 GitHub');const result=await checkForUpdate(config.repository,chrome.runtime.getManifest().version);await chrome.storage.local.set({lastUpdateCheck:result});return result;}

 if(message.type==='NOTES_STATE')return readNotes();
 if(message.type==='TOGGLE_MARK'){if(!onX)throw new Error('来源不受支持');const notes=await toggleMark(message.handle);await notifySettings();return notes;}
 if(message.type==='SAVE_NOTE'){if(!own)throw new Error('请在扩展弹窗中保存标注');const notes=await saveNote(message.handle,message.text);await notifySettings();return notes;}

 if(message.type==='ACTIVE_PAGE_STATUS'){if(!own)throw new Error('来源不受支持');const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(!tab?.id)return {connected:false,reason:'请打开 X 关注或粉丝列表'};try{return await chrome.tabs.sendMessage(tab.id,{type:'PAGE_STATE'});}catch{return {connected:false,reason:'当前页面未连接，请打开 X 列表；已打开时请刷新页面'};}}
 if(message.type==='OPEN_POPUP'){if(!onX)throw new Error('来源不受支持');try{await chrome.action.openPopup({windowId:sender.tab.windowId});return true;}catch{throw new Error('请点击浏览器右上角的 AE 扩展图标打开设置');}}
 if(message.type==='OPEN_OPTIONS'){await chrome.runtime.openOptionsPage();return true;}
 const result=await relationshipMessage(message,{own,onX,sender,settings});if(message.type==='SET_RELATIONSHIP_OPTIONS')await notifySettings();return result;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{dispatch(message,sender).then(data=>reply({ok:true,data}),error=>reply({ok:false,error:error.message}));return true;});
