/* Idempotent presentation decoration. No polling, resize loops or data writes. */
(()=>{'use strict';document.body.classList.add('tracker-ui-v3');const $=id=>document.getElementById(id),page=location.pathname.split('/').pop();let observer,timer;
function pill(text,tone=''){const s=document.createElement('span');s.className='ui-pill '+tone;s.textContent=text;return s;}
function decorate(){observer?.disconnect();try{
for(const table of document.querySelectorAll('table')){const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.toLowerCase());for(const row of table.querySelectorAll('tbody tr'))for(const [i,cell] of [...row.children].entries()){const head=headers[i]||'',text=cell.textContent.trim();if(/budget/.test(head))cell.classList.add('ui-budget');if(/actual|reserved/.test(head))cell.classList.add('ui-actual');if(cell.children.length||!text)continue;
if(/status|check|type|priority/.test(head)&&text.length<90){const tag=pill(text);tag.classList.add('ui-status');tag.dataset.level=/over|unbudgeted|risk|failed|expense/i.test(text)?'danger':/fully|used|configured|high/i.test(text)?'warning':'normal';cell.replaceChildren(tag);}
else if(/income|expense|amount|balance|total|budget|actual|used|share|current|target|remaining|average/.test(head)&&/\d/.test(text)){const tone=/income/.test(head)?'ui-positive':/expense/.test(head)?'ui-negative':/^-|\s-\d/.test(text)?'ui-negative':'';cell.replaceChildren(pill(text,tone));}}
}
for(const id of ['kpiIncome','kpiExpense','kpiSaveRate','kpiOver'])$(id)?.parentElement.classList.add('ui-kpi');
for(const node of document.querySelectorAll('.mr-kpi'))node.classList.add('ui-kpi');
for(const node of document.querySelectorAll('[data-kpi]')){if(!node.dataset.uiKeyboard){node.dataset.uiKeyboard='true';node.tabIndex=0;node.setAttribute('role','button');node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();node.click();}});}}
if(page==='Goals.html'){
const M=window.RanSanModule;
if(M?.data){for(const id of ['trendChart','burndownChart']){const note=document.querySelector('[data-mr-note="'+id+'"]');if(!note||note.querySelector('button'))continue;const goals=M.data.goals.filter(g=>g.currency===M.currency&&g.state!=='archived');const actions=document.createElement('div');actions.className='ui-history-actions';for(const g of goals.slice(0,4)){const b=document.createElement('button');b.type='button';b.textContent='Observe '+g.name;b.dataset.mrAction='goal-observe';b.dataset.value=g.id;actions.append(b);}note.append(actions);}}
const host=$('typeBreakdown')?.closest('.glass');if(host)host.classList.add('ui-type-card');
for(const el of document.querySelectorAll('.goal-card .progress > div,.goal-card .g-pos,.goal-card .g-neg,#consistencyBar,#challengeBar')){const percent=parseFloat(el.style.width);if(Number.isFinite(percent))el.style.background=percent>=75?'#34d399':percent>=40?'#38bdf8':'#fbbf24';}
}
}finally{observer?.observe(document.body,{childList:true,subtree:true});}}
// Keep the headline KPIs directly beneath the report tabs, visible in both views.
if(page==='networth_tracker.html'){const tabs=document.querySelector('.tabs');if(tabs){const grid=document.createElement('div');grid.className='grid ui-headline-kpis';for(const id of ['netWorthCard','assetsCard','liabCard','changeCard'])if($(id))grid.append($(id));tabs.after(grid);}}
observer=new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('canvas,#trackerBusy')))return;clearTimeout(timer);timer=setTimeout(decorate,60);});decorate();
window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(timer);});
})();
