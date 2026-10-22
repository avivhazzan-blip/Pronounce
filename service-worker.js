/* PronounceMe SW v4: offline shell + Firebase background data notifications. */
const CACHE='pronounceme-v4-20261022';
const STATIC=['./','./index.html','./manifest.webmanifest','./dictionary.js','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
 for(const path of STATIC){try{const response=await fetch(path,{cache:'reload'});if(response.ok)await cache.put(path,response);}catch{}}
}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([
 caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE&&x.startsWith('pronounceme-')).map(x=>caches.delete(x)))),
 self.clients.claim()
]));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(async resp=>{if(resp.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',resp.clone());}return resp;}).catch(async()=>await (await caches.open(CACHE)).match('./index.html')||Response.error()));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{if(resp.ok){const c=resp.clone();caches.open(CACHE).then(cache=>cache.put(event.request,c));}return resp;})));
});
// The Firebase SDK expects its messaging SW implementation for background FCM.
try{
 importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
 firebase.initializeApp({
  apiKey:'AIzaSyAPTMeQFZxN9yTQxUMjBisDeJFIMUGh1sE',authDomain:'proeng-23ae9.firebaseapp.com',projectId:'proeng-23ae9',
  messagingSenderId:'863824200149',appId:'1:863824200149:web:971785e5e0f59e69dd3d5c'
 });
 if(firebase.messaging.isSupported())firebase.messaging().onBackgroundMessage(payload=>{
  const data=payload.data||{};
  const title=data.title||'PronounceMe';
  return self.registration.showNotification(title,{body:data.body||'Your learning session is ready.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:'pm-daily-reminder',data:{url:self.registration.scope}});
 });
}catch(e){console.warn('Background push not configured or unsupported',e);}
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
 const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of clientsList){if(client.url.startsWith(self.registration.scope)){await client.focus();return;}}
 await self.clients.openWindow(self.registration.scope);
 })());
});
