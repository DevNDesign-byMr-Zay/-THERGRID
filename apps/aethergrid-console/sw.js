const CACHE='aethergrid-v3';
const FILES=['./','./index.html','./styles.css','./app.js','./app.json','./ui.json','./manifest.webmanifest','./assets/brand/aethergrid-logo.webp','./assets/brand/vaelon.webp','./assets/brand/auren.webp','./assets/brand/solvaer.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))])));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(result=>result||caches.match('./index.html'))));});
