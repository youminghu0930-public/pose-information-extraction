import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
import {sub,dot,cross,unit} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`));
const at=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
function setup(file,frame,subtype){const data=read('3d_results/'+file),metrics=read('metrics/'+file),model=explainSnapshot(data,metrics,{frame,type:'geometric',subtype,duration:30,stay:5});return {model,metrics,plan:(subtype==='hip_turn_tilt'?createLateralTurnTiltChoreography:createSpineBendTiltChoreography)(model)};}
test('hip and spine geometric demos match exports and finish aligned across every swing',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1])for(const subtype of ['hip_turn_tilt','spine_bend_tilt']){
   const {plan,metrics}=setup(file,frame,subtype);assert.equal(plan.duration,35000);
   const keys=subtype==='hip_turn_tilt'?['turn','tilt']:['bend','tilt'];
   for(const key of keys){const state=at(plan,key,1);close(state.referenceAxes.x.to,state.torsoAxes.x.to);close([state.values[key]],[metrics.metrics.geometric[subtype][key][frame]]);}
   const grow=at(plan,subtype==='hip_turn_tilt'?'lateral-grow':'spine-grow',.5);
   assert.deepEqual(grow.jointHighlights[0].joints,subtype==='hip_turn_tilt'?['right_hip','left_hip']:['root','clavicle']);
  }
 }
});
test('spine planes and direct reference vectors follow reference XY and YZ, with the target created after setup',()=>{
 const {plan}=setup('00.json',300,'spine_bend_tilt');
 assert.equal(at(plan,'reference-align',.5).plane,null);
 assert.equal(at(plan,'bend-plane',.5).torsoAxes,null);
 assert.equal(at(plan,'reference-trim',.5).torsoAxes,null);
 for(const [key,axis] of [['bend','z'],['tilt','x']]){
  const ready=at(plan,key+'-reference-fade',1),normal=plan.frames.reference[axis];
  assert.ok(Math.abs(dot(sub(ready.referenceAxes.x.to,ready.referenceAxes.x.from),normal))<1e-8);
  assert.ok(Math.abs(dot(unit(cross(ready.plane.u,ready.plane.v)),normal))>1-1e-8);
  assert.equal(ready.referenceAxes.x.colorAxis,ready.plane.axis);
  const start=at(plan,key+'-reference-fade',0),middle=at(plan,key+'-reference-fade',.5);
  close(start.referenceAxes.x.to,ready.referenceAxes.x.to);assert.equal(start.referenceAxes.x.opacity,0);assert.ok(middle.referenceAxes.x.opacity>0&&middle.referenceAxes.x.opacity<1);
  close(start.torsoAxes.x.to,ready.torsoAxes.x.to);assert.equal(ready.originalTorsoAxes,undefined);
  assert.ok(!plan.segments.some(s=>s.id===key+'-project'));
  const pause=plan.segments.find(s=>s.id===key+'-reference-fade');assert.ok(pause.duration-pause.motionDuration>0);
 }
});
test('both new demos preserve a stable review hold, upright cameras and finite states',()=>{
 for(const subtype of ['hip_turn_tilt','spine_bend_tilt']){
  const {plan}=setup('00.json',300,subtype),finish=plan.segments.find(s=>s.id==='finish'),end=at(plan,'tilt',1),held=plan.sample(finish.start+500);
  for(const key of ['referenceAxes','torsoAxes','values','plane','pairFocus'])assert.deepEqual(held[key],end[key]);
  close(held.camera.direction,end.camera.direction);close(held.camera.up,end.camera.up);
  for(let t=0;t<=plan.duration;t+=37){
   const state=plan.sample(t);assert.deepEqual(state.camera.up,plan.frames.reference.y);assert.ok(Object.values(state.values).every(Number.isFinite));
   for(const key of ['referenceAxes','torsoAxes'])if(state[key])for(const axis of ['x','y','z'])if(state[key][axis])assert.ok(state[key][axis].to.every(Number.isFinite));
  }
  const reviewed=plan.sample(finish.end-.001);close(Object.values(reviewed.values),Object.values(end.values));
 }
});

test('the spine keeps its full joint length and direct references match it',()=>{
 const {plan,model}=setup('00.json',300,'spine_bend_tilt');
 const spine=model.context.spine(),from=model.context.source(spine.from),to=model.context.source(spine.to),expected=Math.hypot(...sub(to,from));
 const grown=at(plan,'spine-grow',1),aligned=at(plan,'spine-align',1);
 close(grown.torsoAxes.x.from,aligned.torsoAxes.x.from);close(grown.torsoAxes.x.to,aligned.torsoAxes.x.to);
 for(const key of ['bend','tilt']){
  const state=at(plan,key+'-reference-fade',1);
  close(state.torsoAxes.x.from,from);close(state.torsoAxes.x.to,to);
  assert.ok(Math.abs(Math.hypot(...sub(state.referenceAxes.x.to,state.referenceAxes.x.from))-expected)<1e-8);
 }
});

test('spine bend and side-tilt cameras stay gently above level without rolling',()=>{
 const {plan}=setup('00.json',300,'spine_bend_tilt'),up=plan.frames.reference.y;
 for(const id of ['bend','tilt-camera','tilt-reference-fade','tilt']){
  const s=plan.segments.find(s=>s.id===id);
  for(const amount of [0,.25,.5,.75,1]){
   const state=plan.sample(s.start+s.motionDuration*amount),elevation=Math.asin(dot(state.camera.direction,up))*180/Math.PI;
   assert.ok(elevation>=6-1e-8&&elevation<=15+1e-8,`${id}: ${elevation}`);
   assert.deepEqual(state.camera.up,up);
  }
 }
});

test('spine inclination views sit on the same side as the measured lean',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   const {plan}=setup(file,frame,'spine_bend_tilt');
   for(const [key,axis] of [['bend','z'],['tilt','x']]){
    const state=at(plan,key,.5),lean=dot(plan.frames.torso.y,plan.frames.reference[axis]),cameraSide=dot(state.camera.direction,plan.frames.reference[axis]);
    if(Math.abs(lean)>1e-8)assert.ok(lean*cameraSide>0,`${file} ${frame} ${key}`);
    assert.deepEqual(state.camera.up,plan.frames.reference.y);
   }
  }
 }
});

test('spine bend and tilt retains a smaller translucent global reference throughout measurement',()=>{
 const {plan}=setup('00.json',300,'spine_bend_tilt');
 const start=at(plan,'reference-trim',0).referenceAxes,middle=at(plan,'reference-trim',.5).referenceAxes,end=at(plan,'reference-trim',1).referenceAxes;
 close([end.frame.length],[start.frame.length*.4]);close([end.opacity],[.3]);
 assert.ok(middle.frame.length<start.frame.length&&middle.frame.length>end.frame.length);
 assert.ok(middle.opacity<1&&middle.opacity>.3);
 for(const id of ['spine-focus','spine-grow','bend-camera','bend','plane-switch','tilt-plane','tilt','finish']){
  const axes=at(plan,id,.5).originalReferenceAxes;
  close(axes.frame.origin,end.frame.origin);close([axes.frame.length],[end.frame.length]);close([axes.opacity],[.3]);
  for(const axis of ['x','y','z']){assert.ok(axes[axis]);close(axes[axis].to,end[axis].to);}
 }
});
