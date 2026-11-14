(()=>{'use strict';const page=location.pathname.split('/').pop(),themes={
 'networth_tracker.html':['#06060a','#8b5cf6','#34d399'],
 'todo.html':['#0b0d12','#7c5cff','#00d0ff'],
 'budget_additional.html':['#08101a','#60a5fa','#6366f1'],
 'catagory_insight.html':['#0f172a','#9a22f6','#f96fdc'],
 'Goals.html':['#0f172a','#22c55e','#84cc16']
};if(!themes[page])return;function decorate(){let box=document.getElementById('trackerBusy');if(!box){window.trackerFeedback?.busy(false);box=document.getElementById('trackerBusy');}if(!box)return;const [bg,accent,accent2]=themes[page];box.classList.add('original-five-loader');box.style.setProperty('--og-loader-bg',bg);box.style.setProperty('--og-loader-accent',accent);box.style.setProperty('--og-loader-accent2',accent2);box.style.setProperty('--og-loader-text','#e8ebf2');}
 document.body?.setAttribute('data-original-module',page);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
