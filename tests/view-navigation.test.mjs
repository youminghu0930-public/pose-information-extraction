import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../vendor/three/three.module.js';
import {createViewNavigation} from '../explain/ui/view-navigation.js';
function setup(){
 let now=0,id=0;const frames=new Map();
 const runtime={request:fn=>{frames.set(++id,fn);return id;},cancel:id=>frames.delete(id),now:()=>now,reduced:()=>false};
 const nav=createViewNavigation(()=>{},runtime);
 const step=ms=>{now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
 const direction=()=>nav.orient(new Vector3(0,0,1),new Vector3(0,1,0)).direction;
 return {nav,step,direction};
}
test('rotate outside explain during playback; rotate inside explain only while paused',()=>{
 const {nav,direction}=setup();nav.setPlayback(false,true);assert.equal(nav.canRotate,true);
 nav.rotate(100,20);assert.ok(direction().distanceTo(new Vector3(0,0,1))>.1);
 nav.setPlayback(true,false);assert.equal(nav.canRotate,true);nav.rotate(50,0);
 nav.setPlayback(true,true);assert.equal(nav.canRotate,false);const before=direction();nav.rotate(100,100);assert.deepEqual(direction(),before);
});
test('resume returns orientation smoothly before releasing playback, preserving pan and zoom',()=>{
 const {nav,step,direction}=setup();nav.setPlayback(true,false);nav.rotate(100,30);nav.pan(1500,-900);nav.zoomBy(20);
 const rotated=direction();nav.setPlayback(true,true);assert.equal(nav.returning,true);
 step(375);assert.equal(nav.returning,true);assert.ok(direction().distanceTo(rotated)>.01);assert.ok(direction().distanceTo(new Vector3(0,0,1))>.01);
 step(375);assert.equal(nav.returning,false);assert.ok(direction().distanceTo(new Vector3(0,0,1))<1e-10);
 assert.equal(nav.panX,1500);assert.equal(nav.panY,-900);assert.equal(nav.zoom,20);
});
test('pausing interrupts the return; reset restores the view without changing playback state',()=>{
 const {nav,step,direction}=setup();nav.setPlayback(true,false);nav.rotate(100,20);nav.setPlayback(true,true);step(200);
 nav.setPlayback(true,false);const paused=direction();assert.equal(nav.returning,false);step(1000);assert.deepEqual(direction(),paused);
 nav.pan(300,100);nav.zoomBy(.01);nav.reset();step(750);
 assert.equal(nav.panX,0);assert.equal(nav.panY,0);assert.equal(nav.zoom,1);assert.equal(nav.canRotate,true);assert.ok(direction().distanceTo(new Vector3(0,0,1))<1e-10);
 nav.setPlayback(false,true);nav.rotate(20,0);nav.reset();nav.dispose();step(1000);assert.equal(nav.returning,false);
});

test('review orbit preserves distance around an explicit intersection without moving it',()=>{
 const {nav}=setup(),pivot=new Vector3(2,3,-1),camera=new Vector3(1,4,7);
 nav.setPlayback(false,true);nav.rotate(70,40);
 assert.ok(nav.orbitPoint(pivot,pivot).distanceTo(pivot)<1e-10);
 assert.ok(Math.abs(nav.orbitPoint(camera,pivot).distanceTo(pivot)-camera.distanceTo(pivot))<1e-10);
 assert.ok(nav.orbitPoint(camera,pivot).distanceTo(camera)>.1);
});
