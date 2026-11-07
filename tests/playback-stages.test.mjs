import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleTimeline} from '../explain/timing.js';
import {playbackStages} from '../explain/playback-stages.js';
const make=(settings)=>{const segments=[{id:'result-preview',duration:2200},{id:'intro',duration:1600},{id:'measure',duration:5000},{id:'finish',duration:5000,completion:true},{id:'reset',duration:1000}];return {segments,duration:scheduleTimeline(segments,settings)};};
test('stage tags cover the four authored phases and jump to their exact boundaries',()=>{
 const stages=playbackStages(make({start_stay:5,explain:40,review:15,end_stay:5}));
 assert.deepEqual(stages.map(({key,start,end})=>({key,start,end})),[
  {key:'start',start:0,end:5000},{key:'explain',start:5000,end:45000},
  {key:'review',start:45000,end:60000},{key:'end',start:60000,end:65000},
 ]);
});
test('disabled stays and review have no misleading jump targets',()=>{
 const stages=playbackStages(make({start_stay:0,explain:10,review:0,end_stay:0}));
 assert.deepEqual(stages.map(s=>s.key),['explain']);assert.equal(stages[0].start,0);assert.equal(stages[0].end,10000);
});

test('transition appears under Explain, without a fifth UI stage',async()=>{
 const {separateReviewTransition}=await import('../explain/choreography/review-transition.js');
 const entry={type:'kinematic',subtype:'torso_turn_bend_tilt',start_stay:1.5,explain:40,transition:2,review:10,end_stay:1};
 const plan=separateReviewTransition(make(entry),entry),stages=playbackStages(plan);
 assert.deepEqual(stages.map(s=>s.key),['start','explain','review','end']);
 assert.equal(stages[1].end-stages[1].start,42000);
 assert.equal(stages[2].start,43500);assert.equal(stages[2].end-stages[2].start,10000);
 const {reviewNavigation}=await import('../explain/choreography/review-navigation.js');
 const state={segment:'review-transition'};
 assert.equal(reviewNavigation(entry,plan,43000,state).restricted,true);
 const review=plan.segments.find(s=>s.id==='finish');
 assert.equal(reviewNavigation(entry,plan,review.start,{segment:'finish',progress:0}).restricted,false);
});
