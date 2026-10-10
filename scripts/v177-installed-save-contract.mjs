import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';

// Only the R9 schema's absent, empty metadata may appear on first reading an
// installed R5 save. The durable record and all existing values stay exact.
export function inspectV177InstalledSaveTransition(before, after) {
  const expected=structuredClone(before.mirror),addedFields=[];
  const add=(record,key,value,path)=>{
    if(!Object.hasOwn(record,key)){record[key]=value;addedFields.push(path);}
  };
  add(expected,'readStoryVersions',{},'readStoryVersions');
  add(expected.flowState,'scriptVersion',null,'flowState.scriptVersion');
  if(expected.eventCursor){
    add(expected.eventCursor,'scriptVersion',null,'eventCursor.scriptVersion');
    add(expected.eventCursor,'sourceKey',null,'eventCursor.sourceKey');
  }
  const changedPaths=[];
  function compare(a,b,path=''){
    if(isDeepStrictEqual(a,b))return;
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path?path+'.'+key:key);
    }else changedPaths.push(path);
  }
  compare(expected,after.mirror);
  const durablePreserved=isDeepStrictEqual(before.native?.record,after.native?.record);
  const rawPreserved=before.raw===after.raw;
  const hash=value=>createHash('sha256').update(value??'').digest('hex');
  return {
    preserved:changedPaths.length===0&&durablePreserved&&(addedFields.length>0||rawPreserved),
    addedFields,changedPaths,durablePreserved,rawPreserved,
    beforeSha256:hash(before.raw),afterSha256:hash(after.raw),
  };
}
