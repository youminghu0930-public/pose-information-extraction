import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainSnapshot} from '../explain/index.js';
import {createHipDisplacementChoreography} from '../explain/choreography/hip-displacement.js';
import {length,sub} from '../explain/math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+p,import.meta.url),'utf8'));
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`));
function setup(file='00.json',frame=300){
 const data=read('3d_results/'+file),metrics=read('metrics/'+file),model=explainSnapshot(data,metrics,{frame,type:'position',subtype:'hip_sway_thrust_lift',duration:40,stay:10});
 return {data,metrics,model,plan:createHipDisplacementChoreography(model)};
}
const at=(plan,id,p)=>{const s=plan.segments.find(s=>s.id===id);return plan.sample(s.start+(s.motionDuration??s.duration)*p);};
test('displacement components reach the exported signed values and selected root across every swing',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/3d_results/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const data=read('3d_results/'+file);
  for(const frame of [0,Math.floor(data.reconstruction.length/2),data.reconstruction.length-1]){
   const {plan,metrics}=setup(file,frame),g=plan.geometry;assert.equal(plan.duration,50000);
   close(g.components[0].from,g.referenceRoot);close(g.components.at(-1).to,g.selectedRoot);
   g.components.forEach((v,i)=>{
    close([v.value],[metrics.metrics.position.hip_sway_thrust_lift[v.key][frame]]);
    close([length(sub(v.to,v.from))/g.scale],[Math.abs(v.value)]);
    if(i)close(v.from,g.components[i-1].to);
    const end=at(plan,v.key,1);close([end.values[v.key]],[v.value]);
   });
   close(Object.values(at(plan,'lift',1).values),Object.values(plan.values));
   const opening=at(plan,'result-preview',.5);assert.equal(opening.referencePose,0);assert.equal(opening.selectedPose,1);assert.deepEqual(opening.values,plan.values);
   close(Object.values(at(plan,'intro',1).values),[0,0,0]);
  }
 }
});
test('normalization uses the saved ankle origin and exact reference mean of the ten scaler bones',()=>{
 const {plan,model}=setup(),g=plan.geometry;
 close(model.context.normalized(g.origin),[0,0,0]);
 close([g.meanLength],[1]);close([length(sub(g.unitEnd,g.origin))],[g.scale]);assert.equal(g.bones.length,10);
 const aligned=at(plan,'scale-align',1),mean=at(plan,'scale-mean',1),unit=mean.boneGuides.find(v=>v.id==='unit-bone');
 for(const [i,b] of g.bones.entries()){
  const guide=aligned.boneGuides.find(v=>v.id==='scale-'+i);
  close([length(sub(guide.to,guide.from))/g.scale],[b.length]);
  const collapsed=mean.boneGuides.find(v=>v.id==='scale-'+i);close(collapsed.from,unit.from);close(collapsed.to,unit.to);
 }
 close([length(sub(unit.to,unit.from))],[g.scale]);
 const moved=at(plan,'unit-align',1).boneGuides.find(v=>v.id==='unit-bone');close(moved.from,g.referenceRoot);
 close(sub(moved.to,moved.from),plan.frames.reference.x.map(v=>v*g.scale));

});
test('component growth is simultaneous with numeric change and retains earlier signed components',()=>{
 const {plan}=setup();
 for(const [i,v] of plan.geometry.components.entries()){
  const mid=at(plan,v.key,.5),guide=mid.guides.find(g=>g.id===v.key);
  close([mid.values[v.key]],[v.value*.5]);close(guide.to,v.from.map((n,j)=>(n+v.to[j])/2));
  for(const previous of plan.geometry.components.slice(0,i))close([mid.values[previous.key]],[previous.value]);
 }
});
test('reference frame has zero displacement and all stages stay finite and upright, including review',()=>{
 for(const frame of [0,300]){
  const {plan}=setup('00.json',frame);
  for(let time=0;time<=plan.duration;time+=89){
   const s=plan.sample(time);close(s.camera.up,plan.frames.reference.y);
   assert.ok(s.camera.direction.every(Number.isFinite));assert.ok(Object.values(s.values).every(Number.isFinite));
   for(const guide of [...s.guides,...s.boneGuides])assert.ok([...guide.from,...(guide.to??[])].every(Number.isFinite));
  }
  const finish=plan.segments.find(s=>s.id==='finish');assert.deepEqual(plan.sample(finish.start+100).values,plan.values);
  close(Object.values(plan.sample(finish.end-.001).values),Object.values(plan.values));
 }
});

test('camera focus bounds remain continuous across normalization and measurement stages',()=>{
 const {plan}=setup();
 for(const [from,to] of [['scale-camera','scale-highlight'],['unit-ready','selected-focus'],['selected-focus','root-camera'],['root-camera','root-markers'],['root-markers','displacement']]){
  const a=at(plan,from,1),b=at(plan,to,0);
  close(a.camera.direction,b.camera.direction);close([a.pairFocus.amount],[b.pairFocus.amount]);
  a.pairFocus.points.forEach((p,i)=>close(p,b.pairFocus.points[i]));
 }
});

test('unit calculation uses solid bones without joints, then aligns the unit before resizing the axes',()=>{
 const {plan}=setup(),g=plan.geometry;
 assert.ok(!plan.segments.some(s=>s.pair||s.id.startsWith('origin-')||s.id.startsWith('reference-hip')||s.id.startsWith('selected-hip')));
 for(const id of ['reference-root','scale-highlight','scale-duplicate','scale-align','scale-mean','unit-align']){
  const state=at(plan,id,.5);close([state.referenceAxes.frame.length],[plan.frames.reference.length]);assert.equal(state.selectedPose,0);
  assert.deepEqual(state.jointHighlights,[]);assert.ok(!state.guides.some(v=>v.kind==='arrow'));
 }
 const highlight=at(plan,'scale-highlight',1);assert.equal(highlight.boneHighlights.length,10);assert.ok(highlight.boneHighlights.every(v=>v.strength===1));
 const copies=at(plan,'scale-duplicate',1).boneGuides;assert.equal(copies.length,10);
 for(const [i,copy] of copies.entries()){close(copy.from,g.bones[i].from);close(copy.to,g.bones[i].to);}
 const sized=at(plan,'unit-axes',1);close([sized.referenceAxes.frame.length],[g.scale]);
 const faded=at(plan,'unit-fade',1);assert.equal(faded.boneGuides.find(v=>v.id==='unit-bone').opacity,0);
 for(let time=plan.segments.find(s=>s.id==='scale-camera').start;time<=plan.duration;time+=113)close(plan.sample(time).referenceAxes.frame.origin,g.referenceRoot);
 const zoom0=at(plan,'root-camera',0),zoom1=at(plan,'root-camera',1);assert.ok(zoom1.referenceAxes.opacity<zoom0.referenceAxes.opacity);assert.ok(zoom1.referenceAxes.widthScale<zoom0.referenceAxes.widthScale);
 assert.ok(!zoom1.guides.some(v=>v.id.endsWith('-root')));
 const roots=at(plan,'root-markers',.5);assert.equal(roots.guides.length,2);assert.ok(roots.guides.every(v=>v.kind==='point'&&v.opacity>.0&&v.opacity<1));
 assert.deepEqual(roots.jointHighlights,[]);
});

test('only the active axis has measurement guides and colored dashed connectors follow the moving point',()=>{
 const {plan}=setup(),g=plan.geometry;
 for(const [active,component] of g.components.entries())for(const amount of [.25,.5,1]){
  const state=at(plan,component.key,amount),cursor=state.guides.find(v=>v.id==='measurement-cursor').from;
  const fraction=amount===.25?.15625:amount===.5?.5:1;
  close(cursor,component.from.map((v,i)=>v+(component.to[i]-v)*fraction));
  assert.equal(state.guides.filter(v=>v.id.startsWith('axis-measure-')).length,1);
  for(const measured of [component]){
   const solid=state.guides.find(v=>v.id==='axis-measure-'+measured.key),dash=state.guides.find(v=>v.id==='axis-connector-'+measured.key),p=fraction;
   close(solid.from,g.referenceRoot);close(solid.to,g.referenceRoot.map((v,j)=>v+(measured.to[j]-measured.from[j])*p));
   close(dash.from,cursor);close(dash.to,solid.to);assert.equal(dash.dashed,true);assert.equal(dash.color,solid.color);
  }
 }
 const finish=plan.segments.find(s=>s.id==='finish'),review=plan.sample(finish.start+finish.duration*.9);
 const ids=review.guides.map(v=>v.id);assert.equal(new Set(ids).size,ids.length,'review must not retain stale guides');
});

test('active measurement guides fade in during readiness and out before the next axis',()=>{
 const {plan}=setup();
 for(const key of ['sway','thrust','lift']){
  const opacity=s=>s.guides.find(v=>v.id==='axis-measure-'+key).opacity;
  assert.equal(opacity(at(plan,key+'-ready',0)),0);
  assert.ok(opacity(at(plan,key+'-ready',.5))>0&&opacity(at(plan,key+'-ready',.5))<1);
  assert.equal(opacity(at(plan,key,0)),1);
  const segment=plan.segments.find(s=>s.id===key);
  assert.ok(opacity(plan.sample(segment.end-.001))<.001);
 }
});

test('stay review keeps the measurement camera and framing still',()=>{
 const {plan}=setup(),measurement=at(plan,'lift',1),finish=plan.segments.find(s=>s.id==='finish');
 for(let i=0;i<100;i++){
  const state=plan.sample(finish.start+finish.duration*i/100);
  close(state.camera.direction,measurement.camera.direction);close(state.camera.up,measurement.camera.up);
  assert.deepEqual(state.pairFocus,measurement.pairFocus);
 }
 const reset=at(plan,'reset',0);close(reset.camera.direction,measurement.camera.direction);assert.deepEqual(reset.pairFocus,measurement.pairFocus);
});

test('gray dashed remaining-displacement connector follows the cursor instead of a static root line',()=>{
 const {plan}=setup(),g=plan.geometry;
 for(const key of ['sway','thrust','lift']){
  const state=at(plan,key,.5),connector=state.guides.find(v=>v.id==='displacement');
  close(connector.from,state.guides.find(v=>v.id==='measurement-cursor').from);
  close(connector.to,g.selectedRoot);
  assert.equal(connector.kind,'line');assert.equal(connector.dashed,true);assert.equal(connector.color,'#8b9198');
  assert.equal(state.guides.filter(v=>v.id==='displacement').length,1);
 }
 const initial=at(plan,'displacement',.5).guides.find(v=>v.id==='displacement');
 assert.equal(initial.dashed,true);
 const finish=plan.segments.find(s=>s.id==='finish');
 for(const fraction of [.3,.5,.9]){
  const state=plan.sample(finish.start+finish.duration*fraction),connectors=state.guides.filter(v=>v.id==='displacement');
  assert.ok(connectors.length<=1);
  for(const connector of connectors){assert.equal(connector.dashed,true);close(connector.from,state.guides.find(v=>v.id==='measurement-cursor').from);}
 }
});
