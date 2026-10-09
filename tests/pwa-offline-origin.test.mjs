import assert from "node:assert/strict";
import test from "node:test";
import {createServer} from "node:http";
import {disconnectPwaOrigin} from "../scripts/pwa-offline-origin.mjs";

test("offline verification disconnects the real socket and restores the identical origin",async()=>{
  let requests=0;
  const server=createServer((_request,response)=>{requests++;response.end("online");});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin=`http://127.0.0.1:${server.address().port}/`;
  try{
    assert.equal(await(await fetch(origin)).text(),"online");
    const offline=await disconnectPwaOrigin(server);
    assert.equal(server.listening,false);
    assert.deepEqual(offline.evidence.negativeControl,{connected:false,code:"ECONNREFUSED"});
    await assert.rejects(fetch(origin));
    assert.equal(requests,1,"No hidden server may satisfy the offline request");
    await offline.reconnect();
    assert.equal(await(await fetch(origin)).text(),"online");assert.equal(requests,2);
  }finally{if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
});
