import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {createSpinePlaneChoreography} from '../explain/choreography/spine-plane.js';
import {createLateralTurnTiltChoreography} from '../explain/choreography/lateral-turn-tilt.js';
import {createSpineBendTiltChoreography} from '../explain/choreography/spine-bend-tilt.js';
import {createSpineTChoreography} from '../explain/choreography/spine-t.js';
import {axisColors,brightAxisColors} from '../explain/palette.js';
import {sub,unit,dot,cross,length} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
const at=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
test('angular highlights only brighten existing visible rotation lines and never introduce an axis',()=>{
 for(const [type,subtype,create,keys] of [
  ['kinematic','torso_turn_bend_tilt',createTorsoChoreography,['turn','bend','tilt']],
  ['kinematic','hip_turn_on_spine_plane',createSpinePlaneChoreography,['turn']],['kinematic','shoulder_turn_on_spine_plane',createSpinePlaneChoreography,['turn']],
  ['geometric','shoulder_turn_tilt',createLateralTurnTiltChoreography,['turn','tilt']],['geometric','hip_turn_tilt',createLateralTurnTiltChoreography,['turn','tilt']],
  ['geometric','spine_bend_tilt',createSpineBendTiltChoreography,['bend','tilt']],['geometric','spine_azimuth_polar_spin',createSpineTChoreography,['azimuth','polar','spin']],
 ]){
  const plan=create(explainSnapshot(data,metrics,{type,subtype,frame:300,duration:40,stay:10}));
  for(const key of keys){
   const state=at(plan,key,.5),sector=state.sectors[0];let highlighted=0,candidates=0;
   for(const name of ['referenceAxes','torsoAxes','originalReferenceAxes','originalTorsoAxes']){
    const axes=state[name];if(!axes)continue;
    for(const axis of ['x','y','z']){
     const vector=axes[axis];if(!vector)continue;
     const parallel=Math.abs(dot(unit(sub(vector.to,vector.from)),unit(sector.normal)))>.99999,aligned=length(cross(sub(vector.from,sector.origin),unit(sector.normal)))<1e-6;
     if(parallel&&aligned)candidates++;
     if(!Object.values(brightAxisColors).includes(vector.color))continue;
     assert.ok(Math.abs(dot(unit(sub(vector.to,vector.from)),unit(sector.normal)))>.99999);
     assert.ok(length(cross(sub(vector.from,sector.origin),unit(sector.normal)))<1e-6);highlighted++;
    }
   }
   assert.equal(highlighted,candidates,`${subtype} ${key}: only existing rotation lines may highlight`);
   assert.equal(state.rotationAxis,undefined,'highlight must not create a hidden axis');
   assert.equal(at(plan,key,1).rotationAxis,undefined,'temporary axis must disappear after rotation');
  }
 }
});
test('torso axis brightness ramps smoothly and leaves thickness and other axis colors unchanged',()=>{
 const plan=createTorsoChoreography(explainSnapshot(data,metrics,{type:'kinematic',subtype:'torso_turn_bend_tilt',frame:300}));
 const first=at(plan,'turn',0),early=at(plan,'turn',.15),middle=at(plan,'turn',.5),end=at(plan,'turn',1);
 assert.equal(first.referenceAxes.y.color,undefined);assert.ok(early.referenceAxes.y.color);assert.notEqual(early.referenceAxes.y.color,brightAxisColors.y);
 assert.equal(middle.referenceAxes.y.color,brightAxisColors.y);assert.equal(end.referenceAxes.y.color,undefined);
 assert.equal(middle.referenceAxes.x.color,undefined);assert.equal(middle.referenceAxes.z.color,undefined);
 assert.equal(middle.referenceAxes.widthScale,undefined);assert.equal(axisColors.y,'#009eaf');
});
