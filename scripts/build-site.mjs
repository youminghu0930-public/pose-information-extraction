import {explainSnapshot} from '../explain/index.js';
import {parseSnapshotEntries,resolveSnapshot} from '../snapshot-config.js';
import {prepareVideos} from './prepare-videos.mjs';
import fs from 'node:fs/promises';
const catalog=prepareVideos();
const root=new URL('../',import.meta.url);
const content=JSON.parse(await fs.readFile(new URL('materials/content.json',root),'utf8'));
if(content.sections.map(s=>s.id).join()!=='abstract,introduction,method,results,discussion,conclusion')throw new Error('Expected six sections');
const snapshots=parseSnapshotEntries(await fs.readFile(new URL('materials/data/snapshot.json',root),'utf8'));
for(const [id,entry] of snapshots){
 if(!/^[\w-]+$/.test(id))throw new Error('Invalid snapshot swing ID');
 const metrics=JSON.parse(await fs.readFile(new URL(`materials/data/metrics/${id}.json`,root),'utf8'));
 const pose=JSON.parse(await fs.readFile(new URL(`materials/data/3d_results/${id}.json`,root),'utf8'));
 resolveSnapshot(entry,metrics,pose.reconstruction.length);
 const explanation=explainSnapshot(pose,metrics,entry);
 if(explanation.items.some(item=>!item.matches))throw new Error(`Swing ${id}: explanation does not match exported metrics`);
}
await fs.rm(new URL('dist/',root),{recursive:true,force:true});
await fs.mkdir(new URL('dist/',root),{recursive:true});
for(const file of ['index.html','styles.css','main.js','hero-banner.js','snapshot-3d.js','pose-structure.js','pose-surface.js','pose-shadow.js','snapshot-config.js','snapshot-framing.js','camera-flight.js','frame-seeker.js','frame-keys.js','frame-timing.js','video-viewer.js','video-recovery.js','.nojekyll','explain','vendor','materials/content.json','materials/data/credits.json','materials/data/snapshot.json','materials/data/videos.json','materials/data/3d_results','materials/data/metrics']){
 const target=new URL(`dist/${file}`,root);await fs.mkdir(new URL('./',target),{recursive:true});await fs.cp(new URL(file,root),target,{recursive:true});
}
for(const clip of catalog)for(const file of [clip.sync,...clip.views.flatMap(v=>[v.src,v.src+'.frames.json'])]){
 const target=new URL(`dist/${file}`,root);await fs.mkdir(new URL('./',target),{recursive:true});await fs.copyFile(new URL(file,root),target);
}
for(const section of content.sections)for(const file of [section.video?.src,section.video?.poster].filter(Boolean)){
 const target=new URL(`dist/${file}`,root);await fs.mkdir(new URL('./',target),{recursive:true});await fs.copyFile(new URL(file,root),target);
}
console.log(`Built ${catalog.length} synchronized swings in dist/`);
