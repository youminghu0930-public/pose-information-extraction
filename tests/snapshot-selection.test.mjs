import test from 'node:test';
import assert from 'node:assert/strict';
import {createSelectionLoader} from '../explain/ui/selection.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('rapid metric changes serialize loads and discard stale scenes',async()=>{
 const first=deferred(),started=[],disposed=[];
 const loader=createSelectionLoader({load:async value=>{started.push(value);if(value==='first')await first.promise;return {dispose:()=>disposed.push(value)};}});
 const done=loader.select('first');loader.select('skipped');loader.select('last');
 assert.deepEqual(started,['first']);first.resolve();await done;
 assert.deepEqual(started,['first','last']);assert.deepEqual(disposed,['first']);
 await loader.select('next');assert.deepEqual(disposed,['first','last']);loader.dispose();assert.deepEqual(disposed,['first','last','next']);
});
test('load errors recover on another metric and disposed loads cannot become active',async()=>{
 const errors=[],pending=deferred();let disposed=0;
 const loader=createSelectionLoader({load:async value=>{if(value==='bad')throw new Error('missing demo');await pending.promise;return {dispose:()=>disposed++};},onError:error=>errors.push(error.message)});
 await loader.select('bad');assert.deepEqual(errors,['missing demo']);
 const done=loader.select('good');loader.dispose();pending.resolve();await done;assert.equal(disposed,1);
});
