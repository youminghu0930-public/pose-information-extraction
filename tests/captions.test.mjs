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
