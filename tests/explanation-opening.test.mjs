import {createSpineTChoreography} from '../explain/choreography/spine-t.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot,registry} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
import {createRecipeTimeline} from '../explain/ui/recipe-timeline.js';
import {openingState} from '../explain/choreography/opening.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
const plans={spine_azimuth_polar_spin:createSpineTChoreography,torso_turn_bend_tilt:createTorsoChoreography,hip_turn_on_spine_plane:createSpinePlaneChoreography,shoulder_turn_on_spine_plane:createSpinePlaneChoreography,shoulder_turn_tilt:createLateralTurnTiltChoreography,hip_turn_tilt:createLateralTurnTiltChoreography,spine_bend_tilt:createSpineBendTiltChoreography};
test('every metric previews the selected pose and final values before reference fade and zero reset',()=>{
 for(const [type,recipes] of Object.entries(registry))for(const subtype of Object.keys(recipes)){
  const model=explainSnapshot(data,metrics,{frame:300,type,subtype,duration:30,stay:5});
  const values=Object.fromEntries(model.items.map(item=>[item.key,item.computed]));
  const custom=plans[subtype],plan=custom?custom(model):createRecipeTimeline(model.items,30,undefined,5);
  const preview=plan.segments[0],intro=plan.segments[1];
  assert.equal(preview.opening,'result');assert.equal(intro.opening,'reference');assert.equal(preview.end,intro.start);
  function state(segment,p){
   return custom?plan.sample(segment.start+(segment.motionDuration??segment.duration)*p):openingState(segment,p,values);
  }
  for(const p of [0,.3,.8]){
   const opening=state(preview,p);assert.equal(opening.referencePose,0);assert.equal(opening.selectedPose,1);assert.deepEqual(opening.values,values);
  }
  const start=state(intro,0),middle=state(intro,.5),end=state(intro,1);
  assert.equal(start.referencePose,0);assert.ok(middle.referencePose>0&&middle.referencePose<.5);assert.equal(end.referencePose,.5);
  for(const value of Object.values(start.values))assert.equal(value,0);
  assert.equal(end.selectedPose,1);assert.equal(plan.duration,35000);
  if(custom)assert.equal(plan.sample(plan.duration).referencePose,0);
 }
});

test('every coordinate metric keeps reference Z visible as an arrow through the construction overview',()=>{
 for(const [type,recipes] of Object.entries(registry))for(const subtype of Object.keys(recipes)){
  const create=plans[subtype];if(!create)continue;
  const plan=create(explainSnapshot(data,metrics,{frame:300,type,subtype,duration:30,stay:5}));
  for(const id of ['reference-forward','reference-plane-fade','reference-cross-camera-out','selected-focus']){
   const segment=plan.segments.find(s=>s.id===id);assert.ok(segment,`${subtype}: ${id}`);
   for(const p of [0,.25,.5,.75,1]){
    const state=plan.sample(segment.start+(segment.motionDuration??segment.duration)*p),z=plan.frames.reference.z;
    const alignment=Math.abs(z.reduce((sum,v,i)=>sum+v*state.camera.direction[i],0));
    assert.ok(alignment<Math.cos(18*Math.PI/180),`${subtype} ${id}: end-on Z`);
    assert.ok(state.referenceAxes.z);assert.equal(state.referenceAxes.z.shape,undefined);
   }
  }
 }
});
