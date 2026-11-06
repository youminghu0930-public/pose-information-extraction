import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSnapshot,parseSnapshotEntries} from '../snapshot-config.js';
const metrics={meta:{ref_frame_id:0},metrics:{kinematic:{torso_turn_bend_tilt:{turn:[],bend:[],tilt:[]}},geometric:{spine_bend_tilt:{bend:[],tilt:[]}}}};
test('resolve selected frame and the separate metadata reference',()=>{
 assert.deepEqual(resolveSnapshot({frame:20,type:'kinematic',subtype:'torso_turn_bend_tilt'},metrics,218),{frame:20,referenceFrame:0,type:'kinematic',subtype:'torso_turn_bend_tilt'});
 assert.equal(resolveSnapshot({frame:0,type:'geometric',subtype:'spine_bend_tilt'},{...metrics,meta:{ref_frame_id:12}},218).referenceFrame,12);
});
test('reject invalid frame IDs and unavailable metric choices',()=>{
 const entry={frame:20,type:'kinematic',subtype:'torso_turn_bend_tilt'};
 for(const frame of [-1,218,1.5,undefined])assert.throws(()=>resolveSnapshot({...entry,frame},metrics,218));
 assert.throws(()=>resolveSnapshot(entry,{...metrics,meta:{}},218),/reference/);
 assert.throws(()=>resolveSnapshot({...entry,subtype:'missing'},metrics,218),/subtype/);
 assert.throws(()=>resolveSnapshot({...entry,type:'other'},metrics,218),/type/);
});
test('metric demo objects retain video, frame, duration and completion stay',()=>{
 const entries=parseSnapshotEntries('{"kinematic":{"torso_turn_bend_tilt":{"video":"00","frame":300,"duration":5,"stay":2}},"geometric":{"spine_bend_tilt":{"video":"12","frame":9}}}');
 assert.deepEqual(entries,[['00',{type:'kinematic',subtype:'torso_turn_bend_tilt',frame:300,duration:5,stay:2}],['12',{type:'geometric',subtype:'spine_bend_tilt',frame:9}]]);
 assert.deepEqual(resolveSnapshot(entries[0][1],metrics,400),{...entries[0][1],referenceFrame:0});
});
test('reject malformed demo objects, invalid timing and duplicate keys',()=>{
 for(const source of ['null','[]','{"00":{"frame":3}}','{"kinematic":[]}','{"geometric":{"spine_bend_tilt":4}}'])assert.throws(()=>parseSnapshotEntries(source));
 const parse=demo=>parseSnapshotEntries(JSON.stringify({kinematic:{torso_turn_bend_tilt:demo}}));
 for(const frame of [-1,1.5,null,'300',{}])assert.throws(()=>parse({video:'00',frame}));
 for(const video of ['../00',0,null])assert.throws(()=>parse({video,frame:300}));
 for(const duration of [0,-1,null,'3',{},true])assert.throws(()=>parse({video:'00',frame:300,duration}),/duration/);
 for(const stay of [-1,null,'2',{},true])assert.throws(()=>parse({video:'00',frame:300,stay}),/stay/);
 assert.equal(parse({video:'00',frame:300,stay:0})[0][1].stay,0);
 for(const source of ['{"kinematic":{},"kinematic":{}}','{"kinematic":{"torso_turn_bend_tilt":{},"torso_turn_bend_tilt":{}}}','{"kinematic":{"torso_turn_bend_tilt":{"video":"00","frame":1,"stay":2,"stay":3}}}'])assert.throws(()=>parseSnapshotEntries(source),/Duplicate/);
 assert.deepEqual(parseSnapshotEntries('{}'),[]);
});
