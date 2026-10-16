export const handleOf=value=>typeof value==='string'&&/^[a-z0-9_]{1,15}$/i.test(value)?value.toLowerCase():'';
export function listScope(path,account){const match=String(path||'').match(/^\/([a-z0-9_]{1,15})\/(followers|verified_followers|followers_you_follow|following)\/?$/i);return match&&handleOf(match[1])===handleOf(account)&&handleOf(account)?match[2]==='following'?'following':'followers':null;}
export function isBlueColor(value){const match=String(value).match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);if(!match)return false;const [,r,g,b]=match.map(Number);return r<=70&&g>=75&&g<=210&&b>=160&&b>r+70&&b>g+20;}
export function snapshotRelation(snapshot,handle,now=Date.now()){if(!snapshot?.completeAt||now-snapshot.completeAt>300000||snapshot.truncated)return 'unknown';return snapshot.handles.includes(handleOf(handle))?'follows':'not-follows';}
export function relationshipMark({scope,account,handle,blue,following,followsYou='unknown',snapshot,highlightFollowers=true,highlightFollowing=true,now}){
  if(!handleOf(account)||!handleOf(handle)||handleOf(account)===handleOf(handle)||!blue)return null;
  if(scope==='followers'&&highlightFollowers&&following==='not-following')return {kind:'follow',label:'蓝标粉丝 · 尚未关注'};
  if(scope!=='following'||!highlightFollowing||following!=='following')return null;
  const relationship=followsYou==='unknown'?snapshotRelation(snapshot,handle,now):followsYou;
  return relationship==='not-follows'?{kind:'unfollow',label:'蓝标 · 未回关，请自行决定'}:relationship==='unknown'?{kind:'check',label:'蓝标 · 回关状态待核对'}:null;
}
