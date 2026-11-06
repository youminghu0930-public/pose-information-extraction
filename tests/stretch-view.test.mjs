import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {sub,unit,dot} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
test('all joint-pair stretches settle broadside with no roll while preserving authored directions',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file),metrics=read('metrics/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   for(const subtype of ['torso_turn_bend_tilt','hip_turn_on_spine_plane','shoulder_turn_on_spine_plane']){
    const model=explainSnapshot(data,metrics,{frame,type:'kinematic',subtype});
    const plan=(subtype==='torso_turn_bend_tilt'?createTorsoChoreography:createSpinePlaneChoreography)(model);
    for(const step of plan.segments.filter(s=>s.jointPair?.phase==='grow'||s.phase==='grow')){
     const start=plan.sample(step.start),end=plan.sample(step.start+step.motionDuration);
     assert.deepEqual(start.camera,end.camera);
     const isReference=step.id.startsWith('reference-'),kind=step.jointPair?.name??step.pair;
     const pair=isReference?plan.frames.reference.jointPairs[kind]:kind==='up'?model.context.spine(subtype==='torso_turn_bend_tilt'?'upper':'lower'):model.context.lateral(subtype.startsWith('hip')?'hip':'shoulder');
     const from=isReference?pair.from:model.context.source(pair.from),to=isReference?pair.to:model.context.source(pair.to);
     const direction=unit(sub(to,from)),view=start.camera.direction,up=start.camera.up;
     assert.ok(Math.abs(dot(direction,view))<.91,`${file} ${subtype} ${step.id} is foreshortened`);
     if(subtype==='shoulder_turn_on_spine_plane'&&!isReference&&kind==='lateral')assert.ok(Math.abs(dot(direction,view))<=.5+1e-10);
     assert.deepEqual(up,plan.frames.reference.y);
    }
   }
  }
 }
});
test('readable authored views are retained and only end-on views are adjusted',async()=>{
 const {avoidEndOn}=await import('../explain/choreography/pair-camera.js');
 const {cameraOrientation,cameraBetween}=await import('../explain/choreography/camera.js');
 const pair={from:[0,0,0],to:[1,0,0]},up=[0,1,0];
 const original=cameraOrientation([0,0,1],up);
 assert.equal(avoidEndOn(original,pair,up),original);
 const endOn=cameraOrientation([1,0,.01],up),adjusted=avoidEndOn(endOn,pair,up);
 assert.notEqual(adjusted,endOn);
 assert.ok(Math.abs(cameraBetween(adjusted,adjusted,1).direction[0])<.9);
});
