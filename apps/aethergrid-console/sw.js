const CACHE='aethergrid-v1';
const FILES=['./','./index.html','./styles.css','./app.js','./app.json','./ui.json','./manifest.webmanifest','./assets/dashboard-reference.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(result=>result||caches.match('./index.html'))));});
