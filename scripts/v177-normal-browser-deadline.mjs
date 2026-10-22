import {spawn} from 'node:child_process';

// Bound protocol methods which Playwright's action timeout does not cover.
// Existing action-specific timeouts and the observation clocks remain owned by their callers.
const rawMethods=new Set(['evaluate','evaluateAll','evaluateHandle','count','isVisible','isHidden','addInitScript','storageState','dispose']);
const locatorFactories=new Set(['locator','getByRole','getByText','getByLabel','getByPlaceholder','getByTestId','getByTitle','getByAltText','nth','first','last','filter','and','or','frameLocator']);
const actionMethods=new Set(['click','dblclick','tap','fill','type','press','check','uncheck','setChecked','selectOption','getAttribute','innerText','textContent','isEnabled','isDisabled','waitFor','scrollIntoViewIfNeeded','boundingBox','screenshot','goto','reload','waitForFunction','waitForLoadState','waitForURL','waitForTimeout']);

export function createNormalBrowserDeadline({timeoutMs=30_000,onTimeout=()=>{},timers={setTimeout,clearTimeout}}={}){
  let failure=null;
  const wrapped=new WeakMap();
  const check=()=>{if(failure)throw failure;};
  async function run(operation,label,budgetMs=timeoutMs){
    check();
    let timer;
    try{
      return await new Promise((resolve,reject)=>{
        timer=timers.setTimeout(()=>{
          if(!failure){failure=new Error(`Normal play protocol deadline exceeded: ${label} (${budgetMs}ms)`);failure.code='NORMAL_PLAY_OPERATION_TIMEOUT';failure.operation=label;failure.timeoutMs=budgetMs;
            try{Promise.resolve(onTimeout(failure)).catch(()=>{});}catch{/* Keep the original timeout. */}}
          reject(failure);
        },Math.max(0,budgetMs));
        Promise.resolve().then(()=>{check();return operation();}).then(value=>{try{check();resolve(value);}catch(error){reject(error);}},reject);
      });
    }finally{timers.clearTimeout(timer);}
  }
  function wrap(target,kind='page'){
    if(wrapped.has(target))return wrapped.get(target);
    const proxy=new Proxy(target,{get(owner,key){
      const value=Reflect.get(owner,key,owner);
      if(key==='mouse'||key==='touchscreen')return wrap(value,'input');
      if(typeof value!=='function')return value;
      if(locatorFactories.has(key))return(...args)=>wrap(Reflect.apply(value,owner,args),'locator');
      if(rawMethods.has(key)||(kind==='input'&&['move','down','up','click','dblclick','wheel','tap'].includes(key)))return(...args)=>run(()=>Reflect.apply(value,owner,args),`${kind}.${key}`).then(result=>key==='evaluateHandle'?wrap(result,'handle'):result);
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
