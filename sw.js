/* Only the explicit public application shell is cached. Private vehicle records
   stay in IndexedDB; Supabase requests and credentials never enter this cache. */
'use strict';
const BUILD='2.3.0-20261022';
const CACHE_PREFIX='fahrzeugwerkstatt-mobile-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=CACHE_PREFIX+BUILD;
const FILES=['./assets/curated-23.js','./assets/public-knowledge-index.js','./assets/catalog-manager.js','./assets/research-case.js','./assets/catalog-manager.css','./assets/workshop22-core.js','./assets/workshop22-ui.js','./assets/workshop22.css','./assets/branding/panorama.png','./assets/branding/logo.png','./index.html','./assets/style.css','./assets/cloud.css','./assets/app.js','./assets/mobile-v2.js','./assets/vehicle-cover.js','./assets/vehicle-cover.css','./assets/fw-model.js','./assets/fw-cloud.js','./assets/fw-sync-ui.js','./assets/workshop21.js','./assets/workshop21.css','./assets/intervals21.js','./assets/vehicle-catalog21.js','./assets/jszip.min.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const publicURL=path=>new URL(path,self.registration.scope).href;
const allowed=new Set(FILES.map(path=>new URL(publicURL(path)).pathname));
const indexURL=publicURL('./index.html');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // A complete new shell is installed before it can replace the current worker.
 // Cache-busting avoids taking a previous release from the browser HTTP cache.
 try{
  await Promise.all(FILES.map(async path=>{
   const url=new URL(publicURL(path));url.searchParams.set('build',BUILD);
   const response=await fetch(new Request(url.href,{cache:'reload',credentials:'omit'}));
   if(!response.ok||response.type==='opaque')throw Error('Programmdatei nicht verfügbar: '+path);
   await cache.put(publicURL(path),response);
  }));
 }catch(error){await caches.delete(CACHE);throw error;}
 // Upgrades wait for the old app to close or for an explicit Update-laden action.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Older unscoped caches may belong to another repository on the same origin.
 // Keep them; clean only this app scope's superseded complete builds.
 for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)await caches.delete(key);
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin)return;
 const isIndex=url.pathname===scope.pathname||url.pathname===new URL(indexURL).pathname;
 if(!isIndex&&!allowed.has(url.pathname))return;
 const key=isIndex?indexURL:new URL(url.pathname,url.origin).href;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(key);
  return cached||fetch(event.request);
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of FILES)if(!(await cache.match(publicURL(path)))){event.ports[0]?.postMessage({ok:false,missing:path,version:BUILD});return;}
  event.ports[0]?.postMessage({ok:true,version:BUILD});
 })());
});
