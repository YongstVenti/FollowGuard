import {handleOf} from './relationship-core.js';
// Read only the logged-in profile link / account switcher, never the viewed profile.
export function detectedAccount(doc=document){
 const link=doc.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
 const profile=handleOf(link?.getAttribute('href')?.match(/^\/([a-z0-9_]+)\/?$/i)?.[1]);if(profile)return profile;
 const switcher=doc.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
 if(!switcher)return '';
 const text=[switcher.innerText,switcher.getAttribute('aria-label')].join(' ');
 const matches=[...new Set((text.match(/@[a-z0-9_]{1,15}(?![a-z0-9_])/ig)||[]).map(value=>handleOf(value.slice(1))))];
 return matches.length===1?matches[0]:'';
}
export function listPage(path){const m=String(path||'').match(/^\/([a-z0-9_]{1,15})\/(followers|verified_followers|followers_you_follow|following)\/?$/i);return m?{owner:handleOf(m[1]),kind:m[2].toLowerCase()}:null;}
