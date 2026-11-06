import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {createPoseSurface} from '../pose-surface.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('open cylindrical sheets attach at the ball surface',()=>{
 const surface=createPoseSurface(.012,.022),material=new THREE.MeshStandardMaterial(),from=new THREE.Vector3(),to=new THREE.Vector3(0,1,0);
 const bone=surface.bone(material);surface.placeBone(bone,from,to);bone.updateMatrixWorld();
 near(bone.scale.y,1-2*surface.cut);assert.equal(bone.geometry.groups.length,1);
 const p=bone.geometry.attributes.position,n=bone.geometry.attributes.normal;
 for(let i=0;i<p.count;i++)if(p.getY(i)>.49){
  const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(bone.matrixWorld);
  near(point.distanceTo(to),.022);
  near(n.getY(i),0);
 }
 const joint=surface.joint(material);surface.placeJoint(joint,to);
 assert.equal(joint.material.clippingPlanes,null);near(joint.position.distanceTo(to),0);
});
test('short connections hide internal bones and preserve complete joint spheres',()=>{
 const surface=createPoseSurface(.012,.022),material=new THREE.MeshStandardMaterial(),a=new THREE.Vector3(),b=new THREE.Vector3(.01,0,0),bone=surface.bone(material);
 surface.placeBone(bone,a,b);assert.equal(bone.visible,false);
 const joint=surface.joint(material);surface.placeJoint(joint,a);
 assert.equal(joint.material.clippingPlanes,null);
 const vertices=joint.geometry.attributes.position;
 for(let i=0;i<vertices.count;i++)near(new THREE.Vector3().fromBufferAttribute(vertices,i).length(),.022);
 assert.notEqual(joint.material,material);
});
test('transparent ball and cylinder surfaces show both sides without masking',()=>{
 const surface=createPoseSurface(.012,.022),material=new THREE.MeshStandardMaterial({transparent:true,opacity:.28,depthWrite:false});
 const bone=surface.bone(material),joint=surface.joint(material);
 for(const mesh of [bone,joint]){
  assert.equal(mesh.material.side,THREE.DoubleSide);
  assert.equal(mesh.material.forceSinglePass,false);
  assert.equal(mesh.material.opacity,.28);assert.equal(mesh.material.depthWrite,false);
  assert.equal(mesh.material.clippingPlanes,null);
  assert.equal(mesh.material.onBeforeCompile,material.onBeforeCompile);
 }
 assert.notEqual(bone.material,joint.material);assert.notEqual(joint.material,material);
 assert.equal(bone.geometry.parameters.openEnded,true);
});
