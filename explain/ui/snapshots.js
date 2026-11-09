import {createViewerInfo} from './viewer-info.js';
import {parseSnapshotConfiguration} from '../../snapshot-config.js';
import {label,subtypeNames} from '../names.js';
import {createPoseSelector} from './pose-selector.js';
import {make} from './dom.js';
import {createMetricNavigator} from './navigator.js';
import {createSelectionLoader} from './selection.js';

export async function mountMetricSnapshots(root,{showCameras=false,mountScene,configUrl='materials/data/snapshot.json'}){
 const response=await fetch(configUrl);
 if(!response.ok)throw new Error('Snapshot configuration unavailable');
 const {entries,selections}=parseSnapshotConfiguration(await response.text());
 const title=make('h3','3D snapshot highlights','result-subheading media-heading viewer-section-heading');
 if(!entries.length){root.replaceChildren(title);root.setAttribute('aria-busy','false');return;}
 const workspace=make('div',undefined,'snapshot-metric-workspace'),player=make('div',undefined,'snapshot-metric-player');
 title.append(createViewerInfo('snapshot-instructions','Snapshot instructions',[
  {gesture:'Playback',action:'Click or tap the window to play or pause.'},
  {gesture:'Rotate',action:'Left-drag or drag with one finger. During Explain, pause first; resuming gently restores the camera.'},
  {gesture:'Pan',action:'Right-drag or drag with two fingers.'},
  {gesture:'Zoom',action:'Scroll or pinch.'},
  {gesture:'Reset',action:'Use the top-right reset button to restore the view.'},
 ],'section-info'));
 let selected=-1,selectedPose=0;
 const loader=createSelectionLoader({
  async load({id,entry,card},isCurrent){
   const response=await fetch(`materials/data/metrics/${encodeURIComponent(id)}.json`);
   if(!response.ok)throw new Error('Snapshot metrics unavailable');
   const metrics=await response.json();if(!isCurrent())return;
   return mountScene(card,id,entry,{showCameras,autoPlay:false,snapshotMetrics:metrics});
  },
  onError(error,{card}){
   console.error(error);card.classList.add('snapshot-load-error');
   card.replaceChildren(make('p','Preview unavailable. Select another metric or pose to retry.','snapshot-placeholder'));
   card.firstChild.setAttribute('role','status');card.setAttribute('aria-busy','false');
  },
 });
 const navigator=createMetricNavigator(entries,select);
 const poses=createPoseSelector(selections,index=>{if(index===selectedPose)return;selectedPose=index;poses.select(index);return load();});
 poses.select(0);workspace.append(navigator.root,player,poses.root);root.replaceChildren(title,workspace);root.setAttribute('aria-busy','false');
 function select(index){
  if(index===selected)return;selected=index;navigator.select(index);return load();
 }
 function load(){
  const selection=selections[selectedPose],[,metric]=entries[selected],id=selection.video,entry={...metric,frame:selection.frame},card=make('article',undefined,'pose-snapshot metric-snapshot');
  card.setAttribute('aria-label',label(subtypeNames,entry.subtype));card.setAttribute('aria-busy','true');
  const placeholder=make('p','Loading preview…','snapshot-placeholder');placeholder.setAttribute('role','status');card.append(placeholder);player.replaceChildren(card);
  return loader.select({id,entry,card});
 }
 await select(0);
 return {dispose:()=>loader.dispose()};
}
