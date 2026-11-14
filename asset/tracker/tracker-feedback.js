(() => {
  "use strict";
function notify(message, type = "success") {
  let container = document.getElementById('toastContainer');
  if (!container) { container = document.createElement('div'); container.id = 'toastContainer'; document.body.appendChild(container); }
  container.setAttribute('aria-label', 'Notifications');
  const aliases = {danger:'error', warn:'warning', information:'info'};
  type = aliases[type] || type;
  if (!['success','error','warning','info'].includes(type)) type = 'info';
  const labels = {success:'Success', error:'Error', warning:'Warning', info:'Information'};
  const symbols = {success:'✓', error:'!', warning:'!', info:'i'};
  const toast = document.createElement('div'); toast.className = 'rs-toast'; toast.dataset.type = type;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-atomic','true');
  const icon = document.createElement('span'); icon.className = 'rs-toast-icon'; icon.textContent = symbols[type]; icon.setAttribute('aria-hidden','true');
  const copy = document.createElement('div'); copy.className = 'rs-toast-copy';
  const title = document.createElement('span'); title.className = 'rs-toast-type'; title.textContent = labels[type];
  const text = document.createElement('span'); text.className = 'rs-toast-message'; text.textContent = String(message ?? '');
  copy.append(title,text);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'rs-toast-close'; close.textContent = '×'; close.setAttribute('aria-label','Dismiss notification');
  toast.append(icon,copy,close); container.appendChild(toast);
  let timer, started, remaining = type === 'error' || type === 'warning' ? 10000 : Math.min(10000, Math.max(4500, text.textContent.length * 45));
  let hovered = false, focused = false, dismissed = false;
  function dismiss(){ if(dismissed)return; dismissed=true;clearTimeout(timer);toast.remove(); }
  function pause(){ clearTimeout(timer); if(started){ remaining=Math.max(0,remaining-(Date.now()-started));started=0; } }
  function resume(){ if(dismissed || hovered || focused)return;started=Date.now();timer=setTimeout(dismiss,remaining); }
  close.addEventListener('click',dismiss);
  toast.addEventListener('mouseenter',()=>{hovered=true;pause();});toast.addEventListener('mouseleave',()=>{hovered=false;resume();});
  toast.addEventListener('focusin',()=>{focused=true;pause();});toast.addEventListener('focusout',event=>{if(!toast.contains(event.relatedTarget)){focused=false;resume();}});
  resume(); return toast;
}

  let requests = 0;
  let explicit = false;
  function updateBusy() {
    if (!document.body) return;
    let box = document.getElementById('trackerBusy');
    if (!box) {
      box = document.createElement('div');
      box.id = 'trackerBusy';
      box.className='tracker-loading-card';
      box.setAttribute('role', 'status');box.setAttribute('aria-live','polite');
      box.innerHTML = '<div class="tracker-loading-title">Preparing your workspace</div><div class="tracker-loading-body"><div class="tracker-loading-orbit" aria-hidden="true"><span class="tracker-busy-spinner"></span><i></i></div><div><strong id="trackerLoadingMessage">Loading recorded data…</strong><small id="trackerLoadingDetail">Waiting for the server.</small></div></div><ol class="tracker-loading-steps"><li id="trackerLoadingRequest"><b>1</b> Request selected environment</li><li id="trackerLoadingRender"><b>2</b> Prepare reports and charts</li></ol><small class="tracker-loading-foot">RanSan Tracker · Please keep this page open while saving.</small>';
      document.body.append(box);
    }
    const host = document.querySelector('dialog[open]') || document.body;
    if (box.parentElement !== host) host.append(box);
    box.hidden = requests === 0 && !explicit;
    box.querySelector('#trackerLoadingMessage').textContent=requests?'Loading recorded data…':'Preparing your reports…';
    box.querySelector('#trackerLoadingDetail').textContent=requests?'Waiting for '+(window.trackerEnvironment||'selected').toUpperCase()+' server confirmation.':'Applying the selected period and currency.';
    box.querySelector('#trackerLoadingRequest').classList.toggle('is-active',requests>0);
    box.querySelector('#trackerLoadingRender').classList.toggle('is-active',requests===0&&explicit);
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, options) {
    const address = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const tracked = /^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|opensheet\.elk\.sh)\//.test(address || '');
    if (!tracked) return originalFetch(input, options);
    const controller=!options?.signal&&typeof AbortController!=='undefined'?new AbortController():null;let timedOut=false;
    const timeout=controller?setTimeout(()=>{timedOut=true;controller.abort();},45000):null;
    requests++;
    updateBusy();
    try {
      const response = await originalFetch(input, controller?{...options,signal:controller.signal}:options);
      // Keep the indicator until the response bytes have arrived.
      await response.clone().arrayBuffer();
      return response;
    } catch(error){if(timedOut)throw new Error('The server took too long to respond. Please refresh to retry; verify a save before submitting it again.');throw error;
    } finally {
      if(timeout)clearTimeout(timeout);
      requests--;
      updateBusy();
    }
  };
  window.trackerFeedback = {
    notify,
    busy(value) { explicit = Boolean(value); updateBusy(); }
  };
  document.addEventListener('DOMContentLoaded', updateBusy);
})();
