// Test-only entrypoint. Never deployed; imports the real Pages handlers.
import * as community from '../../functions/api/community.js';
import * as device from '../../functions/api/profile-device.js';
import * as recovery from '../../functions/api/profile-recovery.js';
import * as arcane from '../../functions/api/arcane-games.js';
import * as decks from '../../functions/api/decks.js';
const routes={'/api/community':community,'/api/profile-device':device,'/api/profile-recovery':recovery,'/api/arcane-games':arcane,'/api/decks':decks};
export default {async fetch(request,env){
 const route=routes[new URL(request.url).pathname];
 const handler=route?.[request.method==='GET'?'onRequestGet':'onRequestPost'];
 return handler?handler({request,env}):new Response('Missing test route',{status:404});
}};
