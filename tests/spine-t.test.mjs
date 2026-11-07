import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from '../vendor/three/three.module.js';
import {joinedTStemShape} from '../explain/ui/arrow-shape.js';
import {explainSnapshot} from '../explain/index.js';
import {createSpineTChoreography} from '../explain/choreography/spine-t.js';
import {sub,dot,length} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
function setup(file='00.json',frame=300){const data=read('3d_results/'+file),metrics=read('metrics/'+file),model=explainSnapshot(data,metrics,{frame,type:'geometric',subtype:'spine_azimuth_polar_spin',duration:40,stay:10});return {data,metrics,plan:createSpineTChoreography(model)};}
const at=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
test('a rigid T reaches the exported spine orientation and shoulder twist for every swing',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   const {plan,metrics}=setup(file,frame);assert.equal(plan.duration,50000);
   const end=at(plan,'spin',1);
   close(end.referenceAxes.y.to,end.torsoAxes.y.to);close(end.referenceAxes.x.from,end.torsoAxes.x.from);close(end.referenceAxes.x.to,end.torsoAxes.x.to);
   for(const key of ['azimuth','polar','spin'])close([end.values[key]],[metrics.metrics.geometric.spine_azimuth_polar_spin[key][frame]]);
   const stem=length(sub(end.torsoAxes.y.to,end.torsoAxes.y.from)),bar=length(sub(end.torsoAxes.x.to,end.torsoAxes.x.from));
   for(const key of ['azimuth','polar','spin'])for(const p of [0,.3,.7,1]){
    const state=at(plan,key,p),a=state.referenceAxes;
    close([length(sub(a.y.to,a.y.from)),length(sub(a.x.to,a.x.from))],[stem,bar]);
    assert.ok(Math.abs(dot(sub(a.y.to,a.y.from),sub(a.x.to,a.x.from)))<1e-7);
    close(a.x.from.map((v,i)=>(v+a.x.to[i])/2),a.y.to);
   }
   assert.equal(end.sectors.length,2);
  }
 }
});
test('T construction emphasizes the actual source pairs and keeps the current-pose opening',()=>{
 const {plan}=setup();assert.equal(plan.sample(0).referencePose,0);assert.deepEqual(plan.sample(0).values,plan.values);
 assert.deepEqual(at(plan,'spine-grow',.5).jointHighlights[0].joints,['root','clavicle']);
 assert.deepEqual(at(plan,'shoulder-grow',.5).jointHighlights[0].joints,['right_shoulder','left_shoulder']);
 for(const id of ['spine-grow','shoulder-grow'])assert.deepEqual(at(plan,id,0).camera,at(plan,id,1).camera);
});
test('T review holds the completed result, then replays all rotations upright',()=>{
 const {plan}=setup(),finish=plan.segments.find(s=>s.id==='finish'),end=at(plan,'spin',1),held=plan.sample(finish.start+500);
 close(held.camera.direction,end.camera.direction);assert.deepEqual(held.values,end.values);assert.deepEqual(held.referenceAxes,end.referenceAxes);
 for(let t=0;t<=plan.duration;t+=47){
  const state=plan.sample(t);assert.deepEqual(state.camera.up,plan.frames.reference.y);assert.ok(Object.values(state.values).every(Number.isFinite));
  for(const key of ['referenceAxes','torsoAxes'])if(state[key])for(const axis of ['x','y','z'])if(state[key][axis])assert.ok(state[key][axis].to.every(Number.isFinite));
 }
 const reviewed=plan.sample(finish.end-.001);close(Object.values(reviewed.values),Object.values(plan.values));
});
test('reference axes rearrange together into a rooted T and keep forward until azimuth is complete',()=>{
 const {plan}=setup(),move=plan.segments.find(s=>s.id==='reference-align');
 const start=at(plan,'reference-align',0),middle=at(plan,'reference-align',.5),end=at(plan,'reference-align',1);
 for(const axis of ['x','y','z']){
  assert.ok(start.referenceAxes[axis]);assert.ok(middle.referenceAxes[axis]);assert.ok(end.referenceAxes[axis]);
  for(const point of ['from','to'])close(middle.referenceAxes[axis][point],start.referenceAxes[axis][point].map((v,i)=>(v+end.referenceAxes[axis][point][i])/2));
 }
 assert.ok(Math.abs(length(sub(end.referenceAxes.z.to,end.referenceAxes.z.from))/length(sub(end.referenceAxes.y.to,end.referenceAxes.y.from))-.5)<1e-7);
 assert.equal(end.referenceAxes.z.opacity,.4);
 assert.equal(start.referenceAxes.z.opacity,1);
 assert.ok(middle.referenceAxes.z.opacity>.4&&middle.referenceAxes.z.opacity<1);
 close(end.referenceAxes.y.from,plan.frames.torso.origin);close(end.referenceAxes.z.from,plan.frames.torso.origin);
 close(end.referenceAxes.x.from.map((v,i)=>(v+end.referenceAxes.x.to[i])/2),end.referenceAxes.y.to);
 for(const id of ['spine-grow','shoulder-grow','crossbar-project','azimuth-camera','azimuth']){
  const state=at(plan,id,.5);assert.ok(state.referenceAxes.x&&state.referenceAxes.y&&state.referenceAxes.z);
  assert.equal(state.referenceAxes.opacity,1);assert.equal(state.referenceAxes.y.keepVisible,true);
 }
 const final=at(plan,'azimuth',1),fade=at(plan,'forward-fade',.5);
 close(final.referenceAxes.z.to,fade.referenceAxes.z.to);assert.ok(fade.referenceAxes.z.opacity>0&&fade.referenceAxes.z.opacity<1);
 assert.equal(at(plan,'polar',.5).referenceAxes.z,null);
 const plane=plan.segments.find(s=>s.id==='azimuth-plane'),camera=plan.segments.find(s=>s.id==='azimuth-camera');assert.equal(camera.end,plane.start);
 assert.equal(at(plan,'azimuth-camera',1).plane,null);assert.ok(at(plan,'azimuth-plane',.5).plane.size>0);
 for(const key of ['spine','shoulder']){assert.equal(at(plan,key+'-align',0).torsoAxes[key==='spine'?'y':'x'].shapeBlend,0);assert.equal(at(plan,key+'-align',1).torsoAxes[key==='spine'?'y':'x'].shapeBlend,1);}
 assert.ok(move.duration>move.motionDuration);
});

test('shoulder projection plane remains until the camera moves and shrinks during that move',()=>{
 const {plan}=setup();
 const projected=at(plan,'crossbar-original-fade',1),hold=at(plan,'reference-t',1);
 close(projected.plane.origin,hold.plane.origin);assert.equal(projected.plane.size,hold.plane.size);
 const start=at(plan,'azimuth-camera',0),middle=at(plan,'azimuth-camera',.5),end=at(plan,'azimuth-camera',1);
 assert.equal(start.plane.size,hold.plane.size);close([middle.plane.size],[hold.plane.size*.5]);
 assert.equal(middle.plane.opacity,1);assert.equal(end.plane,null);
 assert.ok(at(plan,'azimuth-plane',.5).plane.size>0);
});

test('T junction stays on the root side of the crossbar throughout all swing camera paths',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const {plan}=setup(file,Math.floor(read('3d_results/'+file).reconstruction.length/2)),root=new Vector3(...plan.frames.torso.origin),distance=plan.frames.torso.length*4;
  for(const segment of plan.segments)for(const fraction of [0,.25,.5,.75,.999]){
   const state=at(plan,segment.id,fraction),camera=new PerspectiveCamera(45,1.4,.00001,1000);
   camera.position.copy(root).addScaledVector(new Vector3(...state.camera.direction),distance);camera.up.set(...state.camera.up);camera.lookAt(root);camera.updateMatrixWorld();
   const project=p=>{const q=new Vector3(...p).project(camera);return {x:(q.x+1)*500,y:(1-q.y)*350};};
   for(const [axes,width] of [[state.referenceAxes,2.7],[state.torsoAxes,4.5]]){
    if(axes?.y?.stopAt!=='x'||axes.x?.shape!=='bar'||axes.y?.shape!=='bar')continue;
    const start=project(axes.y.from),end=project(axes.y.to),a=project(axes.x.from),b=project(axes.x.to);
    const shape=joinedTStemShape(start,end,a,b,width);if(!shape)continue;
    const length=Math.hypot(b.x-a.x,b.y-a.y);let nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
    if((start.x-a.x)*nx+(start.y-a.y)*ny<0){nx=-nx;ny=-ny;}
    const points=[...shape.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(m=>({x:+m[1],y:+m[2]}));
    const distances=points.map(p=>(p.x-a.x)*nx+(p.y-a.y)*ny-width/2);
    assert.ok(distances.every(d=>d>=-1e-7),`${file} ${segment.id}: protruding stem`);
    assert.ok(distances.some(d=>Math.abs(d)<1e-7),`${file} ${segment.id}: disconnected stem`);
   }
  }
 }
});

test('shoulder plane remains visibly open throughout projection and the overhead transition',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const {plan}=setup(file,Math.floor(read('3d_results/'+file).reconstruction.length/2));
  const normal=plan.frames.torso.y;
  for(const id of ['crossbar-camera','crossbar-angle','crossbar-project','crossbar-original-fade','reference-t','azimuth-camera']){
   for(const p of [0,.1,.25,.5,.75,.9,1]){
    const state=at(plan,id,p);
    assert.ok(dot(state.camera.direction,normal)>=.4-1e-7,`${file} ${id}: edge-on plane`);
    close(state.camera.up,plan.frames.reference.y);
   }
  }
  for(const [from,to] of [['crossbar-plane','crossbar-camera'],['crossbar-camera','crossbar-angle'],['reference-t','azimuth-camera'],['azimuth-camera','azimuth-plane']]){
   close(at(plan,from,1).camera.direction,at(plan,to,0).camera.direction);
  }
 }
});

test('reference forward stays an arrow when construction pulls back to the overview',()=>{
 const {plan}=setup();
 for(const id of ['reference-forward','reference-plane-fade','reference-cross-camera-out','selected-focus','measurement-camera']){
  for(const p of [0,.25,.5,.75,1]){
   const state=at(plan,id,p);
   assert.ok(Math.abs(dot(state.camera.direction,plan.frames.reference.z))<Math.cos(18*Math.PI/180),`${id}: forward is end-on`);
   assert.ok(state.referenceAxes.z);
   assert.equal(state.referenceAxes.z.shape,undefined);
  }
 }
});
