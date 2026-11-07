import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowShape,joinedTStemShape,crossbarContactWidth} from '../explain/ui/arrow-shape.js';
const points=shape=>[...shape.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
test('arrow shaft and head retain screen dimensions as projected length changes',()=>{
 for(const width of [2,4.5]){
  for(const length of [60,100,500]){
   const p=points(arrowShape(0,0,length,0,width));
   assert.equal(p[0][1],-width/2);assert.equal(p[6][1],width/2);
   assert.equal(length-p[2][0],width*3);
   assert.equal(p[4][1],width*1.35);
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

test('short thick arrowheads keep the same triangle and shaft proportions',()=>{
 for(const width of [2,4.5,5.8])for(const length of [4,8,12,20,24,40,100]){
  const p=points(arrowShape(0,0,length,0,width)),shaft=p[6][1]-p[0][1],head=length-p[2][0],halfHead=p[4][1];
  assert.ok(Math.abs(head/shaft-3)<1e-10);
  assert.ok(Math.abs(halfHead/shaft-1.35)<1e-10);
  assert.ok(p[1][0]>=length*2/3-1e-10);assert.deepEqual(p[3],[length,0]);
 }
});
test('arrowheads smoothly morph into constant-width bars without moving endpoints',()=>{
 let previous=Infinity;
 for(const blend of [0,.25,.5,.75,1]){
  const p=points(arrowShape(0,0,60,0,4.5,blend)),head=60-p[2][0];
  assert.ok(head<=previous);previous=head;assert.deepEqual(p[3],[60,0]);assert.equal(p[0][0],0);
 }
 assert.equal(previous,0);
 const small=points(arrowShape(0,0,2,0,2.7,1));assert.equal(small[6][1]-small[0][1],2.7);
});

test('T stem joins the full crossbar edge without protruding at oblique angles',()=>{
 for(const width of [2.7,4.5])for(const angle of [5,15,45,90,135,175]){
  const a=angle*Math.PI/180,start={x:-Math.cos(a)*500,y:-Math.sin(a)*500};
  const shape=joinedTStemShape(start,{x:0,y:0},{x:-1000,y:0},{x:1000,y:0},width);
  assert.ok(shape);
  const p=points(shape),contact=p.filter(([,y])=>Math.abs(y+width/2)<1e-8);
  assert.equal(contact.length,2);
  assert.ok(Math.abs(contact[0][0]-contact[1][0])>=width-1e-8);
  assert.ok(p.every(([,y])=>y<=-width/2+1e-8));
  assert.ok(p.length>20,'exposed root retains its rounded outline');
 }
});

test('T junction follows the growing shoulder arrow through its bar transition',()=>{
 const start={x:0,y:0},contact={x:50,y:0},width=4.5;
 assert.equal(crossbarContactWidth(start,{x:40,y:0},contact,width,0),null);
 for(const blend of [0,.25,.5,.75,1]){
  const crossWidth=crossbarContactWidth(start,{x:100,y:0},contact,width,blend);
  assert.equal(crossWidth,width);
  const shape=joinedTStemShape({x:50,y:100},contact,start,{x:100,y:0},width,crossWidth);
  const p=points(shape);assert.ok(p.every(([,y])=>y>=crossWidth/2-1e-8));
  assert.equal(p.filter(([,y])=>Math.abs(y-crossWidth/2)<1e-8).length,2);
 }
 const tipWidth=crossbarContactWidth(start,{x:52,y:0},contact,width,0);
 assert.ok(tipWidth>0&&tipWidth<width);
});
