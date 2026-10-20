// Network services must be explicitly mocked. Loopback remains available for
// browser fixtures. Live smoke checks have their own opt-in command.
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,...args)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
  throw Error('Unmocked external fetch blocked during local tests: '+url.origin);
 return nativeFetch(input,...args);
};
