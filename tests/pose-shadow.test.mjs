import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {updatePoseShadowStrength} from '../pose-shadow.js';
test('continuous template shadows fade by light strength without noisy depth shaders',()=>{
 const light=new THREE.DirectionalLight();
 for(const opacity of [1,.999,.7,.28,.01,0]){
  updatePoseShadowStrength(light,0,opacity);assert.equal(light.shadow.intensity,opacity);
 }
});
test('reference and current visibility contribute to smooth overall shadow strength',()=>{
 const light=new THREE.DirectionalLight();
 for(const [reference,selected,expected] of [[.5,.28,.5],[0,.28,.28],[0,1,1],[0,0,0],[2,-1,1],[-1,-2,0]]){
  updatePoseShadowStrength(light,reference,selected);assert.equal(light.shadow.intensity,expected);
 }
});
