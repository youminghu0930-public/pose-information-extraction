import test from 'node:test';
import assert from 'node:assert/strict';
import {projectionMotion} from '../explain/choreography/vector-projection.js';
import {unit,length,dot} from '../explain/math.js';
test('projection reaches the plane and normalized display length at the same endpoint',()=>{
 const direction=unit([2,3,1]),normal=[0,1,0],start=projectionMotion(direction,normal,'project',0),end=projectionMotion(direction,normal,'project',1);
 assert.deepEqual(start.direction,direction);
 assert.ok(Math.abs(dot(end.direction,normal))<1e-12);assert.ok(Math.abs(length(end.direction)-1)<1e-12);
 const halfway=projectionMotion(direction,normal,'project',.5);assert.ok(dot(halfway.direction,normal)>0&&dot(halfway.direction,normal)<dot(direction,normal));
 for(const t of [0,.5,1])assert.deepEqual(projectionMotion(direction,normal,'fade',t).direction,end.direction);
 assert.equal(projectionMotion(direction,normal,'fade',1).originalOpacity,0);
});
test('projection angle measures elevation above the plane and closes to parallel',async()=>{
 const {planeProjectionAngle}=await import('../explain/choreography/vector-projection.js');
 const {rotate}=await import('../explain/math.js');
 for(const direction of [unit([2,3,1]),unit([2,-3,1])]){
  let previous=Infinity;
  for(const progress of [0,.2,.5,.8,1]){
   const q=projectionMotion(direction,[0,1,0],'project',progress);
   const marker=planeProjectionAngle(q.direction,[0,1,0],{origin:[0,0,0],radius:1});
   assert.ok(marker.angle<=previous+1e-10);previous=marker.angle;
   assert.equal(marker.rightAngle,false);assert.equal(marker.squareProgress,0);
   assert.ok(Math.abs(dot(marker.from,[0,1,0]))<1e-12);
   const end=rotate(marker.from,marker.normal,marker.angle),expected=unit(q.direction);
   assert.ok(end.every((v,i)=>Math.abs(v-expected[i])<1e-8));
  }
  assert.ok(previous<1e-8);
 }
});
test('the removed projection angle remains a visible magenta pie until the original fades',async()=>{
 const {projectionSweep}=await import('../explain/choreography/vector-projection.js');
 const {createRotationSector}=await import('../explain/ui/rotation-sector.js');
 const THREE=await import('../vendor/three/three.module.js');
 const direction=unit([2,3,1]),normal=[0,1,0],scene=new THREE.Scene(),layer=createRotationSector(scene,p=>new THREE.Vector3(...p));
 let previous=0;
 for(const progress of [0,.2,.5,.8,1]){
  const q=projectionMotion(direction,normal,'project',progress),spec=projectionSweep(direction,q.direction,normal,{origin:[0,0,0],radius:1});
  assert.ok(spec.angle>=previous-1e-10);previous=spec.angle;
  layer.update(spec);
  if(progress>0){assert.equal(scene.children[0].visible,true);assert.equal(scene.children[0].material.opacity,.36);assert.equal(scene.children[1].visible,true);}
 }
 assert.ok(previous>0);layer.dispose();
});
