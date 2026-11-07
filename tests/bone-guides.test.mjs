import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from '../vendor/three/three.module.js';
import {createBoneGuides} from '../explain/ui/bone-guides.js';

test('copied bone capsules retain round ends and physical length while averaging',()=>{
 const scene=new Scene(),guides=createBoneGuides(scene,p=>new Vector3(...p));
 for(const length of [.08,.15,.3]){
  guides.update([{id:'unit',from:[0,0,0],to:[0,length,0]}]);
  const mesh=scene.getObjectByName('normalization-bone-copies').children[0];mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox;
  assert.ok(Math.abs(box.max.y-box.min.y-length)<1e-7);
  assert.ok(Math.abs(box.max.x-box.min.x-.024)<1e-7);
  // Rounded poles narrow to zero radius instead of ending in a flat cylinder.
  const vertices=mesh.geometry.attributes.position;let poles=0;
  for(let i=0;i<vertices.count;i++)if(Math.abs(vertices.getY(i)-box.max.y)<1e-7){assert.ok(Math.hypot(vertices.getX(i),vertices.getZ(i))<1e-7);poles++;}
  assert.ok(poles>0);assert.equal(mesh.material.opacity,1);
 }
 guides.update([]);assert.equal(scene.getObjectByName('normalization-bone-copies').children[0].visible,false);
 guides.dispose();assert.equal(scene.children.length,0);
});
