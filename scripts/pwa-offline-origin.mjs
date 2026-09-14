import assert from "node:assert/strict";
import { get } from "node:http";

// WebKit's setOffline(true) rejects even an entirely cache-served navigation
// before its service worker can respond (product-free 2359 probe). Disconnect
// the actual isolated origin instead. Neither browser routing nor storage is
// replaced. A separate HTTP client must fail before the browser is exercised.
export async function disconnectPwaOrigin(server) {
  const address=server.address();
  assert.ok(address&&typeof address==="object");
  server.closeAllConnections();
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  const unavailable=await new Promise(resolve=>{
    const request=get({host:address.address,port:address.port,path:"/__offline_network_negative_control__",agent:false},response=>{response.resume();resolve({connected:true,status:response.statusCode});});
    request.once("error",error=>resolve({connected:false,code:error.code}));
    request.setTimeout(5_000,()=>request.destroy(new Error("Offline negative control timed out")));
  });
  assert.equal(unavailable.connected,false,"Offline check cannot proceed while the origin is reachable");
  assert.equal(unavailable.code,"ECONNREFUSED");
  return {
    evidence:{method:"actual isolated-origin socket shutdown",negativeControl:unavailable,port:address.port},
    reconnect:()=>new Promise((resolve,reject)=>{server.once("error",reject);server.listen(address.port,address.address,()=>{server.removeListener("error",reject);resolve();});}),
  };
}
