/* PronounceMe SW v6 — network-fresh pages and dictionary; offline fallback; Firebase push preserved. */
const CACHE='pronounceme-v6-20261024-layout-refresh';
const STATIC=['./','./index.html','./manifest.webmanifest','./dictionary.js','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
 for(const path of STATIC){try{const response=await fetch(path,{cache:'reload'});if(response.ok)await cache.put(path,response);}catch(e){}}
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
 const canonicalDictionary=new URL('./dictionary.js',self.registration.scope).href;
 // IMPORTANT: dictionary must be network-first. Otherwise installed PWAs indefinitely
 // load old dictionary.js despite GitHub updates and clearing browser HTTP cache.
 if(url.pathname===new URL(canonicalDictionary).pathname){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(event.request,{cache:'no-store'});
    if(response.ok){await cache.put(canonicalDictionary,response.clone());return response;}
    return (await cache.match(canonicalDictionary))||response;
   }catch(e){return (await cache.match(canonicalDictionary))||(await caches.match(canonicalDictionary))||Response.error();}
  })());
  return;
 }
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(async response=>{
   if(response.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone());}
   return response;
  }).catch(async()=>(await (await caches.open(CACHE)).match('./index.html'))||Response.error()));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok){const cloned=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,cloned));}
  return response;
 })));
});
// Preserve original FCM background messaging behavior and existing Firebase project.
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
