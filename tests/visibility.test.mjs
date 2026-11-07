import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVisibilitySampler} from '../explain/choreography/visibility.js';
import {explainSnapshot} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
import {createSpineTChoreography} from '../explain/choreography/spine-t.js';
import {createHipDisplacementChoreography} from '../explain/choreography/hip-displacement.js';
const stages=[0,1000,2000].map(start=>({start,end:start+1000,duration:1000}));
const base=()=>({selectedPose:1,referencePose:0,guides:[]});
const line=()=>({id:'line',from:[0,0,0],to:[1,0,0],opacity:1});
const plan=sample=>({segments:stages,duration:3000,sample});

test('unspecified show/hide changes fade inside the existing timeline and remain deterministic when seeking',()=>{
 const sampler=createVisibilitySampler(plan(time=>({...base(),guides:time>=1000&&time<2000?[line()]:[]})));
 assert.equal(sampler.events.length,2);
 const alpha=t=>sampler.sample(t).guides[0]?.opacity??0;
 assert.ok(alpha(1000)<.001);assert.ok(Math.abs(alpha(1120)-.5)<1e-5);assert.equal(alpha(1300),1);
 assert.ok(Math.abs(alpha(1880)-.5)<1e-5);assert.equal(alpha(2000),0);
 const first=sampler.sample(1880);sampler.sample(2990);assert.deepEqual(sampler.sample(1880),first);
});
test('authored opacity fades and vector growth keep their original timing',()=>{
 const faded=plan(time=>({...base(),guides:time>=1000&&time<2000?[{...line(),opacity:Math.min(1,(time-1000)/240,(2000-time)/240)}]:[]}));
 const fadeSampler=createVisibilitySampler(faded);assert.equal(fadeSampler.events.length,0);
 assert.deepEqual(fadeSampler.sample(1120),faded.sample(1120));
 const growth=plan(time=>({...base(),guides:time>=1000&&time<2000?[{...line(),to:[Math.min(1,(time-1000)/240),0,0]}]:[]}));
 const growSampler=createVisibilitySampler(growth);assert.ok(!growSampler.events.some(e=>e.appearing));
 assert.deepEqual(growSampler.sample(1120),growth.sample(1120));
});
test('moving an unchanged reference arrow to another layer does not fade it out and in',()=>{
 const sampler=createVisibilitySampler(plan(time=>({...base(),[time<2000?'referenceAxes':'originalReferenceAxes']:{opacity:.3,x:line()}})));
 assert.equal(sampler.events.length,0);
});
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
test('all eight metric choreographies use default fades without changing numbers, camera, or total duration',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');let events=0;
 for(const [type,subtype,create] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography],['geometric','spine_azimuth_polar_spin',createSpineTChoreography],
  ['position','hip_sway_thrust_lift',createHipDisplacementChoreography],
 ]){
  const p=create(explainSnapshot(data,metrics,{type,subtype,frame:300,duration:40,stay:10})),sampler=createVisibilitySampler(p);events+=sampler.events.length;
  assert.equal(p.duration,50000);
  for(const event of sampler.events){
   const time=event.time+(event.appearing?1:-1)*event.duration/2,raw=p.sample(time),smooth=sampler.sample(time);
   assert.deepEqual(smooth.values,raw.values);assert.deepEqual(smooth.camera,raw.camera);assert.deepEqual(smooth.pairFocus,raw.pairFocus);
   assert.ok(event.duration>0&&event.duration<=240);
  }
  // Existing visibility rules still apply: no detached up vector is resurrected.
  if(subtype.includes('on_spine_plane')){
   const start=p.segments.find(s=>s.id==='reference-trim').end;
   for(let time=start;time<p.duration;time+=137)assert.equal(sampler.sample(time).referenceAxes?.y??null,null);
  }
 }
 assert.ok(events>30);
});

test('review reference vectors stay fully hidden while their direction resets, then fade back in',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 for(const [type,subtype,create,inEnd] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography,.34],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography,.4],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography,.4],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography,.38],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography,.38],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography,.38],['geometric','spine_azimuth_polar_spin',createSpineTChoreography,.34],
 ]){
  const p=create(explainSnapshot(data,metrics,{type,subtype,frame:300,duration:30,stay:5})),sampler=createVisibilitySampler(p),finish=p.segments.find(s=>s.id==='finish');
  const hold=Math.min(1200,finish.duration*.2),active=finish.duration-hold,reset=finish.start+hold+active*.22,pause=Math.min(180,active*(inEnd-.22)*.3);
  assert.ok(sampler.sample(reset-.001).referenceAxes.opacity<1e-6,`${subtype}: outgoing vector must be hidden before reset`);
  assert.equal(sampler.sample(reset+pause*.5).referenceAxes.opacity,0,`${subtype}: reset direction must stay hidden during pause`);
  const middle=reset+pause+(active*(inEnd-.22)-pause)*.5,opacity=sampler.sample(middle).referenceAxes.opacity;
  assert.ok(opacity>0&&opacity<1,`${subtype}: returning reference must fade in`);
  assert.equal(sampler.sample(finish.start+hold+active*inEnd).referenceAxes.opacity,1);
 }
});

test('target vectors fade to zero across review resets even when their renderer stays present',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 for(const [type,subtype,create,inEnd] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography,.34],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography,.4],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography,.4],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography,.38],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography,.38],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography,.38],['geometric','spine_azimuth_polar_spin',createSpineTChoreography,.34],
 ]){
  const p=create(explainSnapshot(data,metrics,{type,subtype,frame:300,duration:30,stay:5})),finish=p.segments.find(s=>s.id==='finish');
  const hold=Math.min(1200,finish.duration*.2),active=finish.duration-hold,at=q=>p.sample(finish.start+hold+active*q);
  assert.ok(at(.219999).torsoAxes.opacity<1e-6,`${subtype}: target must fade out before reset`);
  assert.equal(at(.23).torsoAxes.opacity,0,`${subtype}: reset must be fully hidden`);
  const middle=at((.22+inEnd)/2).torsoAxes.opacity;assert.ok(middle>0&&middle<.42);
  assert.ok(Math.abs(at(inEnd).torsoAxes.opacity-.42)<1e-8);
  if(subtype==='shoulder_turn_tilt'||subtype==='hip_turn_tilt'){
   assert.ok(at(.639999).torsoAxes.opacity<1e-6);assert.equal(at(.65).torsoAxes.opacity,0);
   assert.ok(Math.abs(at(.71).torsoAxes.opacity-.42)<1e-8);
  }
 }
});
