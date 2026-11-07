import {axisColors} from '../explain/palette.js';
import {measurementColor} from '../explain/measurement-colors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {sub,unit,dot} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`));
const sample=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
function setup(file='00.json',frame=300){const data=read('3d_results/'+file),metrics=read('metrics/'+file);return {data,metrics,plan:createLateralTurnTiltChoreography(explainSnapshot(data,metrics,{frame,type:'geometric',subtype:'shoulder_turn_tilt',duration:30,stay:5}))};}
test('shoulder turn and tilt match exported measurements and align their vectors',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   const {plan,metrics}=setup(file,frame);assert.equal(plan.duration,35000);
   const end=sample(plan,'tilt',1);
   close([end.values.turn,end.values.tilt],[metrics.metrics.geometric.shoulder_turn_tilt.turn[frame],metrics.metrics.geometric.shoulder_turn_tilt.tilt[frame]]);
   close(end.referenceAxes.x.to,end.torsoAxes.x.to);
   const turn=sample(plan,'turn',1);close(turn.referenceAxes.x.to,turn.torsoAxes.x.to);
   assert.ok(Math.abs(dot(sub(turn.torsoAxes.x.to,turn.torsoAxes.x.from),plan.frames.reference.y))<1e-8);
  }
 }
});
test('the shoulder pair stretches broadside and projection keeps then fades the original',()=>{
 const {plan}=setup(),grow=sample(plan,'lateral-grow',.5);
 assert.deepEqual(grow.jointHighlights[0].joints,['right_shoulder','left_shoulder']);
 assert.ok(Math.abs(dot(plan.frames.torso.x,grow.camera.direction))<.51);
 const projected=sample(plan,'projection',1);assert.ok(projected.originalTorsoAxes);
 assert.equal(sample(plan,'original-fade',1).originalTorsoAxes,undefined);
 const angle=plan.segments.find(s=>s.id==='projection-angle');assert.ok(angle.duration>angle.motionDuration);
});
test('review holds the final result first and the full timeline stays finite and upright',()=>{
 const {plan}=setup(),finish=plan.segments.find(s=>s.id==='finish'),end=sample(plan,'tilt',1);
 const held=plan.sample(finish.start+500);
 for(const key of ['values','camera','referenceAxes','torsoAxes','plane','pairFocus'])assert.deepEqual(held[key],end[key]);
 for(let t=0;t<=plan.duration;t+=43){
  const state=plan.sample(t);assert.deepEqual(state.camera.up,plan.frames.reference.y);
  assert.ok(Object.values(state.values).every(Number.isFinite));
  for(const key of ['referenceAxes','torsoAxes'])if(state[key])for(const axis of ['x','y','z'])if(state[key][axis])assert.ok(state[key][axis].to.every(Number.isFinite));
 }
 const reviewed=plan.sample(finish.end-.001);close([reviewed.values.turn,reviewed.values.tilt],[end.values.turn,end.values.tilt]);
});

test('reference axes finish moving up before the horizontal plane is created',()=>{
 const {plan}=setup(),align=plan.segments.find(s=>s.id==='reference-align'),plane=plan.segments.find(s=>s.id==='plane');
 assert.equal(align.end,plane.start);
 assert.equal(sample(plan,'reference-align',.5).plane,null);
 const ready=sample(plan,'reference-align',1);assert.equal(ready.plane,null);
 close(ready.referenceAxes.frame.origin,plan.frames.torso.origin);
 const growing=sample(plan,'plane',.5);assert.ok(growing.plane.size>0);
 close(growing.referenceAxes.frame.origin,plan.frames.torso.origin);
});

test('target shoulder vector waits until the plane is complete and reference up and forward have faded',()=>{
 const {plan}=setup(),plane=plan.segments.find(s=>s.id==='plane'),trim=plan.segments.find(s=>s.id==='reference-trim'),focus=plan.segments.find(s=>s.id==='lateral-focus');
 assert.equal(plane.end,trim.start);assert.equal(trim.end,focus.start);
 for(const id of ['reference-align','plane','reference-trim'])assert.equal(sample(plan,id,.5).torsoAxes,null);
 const fading=sample(plan,'reference-trim',.5);assert.ok(fading.referenceAxes.y.opacity>0&&fading.referenceAxes.y.opacity<1);assert.ok(fading.referenceAxes.z.opacity>0&&fading.referenceAxes.z.opacity<1);
 for(const id of ['lateral-focus','lateral-grow','lateral-release','lateral-align']){
  const state=sample(plan,id,.5);assert.equal(state.referenceAxes.y,null);assert.equal(state.referenceAxes.z,null);assert.ok(state.plane.size>0);
 }
});

test('reference up is hidden once the plane is established',()=>{
 const {plan}=setup();
 for(const id of ['lateral-grow','projection','turn','tilt']){
  const state=sample(plan,id,.5);assert.equal(state.referenceAxes.y,null);assert.equal(state.torsoAxes?.y??null,null);
 }
});

test('hip and shoulder reference and number transition to the plane color after turn',()=>{
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 for(const subtype of ['shoulder_turn_tilt','hip_turn_tilt']){
  const plan=createLateralTurnTiltChoreography(explainSnapshot(data,metrics,{frame:300,type:'geometric',subtype,duration:30,stay:5}));
  const start=sample(plan,'tilt-camera',0),middle=sample(plan,'tilt-camera',.5),end=sample(plan,'tilt-camera',1);
  assert.equal(start.referenceAxes.x.color,axisColors.x);assert.equal(end.referenceAxes.x.color,axisColors.y);
  assert.notEqual(middle.referenceAxes.x.color,axisColors.x);assert.notEqual(middle.referenceAxes.x.color,axisColors.y);
  for(const state of [start,middle,end])assert.equal(state.valueColors.tilt,state.referenceAxes.x.color);
  assert.equal(sample(plan,'tilt',.5).referenceAxes.x.color,axisColors.y);
  assert.equal(measurementColor(subtype,'tilt'),axisColors.y);
  assert.equal(measurementColor(subtype,'turn'),axisColors.x);
 }
 assert.equal(measurementColor('spine_bend_tilt','bend'),axisColors.z);
 assert.equal(measurementColor('spine_bend_tilt','tilt'),axisColors.x);
 assert.equal(measurementColor('torso_turn_bend_tilt','turn'),axisColors.y);
});
