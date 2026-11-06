import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackClock} from '../explain/ui/playback.js';

function setup(){
 let next,visibility,hidden=false,inert=false,cancelled=false,disconnected=false;
 const deltas=[],states=[],root={isConnected:true,closest:()=>inert};
 const clock=createPlaybackClock({root,target:root,playing:true,onAdvance:delta=>deltas.push(delta),onPlayingChange:value=>states.push(value)},{
  request:callback=>{next=callback;return 1;},cancel:()=>{cancelled=true;},
  observe:(_,callback)=>{visibility=callback;return ()=>{disconnected=true;};},hidden:()=>hidden,
 });
 return {clock,deltas,states,root,tick:now=>next(now),visible:value=>visibility(value),hide:value=>{hidden=value;},inert:value=>{inert=value;},get cleaned(){return cancelled&&disconnected;}};
}
test('shared playback excludes time paused, offscreen, hidden or inert',()=>{
 const f=setup();f.tick(0);assert.deepEqual(f.deltas,[]);
 f.visible(true);f.tick(100);f.tick(120);assert.deepEqual(f.deltas,[0,20]);
 f.clock.setPlaying(false);f.tick(1000);f.clock.setPlaying(true);f.tick(2000);assert.equal(f.deltas.at(-1),0);
 for(const toggle of [f.visible,value=>f.hide(!value),value=>f.inert(!value)]){
  toggle(false);const count=f.deltas.length;f.tick(3000);assert.equal(f.deltas.length,count);
  toggle(true);f.tick(4000);assert.equal(f.deltas.at(-1),0);
 }
 assert.deepEqual(f.states,[false,true]);
});
test('disposal cancels rendering and disconnects visibility observation',()=>{
 const f=setup();f.visible(true);f.tick(1);f.clock.dispose();const count=f.deltas.length;
 f.tick(2);assert.equal(f.deltas.length,count);assert.ok(f.cleaned);
});
