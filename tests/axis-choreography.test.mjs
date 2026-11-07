import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {defineAxisFrame,frameDefinitions,constructAxes} from '../explain/choreography/axis-frame.js';
import {dot,length,sub} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const close=(a,b,tolerance=1e-10)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<tolerance,`${a} != ${b}`));
function setup(file='00.json',frame=300){const data=read('materials/data/3d_results/'+file),metrics=read('materials/data/metrics/'+file),model=explainSnapshot(data,metrics,{frame,type:'kinematic',subtype:'torso_turn_bend_tilt'});return {data,metrics,plan:createTorsoChoreography(model)};}
test('constructed reference frame equals the saved global orientation',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const {plan,metrics}=setup(file,0);
  for(const [i,key] of ['x','y','z'].entries())close(plan.frames.reference[key],metrics.meta.orientation.map(row=>row[i]));
 }
});
test('reference arrow grows right to left, shrinks to midpoint, then rotates about its head at fixed length',()=>{
 const {plan}=setup(),f=plan.frames.torso;
 const full=constructAxes(f,'grow',1);close(full.x.from,f.right);close(full.x.to,f.left);
 const half=constructAxes(f,'shrink',1);close(half.x.from,f.origin);close(half.x.to,f.left);assert.ok(Math.abs(length(sub(half.x.to,half.x.from))-f.length)<1e-12);
 for(const progress of [0,.25,.5,.75,1]){const s=constructAxes(f,'orthogonalize',progress);close(s.x.from,f.origin);assert.ok(Math.abs(length(sub(s.x.to,s.x.from))-f.length)<1e-12);}
 const corrected=constructAxes(f,'orthogonalize',1);assert.ok(Math.abs(dot(sub(corrected.x.to,corrected.x.from),f.y))<1e-12);
});
test('result preview appears first, then reference and current pose fade separately',()=>{
 const {plan}=setup(),sample=id=>plan.sample(plan.segments.find(s=>s.id===id).start);
 const first=plan.sample(0);assert.equal(first.referencePose,0);assert.equal(first.selectedPose,1);assert.equal(first.referenceAxes,null);
 const ref=sample('reference-grow');assert.equal(ref.referencePose,.28);assert.equal(ref.selectedPose,0);
 const torso=sample('torso-grow');assert.equal(torso.referencePose,0);assert.equal(torso.selectedPose,.28);
 const compare=sample('align');assert.ok(Math.abs(compare.selectedPose-.1)<1e-12);assert.ok(Math.abs(compare.torsoAxes.opacity-.42)<1e-12);
});
test('alignment matches origin and scale; Y-X-Z rotation ends exactly at torso axes',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const d=read('materials/data/3d_results/'+file);
  for(const frame of [0,Math.floor(d.reconstruction.length/2),d.reconstruction.length-1]){
   const {plan}=setup(file,frame),turn=plan.sample(plan.segments.find(s=>s.id==='turn').start),finish=plan.sample(plan.segments.find(s=>s.id==='finish').start);
   close(turn.referenceAxes.frame.origin,plan.frames.measurement.origin);assert.equal(turn.referenceAxes.frame.length,plan.frames.torso.length);
   for(const key of ['x','y','z'])close(finish.referenceAxes.frame[key],plan.frames.torso[key],1e-8);
   for(const [key,axis] of [['turn','y'],['bend','x'],['tilt','z']]){
    const s=plan.sample(plan.segments.find(s=>s.id===key).start+100);assert.equal(s.referenceAxes.highlight,axis);
   }
  }
 }
});

test('forward arrow preserves the completed plane until a separate opacity fade',()=>{
 const {plan}=setup(),f=plan.frames.reference;
 for(const p of [0,.25,.5,.75,1]){const state=constructAxes(f,'forward',p);assert.equal(state.plane,1);assert.equal(state.planeOpacity,1);}
 for(const p of [0,.25,.5,.75,1]){const state=constructAxes(f,'plane-fade',p);assert.equal(state.plane,1);assert.equal(state.planeOpacity,1-p);}
});
test('each construction step includes a hold interval and each camera settles before rotation',()=>{
 const {plan}=setup();
 for(const s of plan.segments.filter(s=>s.step)){
  assert.ok(s.duration>s.motionDuration);
  const end=plan.sample(s.start+s.motionDuration),hold=plan.sample(s.end-1);
  assert.deepEqual(end.referenceAxes,hold.referenceAxes);assert.deepEqual(end.torsoAxes,hold.torsoAxes);
 }
 for(const [key,axis] of [['turn','y'],['bend','x'],['tilt','z']]){
  const cameraStep=plan.segments.find(s=>s.id==='camera-'+key),rotation=plan.segments.find(s=>s.id===key);
  assert.equal(cameraStep.end,rotation.start);assert.ok(cameraStep.duration>cameraStep.motionDuration);
  const ready=plan.sample(cameraStep.start+cameraStep.motionDuration),start=plan.sample(rotation.start),during=plan.sample(rotation.start+rotation.motionDuration/2);
  close(ready.camera.direction,start.camera.direction);close(start.camera.direction,during.camera.direction);
  assert.ok(Math.abs(start.values[key])<1e-12);assert.ok(Math.abs(during.values[key])>0);
  const normal=start.referenceAxes.frame[axis];assert.ok(dot(start.camera.direction,normal)>(key==='turn'?.9:1-1e-10));
  assert.equal(during.sectors.length,2);
  assert.deepEqual(during.sectors.map(sector=>sector.direction),['x','y','z'].filter(direction=>direction!==axis));
  for(const sector of during.sectors){assert.equal(sector.axis,axis);assert.equal(sector.angle,during.values[key]);assert.ok(Math.abs(dot(sector.from,sector.normal))<1e-10);}
 }
});

test('component removal exposes the changing left/up angle and finishes at 90 degrees',()=>{
 const frame=defineAxisFrame([0,0,0],[2,1,0],[0,1,0]);
 const values=[0,.35,.55,.75,1].map(p=>constructAxes(frame,'orthogonalize',p).angleMarker.angle);
 assert.ok(values[0]<90);for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1]);
 assert.ok(Math.abs(values.at(-1)-90)<1e-12);
});
test('a component sector becomes a square with an outline at a right angle',async()=>{
 const THREE=await import('../vendor/three/three.module.js');
 const {createRotationSector}=await import('../explain/ui/rotation-sector.js');
 const scene=new THREE.Scene(),layer=createRotationSector(scene,p=>new THREE.Vector3(...p));
 const spec={origin:[0,0,0],from:[1,0,0],normal:[0,0,1],radius:1,axis:'z',rightAngle:true};
 layer.update({...spec,angle:60});assert.ok(scene.children[0].geometry.drawRange.count>6);assert.equal(scene.children[1].visible,false);
 const topology=scene.children[0].geometry.index.array.slice();
 layer.update({...spec,angle:90});assert.deepEqual(scene.children[0].geometry.index.array,topology);assert.equal(scene.children[1].visible,true);
 const vertices=scene.children[0].geometry.attributes.position;
 close([vertices.getX(49),vertices.getY(49),vertices.getZ(49)],[1,1,0]);
 layer.dispose();assert.equal(scene.children.length,0);
});

test('every source joint-pair arrow focuses, stretches, releases, then aligns',()=>{
 const {plan}=setup();
 for(const [prefix,name,growId,alignId] of [['reference','lateral','reference-grow','reference-shrink'],['torso','lateral','torso-grow','torso-shrink'],['torso','up','torso-up','torso-up-align']]){
  const steps=[`${prefix}-${name}-focus`,growId,`${prefix}-${name}-release`,alignId].map(id=>plan.segments.find(s=>s.id===id));
  assert.ok(steps.every(Boolean));steps.slice(1).forEach((s,i)=>assert.equal(s.start,steps[i].end));
  const sample=(step,p)=>plan.sample(step.start+step.motionDuration*p),axes=s=>prefix==='reference'?s.referenceAxes:s.torsoAxes,key=name==='up'?'y':'x';
  const focus=sample(steps[0],.5),beforeGrow=sample(steps[1],0),growing=sample(steps[1],.5),releasing=sample(steps[2],.5),aligned=sample(steps[3],1);
  assert.ok(focus.jointHighlights[0].strength>0&&focus.jointHighlights[0].strength<1);
  assert.ok(length(sub(axes(focus)[key].to,axes(focus)[key].from))<1e-10);
  assert.equal(beforeGrow.jointHighlights[0].strength,1);assert.equal(growing.jointHighlights[0].strength,1);
  assert.ok(releasing.jointHighlights[0].strength>0&&releasing.jointHighlights[0].strength<1);
  assert.equal(aligned.jointHighlights[0].strength,0);
  close(axes(aligned)[key].from,plan.frames[prefix].origin);
  assert.deepEqual(growing.jointHighlights[0].joints,plan.frames[prefix].jointPairs[name].joints);
 }
});
test('torso up starts at the actual spine joints before moving to the axis origin',()=>{
 const {plan}=setup(),f=plan.frames.torso;
 const raw=constructAxes(f,'up',1,'grow').y;
 close(raw.from,f.jointPairs.up.from);close(raw.to,f.jointPairs.up.to);
 const aligned=constructAxes(f,'up',1,'align').y;close(aligned.from,f.origin);
 assert.ok(Math.abs(length(sub(aligned.to,aligned.from))-f.length)<1e-10);
});

test('component-removal marker smoothly morphs with fixed vector endpoints',async()=>{
 const {sectorBoundary}=await import('../explain/ui/sector-shape.js');
 const frame=defineAxisFrame([0,0,0],[2,1,0],[0,1,0]);
 const marker=p=>constructAxes(frame,'orthogonalize',p).angleMarker;
 assert.equal(marker(.65).squareProgress,0);assert.equal(marker(1).squareProgress,1);
 let previous=0;
 for(const p of [.7,.8,.9,.99,1]){const m=marker(.28+.72*p);assert.ok(m.squareProgress>previous);previous=m.squareProgress;}
 const spec={origin:[0,0,0],from:[1,0,0],normal:[0,0,1],radius:1,axis:'z',rightAngle:true,angle:90};
 let last;
 for(let i=0;i<=100;i++){
  const {points}=sectorBoundary({...spec,squareProgress:i/100});
  close(points[0],[1,0,0]);close(points.at(-1),[0,1,0]);
  if(last)points.forEach((point,j)=>assert.ok(length(sub(point,last[j]))<.01));
  last=points;
 }
 close(last[48],[1,1,0]);
});

test('component removal pauses after the angle pie finishes fading in',()=>{
 const frame=defineAxisFrame([0,0,0],[2,1,0],[0,1,0]);
 const start=constructAxes(frame,'orthogonalize',0);
 for(const progress of [.05,.1,.18,.23,.28]){
  const state=constructAxes(frame,'orthogonalize',progress);
  close(state.x.to,start.x.to);assert.equal(state.angleMarker.angle,start.angleMarker.angle);
 }
 assert.equal(constructAxes(frame,'orthogonalize',.18).angleMarker.opacity,1);
 assert.notDeepEqual(constructAxes(frame,'orthogonalize',.3).x.to,start.x.to);
});

test('a separate fully visible angle hold precedes component removal',()=>{
 const {plan}=setup();
 for(const prefix of ['reference','torso']){
  const reveal=plan.segments.find(s=>s.id===prefix+'-angle-reveal');
  const removal=plan.segments.find(s=>s.id===prefix+'-orthogonalize');
  assert.equal(reveal.end,removal.start);
  assert.ok(reveal.duration-reveal.motionDuration>=2000);
  const key=prefix==='reference'?'referenceAxes':'torsoAxes';
  const start=plan.sample(reveal.start+reveal.motionDuration)[key];
  const end=plan.sample(reveal.end-1)[key];
  assert.equal(start.angleMarker.opacity,1);assert.deepEqual(start,end);
  assert.deepEqual(start.x,plan.sample(removal.start)[key].x);
 }
});

test('torso camera keeps global up with a readable turn axis and aligned bend and tilt views',()=>{
 const {plan}=setup();
 for(let time=0;time<=plan.duration;time+=97)assert.deepEqual(plan.sample(time).camera.up,plan.frames.reference.y);
 for(const [key,axis] of [['turn','y'],['bend','x'],['tilt','z']]){
  const stage=plan.segments.find(s=>s.id===key),state=plan.sample(stage.start);
  if(key==='turn'){
   const alignment=dot(state.camera.direction,state.referenceAxes.frame[axis]);
   assert.ok(Math.abs(alignment-Math.cos(25*Math.PI/180))<1e-10);
   assert.ok(alignment<Math.cos(18*Math.PI/180),'turn axis must remain outside the end-on marker range');
  }else assert.ok(dot(state.camera.direction,state.referenceAxes.frame[axis])>1-1e-10);
 }
});

test('Turn to Forward bend remains upright and avoids pole flips',async()=>{
 const {PerspectiveCamera,Vector3}=await import('../vendor/three/three.module.js');
 const {plan}=setup(),step=plan.segments.find(s=>s.id==='camera-bend');
 let previous;
 for(let i=0;i<=200;i++){
  const state=plan.sample(step.start+step.motionDuration*i/200);
  assert.ok(Math.abs(dot(state.camera.direction,plan.frames.reference.y))<.995);
  const camera=new PerspectiveCamera();camera.position.set(...state.camera.direction);camera.up.set(...state.camera.up);camera.lookAt(new Vector3());
  if(previous)assert.ok(previous.angleTo(camera.quaternion)<.04);
  previous=camera.quaternion.clone();
 }
 const turn=plan.segments.find(s=>s.id==='turn');
 close(plan.sample(turn.end-.001).camera.direction,plan.sample(step.start).camera.direction);
});

test('torso axes are built at the shoulders, then translated to the hip midpoint for all measurements',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('materials/data/3d_results/'+file),frame=Math.min(300,data.reconstruction.length-1),{plan}=setup(file,frame);
  const joint=name=>data.reconstruction[frame][data.joints.indexOf(name)];
  const hips=joint('left_hip').map((v,i)=>(v+joint('right_hip')[i])/2),shoulders=joint('left_shoulder').map((v,i)=>(v+joint('right_shoulder')[i])/2);
  const move=plan.segments.find(s=>s.id==='target-root');
  const start=plan.sample(move.start),middle=plan.sample(move.start+move.motionDuration/2),end=plan.sample(move.start+move.motionDuration);
  close(start.torsoAxes.frame.origin,shoulders);close(end.torsoAxes.frame.origin,hips);
  close(middle.torsoAxes.frame.origin,shoulders.map((v,i)=>(v+hips[i])/2));
  for(const axis of ['x','y','z'])close(start.torsoAxes.frame[axis],end.torsoAxes.frame[axis]);
  for(const id of ['turn','bend','tilt','finish']){
   const step=plan.segments.find(s=>s.id===id),state=plan.sample(step.start+step.duration*.5);
   close(state.referenceAxes.frame.origin,hips);close(state.torsoAxes.frame.origin,hips);close(state.focusOrigin,hips);
   for(const sector of state.sectors)close(sector.origin,hips);
  }
 }
});

test('component projection plane is independent of the later cross-product plane',()=>{
 const {plan}=setup();
 for(const prefix of ['reference','torso']){
  const frame=plan.frames[prefix];
  const reveal=plan.segments.find(s=>s.id===prefix+'-angle-reveal');
  const removal=plan.segments.find(s=>s.id===prefix+'-orthogonalize');
  const axesAt=(segment,f)=>plan.sample(segment.start+(segment.motionDuration??segment.duration)*f)[prefix==='reference'?'referenceAxes':'torsoAxes'];
  const first=axesAt(reveal,0),shown=axesAt(reveal,1),removing=axesAt(removal,.5),last=axesAt(removal,1);
  assert.equal(first.componentPlane.opacity,0);assert.equal(shown.componentPlane.opacity,1);
  assert.equal(removing.componentPlane.opacity,1);assert.equal(last.componentPlane.opacity,0);
  assert.ok(Math.abs(dot(shown.componentPlane.u,frame.y))<1e-10);
  assert.ok(Math.abs(dot(shown.componentPlane.v,frame.y))<1e-10);
  assert.equal(shown.plane,0);
  const cross=plan.segments.find(s=>s.id===prefix+'-plane'),crossAxes=axesAt(cross,1);
  assert.equal(crossAxes.componentPlane,undefined);assert.equal(crossAxes.plane,1);
 }
});
