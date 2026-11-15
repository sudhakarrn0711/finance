/* Preserve desktop network-first behavior; retire stale iframe-era mobile Tasks HTML. */
const CACHE_NAME='tracker-v3';
const scopeURL=new URL(self.registration.scope);
const cachedPages=['./','./index.html','./todo.html'].map(path=>new URL(path,scopeURL).href);
const taskPath=new URL('./todo.html',scopeURL).pathname;
async function currentTasks(response){const source=await response.clone().text();return source.includes('asset/tracker/app-shell.js')&&!source.includes('window.top === window.self');}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  // Installation remains possible if one page is temporarily unavailable.
  await Promise.allSettled(cachedPages.map(async url=>{const response=await fetch(url,{cache:'reload'});if(response.ok&&(new URL(url).pathname!==taskPath||await currentTasks(response)))await cache.put(url,response);}));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of ['todo-v1','todo-v2']){
   const cache=await caches.open(name);
   for(const request of await cache.keys()){
    const url=new URL(request.url);
    if(url.origin===scopeURL.origin&&url.pathname.startsWith(scopeURL.pathname))await cache.delete(request);
   }
  }
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='TRACKER_ACTIVATE_MOBILE_FIX')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==scopeURL.origin)return;
 const canonical=new URL(url.pathname,url.origin).href;
 if(!cachedPages.includes(event.request.url)&&!(url.pathname===taskPath&&url.searchParams.get('mobile_ui')==='20261115-r1'))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(event.request,url.searchParams.has('mobile_ui')?{cache:'no-store'}:undefined);
   // A 4xx/5xx stays visible; do not silently present a stale successful save/page.
   if(response.ok&&(url.pathname!==taskPath||await currentTasks(response))){try{const cache=await caches.open(CACHE_NAME);await cache.put(canonical,response.clone());}catch{/* Storage limits must not discard a successful online response. */}}
   return response;
  }catch{
   const cache=await caches.open(CACHE_NAME);
   const saved=(await cache.match(event.request))||(await cache.match(canonical));
   if(saved&&url.pathname===taskPath&&!await currentTasks(saved))return new Response('Tasks needs the updated page. Connect to the internet and reopen Tasks from Finance.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
   return saved||Response.error();
  }
 })());
});
