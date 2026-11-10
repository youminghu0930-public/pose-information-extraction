import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStaticMeasurementSampler} from '../explain/static-measurement.js';
import {measurementChannels,channelPath,sharedMeasurementScale} from '../explain/measurement-series.js';
import {metricPlans} from '../explain/choreography/metric-plans.js';
const read=path=>JSON.parse(fs.readFileSync(new URL('../materials/data/'+path,import.meta.url)));

test('static video overlays reproduce exported measurements for every metric and recording',()=>{
 for(const file of fs.readdirSync(new URL('../materials/data/metrics/',import.meta.url)).filter(f=>f.endsWith('.json'))){
  const metrics=read('metrics/'+file),data=read('3d_results/'+file);
  for(const [type,subtypes] of Object.entries(metrics.metrics))for(const [subtype,series] of Object.entries(subtypes)){
   if(!metricPlans[subtype])continue;
   const entry={type,subtype},keys=Object.keys(series),sampler=createStaticMeasurementSampler(data,metrics,entry);
   assert.deepEqual(sampler.sample(0,[]),[]);
   for(const frame of [0,100,Math.min(300,data.reconstruction.length-1)]){
    const states=sampler.sample(frame,keys);assert.equal(states.length,keys.length);
    for(const {key,state} of states){
     assert.ok(Math.abs(state.values[key]-series[key][frame])<1e-5,`${file} ${subtype} ${key} ${frame}`);
     for(const sector of state.sectors)assert.ok(Number.isFinite(sector.angle));
     if(type!=='position')assert.ok(state.referenceAxes&&state.torsoAxes&&state.sectors.length);
     if(subtype==='spine_bend_tilt')assert.equal(state.torsoAxes.x.colorAxis,'y');
    }
   }
  }
 }
});
test('measurement channels follow shared naming, color, units and frame count',()=>{
 const metrics=read('metrics/00.json'),entry={type:'kinematic',subtype:'torso_turn_bend_tilt'};
 const channels=measurementChannels(metrics,entry,700);
 assert.deepEqual(channels.map(c=>c.key),['turn','bend','tilt']);assert.ok(channels.every(c=>c.color&&c.unit==='°'&&c.values.length===700));
 assert.equal(channels[0].values[300],metrics.metrics.kinematic.torso_turn_bend_tilt.turn[300]);assert.equal(channels[0].values[699],null);
 assert.ok(measurementChannels(metrics,{type:'position',subtype:'hip_sway_thrust_lift'},100).every(c=>c.unit===' units'));
});
test('plot paths break at missing samples, use the full time range and stay finite',()=>{
 const {path,low,high}=channelPath([1,2,null,4,5],20,40);
 assert.equal(low,1);assert.equal(high,5);assert.equal((path.match(/M/g)??[]).length,2);
 assert.ok(path.startsWith('M0.00,60.00'));assert.ok(path.endsWith('1000.00,20.00'));assert.ok(!/NaN|Infinity/.test(path));
 assert.ok(!/NaN|Infinity/.test(channelPath([2,2,2],20,40).path));assert.equal(channelPath([null],20,40).path,'');
});

test('combined measurement lines use one tick scale and identical value positions',()=>{
 const scale=sharedMeasurementScale([{values:[0,50,100]},{values:[-200,0,200]}]);
 assert.ok(scale.low<=-200&&scale.high>=200);assert.ok(scale.ticks.includes(0));
 assert.ok(scale.ticks.every((tick,i)=>i===0||Math.abs(tick-scale.ticks[i-1]-scale.step)<1e-10));
 const first=channelPath([0,0],20,40,1000,scale).path,second=channelPath([-200,0,200],20,40,1000,scale).path;
 assert.ok(first.startsWith('M0.00,40.00'));assert.ok(second.includes('L500.00,40.00'));
 const empty=sharedMeasurementScale([{values:[null,null]}]);assert.ok(empty.high>empty.low);assert.ok(empty.ticks.length>1);
});

test('torso video angles retain their starting reference and share coincident arrows',async()=>{
 const {uniqueVideoAxes}=await import('../explain/video-overlay-components.js');
 const sampler=createStaticMeasurementSampler(read('3d_results/00.json'),read('metrics/00.json'),{type:'kinematic',subtype:'torso_turn_bend_tilt'});
 const samples=sampler.sample(300,['turn','bend','tilt']);
 for(const {state} of samples){
  assert.ok(state.originalReferenceAxes);
  for(const sector of state.sectors){
   const arrow=state.originalReferenceAxes[sector.direction];
   const direction=arrow.to.map((value,i)=>value-arrow.from[i]),length=Math.hypot(...direction);
   assert.ok(direction.every((value,i)=>Math.abs(value/length-sector.from[i])<1e-6));
  }
 }
 const seen=new Set();let count=0;
 for(const {state} of uniqueVideoAxes(samples))for(const field of ['originalReferenceAxes','referenceAxes','torsoAxes'])for(const axis of ['x','y','z']){
  const arrow=state[field]?.[axis];if(!arrow)continue;count++;
  const signature=(field==='torsoAxes'?'target':'measurement')+JSON.stringify([arrow.from,arrow.to].map(point=>point.map(value=>Math.round(value*1e7)/1e7)));
  assert.ok(!seen.has(signature),'shared arrow rendered more than once');seen.add(signature);
 }
 assert.ok(count<27,'coincident axes should be shared');
 assert.ok(samples.every(({state})=>state.originalReferenceAxes.x),'deduplication must not mutate sampler results');
});

test('side tilt keeps solid source and destination plus the translucent final target',async()=>{
 const {uniqueVideoAxes}=await import('../explain/video-overlay-components.js');
 const sampler=createStaticMeasurementSampler(read('3d_results/00.json'),read('metrics/00.json'),{type:'kinematic',subtype:'torso_turn_bend_tilt'});
 const [{state}]=uniqueVideoAxes(sampler.sample(300,['tilt']));
 for(const axis of ['x','y','z'])assert.ok(state.torsoAxes[axis],`final target ${axis} must remain`);
 assert.equal(state.torsoAxes.opacity,.42);
 assert.equal(state.originalReferenceAxes.opacity,1);assert.equal(state.referenceAxes.opacity,1);
 for(const axis of ['x','y']){
  assert.ok(state.originalReferenceAxes[axis]);assert.ok(state.referenceAxes[axis]);
  const destination=state.referenceAxes[axis],target=state.torsoAxes[axis];
  assert.ok(destination.to.every((value,i)=>Math.abs(value-target.to[i])<1e-6));
 }
});

test('video translation selections retain joint centers without connectors or axis dots',async()=>{
 const {uniqueVideoAxes}=await import('../explain/video-overlay-components.js');
 const sampler=createStaticMeasurementSampler(read('3d_results/00.json'),read('metrics/00.json'),{type:'position',subtype:'hip_sway_thrust_lift'});
 for(const frame of [100,300,500]){
  const samples=sampler.sample(frame,['sway','thrust','lift']);
  for(const {key,state} of samples){
   const edges=state.guides.filter(guide=>guide.id.startsWith('axis-'));
   assert.equal(edges.length,1);assert.equal(edges.filter(guide=>guide.kind==='arrow').length,1);
   assert.ok(edges.every(guide=>guide.id==='axis-measure-'+key));
  }
  const guides=uniqueVideoAxes(samples).flatMap(({state})=>state.guides);
  assert.equal(guides.filter(guide=>guide.id.startsWith('axis-')).length,3);
  assert.equal(guides.filter(guide=>guide.id==='measurement-cursor').length,0);
  assert.equal(guides.filter(guide=>guide.id==='reference-root').length,1);
  assert.equal(guides.filter(guide=>guide.id==='selected-root').length,1);
 }
});
