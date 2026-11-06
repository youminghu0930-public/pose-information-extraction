import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {unit,sub,dot,rotate} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8));
const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
const planFor=extra=>createSpinePlaneChoreography(explainSnapshot(data,metrics,{frame:300,type:'kinematic',subtype:'hip_turn_on_spine_plane',duration:30,stay:15,...extra}));
const sample=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
test('hip-plane choreography exposes correct joints, projections and signed final turn',()=>{
 const plan=planFor();assert.equal(plan.duration,45000);
 assert.equal(plan.sample(0).referencePose,0);assert.equal(plan.sample(0).selectedPose,1);
 assert.deepEqual(sample(plan,'lateral-grow',.5).jointHighlights[0].joints,['right_hip','left_hip']);
 assert.deepEqual(sample(plan,'up-grow',.5).jointHighlights[0].joints,['root','torso']);
 const projected=sample(plan,'lateral-project',1),n=plan.frames.torso.y;
 for(const key of ['referenceAxes','torsoAxes'])assert.ok(Math.abs(dot(sub(projected[key].x.to,projected[key].x.from),n))<1e-8);
 const start=sample(plan,'turn',0),end=sample(plan,'turn',1);
 close(rotate(unit(sub(start.referenceAxes.x.to,start.referenceAxes.x.from)),n,plan.values.turn),unit(sub(end.torsoAxes.x.to,end.torsoAxes.x.from)));
 close(end.referenceAxes.x.to,end.torsoAxes.x.to);assert.equal(end.values.turn,metrics.metrics.kinematic.hip_turn_on_spine_plane.turn[300]);
 assert.equal(end.sectors.length,1);
});
test('each projection first reveals its pie and pauses while both vectors stay still',()=>{
 const plan=planFor();
 for(const [id,key,next] of [['baseline-angle','referenceAxes','baseline-project'],['lateral-angle','torsoAxes','lateral-project']]){
  const s=plan.segments.find(s=>s.id===id),a=sample(plan,id,1),b=plan.sample(s.end-1);
  assert.ok(s.duration-s.motionDuration>500);assert.deepEqual(a[key],b[key]);assert.equal(a[key].angleMarker.opacity,1);
  close(a[key].x.to,sample(plan,next,0)[key].x.to);
 }
});
test('sampling the entire timeline stays finite and the review fits stay',()=>{
 for(const subtype of ['hip_turn_on_spine_plane','shoulder_turn_on_spine_plane']){
  const plan=planFor({subtype}),finish=plan.segments.find(s=>s.id==='finish');
  assert.equal(finish.duration,15000);
  for(let t=0;t<=plan.duration;t+=71){
   const state=plan.sample(t);assert.ok(Number.isFinite(state.values.turn));
   for(const key of ['referenceAxes','torsoAxes'])if(state[key])for(const axis of ['x','y','z'])if(state[key][axis])for(const point of ['from','to'])assert.ok(state[key][axis][point].every(Number.isFinite));
  }
  const a=plan.sample(finish.start+finish.duration*(.08+.92*.42)),b=plan.sample(finish.start+finish.duration*(.08+.92*.47));
  assert.deepEqual(a.referenceAxes,b.referenceAxes);assert.equal(a.values.turn,0);
  const end=plan.sample(finish.end-.001);assert.ok(Math.abs(end.values.turn-plan.values.turn)<1e-8);
 }
});
test('full reference frame waits for the plane, moves together and trims before projection',()=>{
 const plan=planFor(),order=['reference-grow','reference-forward','up-grow','plane','reference-align','reference-trim','baseline-project','baseline-fade','lateral-grow','lateral-project','lateral-fade','turn'];
 const indexes=order.map(id=>plan.segments.findIndex(s=>s.id===id));
 indexes.forEach((index,i)=>{assert.ok(index>=0);if(i)assert.ok(index>indexes[i-1]);});
 const ref=sample(plan,'reference-plane-fade',1).referenceAxes;
 for(const axis of ['x','y','z'])assert.ok(ref[axis]);
 const waiting=sample(plan,'plane',1).referenceAxes;
 close(waiting.frame.origin,plan.frames.reference.origin);
 const moved=sample(plan,'reference-align',1).referenceAxes;
 close(moved.frame.origin,plan.frames.torso.origin);
 for(const axis of ['x','y','z']){
  close(moved[axis].from,plan.frames.torso.origin);
  close(moved.frame[axis],plan.frames.reference[axis]);
 }
 const fading=sample(plan,'reference-trim',.5).referenceAxes;
 assert.ok(fading.y.opacity>0&&fading.y.opacity<1);assert.equal(fading.y.opacity,fading.z.opacity);
 assert.equal(fading.x.opacity,undefined);
 const projected=sample(plan,'baseline-project',0).referenceAxes;
 assert.equal(projected.y,null);assert.equal(projected.z,null);
 assert.equal(sample(plan,'plane',.5).torsoAxes.x,null);
 assert.equal(sample(plan,'baseline-project',.5).torsoAxes.x,null);
});
test('projection preserves the original until a separate fade leaves only its projection',()=>{
 const plan=planFor();
 for(const [projectId,fadeId,original,key] of [['baseline-project','baseline-fade','originalReferenceAxes','referenceAxes'],['lateral-project','lateral-fade','originalTorsoAxes','torsoAxes']]){
  const a=sample(plan,projectId,.2),b=sample(plan,projectId,.8);
  assert.deepEqual(a[original],b[original]);assert.notDeepEqual(a[key].x.to,b[key].x.to);
  const fading=sample(plan,fadeId,.5);assert.ok(fading[original].opacity>0&&fading[original].opacity<a[original].opacity);
  const done=sample(plan,fadeId,1);assert.equal(done[original],undefined);
  assert.ok(Math.abs(dot(sub(done[key].x.to,done[key].x.from),plan.frames.torso.y))<1e-8);
 }
});
test('camera up stays aligned to global up through construction, projections and review',()=>{
 const plan=planFor();
 for(let t=0;t<=plan.duration;t+=53)assert.deepEqual(plan.sample(t).camera.up,plan.frames.reference.y);
});

test('reference joint focus never replays the pose fade or resets the close-up camera',()=>{
 const plan=planFor();
 assert.equal(new Set(plan.segments.map(s=>s.id)).size,plan.segments.length);
 const camera=sample(plan,'reference-lateral-camera-in',1);
 const focus=sample(plan,'reference-lateral-focus',.5);
 const grow=sample(plan,'reference-grow',0);
 for(const state of [focus,grow]){
  assert.deepEqual(state.camera,camera.camera);assert.deepEqual(state.pairFocus,camera.pairFocus);
  assert.equal(state.referencePose,.28);assert.equal(state.selectedPose,0);
 }
 assert.ok(focus.jointHighlights[0].strength>0);
 close(focus.referenceAxes.x.from,grow.referenceAxes.x.from);
 close(focus.referenceAxes.x.to,grow.referenceAxes.x.to);
});
test('camera settles facing the difference plane before each projection and stays upright',()=>{
 const plan=planFor();
 for(const prefix of ['baseline','lateral']){
  const ready=sample(plan,prefix+'-camera',1),angle=sample(plan,prefix+'-angle',0),moving=sample(plan,prefix+'-project',.5);
  assert.deepEqual(ready.camera,angle.camera);assert.deepEqual(ready.camera,moving.camera);
  assert.deepEqual(moving.camera.up,plan.frames.reference.y);
  const original=moving[prefix==='baseline'?'originalReferenceAxes':'originalTorsoAxes'];
  const d=unit(sub(original.x.to,original.x.from)),n=plan.frames.torso.y;
  const normal=unit([n[1]*d[2]-n[2]*d[1],n[2]*d[0]-n[0]*d[2],n[0]*d[1]-n[1]*d[0]]);
  assert.ok(Math.abs(dot(normal,moving.camera.direction))>.98);
 }
});

test('the rotation and review never restore the hidden lower-spine arrow',()=>{
 const plan=planFor(),turn=plan.segments.find(s=>s.id==='turn');
 for(let time=turn.start;time<plan.duration;time+=41){
  const state=plan.sample(time);
  assert.equal(state.referenceAxes.y,null);
  assert.equal(state.torsoAxes.y,null);
  assert.equal([state.referenceAxes,state.torsoAxes,state.originalReferenceAxes,state.originalTorsoAxes].filter(axes=>axes?.y).length,0);
 }
});
test('shoulder variant uses the shoulder pair with the same lower spine and correct exported turn',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file),metrics=read('metrics/'+file);
  const frame=Math.min(300,data.reconstruction.length-1);
  const entry={frame,type:'kinematic',subtype:'shoulder_turn_on_spine_plane',duration:30,stay:5};
  const model=explainSnapshot(data,metrics,entry),plan=createSpinePlaneChoreography(model);
  const growing=sample(plan,'lateral-grow',.5),up=sample(plan,'up-grow',.5);
  assert.deepEqual(growing.jointHighlights[0].joints,['right_shoulder','left_shoulder']);
  close(growing.torsoAxes.x.from,data.reconstruction[frame][data.joints.indexOf('right_shoulder')]);
  assert.deepEqual(up.jointHighlights[0].joints,['root','torso']);
  const finish=sample(plan,'turn',1);
  close([finish.values.turn],[metrics.metrics.kinematic.shoulder_turn_on_spine_plane.turn[frame]]);
  close(finish.referenceAxes.x.to,finish.torsoAxes.x.to);
  assert.equal(plan.duration,35000);
 }
});

test('completed result holds before review motion or value reset',()=>{
 const plan=planFor(),finish=plan.segments.find(s=>s.id==='finish');
 const final=sample(plan,'turn',1);
 for(const offset of [0,300,1000]){
  const state=plan.sample(finish.start+offset);
  for(const key of ['referenceAxes','torsoAxes','camera','values','plane','pairFocus','selectedPose'])assert.deepEqual(state[key],final[key]);
 }
});
