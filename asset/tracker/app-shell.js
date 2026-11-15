(() => {
  const pages = [
    ['finance_tracker_new.html', 'Finance', '₹'],
    ['budget.html', 'Budget', '▤'],
    ['networth_tracker.html', 'Net worth', '◈'],
    ['todo.html', 'Tasks', '✓'],
    ['budget_additional.html', 'Budget+', '+'],
    ['catagory_insight.html', 'Category insights', '◫'],
    ['Goals.html', 'Goals', '◎'],
    ['ai_advisor.html', 'AI Advisor', '✦']
  ];
  const page = location.pathname.split('/').pop();
  const timeout = 15 * 60 * 1000;
  const key = 'ranSanLastUnlockedActivity';
  const loggedIn = () => localStorage.getItem('isLoggedIn') === 'true';
  const unlocked = () => Date.now() - Number(sessionStorage.getItem(key)) < timeout;

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }

  if (page === 'login.html') return;
  if (!loggedIn()) {
    sessionStorage.removeItem(key);
    location.replace('login.html');
    return;
  }

  if (!pages.some(([file]) => file === page)) {
    const params = new URLSearchParams(location.search);
    const next = pages.find(([file]) => file === params.get('next'))?.[0] || pages[0][0];
    if (unlocked()) {
      location.replace(next);
      return;
    }
    window.completeTrackerUnlock = () => {
      sessionStorage.setItem(key, String(Date.now()));
      location.replace(next);
    };
    return;
  }

  function checkSession() {
    if (!loggedIn()) {
      sessionStorage.removeItem(key);
      window.trackerNavigation?.allowUnload();
      location.replace('login.html');
      return false;
    }
    if (!unlocked()) {
      window.trackerNavigation?.allowUnload();
      location.replace('index.html?next=' + encodeURIComponent(page));
      return false;
    }
    return true;
  }

  if (!checkSession()) return;
  let lastActivity = 0;
  function recordActivity() {
    if (Date.now() - lastActivity < 1000 || !checkSession()) return;
    lastActivity = Date.now();
    sessionStorage.setItem(key, String(lastActivity));
  }
  for (const event of ['pointerdown', 'keydown', 'scroll']) {
    window.addEventListener(event, recordActivity, { passive: true, capture: true });
  }
  window.addEventListener('pageshow', checkSession);
  window.addEventListener('storage', checkSession);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSession();
  });
  setInterval(checkSession, 1000);

  function link([file, label, icon], index) {
    const active = file === page ? ' aria-current="page"' : '';
    return `<a href="${file}" data-tone="${index}"${active}><span aria-hidden="true">${icon}</span>${label}</a>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;
    const nav = document.createElement('nav');
    nav.id = 'trackerNav';
    nav.setAttribute('aria-label', 'Tracker modules');
    nav.innerHTML = `<div class="tracker-nav-inner">
      <a class="tracker-brand" href="index.html">RanSan <small>Tracker</small></a>
      <button type="button" class="tracker-mobile-menu" aria-expanded="false" aria-controls="trackerModuleLinks">☰ <span>${pages.find(item=>item[0]===page)?.[1]||'Modules'}</span></button>
      <div id="trackerModuleLinks" class="tracker-module-links">${pages.map(link).join('')}<button type="button" class="tracker-mobile-session" data-mobile-lock>Lock screen</button><button type="button" class="tracker-mobile-session" data-mobile-logout>Sign out</button></div>
      <details class="tracker-quick-add"><summary>＋ Quick Add</summary><div><button type="button" data-quick-add="transaction">Transaction</button><button type="button" data-quick-add="movement">Transfer / refund</button><button type="button" data-quick-add="commitment">Commitment</button></div></details>
      <button type="button" class="tracker-env" data-environment role="switch" aria-label="Live environment"><span aria-hidden="true" class="tracker-env-test">TEST</span><span aria-hidden="true" class="tracker-env-live">LIVE</span></button>
      <button type="button" data-tone="7" data-lock><span aria-hidden="true">◇</span>Lock screen</button>
      <button type="button" data-tone="5" data-logout><span aria-hidden="true">↪</span>Sign out</button>
    </div>`;
    document.body.classList.add('tracker-page');
    document.body.prepend(nav);
    // Mobile-only assets are loaded on demand; all desktop presentation remains unchanged.
    const mobileMedia=window.matchMedia('(max-width: 768px)');
    const loadMobileAssets=()=>{
      if(!mobileMedia.matches||document.getElementById('trackerMobileFixCSS'))return;
      const css=document.createElement('link');css.id='trackerMobileFixCSS';css.rel='stylesheet';css.href='asset/tracker/mobile-report-fixes.css?v=20261115-r2';document.head.append(css);
      const js=document.createElement('script');js.src='asset/tracker/mobile-report-fixes.js?v=20261115-r2';document.head.append(js);
    };
    mobileMedia.addEventListener('change',loadMobileAssets);loadMobileAssets();

    nav.querySelector('[data-mobile-lock]').addEventListener('click',()=>nav.querySelector('[data-lock]').click());
    nav.querySelector('[data-mobile-logout]').addEventListener('click',()=>nav.querySelector('[data-logout]').click());
    nav.querySelector('.tracker-mobile-menu').addEventListener('click',event=>{
      const button=event.currentTarget,open=nav.classList.toggle('tracker-menu-open');button.setAttribute('aria-expanded',String(open));
    });
    nav.querySelectorAll('[data-quick-add]').forEach(button=>button.addEventListener('click',async()=>{
      if(window.trackerNavigation&&!await window.trackerNavigation.check(page!=='finance_tracker_new.html'))return;
      const kind=button.dataset.quickAdd;
      nav.querySelector('details').open=false;
      if(page==='finance_tracker_new.html')window.dispatchEvent(new CustomEvent('tracker-quick-add',{detail:kind}));
      else location.assign('finance_tracker_new.html?quick='+encodeURIComponent(kind));
    }));
    const setHeaderOffset = () => {
      document.body.style.setProperty('--tracker-header-space', `${nav.offsetHeight}px`);
    };
    setHeaderOffset();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(setHeaderOffset).observe(nav);
    const footer = document.createElement('footer');
    footer.id = 'trackerFooter';
    footer.innerHTML = `
      <div class="tracker-credit"><span class="tracker-footer-icon" aria-hidden="true">©</span><div><strong>© 2026 RanSan Groups.</strong><small>All rights reserved.</small></div></div>
      <a class="tracker-website" href="https://www.ransangroups.com"><span class="tracker-footer-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></span><strong>www.ransangroups.com</strong></a>
      <div class="tracker-credit tracker-developer"><span class="tracker-footer-icon" aria-hidden="true">‹/›</span><div><small>Designed and developed by</small><strong>RanSan Technology</strong></div></div>`;
    const status=document.createElement('div');status.className='tracker-footer-status';
    status.innerHTML='<small id="trackerUpdatedStatus" role="status">Ready</small><span>v2026.11.13-r5</span><button type="button" id="trackerHelp">Help</button><details><summary>Brand</summary><p>© 2026 RanSan Groups · www.ransangroups.com · Designed and developed by RanSan Technology</p></details>';
    footer.append(status);
    document.body.append(footer);
    const help=document.createElement('dialog');help.id='trackerHelpDialog';help.className='tracker-utility-dialog';
    help.innerHTML='<form method="dialog"><h2>RanSan Tracker help</h2><p>Select TEST or LIVE in the header. Quick Add opens a transaction, transfer or commitment. Finance ledger filters apply to the displayed totals and CSV export. Planning views group each currency separately.</p><p>New transaction drafts stay in this browser and environment. CSV imports require a reviewed preview. Reports can be printed using the browser’s Save as PDF option.</p><p>Version 2026.11.13-r5</p><button>Close</button></form>';
    document.body.append(help);document.getElementById('trackerHelp').addEventListener('click',()=>help.showModal());
    document.addEventListener('tracker-data-status',event=>{document.getElementById('trackerUpdatedStatus').textContent=event.detail;});
    new ResizeObserver(()=>document.body.style.setProperty('--tracker-footer-space',footer.offsetHeight+'px')).observe(footer);
    const environment = nav.querySelector('[data-environment]');
    const isLive = (window.trackerEnvironment || localStorage.getItem('trackerEnvironment')) === 'live';
    environment.setAttribute('aria-checked', String(isLive));
    environment.title = isLive ? 'Switch to TEST' : 'Switch to LIVE';
    environment.addEventListener('click', async () => {
      if(window.trackerNavigation&&!await window.trackerNavigation.check(true))return;
      localStorage.setItem('trackerEnvironment', isLive ? 'test' : 'live');
      location.reload();
    });
    nav.querySelector('[data-lock]').addEventListener('click', async () => {
      if(window.trackerNavigation&&!await window.trackerNavigation.check(true))return;
      sessionStorage.removeItem(key);
      checkSession();
    });
    nav.querySelector('[data-logout]').addEventListener('click', async () => {
      if(window.trackerNavigation&&!await window.trackerNavigation.check(true))return;
      sessionStorage.removeItem(key);
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      checkSession();
    });
    const content=document.createElement('div');content.id='trackerContent';
    const fixedIds=new Set(['trackerNav','trackerFooter','trackerHelpDialog','modalBackdrop','pfFabBtn','notifPopup','toastContainer','trackerBusy','ws-print-report']);
    [...document.body.children].forEach(el=>{if(!fixedIds.has(el.id)&&!['DIALOG','SCRIPT','STYLE','LINK'].includes(el.tagName)&&!el.classList.contains('pf-fab'))content.append(el);});
    document.body.insertBefore(content,footer);
    const dock=document.createElement('nav');dock.id='trackerMobileDock';dock.setAttribute('aria-label','Mobile modules');
    dock.innerHTML=pages.filter(([file])=>['finance_tracker_new.html','budget.html','networth_tracker.html','todo.html'].includes(file)).map(([file,label,icon])=>`<a href="${file}"${file===page?' aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('')+'<button type="button" aria-label="All modules" aria-controls="trackerModuleLinks" aria-expanded="false"><span aria-hidden="true">☰</span>More</button>';
    document.body.append(dock);const more=dock.querySelector('button');
    more.addEventListener('click',()=>{const open=nav.classList.toggle('tracker-menu-open');more.setAttribute('aria-expanded',String(open));nav.querySelector('.tracker-mobile-menu').setAttribute('aria-expanded',String(open));});
    nav.querySelector('.tracker-mobile-menu').addEventListener('click',()=>more.setAttribute('aria-expanded',String(nav.classList.contains('tracker-menu-open'))));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){nav.classList.remove('tracker-menu-open');more.setAttribute('aria-expanded','false');nav.querySelector('.tracker-mobile-menu').setAttribute('aria-expanded','false');}});
    if(page==='todo.html'){const sidebar=content.querySelector('main>aside');if(sidebar){sidebar.classList.add('task-filters-collapsed');const toggle=document.createElement('button');toggle.type='button';toggle.className='task-sidebar-toggle';toggle.textContent='Filters and calendar  ▾';toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>{const expanded=!sidebar.classList.toggle('task-filters-collapsed');toggle.setAttribute('aria-expanded',String(expanded));});sidebar.prepend(toggle);}}

  });
})();
