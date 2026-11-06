import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot,registry} from '../explain/index.js';
import {createContext} from '../explain/context.js';
import {subtypeNames,itemNames} from '../explain/names.js';
import {spin,axes,rotate,planeAngle} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
test('all explanations reproduce every exported frame across all supplied swings',()=>{
 let checked=0;
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('materials/data/3d_results/'+file),metrics=read('materials/data/metrics/'+file);
  for(const [type,subtypes] of Object.entries(metrics.metrics))for(const subtype of Object.keys(subtypes)){
   assert.ok(registry[type]?.[subtype]);assert.ok(subtypeNames[subtype]);
   for(let frame=0;frame<data.reconstruction.length;frame++){
    const model=explainSnapshot(data,metrics,{frame,type,subtype});
    for(const item of model.items){assert.ok(item.matches,`${file} ${subtype} ${frame}: ${item.computed} != ${item.value}`);assert.ok(itemNames[item.key]);assert.ok(item.steps.length>1);checked++;}
   }
  }
 }
 assert.ok(checked>10000);
});
test('alignment transform round-trips points and locates the reference ankle origin',()=>{
 const data=read('materials/data/3d_results/00.json'),metrics=read('materials/data/metrics/00.json');
 const c=createContext(data,metrics,{frame:300});
 for(const p of data.reconstruction[300])c.source(c.normalized(p)).forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-10));
 const midpoint=c.midpoint('left_ankle','right_ankle',c.reference);midpoint.forEach(v=>assert.ok(Math.abs(v)<1e-10));
});
test('signed turns and plane inclinations retain direction',()=>{
 assert.ok(Math.abs(spin(axes.x,rotate(axes.x,axes.y,35),axes.y)-35)<1e-10);
 assert.ok(Math.abs(spin(axes.x,rotate(axes.x,axes.y,-35),axes.y)+35)<1e-10);
 assert.ok(Math.abs(planeAngle([0,1,1],axes.y)-45)<1e-10);
});
test('angles omit scale/translation instruction; position identifies origin',()=>{
 const data=read('materials/data/3d_results/00.json'),metrics=read('materials/data/metrics/00.json');
 for(const type of ['kinematic','geometric'])for(const subtype of Object.keys(registry[type])){
  const m=explainSnapshot(data,metrics,{frame:300,type,subtype});
  for(const item of m.items)assert.doesNotMatch(item.steps.map(s=>s.text).join(' '),/divide|scal(?:e|ing)|subtract.*origin/i);
 }
 const m=explainSnapshot(data,metrics,{frame:300,type:'position',subtype:'hip_sway_thrust_lift'});
 assert.match(m.items[0].steps.map(s=>s.text).join(' '),/midpoint between the reference frame’s ankles/);
});

test('animation phases finish projection before the angle is measured',async()=>{
 const {phases}=await import('../explain/ui/timeline.js');
 assert.equal(phases(0).directions,0);assert.equal(phases(0).angle,0);
 assert.equal(phases(.6).projection,1);assert.ok(phases(.6).angle>0);
 assert.deepEqual(phases(1),{directions:1,projection:1,angle:1});
});
test('automatic animation shares common setup but includes every component',async()=>{
 const {sequence}=await import('../explain/ui/timeline.js');
 const data=read('materials/data/3d_results/00.json'),metrics=read('materials/data/metrics/00.json');
 const m=explainSnapshot(data,metrics,{frame:300,type:'kinematic',subtype:'torso_turn_bend_tilt'});
 const steps=sequence(m.items).map(s=>m.items[s.itemIndex].steps[s.stepIndex].title);
 assert.deepEqual(steps,['Set the global directions','Build the torso directions','Read the turn','Read the forward bend','Read the side tilt']);
 assert.ok(sequence(m.items,2).every(s=>s.itemIndex===2));
});

test('shared pair timing makes joints solid before stretching and releases before alignment',async()=>{
 const {jointPairProgress}=await import('../explain/choreography/joint-pair.js');
 const focusing=jointPairProgress(.1);assert.equal(focusing.stretch,0);assert.ok(focusing.strength>0&&focusing.strength<1);
 const growing=jointPairProgress(.4);assert.equal(growing.strength,1);assert.ok(growing.stretch>0&&growing.stretch<1);
 const releasing=jointPairProgress(.7);assert.equal(releasing.stretch,1);assert.ok(releasing.strength>0&&releasing.strength<1);
 assert.equal(jointPairProgress(.9).strength,0);assert.equal(jointPairProgress(.9).phase,'align');
});
test('current angular recipes identify the source joint pairs in their visual primitives',()=>{
 const data=read('materials/data/3d_results/00.json'),metrics=read('materials/data/metrics/00.json');
 for(const type of ['kinematic','geometric'])for(const subtype of Object.keys(registry[type])){
  const model=explainSnapshot(data,metrics,{frame:300,type,subtype});
  const visuals=model.items.flatMap(item=>item.steps.flatMap(step=>step.visuals)).filter(v=>v.jointPair);
  assert.ok(visuals.length>0);
  for(const visual of visuals){assert.ok(visual.jointPair.joints.length>=2);visual.jointPair.joints.forEach(name=>assert.ok(data.joints.includes(name)));assert.ok(['reference','selected'].includes(visual.jointPair.pose));}
 }
});
