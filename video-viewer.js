import {createViewerInfo} from './explain/ui/viewer-info.js';
import {parseSnapshotConfiguration} from './snapshot-config.js';
import {createMetricNavigator} from './explain/ui/navigator.js';
import {createVideoMeasurements} from './explain/ui/video-measurements.js';
import {unlockVideo,waitForDecoders} from './video-recovery.js';
import {createFrameSeeker} from './frame-seeker.js';
import {installFrameKeys} from './frame-keys.js';
import {mountPoseScene} from './snapshot-3d.js';
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url}: ${response.status}`);return response.json();}
function playbackIcon(button, key) {
  const paths = {
    start: 'M3 4v16M12 6 5 12l7 6ZM21 6l-7 6 7 6Z',
    previous: 'M6 4v16M18 5 8 12l10 7Z',
    play: 'm8 5 11 7-11 7Z',
    stop: 'M6 6h12v12H6Z',
    next: 'M18 4v16M6 5l10 7-10 7Z',
    end: 'M21 4v16M3 6l7 6-7 6ZM12 6l7 6-7 6Z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[key]); svg.append(path); button.replaceChildren(svg);
}
function setPlaybackButton(button,playing){
  playbackIcon(button,playing?'stop':'play');
  button.title=playing?'Stop':'Play';button.setAttribute('aria-label',button.title);
}
export async function mountVideos(root){
  const heading=make('h3','Videos','result-subheading media-heading viewer-section-heading');
  heading.append(createViewerInfo('video-instructions','Video instructions',[
    {gesture:'Rotate',action:'Left-drag or drag with one finger.'},
    {gesture:'Pan',action:'Right-drag or drag with two fingers.'},
    {gesture:'Zoom',action:'Scroll or pinch.'},
    {gesture:'Playback',action:'Press Space to play or pause. Use ← / → to step frames; hold to repeat.'},
    {gesture:'Measurements',action:'Select a measurement to show its geometry. Use the plot legend to show or hide curves.'},
  ],'section-info'));root.append(heading);
  const shell=make('div',undefined,'video-workspace video-metric-workspace');
  const player=make('div',undefined,'reconstruction-player comparison-player'),sidebar=make('aside',undefined,'video-sidebar');
  player.tabIndex=0;player.setAttribute('aria-label','Video reconstruction player');
  const sidebarHeading=make('div',undefined,'sidebar-heading'),videoCount=make('span');sidebarHeading.append(make('h4','Swing videos'),videoCount);sidebar.append(sidebarHeading);
  const loadingMetrics=make('aside',undefined,'snapshot-metric-navigator');loadingMetrics.setAttribute('aria-label','Video metrics');loadingMetrics.append(make('h4','Choose a metric','snapshot-navigator-title'));shell.append(loadingMetrics);
  const list=make('div',undefined,'video-name-list video-list');list.append(make('p','Loading video list…','section-note'));sidebar.append(list);shell.append(player,sidebar);root.append(shell);
  const placeholder=make('div','Loading videos…','video-loading-placeholder');placeholder.setAttribute('role','status');player.append(placeholder);
  const [catalog,credits,configResponse]=await Promise.all([json('materials/data/videos.json'),json('materials/data/credits.json'),fetch('materials/data/snapshot.json')]);
  const {entries:metricEntries}=parseSnapshotConfiguration(await configResponse.text());
  let selectedMetric=0,refreshMetric=()=>{},measurementView,overlayKeys=[];
  const metricNavigator=createMetricNavigator(metricEntries,index=>{if(index!==selectedMetric)overlayKeys=[];selectedMetric=index;metricNavigator.select(index);refreshMetric();});
  metricNavigator.root.setAttribute('aria-label','Video metrics');metricNavigator.select(0);loadingMetrics.replaceWith(metricNavigator.root);
  let controller,media=[],version=0,frame=0,playing=false,raf,videoCallback,callbackVideo,selectionAbort,seekers=[],shortcutReady=false,shortcutStep,shortcutToggle;
  let activeView='free-view',playbackVersion=0;
  const content=make('div',undefined,'video-player-content'),details=make('div',undefined,'video-details');
  shell.append(details);
  const viewOptions=make('div',undefined,'camera-view-options');viewOptions.setAttribute('role','group');viewOptions.setAttribute('aria-label','Select POV');viewOptions.append(make('span','Select POV:','camera-view-label'));
  const viewButtons=[];
  for(const [value,label] of [['face-on','Face-on view'],['down-the-line','Down-the-line view'],['free-view','Free-view']]){
    const button=make('button',label);button.type='button';button.setAttribute('aria-pressed',String(value===activeView));
    button.onclick=()=>{activeView=value;controller?.setView(value);viewButtons.forEach(([b,v])=>b.setAttribute('aria-pressed',String(v===value)));};
    viewOptions.append(button);viewButtons.push([button,value]);
  }
  player.replaceChildren(viewOptions,content);
  const frameKeys=installFrameKeys({target:document,blurTarget:window,isReady:()=>shortcutReady,step:delta=>shortcutStep?.(delta),toggle:()=>shortcutToggle?.()});
  const buttons=[];
  function stop(){++playbackVersion;playing=false;cancelAnimationFrame(raf);if(callbackVideo&&videoCallback!==undefined)callbackVideo.cancelVideoFrameCallback(videoCallback);videoCallback=undefined;media.forEach(video=>{video.pause();video.playbackRate=1;});}
  let selectedId,refreshing=false;
  function renderList(){
    list.replaceChildren();buttons.length=0;videoCount.textContent=`${catalog.length} videos`;
    catalog.forEach((clip,i)=>{
      const button=make('button',undefined,'video-item');const caption=make('span');caption.append(make('strong',clip.name));button.append(caption);button.type='button';button.setAttribute('aria-pressed',String(clip.id===selectedId));button.onclick=()=>select(clip,i);list.append(button);buttons.push(button);
    });
  }
  renderList();
  async function refreshCatalog(){
    if(refreshing||document.hidden)return;refreshing=true;
    try{
      const next=await json('materials/data/videos.json');
      if(JSON.stringify(next)===JSON.stringify(catalog))return;
      catalog.splice(0,catalog.length,...next);renderList();
      if(!catalog.some(clip=>clip.id===selectedId)){
        if(catalog.length)await select(catalog[0],0);
        else{++version;shortcutReady=false;stop();selectionAbort?.abort();controller?.dispose();controller=undefined;content.replaceChildren(make('p','No videos available.'));}
      }
    }catch(error){console.warn('Video list refresh failed',error);}finally{refreshing=false;}
  }
  window.addEventListener('focus',refreshCatalog);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCatalog();});
  async function select(clip,index){
    selectedId=clip.id;
    const request=++version;shortcutReady=false;frameKeys.clear();seekers.forEach(seeker=>seeker.reset());seekers=[];selectionAbort?.abort();selectionAbort=new AbortController();const signal=selectionAbort.signal;stop();controller?.dispose();controller=undefined;media.forEach(v=>{v.removeAttribute('src');v.load();});media=[];
    frame=0;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    content.replaceChildren();details.replaceChildren();measurementView=undefined;refreshMetric=()=>{};
    const views=make('div',undefined,'video-source-decoders');
    const pose=make('article',undefined,'video-pose');pose.setAttribute('aria-busy','true');
    const loadingMask=make('div','Loading reconstruction…','video-loading-mask');loadingMask.setAttribute('role','status');pose.append(loadingMask);
    const status=make('p','Loading reconstruction…','section-note');status.setAttribute('role','status');
    for(const view of clip.views){
      const panel=make('div');
      const video=make('video');video.src=view.src;video.preload='auto';video.muted=video.defaultMuted=true;video.playsInline=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;panel.append(video);views.append(panel);media.push(video);

    }
    const controls=make('div',undefined,'playback-controls');
    const playback={};
    for(const [key,label] of [['start','Jump to start'],['previous','Previous frame'],['play','Play'],['next','Next frame'],['end','Jump to end']]){
      const button=make('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.disabled=true;playbackIcon(button,key);controls.append(button);playback[key]=button;
    }
    controls.addEventListener('click',event=>{if(event.detail>0)player.focus({preventScroll:true});});
    const {start,previous,play,next,end}=playback;
    const slider=make('input',undefined,'frame-slider');slider.type='range';slider.min=0;slider.max=clip.frames-1;slider.value=0;slider.setAttribute('aria-label','Video frame');slider.disabled=true;
    const meta=make('div',undefined,'player-meta');
    const counter=make('output',`Frame 1 / ${clip.frames}`);meta.append(counter,status);
    const controlRow=make('div',undefined,'player-control-row');controlRow.append(meta,controls);
    content.append(views,pose,slider,controlRow);
    const creditValue=credits[clip.id]??credits[clip.id.split('-')[0]];
    if(creditValue){
      try{
        const url=new URL(typeof creditValue==='string'?creditValue:creditValue.url);
        if(['http:','https:'].includes(url.protocol)){
          const credit=make('div',undefined,'video-credit'),line=make('p'),link=make('a','Original video on YouTube ↗');
          link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
          line.append(make('span','Video source: '),link);credit.append(line);details.append(credit);
        }
      }catch(error){console.warn('Invalid video credit URL',error);}
    }
    if(clip.alignmentError){
      status.textContent=clip.alignmentError;
      pose.remove();media.forEach(video=>{video.removeAttribute('src');video.load();});
      return;
    }
    let readyController;
    const sources=[...media],startedAt=performance.now();
    let reconstructionReady=false,retryNeeded=false;
    const unlocking=new Set(),lastDecoded=sources.map(()=>startedAt);
    const updateStatus=()=>{
      if(request!==version)return;
      if(!reconstructionReady){status.textContent=performance.now()-startedAt>20000?'Still loading the 3D reconstruction… This is taking longer than usual.':'Loading reconstruction…';return;}
      const stalled=sources.some((video,i)=>video.readyState<2&&performance.now()-lastDecoded[i]>10000);
      if(stalled||sources.some(video=>video.error))retryNeeded=true;
      status.textContent='';
      setPlaybackButton(play,playing&&!retryNeeded);
    };
    const statusTimer=setInterval(updateStatus,1000);
    signal.addEventListener('abort',()=>clearInterval(statusTimer),{once:true});
    for(const video of sources)for(const event of ['progress','loadeddata','waiting','playing','error','stalled'])video.addEventListener(event,updateStatus,{signal});
    let sync,metrics;
    try{[sync,metrics]=await Promise.all([json(clip.sync),json(`materials/data/metrics/${encodeURIComponent(clip.id)}.json`)]);
      if(request!==version)return;
      readyController=await mountPoseScene(pose,clip.id,{range:[0,clip.frames-1],fps:clip.fps,joints:['golf_club_head']},{showCameras:false,calibratedViews:true,videoMetrics:metrics,autoPlay:false,cameraVideos:Object.fromEntries(clip.views.map((view,i)=>[view.name,media[i]]))});}
    catch(error){if(request===version){console.error(error);clearInterval(statusTimer);status.textContent='The reconstruction could not be loaded. Select another swing or reload to retry.';loadingMask.remove();pose.setAttribute('aria-busy','false');}return;}
    if(request!==version){readyController.dispose();return;}controller=readyController;reconstructionReady=true;controller.setView(activeView,{animate:false});

    refreshMetric=()=>{
      if(request!==version)return;
      const [,entry]=metricEntries[selectedMetric];
      measurementView?.measurements.remove();measurementView?.plot.remove();
      measurementView=createVideoMeasurements({entry,metrics,frameCount:clip.frames,fps:clip.fps,selectedKeys:overlayKeys,onSelection:keys=>{overlayKeys=keys;controller?.setMeasurementSelection(keys);}});
      pose.after(measurementView.measurements,measurementView.plot);
      controller.setMetricSelection(entry,overlayKeys);measurementView.update(frame);
    };
    refreshMetric();
    const times=clip.views.map(view=>Array.from({length:view.frames},(_,i)=>i/view.fps));
    // Exact timestamps improve decoding, but never gate the reconstruction UI.
    clip.views.forEach((view,i)=>json(view.src+'.frames.json').then(value=>{if(request===version)times[i]=value;}).catch(()=>{}));
    let requestedFrame=0;
    const rawFrame=(i,index)=>sync.mapping[clip.views[i].name][index];
    const settled=media.map(()=>-1);
    seekers=media.map((video,i)=>createFrameSeeker(video,{
      getTimes:()=>times[i],onRequest:()=>{},
      onSettled:index=>{
        settled[i]=index;lastDecoded[i]=performance.now();
        if(request===version&&settled.every((value,i)=>value===rawFrame(i,requestedFrame))){
          updateStatus();
        }
      }
    }));
    function updateLabel(index){measurementView?.update(index);slider.value=index;counter.textContent=`Frame ${index+1} / ${clip.frames}`;slider.setAttribute('aria-valuetext',counter.textContent);}
    const fps=clip.fps;
    function showFrame(value,seek=true){
      const target=Math.max(0,Math.min(clip.frames-1,Math.floor(value)));
      if(seek){requestedFrame=target;frame=target;controller.setFrame(target);updateLabel(target);updateStatus();seekers.forEach((seeker,i)=>{if(sources[i].readyState>=2)seeker.request(rawFrame(i,target));});}
      else{requestedFrame=target;if(frame!==target){frame=target;controller.setFrame(frame);}updateLabel(frame);}
    }
    function pause(){stop();setPlaybackButton(play,false);}
    let clockStart=0,clockFrame=0;
    function startSource(video,i){
      if(request!==version||video.readyState<2)return;
      video.pause();seekers[i].request(rawFrame(i,frame));
    }
    sources.forEach((video,i)=>video.addEventListener('loadeddata',()=>{lastDecoded[i]=performance.now();if(!unlocking.has(video))startSource(video,i);},{signal}));
    // Decode the saved raw-frame selections rather than approximate the mapping
    // with native playback rates: repeats, skips, and event frames stay explicit.
    async function tick(now,run=playbackVersion){
      if(!playing||request!==version||run!==playbackVersion)return;
      const target=Math.min(clip.frames-1,Math.floor(clockFrame+(now-clockStart)*fps/1000));
      requestedFrame=target;
      seekers.forEach((seeker,i)=>{if(sources[i].readyState>=2&&!unlocking.has(sources[i]))seeker.request(rawFrame(i,target));});
      const decoded=await waitForDecoders(seekers,{signal});
      if(!playing||request!==version||run!==playbackVersion)return;
      if(!decoded){retryNeeded=true;seekers.forEach(seeker=>seeker.reset());updateStatus();}
      showFrame(target,false);
      if(target>=clip.frames-1){pause();return;}
      raf=requestAnimationFrame(now=>tick(now,run));
    }
    const togglePlayback=()=>{
      if(playing&&!retryNeeded){pause();updateStatus();return;}
      if(frame>=clip.frames-1)showFrame(0);
      seekers.forEach(seeker=>seeker.reset());
      const run=++playbackVersion;
      playing=true;clockFrame=frame;clockStart=performance.now();setPlaybackButton(play,true);
      // play() must run in the click gesture before awaiting any decoder work.
      retryNeeded=false;
      sources.forEach((video,i)=>{unlocking.add(video);unlockVideo(video,{
        isCurrent:()=>request===version&&run===playbackVersion,
        onReady:()=>{unlocking.delete(video);lastDecoded[i]=performance.now();startSource(video,i);updateStatus();},
        onFailure:()=>{unlocking.delete(video);retryNeeded=true;updateStatus();}
      });});
      updateStatus();raf=requestAnimationFrame(now=>tick(now,run));
    };
    play.onclick=togglePlayback;
    start.onclick=()=>{pause();showFrame(0);};end.onclick=()=>{pause();showFrame(clip.frames-1);};
    previous.onclick=()=>{pause();showFrame(requestedFrame-1);};next.onclick=()=>{pause();showFrame(requestedFrame+1);};slider.oninput=()=>{pause();showFrame(Number(slider.value));};
    media.forEach((video,i)=>video.addEventListener('loadedmetadata',()=>{if(request===version)video.currentTime=times[i][rawFrame(i,frame)]??rawFrame(i,frame)/clip.views[i].fps;}));
    shortcutStep=delta=>{player.focus({preventScroll:true});pause();showFrame(requestedFrame+delta);};shortcutToggle=()=>{player.focus({preventScroll:true});togglePlayback();};shortcutReady=true;

    for(const [button] of viewButtons)button.disabled=false;
    for(const button of Object.values(playback))button.disabled=false;slider.disabled=false;showFrame(0);updateStatus();loadingMask.remove();pose.setAttribute('aria-busy','false');
  }
  if(catalog.length)await select(catalog[0],0);else player.textContent='No videos available.';
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();const button=player.querySelector('.playback-controls button:nth-child(3)');if(button)setPlaybackButton(button,false);}});
}
