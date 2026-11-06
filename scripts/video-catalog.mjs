import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export function probeVideo(file){
  const result=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=r_frame_rate,nb_frames','-of','json',file],{encoding:'utf8'});
  if(result.status!==0)throw new Error(`Could not inspect ${file}. Install ffmpeg (including ffprobe).`);
  const stream=JSON.parse(result.stdout).streams[0], [n,d]=stream.r_frame_rate.split('/').map(Number);
  const fps=n/d,frames=Number(stream.nb_frames);
  if(!(fps>0)||!Number.isInteger(frames)||frames<1)throw new Error(`Invalid video metadata: ${file}`);
  return {fps,frames};
}
export function validateSync(sync,views){
  const lengths=views.map(view=>sync.mapping?.[view.name]?.length);
  if(!lengths[0]||!lengths.every(n=>n===lengths[0]))throw new Error('Sync mappings must be nonempty and equal length');
  for(const view of views){
    const mapping=sync.mapping[view.name],events=sync.meta?.[view.name];
    if(!events||!Number.isInteger(events.E1)||!Number.isInteger(events.E2)||events.E1>=events.E2)throw new Error('Invalid sync events');
    if(mapping.some((f,i)=>!Number.isInteger(f)||f<0||f>=view.frames||(i>0&&f<mapping[i-1])))throw new Error('Invalid sync frame mapping');
  }
  for(const event of ['E1','E2']){
    const index=sync.mapping[views[0].name].findIndex((_,i)=>views.every(v=>sync.mapping[v.name][i]===sync.meta[v.name][event]));
    if(index<0)throw new Error('Sync events are not aligned');
  }
  return lengths[0];
}
export function discoverVideoCatalog(root,{probe=probeVideo}={}){
  const folder=path.join(root,'materials/data/videos');
  if(!fs.existsSync(folder))return [];
  const clips=[];
  for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(!item.isDirectory()||! /^[\w-]+$/.test(item.name))continue;
    const id=item.name,base=`materials/data/videos/${id}`,result=`materials/data/3d_results/${id}.json`;
    if(!fs.existsSync(path.join(root,result))||!fs.existsSync(path.join(root,base,'sync.json')))continue;
    const files=fs.readdirSync(path.join(folder,id)),views=[];
    for(const name of ['face-on','down-the-line']){
      const file=files.find(file=>file.toLowerCase()===name+'.mp4');
      if(!file)break;
      const source=`${base}/${file}`,metadata=probe(path.join(root,source));
      views.push({name,src:`materials/data/previews/${id}/${name}.mp4`,...metadata,source});
    }
    if(views.length!==2)continue;
    const sync=JSON.parse(fs.readFileSync(path.join(root,base,'sync.json'),'utf8'));
    const frames=validateSync(sync,views);
    const reconstruction=JSON.parse(fs.readFileSync(path.join(root,result),'utf8')).reconstruction;
    const alignmentError=reconstruction.length===frames?null:`After reconstruction has ${reconstruction.length} frames, but sync.json has ${frames} steps. The 3D frame indexing needs clarification before synchronized playback is available.`;
    clips.push({id,name:`Swing ${id}`,frames,reconstructionFrames:reconstruction.length,alignmentError,fps:Math.max(...views.map(v=>v.fps)),sync:`${base}/sync.json`,views});
  }
  return clips;
}
