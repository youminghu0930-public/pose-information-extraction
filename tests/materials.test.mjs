import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveSnapshot,parseSnapshotEntries} from '../snapshot-config.js';
import {discoverVideoCatalog,validateSync} from '../scripts/video-catalog.mjs';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
test('all supplied swings have aligned reconstruction and synchronization',()=>{
 const root=new URL('../',import.meta.url).pathname;
 const catalog=discoverVideoCatalog(decodeURIComponent(root));
 assert.equal(catalog.length,7);
 for(const clip of catalog){assert.equal(clip.alignmentError,null,clip.id);assert.equal(clip.frames,clip.reconstructionFrames);}
});
test('invalid or out-of-range sync mappings are rejected',()=>{
 const views=[{name:'a',frames:3},{name:'b',frames:3}];
 const sync={mapping:{a:[0,1,2],b:[0,1,2]},meta:{a:{E1:0,E2:2},b:{E1:0,E2:2}}};
 assert.equal(validateSync(sync,views),3);
 sync.mapping.b[2]=3;assert.throws(()=>validateSync(sync,views));
});
test('snapshot highlights reference available reconstructed swings',()=>{
 for(const [id,entry] of parseSnapshotEntries(fs.readFileSync(new URL('../materials/data/snapshot.json',import.meta.url),'utf8'))){
 const frames=read(`materials/data/3d_results/${id}.json`).reconstruction;
 const snapshot=resolveSnapshot(entry,read(`materials/data/metrics/${id}.json`),frames.length);
 assert.equal(snapshot.frame,entry.frame);assert.ok(frames[snapshot.referenceFrame]);
 }
});
