import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowShape} from '../explain/ui/arrow-shape.js';
const points=shape=>[...shape.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
test('arrow shaft and head retain screen dimensions as projected length changes',()=>{
 for(const width of [2,4.5]){
  for(const length of [24,40,100,500]){
   const p=points(arrowShape(0,0,length,0,width));
   assert.equal(p[0][1],-width/2);assert.equal(p[6][1],width/2);
   assert.equal(length-p[2][0],width*5);
   assert.equal(p[4][1],width*2.4);
   assert.deepEqual(p[3],[length,0]);
  }
 }
});
test('short arrows keep their endpoints and never extend behind the origin',()=>{
 for(const length of [4,8,12]){
  const p=points(arrowShape(0,0,length,0,4.5));
  assert.ok(p.every(([x,y])=>Number.isFinite(y)&&x>=0&&x<=length));assert.deepEqual(p[3],[length,0]);
 }
 assert.equal(arrowShape(0,0,0,0,2),null);
});

test('triangle dimensions are proportional to line width',()=>{
 const thin=points(arrowShape(0,0,200,0,2)),thick=points(arrowShape(0,0,200,0,4.5)),ratio=4.5/2;
 assert.equal((200-thick[2][0])/(200-thin[2][0]),ratio);
 assert.equal(thick[4][1]/thin[4][1],ratio);
 assert.equal(thick[0][1]/thin[0][1],ratio);
});
