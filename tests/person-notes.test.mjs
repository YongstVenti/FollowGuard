import test from 'node:test';
import assert from 'node:assert/strict';
import {readNotes,saveNote,toggleMark} from '../notes.js';
test('person notes persist without expiration, serialize concurrent edits and delete only the selected account',async()=>{
 const store={};globalThis.chrome={storage:{local:{get:async key=>({[key]:structuredClone(store[key])}),set:async values=>Object.assign(store,structuredClone(values))}}};
 await Promise.all([saveNote('@Alice','老朋友'),saveNote('bob','之后核对')]);assert.equal((await readNotes()).alice.text,'老朋友');assert.equal((await readNotes()).bob.text,'之后核对');
 const created=(await readNotes()).alice.createdAt;await saveNote('ALICE','长期保留');assert.equal((await readNotes()).alice.createdAt,created);
 store.personNotes.alice.updatedAt=1;assert.equal((await readNotes()).alice.text,'长期保留','old notes must not expire');
 await assert.rejects(saveNote('bad/name','x'),/用户名/);await assert.rejects(saveNote('alice','a'.repeat(501)),/500/);
 await saveNote('constructor','prototype-safe');assert.equal((await readNotes()).constructor.text,'prototype-safe');
 await toggleMark('alice');assert.equal((await readNotes()).alice.marked,false);assert.equal((await readNotes()).alice.text,'长期保留');await toggleMark('alice');assert.equal((await readNotes()).alice.marked,true);await toggleMark('flagonly');assert.equal((await readNotes()).flagonly.text,'');assert.equal((await readNotes()).flagonly.marked,true);await toggleMark('flagonly');assert.equal((await readNotes()).flagonly,undefined);
 await saveNote('bob','');assert.equal((await readNotes()).bob,undefined);assert.equal((await readNotes()).alice.text,'长期保留');
});
