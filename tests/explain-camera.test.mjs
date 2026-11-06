import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from '../vendor/three/three.module.js';
import {explainSnapshot} from '../explain/index.js';
import {createTorsoChoreography} from '../explain/choreography/torso.js';
import {jointPairPresentation} from '../explain/choreography/joint-pair.js';
import {fitPairCamera} from '../explain/ui/camera-framing.js';
import {arrowShape} from '../explain/ui/arrow-shape.js';
import {dot,sub,length} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
test('an axis set keeps one settled close-up through every construction step',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url))){
  if(!file.endsWith('.json'))continue;
  const data=read('3d_results/'+file),metrics=read('metrics/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   const plan=createTorsoChoreography(explainSnapshot(data,metrics,{frame,type:'kinematic',subtype:'torso_turn_bend_tilt'}));
   for(const prefix of ['reference','torso']){
    const camera=plan.segments.find(s=>s.id===`${prefix}-lateral-camera-in`),out=plan.segments.find(s=>s.id===`${prefix}-cross-camera-out`);
    assert.equal(plan.segments.filter(s=>s.constructionCamera===prefix&&s.view==='in').length,1);
    assert.equal(plan.segments.filter(s=>s.constructionCamera===prefix&&s.view==='out').length,1);
    assert.ok(camera.duration>camera.motionDuration);
    const settled=plan.sample(camera.start+camera.motionDuration);
    for(const segment of plan.segments.filter(s=>s.start>=camera.end&&s.end<=out.start)){
     for(const time of [segment.start,segment.start+segment.duration/2,segment.end-1]){
      const state=plan.sample(time);assert.equal(state.pairFocus.amount,1);assert.deepEqual(state.pairFocus.points,settled.pairFocus.points);
     }
    }
    assert.equal(plan.sample(out.start+out.motionDuration).pairFocus.amount,0);
   }
   for(const [prefix,name,key] of [['reference','lateral','x'],['torso','lateral','x'],['torso','up','y']]){
    const focus=plan.segments.find(s=>s.id===`${prefix}-${name}-focus`),ready=plan.sample(focus.start),axes=prefix==='reference'?ready.referenceAxes:ready.torsoAxes;
    assert.equal(ready.pairFocus.amount,1);assert.ok(length(sub(axes[key].to,axes[key].from))<1e-8);
    const pair=plan.frames[prefix].jointPairs[name],direction=sub(pair.to,pair.from);
    assert.ok(Math.abs(dot(ready.camera.direction,direction)/length(direction))<.95);
   }
  }
 }
});
test('pair framing preserves endpoint margin in portrait and landscape views',()=>{
 const points=[[-.4,0,0],[.4,.2,0],[0,.7,0]];
 for(const aspect of [.45,1,2.3]){
  const camera=new PerspectiveCamera(45,aspect,.001,100),half=Math.min(Math.PI/8,Math.atan(Math.tan(Math.PI/8)*aspect));
  const fit=fitPairCamera({points,amount:1},p=>new Vector3(...p),half,10,new Vector3());
  camera.position.copy(fit.target).add(new Vector3(0,0,fit.distance));camera.lookAt(fit.target);camera.updateMatrixWorld();
  for(const point of points){const p=new Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
 }
});
test('generic pair animation holds growth until close-up finishes and returns afterward',()=>{
 for(const t of [0,.1,.2,.239]){const q=jointPairPresentation(t);assert.equal(q.stretch,0);assert.equal(q.strength,0);}
 assert.equal(jointPairPresentation(.24).camera,1);
 assert.ok(jointPairPresentation(.55).stretch>0);assert.equal(jointPairPresentation(.55).camera,1);
 assert.equal(jointPairPresentation(.95).stretch,1);assert.equal(jointPairPresentation(1).camera,0);
});
test('short arrows retain a closed silhouette with no shaft beyond the tip',()=>{
 assert.equal(arrowShape(0,0,0,0,4.5),null);
 for(const width of [2,4.5,5.8])for(const size of [4,8,20,150]){
  const path=arrowShape(0,0,size,0,width);assert.ok(path.endsWith('Z'));
  const values=path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
  for(let i=0;i<values.length;i+=2){assert.ok(values[i]>=0&&values[i]<=size);assert.ok(Number.isFinite(values[i+1]));}
 }
});
test('cross-product close-ups settle before the plane and hold through the result',async()=>{
 const {crossProductView}=await import('../explain/choreography/cross-product.js');
 const data=read('3d_results/00.json'),metrics=read('metrics/00.json');
 const plan=createTorsoChoreography(explainSnapshot(data,metrics,{frame:300,type:'kinematic',subtype:'torso_turn_bend_tilt'}));
 for(const prefix of ['reference','torso']){
  const stages=Object.fromEntries(plan.segments.map(s=>[s.id,s]));
  const move=stages[prefix+'-cross-camera-in'],plane=stages[prefix+'-plane'];
  assert.equal(move.end,plane.start);assert.ok(move.duration>move.motionDuration);
  const ready=plan.sample(move.start+move.motionDuration),start=plan.sample(plane.start);
  assert.deepEqual(ready.camera,start.camera);assert.deepEqual(ready.pairFocus,start.pairFocus);
  for(const step of ['plane','forward','plane-fade']){
   const state=plan.sample(stages[prefix+'-'+step].start+500);
   assert.equal(state.pairFocus.amount,1);assert.deepEqual(state.camera,start.camera);
  }
  const view=crossProductView(plan.frames[prefix]);
  for(const aspect of [.5,1,2]){
   const half=Math.min(Math.PI/8,Math.atan(Math.tan(Math.PI/8)*aspect));
   const fit=fitPairCamera({points:view.points,amount:1},p=>new Vector3(...p),half,1e6,new Vector3());
   const camera=new PerspectiveCamera(45,aspect,.01,1e6);camera.quaternion.copy(view.orientation);
   camera.position.copy(fit.target).add(new Vector3(0,0,fit.distance).applyQuaternion(view.orientation));camera.updateMatrixWorld();
   for(const point of view.points){const p=new Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9);}
   for(const axis of ['x','y','z'])assert.ok(Math.abs(dot(camera.getWorldDirection(new Vector3()).toArray(),plan.frames[prefix][axis]))<.95);
  }
 }
});
test('close-up framing releases continuously into the review zoom',()=>{
 const points=[[0,0,0],[.2,.4,0]],target=new Vector3(.1,.2,0),distance=5,zoom=1.768;
 const zero=fitPairCamera({points,amount:0},p=>new Vector3(...p),Math.PI/8,distance,target,zoom);
 assert.equal(zero.zoom,zoom);assert.equal(zero.distance,distance);assert.ok(zero.target.distanceTo(target)<1e-12);
 const almost=fitPairCamera({points,amount:.000001},p=>new Vector3(...p),Math.PI/8,distance,target,zoom);
 assert.ok(Math.abs(almost.zoom-zero.zoom)<.000001);
 const close=fitPairCamera({points,amount:1},p=>new Vector3(...p),Math.PI/8,distance,target,zoom);
 assert.equal(close.zoom,1);
});
