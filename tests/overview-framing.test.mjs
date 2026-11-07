import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationBoundsCenter} from '../snapshot-framing.js';
import {constrainCameraAboveGround,constrainOrbitAboveGround} from '../camera-flight.js';
import {PerspectiveCamera,Vector3} from '../vendor/three/three.module.js';

test('overview uses a fixed frame-range bounds center, including club extremes',()=>{
 const frames=[[[0,0,0],[2,4,2],[10,-2,3]],[[1,1,0],[3,5,2],[-6,3,4]]];
 assert.deepEqual(rotationBoundsCenter(frames),[2,1.5,2]);
 assert.deepEqual(rotationBoundsCenter(frames,0,0),[5,1,1.5]);
 assert.deepEqual(rotationBoundsCenter([...frames,[[NaN,0,0],null]]),[2,1.5,2]);
 assert.throws(()=>rotationBoundsCenter([[]]));
});
test('ground constraint cannot put the camera below the floor, even at a tiny radius',()=>{
 for(const position of [[1,-3,2],[0,-.001,.001],[0,0,0],[2,4,3]])for(const floor of [-.8,.02,5]){
  const camera=new PerspectiveCamera();camera.position.set(...position);camera.lookAt(new Vector3());
  constrainCameraAboveGround(camera,floor);
  assert.ok(camera.position.y>=floor);
  assert.ok(camera.position.toArray().every(Number.isFinite));assert.ok(camera.quaternion.toArray().every(Number.isFinite));
 }
});

test('manual ground-limited orbit preserves its distance around an offset pivot',()=>{
 const target=new Vector3(2,1,-3),radius=4;
 for(const pitch of [-1.5,-.8,0,.8]){
  const position=new Vector3(0,Math.sin(pitch),Math.cos(pitch)).multiplyScalar(radius).add(target);
  constrainOrbitAboveGround(position,target,0);
  assert.ok(position.y>=0);assert.ok(Math.abs(position.distanceTo(target)-radius)<1e-10);
 }
});
