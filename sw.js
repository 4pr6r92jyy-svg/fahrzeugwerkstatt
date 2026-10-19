const CACHE='fahrzeugwerkstatt-mobile-0.2.0';
const FILES=['./','./index.html','./assets/style.css','./assets/app.js','./assets/jszip.min.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys()){if(k.startsWith('fahrzeugwerkstatt-mobile-')&&k!==CACHE)await caches.delete(k)}await self.clients.claim()})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==location.origin)return;event.respondWith((async()=>{const found=await caches.match(event.request);if(found)return found;return fetch(event.request)})())});
self.addEventListener('message',event=>{if(event.data?.type==='CHECK_OFFLINE'){event.waitUntil((async()=>{const c=await caches.open(CACHE);for(const p of FILES){if(!(await c.match(p))){event.ports[0]?.postMessage({ok:false,missing:p});return}}event.ports[0]?.postMessage({ok:true})})())}});
