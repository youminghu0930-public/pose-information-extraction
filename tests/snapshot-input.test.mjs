import test from 'node:test';
import assert from 'node:assert/strict';
import {mountViewInput,bindWindowPlayback} from '../explain/ui/window-input.js';
function setup(){
 const handlers=new Map(),attributes={},zooms=[],pans=[],feedbackActions=[];let feedbackDisposed=false;
 const canvas={dataset:{},setPointerCapture(){},setAttribute:(key,value)=>attributes[key]=value,addEventListener(type,fn){const list=handlers.get(type)??[];list.push(fn);handlers.set(type,list);},removeEventListener(type,fn){handlers.set(type,(handlers.get(type)??[]).filter(f=>f!==fn));}};
 let binding;const clock={playing:true,setPlaying(value){this.playing=value;binding.update(value);}};
 const disposeInput=mountViewInput(canvas,ratio=>zooms.push(ratio),(dx,dy)=>pans.push([dx,dy]));binding=bindWindowPlayback(canvas,clock,{feedback:{show:playing=>feedbackActions.push(playing),dispose:()=>{feedbackDisposed=true;}}});
 function emit(type,fields={}){const event={pointerId:1,pointerType:'mouse',button:0,clientX:0,clientY:0,preventDefault(){},stopImmediatePropagation(){this.stopped=true;},...fields};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}}
 return {clock,canvas,attributes,zooms,pans,feedbackActions,get feedbackDisposed(){return feedbackDisposed;},emit,dispose(){disposeInput();binding.dispose();}};
}
test('window taps toggle playback, while drags and pinches do not',()=>{
 const f=setup();f.emit('pointerdown');f.emit('pointerup');f.emit('click');assert.equal(f.clock.playing,false);
 f.emit('pointerdown');f.emit('pointermove',{clientX:40});f.emit('pointerup');f.emit('click');assert.equal(f.clock.playing,false);assert.deepEqual(f.zooms,[]);assert.deepEqual(f.pans,[[40,0]]);
 f.emit('pointerdown',{pointerType:'touch'});f.emit('pointerdown',{pointerType:'touch',pointerId:2,clientX:100});
 f.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:120});assert.equal(f.zooms[0],1.2);assert.deepEqual(f.pans.at(-1),[10,0]);
 f.emit('pointerup',{pointerId:2});f.emit('pointerup');f.emit('click');assert.equal(f.clock.playing,false);
 f.emit('pointerdown');f.emit('pointerup');f.emit('click');assert.equal(f.clock.playing,true);assert.deepEqual(f.feedbackActions,[false,true]);
});
test('wheel zoom, keyboard playback, accessible state and cleanup stay independent',()=>{
 const f=setup();f.emit('wheel',{deltaY:-100});assert.ok(f.zooms[0]>1);assert.equal(f.clock.playing,true);
 f.emit('keydown',{key:' '});assert.equal(f.clock.playing,false);assert.equal(f.attributes['aria-label'],'Play explanation');
 f.emit('keydown',{key:' ',repeat:true});assert.equal(f.clock.playing,false);
 f.emit('keydown',{key:'Enter'});assert.equal(f.clock.playing,true);assert.equal(f.canvas.dataset.playing,'true');
 assert.deepEqual(f.feedbackActions,[false,true]);f.dispose();assert.equal(f.feedbackDisposed,true);f.emit('click');f.emit('wheel',{deltaY:100});assert.equal(f.clock.playing,true);assert.equal(f.zooms.length,1);
});
