import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot,registry} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createRecipeTimeline} from '../explain/ui/recipe-timeline.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('total duration proportionally scales every torso motion and hold interval',()=>{
 const entry={frame:300,type:'kinematic',subtype:'torso_turn_bend_tilt'},natural=createTorsoChoreography(explainSnapshot(data,metrics,entry));
 for(const seconds of [3,.5,120]){
  const scaled=createTorsoChoreography(explainSnapshot(data,metrics,{...entry,duration:seconds})),ratio=seconds*1000/natural.duration;
  assert.equal(scaled.duration,seconds*1000);assert.equal(scaled.segments.length,natural.segments.length);
  scaled.segments.forEach((step,i)=>{
   const original=natural.segments[i];assert.equal(step.id,original.id);close(step.duration,original.duration*ratio);close(step.start,original.start*ratio);
   if(step.motionDuration!==undefined)close(step.motionDuration,original.motionDuration*ratio);
   const a=natural.sample(original.start+original.duration*.4),b=scaled.sample(step.start+step.duration*.4);
   assert.equal(a.segment,b.segment);for(const key of ['turn','bend','tilt'])close(a.values[key],b.values[key]);
   for(const key of ['referenceAxes','torsoAxes'])if(a[key])for(const axis of ['x','y','z'])a[key].frame[axis].forEach((v,j)=>close(v,b[key].frame[axis][j]));
  });
 }
});
test('all primitive recipe timelines include the intro and preserve step proportions',()=>{
 for(const [type,recipes] of Object.entries(registry))for(const subtype of Object.keys(recipes)){
  const model=explainSnapshot(data,metrics,{frame:300,type,subtype}),natural=createRecipeTimeline(model.items),scaled=createRecipeTimeline(model.items,3);
  assert.equal(natural.segments[0].intro,true);assert.equal(scaled.duration,3000);
  scaled.segments.forEach((step,i)=>{
   close(step.duration,natural.segments[i].duration*3000/natural.duration);
   const sample=scaled.sample(step.start+step.duration*.5);assert.equal(sample.segment,step);close(sample.progress,.5);
  });
  assert.equal(scaled.sample(scaled.duration).progress,1);
 }
});

test('completion stay fits a global rotation review and preserves recipe hold timing',()=>{
 const entry={frame:300,type:'kinematic',subtype:'torso_turn_bend_tilt',duration:5,stay:2};
 const plan=createTorsoChoreography(explainSnapshot(data,metrics,entry));
 assert.equal(plan.duration,7000);
 const finish=plan.segments.find(s=>s.id==='finish');close(finish.duration,2000);
 const a=plan.sample(finish.start+100),b=plan.sample(finish.end-100);
 assert.notDeepEqual(a.camera,b.camera);assert.ok(b.focus<a.focus);assert.ok(b.selectedPose>a.selectedPose);
 for(const [index,key] of ['turn','bend','tilt'].entries()){
  const fraction=.34+.54*(index+.625)/3,state=plan.sample(finish.start+finish.duration*(.2+.8*fraction));
  close(state.values[key],plan.values[key]*.5);assert.equal(state.sectors.length,2);
  assert.deepEqual(state.camera,b.camera);
  const at=part=>plan.sample(finish.start+finish.duration*(.2+.8*(.34+.54*(index+part)/3)));
  const pauseStart=at(.02),pauseEnd=at(.23);
  assert.deepEqual(pauseStart.values,pauseEnd.values);
  assert.deepEqual(pauseStart.referenceAxes,pauseEnd.referenceAxes);
  close(pauseEnd.values[key],0);
 }
 const reviewAt=f=>plan.sample(finish.start+finish.duration*(.2+.8*f));
 assert.deepEqual(reviewAt(.1).values,{turn:0,bend:0,tilt:0});
 assert.ok(reviewAt(.21).referenceAxes.opacity<.02);
 assert.ok(reviewAt(.23).referenceAxes.opacity<.1);
 assert.ok(reviewAt(.33).referenceAxes.opacity>.9);
 assert.deepEqual(reviewAt(.23).referenceAxes.frame,reviewAt(.33).referenceAxes.frame);
 assert.ok(b.focus>=.3);
 assert.deepEqual(b.values,plan.values);
 const reset=plan.segments.find(s=>s.id==='reset'),resetStart=plan.sample(reset.start);
 assert.deepEqual(resetStart.camera,b.camera);close(resetStart.focus,b.focus);
 for(const [type,recipes] of Object.entries(registry))for(const subtype of Object.keys(recipes)){
  const model=explainSnapshot(data,metrics,{...entry,type,subtype});
  const timeline=createRecipeTimeline(model.items,5,undefined,2);
  assert.equal(timeline.duration,7000);close(timeline.segments.at(-1).duration,2000);
  assert.equal(timeline.sample(6000).progress,1);
 }
 const noHold=createTorsoChoreography(explainSnapshot(data,metrics,{...entry,stay:0}));
 assert.equal(noHold.duration,5000);assert.equal(noHold.segments.find(s=>s.id==='finish').duration,0);
});
