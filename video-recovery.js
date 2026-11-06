export const VIDEO_RETRY_MESSAGE='Video playback is unavailable. The 3D animation continues; tap Play to retry.';

// Called synchronously from the existing Play gesture, including on iOS.
export function unlockVideo(video,{isCurrent,onReady,onFailure}){
  try{
    if(video.error||video.readyState<2)video.load();
    const attempt=video.play();
    return Promise.resolve(attempt).then(()=>{
      video.pause();
      if(isCurrent())onReady();
    },error=>{if(isCurrent())onFailure(error);});
  }catch(error){if(isCurrent())onFailure(error);return Promise.resolve();}
}

// A blocked/failed decoder must not freeze the independent 3D timeline.
export function waitForDecoders(seekers,{timeout=750,signal}={}){
  return new Promise(resolve=>{
    let timer;
    const finish=value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve(value);};
    const abort=()=>finish(false);
    if(signal?.aborted){resolve(false);return;}
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish(false),timeout);
    Promise.all(seekers.map(seeker=>seeker.whenIdle())).then(()=>finish(true),()=>finish(false));
  });
}
