import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJson} from '../tool-request.js';
const response=(data,status=200)=>Response.json(data,{status});
const hanging=async(url,{signal})=>new Promise((resolve,reject)=>{
 if(signal.aborted)return reject(signal.reason);
 signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
});
test('discovery helper preserves request options and parses valid object responses',async()=>{
 const data=await requestJson('/api/test',{method:'POST',credentials:'omit',body:'{}'},async(url,options)=>{
  assert.equal(url,'/api/test');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.body,'{}');assert.ok(options.signal instanceof AbortSignal);
  return response({cards:[]});
 });
 assert.deepEqual(data,{cards:[]});
});
test('lookup distinguishes HTTP errors, unreadable JSON, and malformed success bodies',async()=>{
 await assert.rejects(requestJson('/api/test',{},async()=>response({error:'Unavailable'},503)),/Unavailable/);
 await assert.rejects(requestJson('/api/test',{},async()=>new Response('not JSON')),/unreadable/);
 await assert.rejects(requestJson('/api/test',{},async()=>response([])),/incomplete/);
});
test('timeout and caller cancellation terminate the network request',async()=>{
 await assert.rejects(requestJson('/api/test',{timeoutMs:5},hanging),/timed out/);
 const controller=new AbortController();
 const pending=requestJson('/api/test',{signal:controller.signal},hanging);
 controller.abort(Error('Canceled by caller'));
 await assert.rejects(pending,/Canceled by caller/);
});
