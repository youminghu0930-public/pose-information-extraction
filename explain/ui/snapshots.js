import {parseSnapshotEntries} from '../../snapshot-config.js';
import {label,subtypeNames} from '../names.js';
import {make} from './dom.js';
import {createMetricNavigator} from './navigator.js';
import {createSelectionLoader} from './selection.js';

export async function mountMetricSnapshots(root,{showCameras=false,mountScene,configUrl='materials/data/snapshot.json'}){
 const response=await fetch(configUrl);
 if(!response.ok)throw new Error('Snapshot configuration unavailable');
 const entries=parseSnapshotEntries(await response.text());
 const title=make('h3','3D snapshot highlights','result-subheading media-heading');
 if(!entries.length){root.replaceChildren(title);root.setAttribute('aria-busy','false');return;}
 const workspace=make('div',undefined,'snapshot-metric-workspace'),player=make('div',undefined,'snapshot-metric-player');
 const hints=make('div',undefined,'snapshot-gesture-hints');
 for(const text of ['Click or tap the window to play or pause.','Drag to move the view. Scroll or pinch to zoom.'])hints.append(make('p',text,'keyboard-hint'));
 let selected=-1;
 const loader=createSelectionLoader({
  async load({id,entry,card},isCurrent){
   const response=await fetch(`materials/data/metrics/${encodeURIComponent(id)}.json`);
   if(!response.ok)throw new Error('Snapshot metrics unavailable');
   const metrics=await response.json();if(!isCurrent())return;
   return mountScene(card,id,entry,{showCameras,autoPlay:false,snapshotMetrics:metrics});
  },
  onError(error,{card}){
   console.error(error);card.classList.add('snapshot-load-error');
   card.replaceChildren(make('p','Preview unavailable. Select another metric or reload to retry.','snapshot-placeholder'));
   card.firstChild.setAttribute('role','status');card.setAttribute('aria-busy','false');
  },
 });
 const navigator=createMetricNavigator(entries,select);
 workspace.append(navigator.root,player);root.replaceChildren(title,workspace,hints);root.setAttribute('aria-busy','false');
 function select(index){
  if(index===selected)return;selected=index;navigator.select(index);
  const [id,entry]=entries[index],card=make('article',undefined,'pose-snapshot metric-snapshot');
  card.setAttribute('aria-label',label(subtypeNames,entry.subtype));card.setAttribute('aria-busy','true');
  const placeholder=make('p','Loading preview…','snapshot-placeholder');placeholder.setAttribute('role','status');card.append(placeholder);player.replaceChildren(card);
  return loader.select({id,entry,card});
 }
 await select(0);
 return {dispose:()=>loader.dispose()};
}
