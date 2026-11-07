import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {stepCaption} from '../explain/captions.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
import {createSpineTChoreography} from '../explain/choreography/spine-t.js';
import {createHipDisplacementChoreography} from '../explain/choreography/hip-displacement.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
test('all eight metrics use short semantic captions and leave obvious steps silent',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');let checked=0,silent=0,shown=0;
 for(const [type,subtype,create] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography],['geometric','spine_azimuth_polar_spin',createSpineTChoreography],
  ['position','hip_sway_thrust_lift',createHipDisplacementChoreography],
 ]){
  const model=explainSnapshot(data,metrics,{type,subtype,frame:300,duration:30,stay:5}),plan=create(model);
  for(const segment of plan.segments)for(const fraction of segment.completion?[.05,.22,.35,.5,.75,.95]:[.5]){
   const state=plan.sample(segment.start+segment.duration*fraction),caption=stepCaption(model,segment,state);
   checked++;
   if(caption===null){silent++;continue;}
   shown++;assert.equal(typeof caption,'string');
   assert.ok(!/camera|focus|release|fade|ready|preview|intro|reset/.test(segment.id));
   assert.ok(caption.length>10);assert.ok(caption.split(/\s+/).length<=25,caption);
   assert.ok(!/undefined|_|\n/.test(caption),caption);
  }
 }
 assert.ok(checked>300);
 assert.ok(silent>shown, `Expected most steps to explain themselves: ${silent} silent, ${shown} captioned`);
 assert.ok(shown>30);
});

test('caption cues anticipate definitions and projections, and persist through silent follow-through',async()=>{
 const {createCaptionTimeline}=await import('../explain/caption-timing.js');
 const model=explainSnapshot(read('3d_results/00.json'),read('metrics/00.json'),{type:'kinematic',subtype:'torso_turn_bend_tilt',frame:300,duration:30,stay:5});
 const plan=createTorsoChoreography(model),timeline=createCaptionTimeline(model,plan);
 const segment=id=>plan.segments.find(s=>s.id===id);
 const definition=timeline.cues.find(c=>c.text.includes('reference’s left–right'));
 assert.equal(definition.start,segment('reference-lateral-focus').start);
 assert.ok(definition.end>segment('reference-grow').end);
 const leveling=timeline.cues.find(c=>c.text.includes('Use global up'));
 assert.equal(leveling.start,segment('reference-up').start);
 assert.ok(leveling.end>=segment('reference-orthogonalize').end);
 const plane=timeline.cues.find(c=>c.text.includes('perpendicular to both'));
 assert.equal(timeline.sample(segment('reference-forward').start),plane.text);
 for(let i=0;i<timeline.cues.length;i++){
  const cue=timeline.cues[i];assert.ok(cue.end>cue.start);
  if(timeline.cues[i+1])assert.ok(cue.end<=timeline.cues[i+1].start);
  assert.equal(timeline.sample(cue.start),cue.text);
 }
 assert.equal(timeline.sample(segment('reset').start),null);
 // Sampling out of order produces the same captions as normal playback.
 const times=[18000,4000,25000,12000];
 assert.deepEqual(times.map(t=>timeline.sample(t)),times.map(t=>createCaptionTimeline(model,plan).sample(t)));
});

test('all metrics honor four shared playback phases and clean pose-only stays for every selection',()=>{
 const config=read('snapshot.json'),data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 const creators={torso_turn_bend_tilt:createTorsoChoreography,hip_turn_on_spine_plane:createSpinePlaneChoreography,shoulder_turn_on_spine_plane:createSpinePlaneChoreography,shoulder_turn_tilt:createLateralTurnTiltChoreography,hip_turn_tilt:createLateralTurnTiltChoreography,spine_bend_tilt:createSpineBendTiltChoreography,spine_azimuth_polar_spin:createSpineTChoreography,hip_sway_thrust_lift:createHipDisplacementChoreography};
 for(const frame of config.selections.map(s=>s.frame))for(const [type,subtypes] of Object.entries(config.metrics))for(const [subtype,settings] of Object.entries(subtypes)){
  const model=explainSnapshot(data,metrics,{type,subtype,frame,...settings}),plan=creators[subtype](model);
  assert.ok(Math.abs(plan.duration-(settings.start_stay+settings.explain+(settings.transition??0)+settings.review+settings.end_stay)*1000)<1e-6);
  assert.equal(plan.segments.find(s=>s.id==='result-preview').duration,settings.start_stay*1000);
  assert.equal(plan.segments.find(s=>s.id==='finish').duration+plan.segments.find(s=>s.id==='reset').duration,settings.review*1000);
  assert.ok(Math.abs(plan.segments.find(s=>s.id==='finish').start-(settings.start_stay+settings.explain+(settings.transition??0))*1000)<1e-6);
  assert.ok(Math.abs(plan.segments.find(s=>s.id==='end-stay').start-(settings.start_stay+settings.explain+(settings.transition??0)+settings.review)*1000)<1e-6);
  assert.equal(plan.segments.find(s=>s.id==='end-stay').duration,settings.end_stay*1000);
  if(settings.transition!==undefined){
   const setup=plan.segments.find(s=>s.id==='review-transition'),review=plan.segments.find(s=>s.id==='finish');
   assert.equal(setup.duration,settings.transition*1000);
   const longer=creators[subtype](explainSnapshot(data,metrics,{type,subtype,frame,...settings,transition:settings.transition+2}));
   const longerReview=longer.segments.find(s=>s.id==='finish');
   const a=plan.sample(review.start+review.duration*.7),b=longer.sample(longerReview.start+longerReview.duration*.7);
   for(const key of Object.keys(a.values))assert.ok(Math.abs(a.values[key]-b.values[key])<1e-8,`${subtype}: transition changed replay tempo`);
   const ready=plan.sample(review.start),settled=plan.sample(review.start+review.duration*.6);
   for(const key of ['direction','up'])for(let i=0;i<3;i++)assert.ok(Math.abs(ready.camera[key][i]-settled.camera[key][i])<1e-8,`${subtype}: camera still moving in review`);
  }

  for(const id of ['result-preview','end-stay']){
   const segment=plan.segments.find(s=>s.id===id),state=plan.sample(segment.start+segment.duration*.5);
   assert.equal(state.referencePose,0);assert.equal(state.selectedPose,1);
   for(const key of ['referenceAxes','torsoAxes','originalReferenceAxes','originalTorsoAxes','plane'])assert.ok(!state[key],`${subtype} ${id}: stray ${key}`);
   assert.equal(state.sectors.length,0);assert.equal(state.guides?.length??0,0);
   for(const item of model.items)assert.equal(state.values[item.key],item.computed);
  }
  const noStay=creators[subtype](explainSnapshot(data,metrics,{type,subtype,frame,start_stay:0,explain:10,review:0,end_stay:0}));
  for(const t of [0,5000,9999,noStay.duration]){const state=noStay.sample(t);assert.ok(Object.values(state.values).every(Number.isFinite));assert.ok(Number.isFinite(state.progress));}
 }
});

test('review rotation unlocks after camera arrival and uses the content intersection',async()=>{
 const {reviewNavigation}=await import('../explain/choreography/review-navigation.js');
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 for(const [type,subtype,create] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography],['geometric','spine_azimuth_polar_spin',createSpineTChoreography],
  ['position','hip_sway_thrust_lift',createHipDisplacementChoreography],
 ]){
  const entry={type,subtype,frame:300,start_stay:2,explain:30,review:15,end_stay:2},plan=create(explainSnapshot(data,metrics,entry));
  const finish=plan.segments.find(s=>s.id==='finish'),hold=Math.min(1200,finish.duration*.2),active=finish.duration-hold;
  assert.equal(reviewNavigation(entry,plan,1000).restricted,false);
  assert.equal(reviewNavigation(entry,plan,10000).restricted,true);
  assert.equal(reviewNavigation(entry,plan,finish.start+hold+active*.21).restricted,type!=='position');
  const time=finish.start+hold+active*.5,state=plan.sample(time),policy=reviewNavigation(entry,plan,time,state);
  assert.equal(policy.restricted,false);
  if(type==='position')assert.equal(policy.pivot,null);
  else if(subtype==='spine_azimuth_polar_spin')assert.deepEqual(policy.pivot,state.torsoAxes.y.to);
  else assert.deepEqual(policy.pivot,state.sectors[0].origin);
 }
});
