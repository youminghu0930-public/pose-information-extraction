export function validateDuration(seconds){
 if(seconds!==undefined&&(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0))throw new Error('Snapshot duration must be a positive number of seconds');
}
export function validateStay(seconds){
 if(seconds!==undefined&&(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0))throw new Error('Snapshot stay must be a nonnegative number of seconds');
}
// Scale motion and hold intervals together; omission preserves authored tempo.
export function scheduleTimeline(segments,seconds,stay){
 validateDuration(seconds);validateStay(stay);
 const scalable=segments.filter(segment=>!(stay!==undefined&&segment.completion));
 const natural=scalable.reduce((sum,segment)=>sum+segment.duration,0),target=seconds===undefined?natural:seconds*1000,scale=target/natural;
 let elapsed=0;
 for(const segment of segments){
  segment.duration=stay!==undefined&&segment.completion?stay*1000:segment.duration*scale;if(segment.motionDuration!==undefined)segment.motionDuration*=scale;
  segment.start=elapsed;elapsed+=segment.duration;segment.end=elapsed;
 }
 const total=target+(stay===undefined?0:segments.filter(segment=>segment.completion).length*stay*1000);
 if(segments.length){const last=segments.at(-1);last.end=total;last.duration=total-last.start;}
 return total;
}
