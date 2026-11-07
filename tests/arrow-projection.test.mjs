import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from '../vendor/three/three.module.js';
import {projectArrow} from '../explain/ui/arrow-projection.js';
const camera=new PerspectiveCamera(45,1,.01,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const origin=new Vector3();
test('camera-parallel arrows retain a visible, directional end-on symbol',()=>{
 const toward=projectArrow(origin,new Vector3(0,0,1),camera,600,600),away=projectArrow(origin,new Vector3(0,0,-1),camera,600,600);
 assert.equal(toward.markerOpacity,1);assert.equal(toward.arrowOpacity,0);assert.equal(toward.toward,true);
 assert.equal(away.markerOpacity,1);assert.equal(away.toward,false);
 assert.equal(toward.tx,300);assert.equal(toward.ty,300);
 assert.equal(projectArrow(origin,origin,camera,600,600),null);
});
test('near-parallel arrows smoothly cross-fade without altering their endpoints',()=>{
 let previous=1;
 for(const degrees of [0,6,9,12,15,18,30,90]){
  const radians=degrees*Math.PI/180,to=new Vector3(Math.sin(radians),0,Math.cos(radians)),original=to.clone();
  const result=projectArrow(origin,to,camera,600,600);
  assert.ok(result.markerOpacity<=previous);previous=result.markerOpacity;
  assert.ok(Math.abs(result.markerOpacity+result.arrowOpacity-1)<1e-12);assert.deepEqual(to,original);
  const actual=to.clone().project(camera);assert.ok(Math.abs(result.tx-(actual.x+1)*300)<1e-10);
 }
 assert.equal(previous,0);
});
test('end-on direction follows the camera after orbiting to the opposite side',()=>{
 const back=new PerspectiveCamera(45,1,.01,100);back.position.set(0,0,-5);back.lookAt(0,0,0);back.updateMatrixWorld();
 assert.equal(projectArrow(origin,new Vector3(0,0,1),back,600,600).toward,false);
});

test('a long axis crossing behind the close-up camera retains its visible root segment',()=>{
 const close=new PerspectiveCamera(45,1,.01,100);close.updateMatrixWorld();
 const from=new Vector3(0,0,-.1),to=new Vector3(.2,0,.1),result=projectArrow(from,to,close,600,600);
 assert.ok(result);assert.equal(result.x,300);assert.equal(result.y,300);assert.ok(result.tx>600);
 assert.ok(Object.values(result).every(v=>typeof v!=='number'||Number.isFinite(v)));
 assert.deepEqual(from,new Vector3(0,0,-.1));assert.deepEqual(to,new Vector3(.2,0,.1));
 assert.equal(projectArrow(new Vector3(0,0,.1),new Vector3(.2,0,.2),close,600,600),null);
});
test('far clipping preserves the visible part of a long axis',()=>{
 const close=new PerspectiveCamera(45,1,.01,1);close.updateMatrixWorld();
 assert.ok(projectArrow(new Vector3(0,0,-.1),new Vector3(.2,0,-5),close,600,600));
 assert.equal(projectArrow(new Vector3(0,0,-2),new Vector3(.2,0,-5),close,600,600),null);
});
