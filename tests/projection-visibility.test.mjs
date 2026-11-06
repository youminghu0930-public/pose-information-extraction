import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
test('hidden up arrows never return in any projection metric, including review and reset',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 for(const [type,subtype,create] of [
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography],['geometric','spine_bend_tilt',createSpineBendTiltChoreography],
 ]){
  const plan=create(explainSnapshot(data,metrics,{frame:300,type,subtype,duration:30,stay:5}));
  const trim=plan.segments.find(s=>s.id==='reference-trim');
  for(let time=trim.end;time<=plan.duration;time+=31){
   const state=plan.sample(time);
   for(const key of ['referenceAxes','torsoAxes','originalReferenceAxes','originalTorsoAxes'])assert.equal(state[key]?.y??null,null,`${subtype} ${state.segment} ${key}`);
  }
  for(const segment of plan.segments.filter(s=>['projection','baseline-project','lateral-project','bend-project','tilt-project'].includes(s.id))){
   const state=plan.sample(segment.start+segment.motionDuration*.7),axes=segment.id==='baseline-project'?state.referenceAxes:state.torsoAxes;
   assert.ok(axes.projectionSweep.angle>0);assert.ok(axes.projectionSweep.opacity>0);assert.equal(axes.projectionSweep.outline,true);
  }
 }
});
