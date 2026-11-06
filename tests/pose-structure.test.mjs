import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {poseStructure} from '../pose-structure.js';
const folder=new URL('../materials/data/3d_results/',import.meta.url);
test('all exported poses connect the spine, limbs and club with in-range joints',()=>{
 for(const file of fs.readdirSync(folder).filter(file=>file.endsWith('.json'))){
  const data=JSON.parse(fs.readFileSync(new URL(file,folder),'utf8'));
  const {edges,indexes}=poseStructure(data.joints);
  assert.equal(edges.length,21);
  for(const frame of data.reconstruction)assert.equal(frame.length,data.joints.length,file);
  for(const pair of [['root','torso'],['torso','clavicle'],['clavicle','atlas'],['left_knee','left_ankle'],['golf_club_grip','golf_club_heel']])assert.ok(edges.some(edge=>edge.every((value,i)=>value===indexes[pair[i]])));
  assert.equal(data.joints[indexes.left_ankle],'left_ankle');
 }
});
test('bone mapping follows the exported order rather than fixed numeric indices',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('00.json',folder),'utf8'));
 const original=poseStructure(data.joints),reordered=poseStructure([...data.joints].reverse());
 const namedEdges=structure=>structure.edges.map(edge=>edge.map(index=>structure.names[index]));
 assert.deepEqual(namedEdges(reordered),namedEdges(original));
 assert.throws(()=>poseStructure(data.joints.filter(name=>name!=='clavicle')),/Missing pose joint/);
});

test('shaft history uses only club connections in any exported joint order',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('00.json',folder),'utf8'));
 for(const joints of [data.joints,[...data.joints].reverse()]){
  const structure=poseStructure(joints);
  assert.deepEqual(structure.clubEdges.map(edge=>edge.map(index=>joints[index])),[
   ['golf_club_grip','golf_club_heel'],['golf_club_heel','golf_club_head']
  ]);
 }
});
