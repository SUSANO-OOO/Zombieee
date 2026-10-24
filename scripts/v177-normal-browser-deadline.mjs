import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

// Bound protocol methods which Playwright's action timeout does not cover.
// Existing action-specific timeouts and the observation clocks remain owned by their callers.
const rawMethods=new Set(['evaluate','evaluateAll','evaluateHandle','count','isVisible','isHidden','addInitScript','storageState','dispose']);
const locatorFactories=new Set(['locator','getByRole','getByText','getByLabel','getByPlaceholder','getByTestId','getByTitle','getByAltText','nth','first','last','filter','and','or','frameLocator']);
const actionMethods=new Set(['click','dblclick','tap','fill','type','press','check','uncheck','setChecked','selectOption','getAttribute','innerText','textContent','isEnabled','isDisabled','waitFor','scrollIntoViewIfNeeded','boundingBox','screenshot','goto','reload','waitForFunction','waitForLoadState','waitForURL','waitForTimeout']);

const locatorDescription=(previous,key,args)=>{
  const row={factory:key};
  if(typeof args[0]==='string'){row.value=args[0].slice(0,256);if(args[0].length>256)row.truncated=true;}
  else if(key==='nth'&&Number.isSafeInteger(args[0]))row.index=args[0];
  else if(!['first','last'].includes(key))row.detailsOmitted=true;
  const chain=[...(previous?.chain??[]),row];
  return{chain:chain.slice(-8),truncated:!!previous?.truncated||chain.length>8};
};

export function normalProtocolTimeoutReceipt(error){
  return{code:error.code,operation:error.operation,timeoutMs:error.timeoutMs,
    timing:error.timing,locator:error.locator,...(error.evaluation?{evaluation:error.evaluation}:{})};
}

export function createNormalBrowserDeadline({timeoutMs=30_000,onTimeout=()=>{},timers={setTimeout,clearTimeout},clock=()=>performance.now()}={}){
  let failure=null;
  const wrapped=new WeakMap();
  const check=()=>{if(failure)throw failure;};
  async function run(operation,label,budgetMs=timeoutMs,locator=null,timeoutDetails=null){
    check();
    const startedAt=clock();
    let timer;
    try{
      return await new Promise((resolve,reject)=>{
        timer=timers.setTimeout(()=>{
          if(!failure){failure=new Error(`Normal play protocol deadline exceeded: ${label} (${budgetMs}ms)`);failure.code='NORMAL_PLAY_OPERATION_TIMEOUT';failure.operation=label;failure.timeoutMs=budgetMs;
            const timeoutAt=clock();failure.timing={clock:'node-performance-now-ms',startedAt,timeoutAt,elapsedMs:timeoutAt-startedAt};
            failure.locator=locator;
            if(timeoutDetails)try{failure.evaluation=timeoutDetails();}catch{failure.evaluation={unavailable:true};}
            try{Promise.resolve(onTimeout(failure)).catch(()=>{});}catch{/* Keep the original timeout. */}}
          reject(failure);
        },Math.max(0,budgetMs));
        Promise.resolve().then(()=>{check();return operation();}).then(value=>{try{check();resolve(value);}catch(error){reject(error);}},reject);
      });
    }finally{timers.clearTimeout(timer);}
  }
  function wrap(target,kind='page',locator=null){
    if(wrapped.has(target))return wrapped.get(target);
    const proxy=new Proxy(target,{get(owner,key){
      const value=Reflect.get(owner,key,owner);
      if(key==='mouse'||key==='touchscreen')return wrap(value,'input');
      if(typeof value!=='function')return value;
      if(locatorFactories.has(key))return(...args)=>wrap(Reflect.apply(value,owner,args),'locator',locatorDescription(locator,key,args));
      if(rawMethods.has(key)||(kind==='input'&&['move','down','up','click','dblclick','wheel','tap'].includes(key)))return(...args)=>run(()=>Reflect.apply(value,owner,args),`${kind}.${key}`,timeoutMs,locator,
        ['evaluate','evaluateAll','evaluateHandle'].includes(key)?()=>{
          const fn=typeof args[0]==='function',source=fn?Function.prototype.toString.call(args[0]):typeof args[0]==='string'?args[0]:null;
          return source===null?{unavailable:true}:{callbackType:fn?'function':'string',name:fn?args[0].name:null,sourceChars:source.length,
            sourceSha256:createHash('sha256').update(source).digest('hex'),...(fn?{sourceStart:source.slice(0,256)}:{})};
        }:null).then(result=>key==='evaluateHandle'?wrap(result,'handle'):result);
      if(actionMethods.has(key))return(...args)=>{check();return Promise.resolve(Reflect.apply(value,owner,args)).then(result=>{check();return result;});};
      return value.bind(owner);
    }});
    wrapped.set(target,proxy);return proxy;
  }
  return{run,wrap,check,get failure(){return failure;},setDefaultTimeout(ms){timeoutMs=ms;}};
}

export async function normalCleanupWithin(operation,label,{timeoutMs=5_000,timers={setTimeout,clearTimeout}}={}){
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    timer=timers.setTimeout(()=>{const error=new Error(`Normal play cleanup deadline exceeded: ${label}`);error.code='NORMAL_PLAY_CLEANUP_TIMEOUT';reject(error);},timeoutMs);
  })]);}finally{timers.clearTimeout(timer);}
}

export function normalPlayChildCompletion(report){
  process.send?.({type:'v177-normal-play-complete',status:report.status,error:report.error??null});
}

// No new setup/observation budget: supervise exit only after the child has
// persisted its terminal report and finished its bounded browser cleanup.
export function runNormalPlayChild(script,{env=process.env,spawnProcess=spawn,timers={setTimeout,clearTimeout}}={}){
  return new Promise((resolve,reject)=>{
    const child=spawnProcess(process.execPath,[script],{stdio:['inherit','inherit','inherit','ipc'],env,windowsHide:true});
    const pending=[];let finished=false,completion=null,exitFailure=null;
    const finish=(error,code)=>{if(finished)return;finished=true;for(const timer of pending)timers.clearTimeout(timer);if(error)reject(error);else resolve(code);};
    const later=(callback)=>{pending.push(timers.setTimeout(callback,3_000));};
    child.once('error',error=>finish(exitFailure??error));
    child.once('exit',code=>finish(exitFailure,code));
    child.on('message',message=>{
      if(finished||completion||message?.type!=='v177-normal-play-complete')return;
      completion=message;
      later(()=>{
        exitFailure=new Error(message.error??'Normal play child did not exit after its terminal report');
        exitFailure.childExitTimeout={code:'NORMAL_PLAY_CHILD_EXIT_TIMEOUT',script,pid:child.pid,terminalStatus:message.status,graceMs:3_000};
        try{child.kill('SIGTERM');}catch(error){exitFailure.childExitTimeout.termError=String(error);}
        later(()=>{
          if(finished)return;
          try{child.kill('SIGKILL');}catch(error){exitFailure.childExitTimeout.killError=String(error);}
          later(()=>finish(exitFailure));
        });
      });
    });
  });
}
