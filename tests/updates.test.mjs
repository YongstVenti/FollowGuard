import test from 'node:test';
import assert from 'node:assert/strict';
import {checkForUpdate,newerVersion,repositoryOf} from '../updates.js';
test('GitHub update check compares numeric releases and uses only a validated configured public repository',async()=>{
 assert.equal(newerVersion('v1.10.0','1.9.9'),true);assert.equal(newerVersion('1.3.0','1.3.0'),false);assert.equal(newerVersion('1.2.9','1.3.0'),false);
 for(const s of ['https://evil.com/u/r','u/../r','u/r?q=x'])assert.equal(repositoryOf(s),null);
 assert.deepEqual(repositoryOf('https://github.com/YongstVenti/example.git'),{owner:'YongstVenti',name:'example'});
 let requested;const result=await checkForUpdate('YongstVenti/example','1.3.0',{fetcher:async(url,options)=>{requested=url;assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({tag_name:'v1.3.1',html_url:'https://github.com/YongstVenti/example/releases/tag/v1.3.1'})};}});assert.equal(result.available,true);assert.equal(requested,'https://api.github.com/repos/YongstVenti/example/releases/latest');
 await assert.rejects(checkForUpdate('','1.3.0'),/仓库/);await assert.rejects(checkForUpdate('u/r','1.3.0',{fetcher:async()=>({ok:false,status:404})}),/正式发布/);
 await assert.rejects(checkForUpdate('u/r','1.3.0',{fetcher:async()=>({ok:true,json:async()=>({tag_name:'v1.4.0',html_url:'https://evil.com/download'})})}),/不属于/);
});
