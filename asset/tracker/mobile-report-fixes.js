/* Mobile presentation and same-origin navigation only. No financial writes or auth bypass. */
(()=>{'use strict';
 const media=window.matchMedia('(max-width: 768px)'),release='20261115-r1';
 const wrappers=new Set(),links=new Map(),marks=new Map(),tableTools=new Map();let observer,timer,heading,active=false,workerRequested=false;
 function stopObserver(){observer?.disconnect();clearTimeout(timer);}
 function mark(el,...classes){if(!el)return;let added=marks.get(el);if(!added){added=new Set();marks.set(el,added);}for(const c of classes)if(!el.classList.contains(c)){el.classList.add(c);added.add(c);}}
 function updateTools(record){const {host,table,tools,label,left,right}=record,columns=table.querySelectorAll('thead th').length;
  const measurable=host.clientWidth>0,overflow=measurable&&host.scrollWidth>host.clientWidth+2;
  tools.hidden=measurable?!overflow:columns<=4;
  const text=columns+' columns · swipe or use arrows';if(label.textContent!==text)label.textContent=text;
  const max=Math.max(0,(host.scrollWidth||0)-(host.clientWidth||0));left.disabled=!overflow||host.scrollLeft<=1;right.disabled=!overflow||host.scrollLeft>=max-1;
 }
 function refreshTools(){if(active)for(const r of tableTools.values())updateTools(r);}
 function clean(){for(const w of [...wrappers])if(!w.isConnected)wrappers.delete(w);for(const el of marks.keys())if(!el.isConnected)marks.delete(el);for(const [table,r]of tableTools)if(!table.isConnected||table.parentElement!==r.host){r.tools.remove();r.host.removeEventListener('scroll',r.onScroll);tableTools.delete(table);}}
 function tableEnhance(table){
  const selector='.mobile-table-scroll,.mr-scroll,.fp-table-scroll,.finance-ledger-scroll,.finance-table-scroll,.ci-table-wrap,.ad-scroll,.overflow-x-auto,.overflow-auto,.ru-table-wrap,.table-wrap,.table-scroll';
  let host=table.parentElement;if(!host.matches(selector)){host=document.createElement('div');host.className='mobile-table-scroll';host.tabIndex=0;host.setAttribute('role','region');host.setAttribute('aria-label','Table · swipe horizontally for more columns');table.before(host);host.append(table);wrappers.add(host);}
  mark(host,'mobile-report-scroller');
  // Category Insights already has a four-column stacked-card layout on phones.
  const categoryCards=table.closest('#ciApp')&&table.querySelector('td[data-label="Total"]');if(!categoryCards)mark(table,'mobile-report-table');
  const heads=[...table.querySelectorAll('thead th')],dates=heads.map(h=>/^(date(?:\s*[↓↑])?|valued on|deadline|due|due date|completed(?: at| date)?|created(?: at| date)?)$/i.test(h.textContent.trim()));
  heads.forEach((h,i)=>{if(dates[i])mark(h,'mobile-date-cell');});
  for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((cell,i)=>{if(dates[i]||/^(?:\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4})(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/.test(cell.textContent.trim()))mark(cell,'mobile-date-cell');});
  let record=tableTools.get(table);
  if(!record&&!categoryCards){const tools=document.createElement('div');tools.className='mobile-table-tools';const label=document.createElement('span'),left=document.createElement('button'),right=document.createElement('button');left.type=right.type='button';left.textContent='‹';right.textContent='›';left.setAttribute('aria-label','Previous table columns');right.setAttribute('aria-label','Next table columns');tools.append(label,left,right);host.before(tools);
   const move=direction=>{const distance=Math.max(140,(host.clientWidth||240)*.8)*direction;if(typeof host.scrollBy==='function')host.scrollBy({left:distance,behavior:'auto'});else host.scrollLeft=(host.scrollLeft||0)+distance;updateTools(record);};left.onclick=()=>move(-1);right.onclick=()=>move(1);
   record={table,host,tools,label,left,right,onScroll:()=>updateTools(record)};host.addEventListener('scroll',record.onScroll,{passive:true});tableTools.set(table,record);
  }
  if(record)updateTools(record);
 }
 function decorate(){if(!active)return;stopObserver();try{
  clean();const sidebar=document.querySelector('.finance-workspace>.finance-sidebar');
  if(sidebar&&!sidebar.querySelector('.mobile-workspace-heading')){heading=document.createElement('div');heading.className='mobile-workspace-heading';heading.textContent='▦ Workspace · swipe for more';sidebar.prepend(heading);}
  for(const table of document.querySelectorAll('#trackerContent table,dialog table,#modalContent table,.tac-modal table,.ru-modal table'))tableEnhance(table);
  if(location.pathname?.endsWith('/todo.html')){const header=document.querySelector('#trackerContent>header'),hero=header?.querySelector('.glass.ring-grad');if(header&&hero){mark(header,'mobile-tasks-header');mark(hero,'mobile-task-hero');mark(hero.children[0],'mobile-task-identity');mark(hero.children[1],'mobile-task-actions');const tabs=[...header.children].find(el=>el!==hero&&el.querySelector('.pf-view-toggle'));mark(tabs,'mobile-task-switches');}}
  for(const link of document.querySelectorAll('#trackerMobileDock a,#trackerModuleLinks a')){const raw=link.getAttribute('href');if(!raw)continue;const url=new URL(raw,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('/todo.html'))continue;if(!links.has(link))links.set(link,raw);url.searchParams.set('mobile_ui',release);link.setAttribute('href',url.href);}
 }finally{observer?.observe(document.body,{childList:true,subtree:true});}}
 async function updateWorker(){if(workerRequested||!('serviceWorker'in navigator)||!window.isSecureContext)return;workerRequested=true;try{const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await registration.update();registration.waiting?.postMessage({type:'TRACKER_ACTIVATE_MOBILE_FIX'});}catch(error){console.warn('Tracker cache update unavailable; normal online navigation remains available.',error?.message);}}
 function enter(){if(active)return;active=true;document.body.classList.add('mobile-report-ui');observer=new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('canvas,#trackerBusy')))return;clearTimeout(timer);timer=setTimeout(decorate,80);});decorate();updateWorker();}
 function leave(){if(!active)return;active=false;stopObserver();document.body.classList.remove('mobile-report-ui');heading?.remove();heading=null;
  for(const r of tableTools.values()){r.tools.remove();r.host.removeEventListener('scroll',r.onScroll);}tableTools.clear();
  for(const [el,classes]of marks)for(const c of classes)el.classList.remove(c);marks.clear();
  for(const wrapper of wrappers)if(wrapper.isConnected){for(const child of [...wrapper.childNodes])wrapper.before(child);wrapper.remove();}wrappers.clear();
  for(const [link,raw]of links)if(link.isConnected)link.setAttribute('href',raw);links.clear();
 }
 function sync(){if(media.matches)enter();else leave();}
 media.addEventListener('change',sync);window.addEventListener('resize',refreshTools,{passive:true});window.addEventListener('pagehide',()=>{stopObserver();});window.addEventListener('pageshow',()=>{if(active)decorate();else sync();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();
