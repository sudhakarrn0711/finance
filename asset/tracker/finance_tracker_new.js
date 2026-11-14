//
//Montly income summary table

/* -------- CONFIG -------- */
//const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec";


const SCRIPT_URL = window.getScriptURL("finance_tracker_new");

const ENABLE_JSONP_FALLBACK = false;

/* ------- DOM helpers ------- */
const el = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const qAll = sel => Array.from(document.querySelectorAll(sel));

/* ------- UI elements ------- */
const sidebar = el('sidebar');
const overlay = el('overlay');
const openSidebarBtn = el('openSidebar');
const closeSidebarBtn = el('closeSidebar');
const mainWrap = el('mainContent');
const toastEl = el('toast');
const loaderOverlay = el('loaderOverlay');

function showLoading() { window.trackerFeedback.busy(true); }
function hideLoading() { window.trackerFeedback.busy(false); }
function showToast(message = 'Action successful') {
  return window.trackerFeedback.notify(message, 'success');
}
function localDateInput(value = new Date()) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-');
    return year + '-' + month + '-' + day;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

/* Sidebar toggle */
openSidebarBtn && openSidebarBtn.addEventListener('click', () => {
  sidebar.classList.add('active');
  overlay.classList.add('show');
  mainWrap.classList.add('shifted');
});
closeSidebarBtn && closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.remove('active');
  overlay.classList.remove('show');
  mainWrap.classList.remove('shifted');
});
overlay && overlay.addEventListener('click', () => {
  sidebar.classList.remove('active');
  overlay.classList.remove('show');
  mainWrap.classList.remove('shifted');
});

/* Tab navigation - unified to .tab-btn */
qAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qAll('.tab-content').forEach(s => s.style.display = 'none');

    const id = btn.dataset.tab;
    if (id && el(id)) el(id).style.display = 'block';

  });
});



document.querySelectorAll(".report-subtab").forEach(btn => {
  btn.addEventListener("click", () => {
    // Remove active class from all tabs, then set for the clicked one
    document.querySelectorAll(".report-subtab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.dataset.subtab === "monthly") {
      // Show monthly dashboard
      document.getElementById("monthlyDashboard").style.display = "";
      document.getElementById("annualDashboard").style.display = "none";
    } else {
      // Show annual dashboard
      document.getElementById("monthlyDashboard").style.display = "none";
      document.getElementById("annualDashboard").style.display = "";

      // ✅ Only generate the annual report when the Annual tab is clicked
      console.log("📊 Loading Annual Report...");

    }
  });
});


/* ------- API helpers ------- */
function validateFinanceResponse(data, action) {
  if (!data || typeof data !== 'object') throw new Error(action + ': the server returned no usable JSON data.');
  if (data.error || data.status === 'error' || data.success === false) {
    const message=typeof data.error==='string'?data.error:data.error?.message||data.message||'Server rejected this request.';
    throw new Error(action + ': ' + message);
  }
  if(action==='listTransactions') {
    if(Array.isArray(data))return {rows:data};
    if(!Array.isArray(data.rows))throw new Error('listTransactions: the deployed endpoint did not return a rows array. Check the combined /exec URL and deploy the latest Apps Script version.');
  }
  return data;
}
function showFinanceLoadError(error) {
  const message='Unable to load transactions. '+String(error?.message||error);
  let box=el('financeLoadError');
  if(!box){box=document.createElement('div');box.id='financeLoadError';box.className='finance-load-error';box.setAttribute('role','alert');const text=document.createElement('p');text.dataset.loadMessage='true';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry transactions';retry.addEventListener('click',()=>loadTransactions());box.append(text,retry);el('transactions').prepend(box);}
  box.querySelector('[data-load-message]').textContent=message;box.hidden=false;
  window.trackerFeedback.notify(message,'error');
  document.dispatchEvent(new CustomEvent('tracker-data-status',{detail:'Transaction load failed · use Retry'}));
}

async function apiGet(action, params = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  try {
    const res = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no body>');
      throw new Error(`HTTP ${res.status} — ${txt}`);
    }
    return validateFinanceResponse(await res.json(), action);
  } catch (err) {
    console.error('apiGet failed:', err);
    if (ENABLE_JSONP_FALLBACK) return await jsonpGet(action, params);
    throw err;
  }
}

async function apiPost(action, payload = {}) {
  const params = new URLSearchParams();
  params.set('action', action);
  params.set('actor', localStorage.getItem('user') || 'Tracker user');
  Object.keys(payload || {}).forEach(k => {
    const v = (payload[k] === undefined || payload[k] === null) ? '' : String(payload[k]);
    params.set(k, v);
  });
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString()
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no body>');
      throw new Error(`HTTP ${res.status} — ${txt}`);
    }
    return validateFinanceResponse(await res.json(), action);
  } catch (err) {
    console.error('apiPost failed:', err);
    throw err;
  }
}

function jsonpGet(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'cb_' + Math.random().toString(36).slice(2);
    window[callbackName] = function (data) { cleanup(); resolve(data); };
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    const s = document.createElement('script'); s.src = url.toString();
    s.onerror = () => { cleanup(); reject(new Error('JSONP load error')); };
    document.body.appendChild(s);
    function cleanup() { try { delete window[callbackName]; } catch (e) { } if (s.parentNode) s.parentNode.removeChild(s); }
    setTimeout(() => { if (window[callbackName]) { cleanup(); reject(new Error('JSONP timeout')); } }, 8000);
  });
}

/* ------- Setup data (categories/accounts/currency) ------- */
let incomeCats = [], expenseCats = [], accounts = [];




function updateCategoryDropdown(type) {
  const sel = el('txCategory');
  if (!sel) return;
  sel.innerHTML = '';
  const list = (type === 'income') ? incomeCats : expenseCats;
  list.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
  });
}

function updateAccountDropdown() {
  const sel = el('txAccount'); if (!sel) return;
  sel.innerHTML = '';
  accounts.forEach(a => {
    const o = document.createElement('option'); o.value = a; o.textContent = a; sel.appendChild(o);
  });
}


/* ---------- Helpers ---------- */
function normalize(s) {
  return String(s ?? '').trim();
}

async function getSetupList(type) {
  // returns array for the requested type by fetching current server state
  try {
    const res = await apiGet('getSetup');
    if (!res) return [];
    if (type === 'income') return (res.incomeCategories || []).map(normalize);
    if (type === 'expense') return (res.expenseCategories || []).map(normalize);
    return (res.accounts || []).map(normalize);
  } catch (err) {
    console.error('getSetupList failed', err);
    return [];
  }
}

async function categoryExistsOnServer(type, name) {
  const list = await getSetupList(type);
  return list.includes(normalize(name));
}

// Inject styles for UI/UX enhancements
// Inject styles for UI/UX enhancements
(function () {
  const style = document.createElement('style');
  style.textContent = `
    /* Zebra striping */
    .strip-even { background-color: #15141d; }
    .strip-odd { background-color: #101117; }
    .strip-even:hover, .strip-odd:hover { background-color: #232236; }

    /* Buttons */
    .btn-rename {
      background: #14b8a6; color: white; border-radius: 30px; padding: 4px 12px;
      display: flex; align-items: center; gap: 4px; transition: background 0.2s ease;
    }
    .btn-rename:hover { background: #0d9488; }
    .btn-delete {
      background: #f97316; color: white; border-radius: 30px; padding: 4px 12px;
      display: flex; align-items: center; gap: 4px; transition: background 0.2s ease;
    }
    .btn-delete:hover { background: #ea580c; }

    /* Fade animations */
    @keyframes fadeInRow { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .fade-row { animation: fadeInRow 0.25s ease forwards; }
    @keyframes fadeOutRow { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(6px); } }
    .fade-out { animation: fadeOutRow 0.3s ease forwards; }

    /* Flashes */
    @keyframes flashSuccess { 0% { background-color: #163328; } 50% { background-color: #1e4436; } 100% { background-color: inherit; } }
    .flash-success { animation: flashSuccess 0.8s ease; }
    @keyframes flashDelete { 0% { background-color: #341c27; } 50% { background-color: #492332; } 100% { background-color: inherit; } }
    .flash-delete { animation: flashDelete 0.4s ease; }

    /* Custom rename modal */
    .rename-modal {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.4); z-index: 1000;
    }
    .rename-box {
      position: absolute;
      background: white; border-radius: 8px;
      min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; flex-direction: column; gap: 8px;
    }
    .rename-header {
      padding: 8px; background: #14b8a6; color: white;
      cursor: move; border-radius: 8px 8px 0 0; font-weight: bold;
    }
    .rename-content { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .rename-content input {
      padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;
    }
    .rename-actions {
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .rename-ok {
      background: #14b8a6; color: white; padding: 6px 12px;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .rename-cancel {
      background: #ccc; color: black; padding: 6px 12px;
      border: none; border-radius: 4px; cursor: pointer;
    }

    /* Infinite pulse until process ends */
@keyframes pulseDelete {
  0% { background-color: #341c27; }
  50% { background-color: #492332; }
  100% { background-color: #341c27; }
}
.pulse-delete {
  animation: pulseDelete 1s ease-in-out infinite;
}

@keyframes pulseRename {
  0% { background-color: #163328; }
  50% { background-color: #1e4436; }
  100% { background-color: #163328; }
}
.pulse-rename {
  animation: pulseRename 1s ease-in-out infinite;
}

/* Success flash after operation */
@keyframes flashSuccess {
  0% { background-color: #163328; }
  50% { background-color: #1e4436; }
  100% { background-color: inherit; }
}
.flash-success {
  animation: flashSuccess 0.8s ease;
}

/* Error flash after operation */
@keyframes flashError {
  0% { background-color: #341c27; }
  50% { background-color: #492332; }
  100% { background-color: inherit; }
}
.flash-error {
  animation: flashError 0.8s ease;
}
  `;
  document.head.appendChild(style);
})();

let pendingFlash = null; // {type, index}
let lastModalPos = null; // {left, top}

// Custom rename modal with drag + position memory
function showRenameModal(oldName, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'rename-modal';
  overlay.innerHTML = `
    <div class="rename-box">
      <div class="rename-header">Rename Category</div>
      <div class="rename-content">
        <label>New name:</label>
        <input type="text" value="${escapeHtml(oldName)}" />
        <div class="rename-actions">
          <button class="rename-cancel">Cancel</button>
          <button class="rename-ok">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const box = overlay.querySelector('.rename-box');
  const header = overlay.querySelector('.rename-header');
  const input = overlay.querySelector('input');

  // Apply last position if available
  if (lastModalPos) {
    box.style.left = lastModalPos.left + 'px';
    box.style.top = lastModalPos.top + 'px';
    box.style.position = 'absolute';
  }

  input.select();
  input.focus();

  // Drag logic
  let offsetX, offsetY, isDragging = false;
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = box.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  function onMouseMove(e) {
    if (!isDragging) return;
    const left = e.clientX - offsetX;
    const top = e.clientY - offsetY;
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.position = 'absolute';
  }
  function onMouseUp(e) {
    isDragging = false;
    // Save last position
    const rect = box.getBoundingClientRect();
    lastModalPos = { left: rect.left, top: rect.top };
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // Cancel
  overlay.querySelector('.rename-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // OK
  overlay.querySelector('.rename-ok').addEventListener('click', () => {
    const newName = input.value.trim();
    document.body.removeChild(overlay);
    callback(newName);
  });

  // Keyboard
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('.rename-ok').click();
    if (e.key === 'Escape') overlay.querySelector('.rename-cancel').click();
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

/* ---------- renderCategoryLists (replace your existing) ---------- */
function renderCategoryLists() {
  const setupBadgeTones = ['sky', 'violet', 'mint', 'amber', 'rose'];
  const createRow = (text, type, index) => {
    const li = document.createElement('li');
    li.className = `${(index % 2 === 0) ? 'strip-even' : 'strip-odd'} fade-row finance-setup-row`;
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '8px 12px';
    li.innerHTML = `
      <div class="finance-pill tone-${setupBadgeTones[index % setupBadgeTones.length]}">${escapeHtml(text)}</div>
      <div class="finance-setup-actions">
        <button type="button" class="small-btn btn-rename" data-act="rename"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5"/></svg> Edit</button>
        <button type="button" class="small-btn btn-delete" data-act="del"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg> Delete</button>
      </div>`;

    // DELETE
    li.querySelector('[data-act="del"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const list = (type === 'income') ? incomeCats : (type === 'expense') ? expenseCats : accounts;
      const name = list[index];
      if (!name) return showSetupNotice("This item could not be found.");


      li.classList.add("pulse-delete");

      const removed = await removeCategory(type, name, null);

      li.classList.remove("pulse-delete");

      if (removed) {
        li.classList.add("flash-success");
        await sleep(300);
        li.remove();
      } else {
        li.classList.add("flash-error");
        await sleep(800);
        li.classList.remove("flash-error");
      }
    });

    // RENAME
    li.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openFinanceSetup(type, text);
    });

    return li;
  };

  // Populate lists
  const incList = el('incomeCatList'); incList.innerHTML = '';
  incomeCats.forEach((c, i) => incList.appendChild(createRow(c, 'income', i)));

  const expList = el('expenseCatList'); expList.innerHTML = '';
  expenseCats.forEach((c, i) => expList.appendChild(createRow(c, 'expense', i)));

  const accList = el('accountList'); accList.innerHTML = '';
  accounts.forEach((c, i) => accList.appendChild(createRow(c, 'account', i)));
}

/* ------- Transactions CRUD & UI ------- */
let editingId = null;
let pendingEditIndex = null;
const transactionDialog = el('transactionDialog');

function openTransactionDialog(title) {
  el('transactionDialogTitle').textContent = title;
  el('transactionDialogHelp').textContent = 'Choose an account and category for this entry.';
  el('addLocalTx').hidden = editingId !== null;
  el('addLocalTx').textContent = pendingEditIndex === null ? 'Add to pending' : 'Update pending';
  transactionDialog.append(loaderOverlay);
  transactionDialog.showModal();
}

transactionDialog.addEventListener('close', () => {
  document.body.append(loaderOverlay);
  delete transactionDialog.dataset.adjusting;
  el('txType').disabled = false;
  el('txAccount').disabled = false;
});
el('openTransaction').addEventListener('click', () => {
  resetForm();
  el('txDate').value = localDateInput();
  openTransactionDialog('New transaction');
});
el('closeTransaction').addEventListener('click', () => {
  if (!el('saveTx').disabled) transactionDialog.close();
});
transactionDialog.addEventListener('cancel', event => {
  if (el('saveTx').disabled) event.preventDefault();
});

function confirmFinanceAction(message, { title = "Remove transaction data?", notice = false } = {}) {
  const dialog = el('financeConfirm');
  if (dialog.open) return Promise.resolve(false);
  el('financeConfirmTitle').textContent = title;
  el('financeConfirmMessage').textContent = message;
  dialog.querySelector('[value="cancel"]').hidden = notice;
  dialog.querySelector('[value="confirm"]').textContent = notice ? 'OK' : 'Remove';
  dialog.returnValue = 'cancel';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}

function showSetupNotice(message) {
  return confirmFinanceAction(String(message), { title: 'Setup notice', notice: true });
}

async function saveTransaction() {
  const saveButton = el('saveTx');
  if (saveButton.disabled) return;
  const type = el('txType').value;
  const date = el('txDate').value || localDateInput();
  const category = el('txCategory').value;
  const account = el('txAccount').value;
  const amount = Number(el('txAmount').value) || 0;
  const desc = el('txDesc').value;

  if (transactionDialog.dataset.adjusting === 'true' && (!Number.isFinite(amount) || amount <= 0)) {
    alert('Enter an amount greater than zero.');
    return;
  }

  if (!date || !category || !amount || !account) {
    alert("Please fill all required fields.");
    return;
  }

  const currency = el('fp-transaction-currency')?.value || el('currencyDisplay').innerText;
  const payload = { type, date, category, account, amount, desc, currency,paymentMethod:el("rpt-payment").value,classification:el("rpt-classification").value };
  if (editingId) payload.row = editingId;

  const wasEditing = editingId !== null;
  const pendingIndex = pendingEditIndex;
  const pendingSnapshot = pendingIndex === null ? null : localStorage.getItem(LOCAL_TX_KEY);
  saveButton.disabled = true;
  showLoading();
  try {
    const action = editingId ? 'updateTransaction' : 'addTransaction';
    const res = await apiPost(action, payload);

    if (res && res.status === 'ok') {
      if (pendingIndex !== null && localStorage.getItem(LOCAL_TX_KEY) === pendingSnapshot) {
        const list = getLocalTransactions();
        list.splice(pendingIndex, 1);
        setLocalTransactions(list);
      }
      resetForm();
      window.dispatchEvent(new Event('tracker-clear-draft'));
      transactionDialog.close();
      await loadTransactions();
      await loadSetupData();
      editingId = null;

      hideLoading(); // hide loader first
      setTimeout(() => {
        showToast(wasEditing ? '✅ Transaction updated!' : '✅ Transaction saved!');
      }, 150); // small delay so toast appears after loader
    } else {
      const errMsg = res?.error || res?.message || JSON.stringify(res);
      throw new Error(errMsg || 'unknown server response');
    }
  } catch (err) {
    hideLoading();
    console.error('Save transaction failed:', err);
    alert('❌ Network/Server error for add/update: ' + (err.message || err));
  } finally {
    saveButton.disabled = false;
  }
}

//save local start
/* ========= Local Transaction Queue ========= */
const LOCAL_TX_KEY = window.trackerEnvironment === 'live'
  ? 'pendingTransactions'
  : 'pendingTransactions:test';
window.addEventListener('storage', event => {
  if (event.key !== LOCAL_TX_KEY && event.key !== null) return;
  if (pendingEditIndex !== null && !el('saveTx').disabled) {
    resetForm();
    transactionDialog.close();
    showToast('Pending transactions changed in another tab. Reopen the entry to edit.');
  }
  renderPendingTransactions();
});

function getLocalTransactions() {
  return JSON.parse(localStorage.getItem(LOCAL_TX_KEY) || "[]");
}

function setLocalTransactions(list) {
  localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(list));
  renderPendingTransactions();
}

function addLocalTransaction() {
  if (editingId !== null || el('saveTx').disabled) return;
  const type = el('txType').value;
  const date = el('txDate').value || localDateInput();
  const category = el('txCategory').value;
  const account = el('txAccount').value;
  const amount = Number(el('txAmount').value) || 0;
  const desc = el('txDesc').value;

  if (!date || !category || !amount || !account) {
    alert("⚠️ Please fill all required fields before adding.");
    return;
  }

  const currency = el('fp-transaction-currency')?.value || el('currencyDisplay').innerText;
  const tx = { type, date, category, account, amount, desc, currency,paymentMethod:el("rpt-payment").value,classification:el("rpt-classification").value };
  const list = getLocalTransactions();
  if (pendingEditIndex === null) list.push(tx);
  else list[pendingEditIndex] = tx;
  setLocalTransactions(list);

  showToast(pendingEditIndex === null ? "✅ Transaction added locally" : "✅ Pending transaction updated");
  resetForm();
  window.dispatchEvent(new Event('tracker-clear-draft'));
  transactionDialog.close();
}

async function clearLocalTransactions() {
  if (!await confirmFinanceAction("Clear all pending transactions on this device?")) return;
  localStorage.removeItem(LOCAL_TX_KEY);
  renderPendingTransactions();
  showToast("✅ Pending transactions cleared");
}

async function saveAllTransactions() {
  const list = getLocalTransactions();
  if (list.length === 0) {
    alert("⚠️ No pending transactions to save.");
    return;
  }

  showLoading();
  try {
    // ✅ stringify array
    const res = await apiPost("bulkAddTransactions", { transactions: JSON.stringify(list) });

    if (res && res.status === "ok") {
      localStorage.removeItem(LOCAL_TX_KEY);
      renderPendingTransactions();
      await loadTransactions();
      showToast(`✅ Saved ${res.saved} transactions`);
    } else {
      throw new Error(res?.message || "unknown error");
    }
  } catch (err) {
    console.error("Bulk save failed:", err);
    alert("❌ Save All failed: " + (err.message || err));
  } finally {
    hideLoading();
  }
}

function bulkAddTransactions(transactions) {
  try {
    // ✅ Parse JSON if string
    if (typeof transactions === "string") {
      transactions = JSON.parse(transactions);
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { status: "error", message: "No transactions provided" };
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName("Transactions");
    if (!sheet) throw new Error("Transactions sheet not found");

    const rows = transactions.map(t => [
      t.type || "",
      t.date || new Date().toISOString().slice(0, 10),
      t.category || "",
      t.account || "",
      Number(t.amount) || 0,
      t.desc || ""
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return { status: "ok", saved: rows.length };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

function transactionTypePill(type) {
  const label = String(type ?? '').trim();
  const kind = label.toLowerCase();
  const tone = kind === 'income' ? 'mint' : kind === 'expense' ? 'amber' : 'neutral';
  return `<span class="finance-pill finance-type tone-${tone}">${escapeHtml(label || 'Unspecified')}</span>`;
}

function renderPendingTransactions() {
  const list = getLocalTransactions();
  const container = el("pendingTxList");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<p class="text-gray-500">No pending transactions.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-sm border rounded">
      <thead>
        <tr class="bg-purple-200">
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Account</th>
          <th>Amount</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((tx, idx) => `
          <tr>
            <td>${escapeHtml(String(tx.date ?? ''))}</td>
            <td>${transactionTypePill(tx.type)}</td>
            <td><span class="finance-pill tone-sky">${escapeHtml(String(tx.category ?? ''))}</span></td>
            <td><span class="finance-pill tone-sky">${escapeHtml(String(tx.account ?? ''))}</span></td>
            <td><span class="finance-pill tone-${tx.type === 'income' ? 'mint' : 'rose'}">${escapeHtml(String(tx.amount ?? ''))}</span></td>
            <td>${escapeHtml(String(tx.desc ?? ''))}</td>
            <td>
              <button class="finance-pill tone-sky editLocalTx" data-index="${idx}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5"/></svg> Edit</button>
              <button class="finance-pill tone-rose deleteLocalTx" data-index="${idx}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg> Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  // attach delete handlers
  container.querySelectorAll(".deleteLocalTx").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index, 10);
      const list = getLocalTransactions();
      list.splice(index, 1); // remove 1 row
      setLocalTransactions(list);
      showToast("✅ Transaction removed from pending list");
    });
  });

  // attach edit handlers
  container.querySelectorAll(".editLocalTx").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index, 10);
      const tx = getLocalTransactions()[index];
      if (!tx) return;

      // preload into Add Transaction form
      el('txType').value = tx.type;
      el('txDate').value = localDateInput(tx.date);
      updateCategoryDropdown(tx.type);
      window.trackerCatalogUI?.ensureOption('txCategory',tx.category);
      window.trackerCatalogUI?.ensureOption('txAccount',tx.account);
      el('txCategory').value = tx.category;
      el('txAccount').value = tx.account;
      el('txAmount').value = tx.amount;
      el('txDesc').value = tx.desc;el('rpt-payment').value=tx.paymentMethod||'';el('rpt-classification').value=tx.classification||'';
      window.dispatchEvent(new Event('tracker-form-updated'));

      editingId = null;
      pendingEditIndex = index;
      transactionDialog.dataset.editor = 'pending';
      el('saveTx').textContent = 'Save to ledger';
      openTransactionDialog('Edit pending transaction');
    });
  });
}


// Attach event listeners after DOM load
document.addEventListener("DOMContentLoaded", () => {
  el("addLocalTx")?.addEventListener("click", addLocalTransaction);
  el("clearLocalTx")?.addEventListener("click", clearLocalTransactions);
  el("saveAllTx")?.addEventListener("click", saveAllTransactions);
  renderPendingTransactions();
});



//save local end

async function loadSetupData() {
  showLoading();
  try {
    const res = await apiGet('getSetup');
    if (!res || res.error) throw new Error(res?.error || 'Setup returned no data.');

    // 1) Store categories & accounts
    incomeCats = res.incomeCategories || [];
    expenseCats = res.expenseCategories || [];
    accounts = res.accounts || [];

    // 2) Currency
    const currency = res.currency || '₹';
    el('currencyDisplay').innerText = currency;
    const choices = Array.isArray(res.currencies) ? res.currencies : [];
    el('setupCurrency').replaceChildren(...[...new Set([currency, ...choices])].map(value => new Option(value, value)));
    el('setupCurrency').value = currency;
    window.trackerSetupCurrency=currency;

    // 3) Prepare balances
    const balances = Array.isArray(res.accountBalances) ? res.accountBalances : [];
    const maxAbs = Math.max(1, ...balances.map(a => Math.abs(parseFloat(a.balance) || 0)));

    // 4) Start HTML
    const container = document.getElementById("accountBalancesContainer");
    let html = `
      <div class="glass-card p-4 rounded-xl shadow-lg backdrop-blur-md bg-white/10">
        <h4 class="text-lg font-semibold mb-3 text-white">Account Balances</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-gradient-to-r from-white/10 via-white/5 to-transparent text-white backdrop-blur-sm">
                <th class="px-4 py-2 text-left font-medium">Account</th>
                <th class="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
    `;

    // 5) Rows
    if (balances.length) {
      balances.forEach((acc, i) => {
        const raw = parseFloat(acc.balance) || 0;
        const absVal = Math.abs(raw);
        const pct = Math.min(100, Math.round((absVal / maxAbs) * 100));

        const tone = raw > 0 ? 'mint' : raw < 0 ? 'rose' : 'neutral';
        const sign = raw > 0 ? '+' : raw < 0 ? '−' : '';
        const account = escapeHtml(String(acc.name ?? ''));
        const amount = escapeHtml(String(acc.currency || currency)) + ' ' + absVal.toLocaleString();

        html += `
          <tr class="${i % 2 === 0 ? 'strip-even' : 'strip-odd'}">
            <td>
              <span class="finance-pill tone-${['sky', 'violet', 'mint', 'amber', 'rose'][i % 5]}">${account}</span>
              <div class="finance-balance-track tone-${tone}" aria-hidden="true">
                <span style="width:${pct}%"></span>
              </div>
            </td>
            <td class="text-right finance-balance-cell">
              <span class="finance-pill finance-money tone-${tone}">${sign}${amount}</span>
              <div class="finance-adjust-actions">
                <button type="button" class="finance-pill tone-mint" data-adjust="income" data-index="${i}">＋ Add</button>
                <button type="button" class="finance-pill tone-rose" data-adjust="expense" data-index="${i}">− Deduct</button>
              </div>
            </td>
          </tr>
        `;
      });
    } else {
      html += `
        <tr class="bg-white/10">
          <td colspan="2" class="px-4 py-3 text-center text-gray-200">
            No account balances yet.
          </td>
        </tr>
      `;
    }

    // 6) Close table
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
    window.dispatchEvent(new Event('tracker-ledger-updated'));
    container.querySelectorAll('[data-adjust]').forEach(button => {
      button.addEventListener('click', () => {
        const account = String(balances[Number(button.dataset.index)].name);
        const type = button.dataset.adjust;
        openAccountAdjustment(account, type);
      });
    });


    // Preserve an open entry while refreshing setup lists.
    const selected=transactionDialog.open?{category:el('txCategory').value,account:el('txAccount').value}:null;
    updateCategoryDropdown(el('txType').value || 'income');
    updateAccountDropdown();
    if(selected){window.trackerCatalogUI?.ensureOption('txCategory',selected.category);window.trackerCatalogUI?.ensureOption('txAccount',selected.account);el('txCategory').value=selected.category;el('txAccount').value=selected.account;}
    renderCategoryLists();
    populateMonthYear();
    window.dispatchEvent(new Event('tracker-setup-ready'));

  } catch (err) {
    console.error('loadSetupData error', err);
    showSetupNotice('Unable to load Setup. ' + (err.message || err));
  } finally {
    hideLoading();
  }
}



function resetForm() {
  transactionDialog.dataset.editor = 'new';
  delete transactionDialog.dataset.adjusting;
  el('txType').disabled = false;
  el('txAccount').disabled = false;
  editingId = null;
  pendingEditIndex = null;
  el('addLocalTx').hidden = false;
  el('addLocalTx').textContent = 'Add to pending';
  el('transactionDialogTitle').textContent = 'New transaction';
  el('txType').value = 'income';
  updateCategoryDropdown('income');
  el('txDate').value = '';
  if (el('txCategory')) el('txCategory').selectedIndex = 0;
  if (el('txAccount')) el('txAccount').selectedIndex = 0;
  el('txAmount').value = '';
  el('txDesc').value = '';
  el('saveTx').textContent = 'Save';
  el('rpt-payment').value='';el('rpt-classification').value='';
  window.trackerCatalogUI?.filterSelects();
}

let miniChart = null, reportChart = null, annualChart = null;

async function loadTransactions({ limit = null, rowsOverride = null } = {}) {
  showLoading();
  try {
    const res = validateFinanceResponse(rowsOverride !== null ? {rows:rowsOverride} : await apiGet('listTransactions'),'listTransactions');
    const sourceRows=res.rows;
    let rows = sourceRows;
    const errorBox=el('financeLoadError');if(errorBox)errorBox.hidden=true;
    if(!rowsOverride)window.dispatchEvent(new Event('tracker-ledger-updated'));
    window.trackerAllLedgerRows=rows.slice();

    updateCurrentMonthSummary(rows);

    let filteredRows=rows;
    if(window.trackerLedger) {
      const selection=window.trackerLedger.apply(rows);
      filteredRows=selection.all;rows=selection.rows;
    } else if(limit)rows=rows.slice(0,limit);
    window.trackerDisplayedLedgerIds=filteredRows.map(row=>row.id).filter(Boolean);

    const tbody = document.querySelector('#txTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let sumIncome = filteredRows.filter(row=>row.type==='income').reduce((sum,row)=>sum+Number(row.amount||0),0);
    let sumExpense = filteredRows.filter(row=>row.type==='expense').reduce((sum,row)=>sum+Number(row.amount||0),0);

    const categoryTones = new Map([
      ['salary', 'mint'],
      ['food', 'amber'],
      ['shopping', 'rose'],
      ['transport', 'sky']
    ]);

    rows.forEach((r, rowIndex) => {
      const amountTone = { income: 'mint', expense: 'rose' }[String(r.type ?? '').trim().toLowerCase()] || 'neutral';
      const amountFormatted = (el('currencyDisplay')?.innerText || '₹') + ' ' + Number(r.amount || 0).toFixed(2);
      const categoryTone = categoryTones.get(String(r.category ?? '').trim().toLowerCase()) || 'violet';

      const tr = document.createElement("tr");
      tr.className = rowIndex % 2 === 0 ? 'strip-even' : 'strip-odd';
      tr.classList.add('transition', 'duration-150', 'ease-in-out');

      tr.innerHTML = `
        <td>${r.date || ''}</td>
        <td>${transactionTypePill(r.type)}</td>
        <td>
          <span class="finance-pill tone-${categoryTone}">
            ${escapeHtml(r.category || '')}
          </span>
        </td>
        <td><span class="finance-pill tone-sky">${escapeHtml(r.account || '')}</span></td>
        <td><span class="finance-pill finance-money tone-${amountTone}">${escapeHtml(amountFormatted)}</span></td>
        <td style="text-align:right">
          <div class="flex items-center justify-end gap-2">
            <button type="button" class="finance-row-action tone-sky" data-row="${r.row}" data-act="edit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5"/></svg> Edit
            </button>
            <button type="button" class="finance-row-action tone-violet" data-row="${r.row}" data-act="duplicate">⧉ Copy</button>
            <button type="button" class="finance-row-action tone-rose" data-row="${r.row}" data-act="del">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg> Delete
            </button>
          </div>
        </td>
      `;

      if (r.managed) {
        tr.querySelector('td:last-child').innerHTML = '<button type="button" class="finance-pill tone-violet" data-fp-managed="true">Movement history</button>';
      }
      tbody.appendChild(tr);


    });


    updateQuickSummary(sumIncome, sumExpense);

    function updateQuickSummary(sumIncome, sumExpense) {
      const balance = sumIncome - sumExpense;
      const currency = el('currencyDisplay')?.innerText || '₹';

      const incomeCard = document.getElementById('sumIncomeCard');
      const expenseCard = document.getElementById('sumExpenseCard');
      const balanceCard = document.getElementById('sumBalanceCard');

      const animateCount = (el, start, end, prefix = '', suffix = '', glowColor = '') => {
        const startTime = performance.now();
        el.style.transition = 'transform 0.4s ease-out, text-shadow 0.4s ease-out';
        el.style.transform = 'scale(1.15)';
        el.style.textShadow = `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`;

        function update(now) {
          const progress = Math.min((now - startTime) / 800, 1);
          const value = Math.floor(start + (end - start) * progress);
          el.textContent = `${prefix}${value.toLocaleString()}${suffix}`;
          if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);

        setTimeout(() => {
          el.style.transform = 'scale(1)';
          el.style.textShadow = '';
        }, 400);
      };

      // Income Card
      incomeCard.className = `
    metric-card bg-gradient-to-br from-lime-200 to-green-200 text-green-800
    backdrop-blur-md bg-opacity-60 shadow-lg rounded-xl p-4 text-center
    border border-white flex flex-col items-center
  `.trim();
      incomeCard.innerHTML = `
    <div class="p-2 rounded-full bg-green-500/80 text-white mb-2">💰</div>
    <div id="sumIncome" class="font-bold text-lg mb-1"></div>
    <div class="text-green-800 font-medium text-sm">Income</div>
  `;
      animateCount(document.getElementById('sumIncome'), 0, sumIncome, `${currency} `, '', 'rgba(34, 197, 94, 0.6)`');

      // Expense Card
      expenseCard.className = `
    metric-card bg-gradient-to-br from-orange-100 to-rose-200 text-orange-800
    backdrop-blur-md bg-opacity-60 shadow-lg rounded-xl p-4 text-center
    border border-white flex flex-col items-center
  `.trim();
      expenseCard.innerHTML = `
    <div class="p-2 rounded-full bg-orange-500/80 text-white mb-2">💸</div>
    <div id="sumExpense" class="font-bold text-lg mb-1"></div>
    <div class="text-orange-800 font-medium text-sm">Expense</div>
  `;
      animateCount(document.getElementById('sumExpense'), 0, sumExpense, `${currency} `, '', 'rgba(249, 115, 22, 0.6)`');

      // Balance Card
      const balancePositive = balance >= 0;
      balanceCard.dataset.balance = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero';
      balanceCard.className = balancePositive
        ? `
      metric-card bg-gradient-to-br from-indigo-100 to-purple-200 text-indigo-800
      backdrop-blur-md bg-opacity-60 shadow-lg rounded-xl p-4 text-center
      border border-white flex flex-col items-center
    `.trim()
        : `
      metric-card bg-gradient-to-br from-pink-200 to-blue-200 text-pink-800
      backdrop-blur-md bg-opacity-60 shadow-lg rounded-xl p-4 text-center
      border border-white flex flex-col items-center
    `.trim();

      balanceCard.innerHTML = `
    <div class="p-2 rounded-full ${balancePositive ? 'bg-green-500/80' : 'bg-red-500/80'} text-white mb-2">
      ${balancePositive ? '📈' : '📉'}
    </div>
    <div id="sumBalance" class="font-bold text-lg mb-1"></div>
    <div class="${balancePositive ? 'text-indigo-800' : 'text-pink-800'} font-medium text-sm">Balance</div>
  `;
      animateCount(
        document.getElementById('sumBalance'),
        0,
        balance,
        `${currency} `,
        '',
        balancePositive ? 'rgba(79, 70, 229, 0.6)' : 'rgba(239, 68, 68, 0.6)'
      );
    }



    // Render mini chart
    renderMiniChart(sumIncome, sumExpense);

    // Attach edit/delete handlers with pulse effect
    tbody.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', async () => {
        const row = b.dataset.row;
        const act = b.dataset.act;
        const tr = b.closest('tr');

        tr.style.transition = 'background-color 0.3s ease';
        if (act === 'del') tr.style.backgroundColor = '#341c27';
        else tr.style.backgroundColor = '#163328';

        if (act === 'del') {
          if (!await confirmFinanceAction('Delete this transaction from the ledger?')) {
            tr.style.backgroundColor = '';
            return;
          }
          showLoading();
          try {
            const resp = await apiPost('deleteTransaction', { row });
            if (resp.status === 'ok') {
              await new Promise(res => setTimeout(res, 250));
              tr.remove();
              await loadSetupData();
              await loadTransactions();
              showToast(`✅ Transaction deleted`);
            } else {
              alert('Delete failed: ' + JSON.stringify(resp));
              tr.style.backgroundColor = '';
            }
          } catch (err) {
            console.error('Delete failed:', err);
            alert('Delete failed: ' + (err.message || err));
            tr.style.backgroundColor = '';
          } finally { hideLoading(); }
        }
        else if (act === 'edit' || act === 'duplicate') {
          showLoading();
          try {
            const resp = await apiGet('getTransaction', { row });
            if (resp?.rowData) {
              pendingEditIndex = null;
              editingId = act === 'duplicate' ? null : resp.row;
              transactionDialog.dataset.editor = act === 'duplicate' ? 'new' : 'edit';
              const detailResponse=await apiGet('getTransactionDetails',{row});el('rpt-payment').value=detailResponse?.item?.paymentMethod||'';el('rpt-classification').value=detailResponse?.item?.classification||'';
              el('txType').value = resp.rowData.type || 'income';
              updateCategoryDropdown(resp.rowData.type || 'income');
              el('txDate').value = act === 'duplicate' ? localDateInput() : localDateInput(resp.rowData.date);
              window.trackerCatalogUI?.ensureOption('txCategory',resp.rowData.category);
              window.trackerCatalogUI?.ensureOption('txAccount',resp.rowData.account);
              el('txCategory').value = resp.rowData.category || '';
              el('txAccount').value = resp.rowData.account || '';
              el('txAmount').value = resp.rowData.amount || '';
              el('txDesc').value = resp.rowData.desc || '';
              window.dispatchEvent(new Event('tracker-form-updated'));
              el('saveTx').textContent = act === 'duplicate' ? 'Save' : 'Update';
              qAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
              q('.tab-btn[data-tab="transactions"]').classList.add('active');
              qAll('.tab-content').forEach(s => s.style.display = 'none');
              el('transactions').style.display = 'block';
              openTransactionDialog(act === 'duplicate' ? 'Duplicate transaction' : 'Edit transaction');
              await new Promise(res => setTimeout(res, 400));
              tr.style.backgroundColor = '';
            } else {
              alert('Row not found');
              tr.style.backgroundColor = '';
            }
          } catch (err) {
            console.error('Fetch row failed:', err);
            alert('Fetch row failed: ' + (err.message || err));
            tr.style.backgroundColor = '';
          } finally { hideLoading(); }
        }
      });
    });

    // Show Load More if limit applied
    if (!window.trackerLedger && limit && sourceRows.length > limit) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align:center">
        <button id="loadMoreBtn" class="px-4 py-2 bg-blue-500 text-white rounded">Load More</button>
      </td>`;
      tbody.appendChild(tr);
      el('loadMoreBtn').addEventListener('click', () => loadTransactions());
    }
    return true;

  } catch (err) {
    console.error('loadTransactions failed', err);
    showFinanceLoadError(err);
    return false;
  } finally { hideLoading(); }

}

function updateCurrentMonthSummary(rows) {
  let sumIncomeMonth = 0, sumExpenseMonth = 0;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  rows.forEach(r => {
    const amount = Number(r.amount || 0);
    const txDate = r.date ? new Date(r.date) : null;

    if (txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      if ((r.type || '').toLowerCase() === 'income') sumIncomeMonth += amount;
      else sumExpenseMonth += amount;
    }
  });

  const balanceMonth = sumIncomeMonth - sumExpenseMonth;
  const savingsPercentMonth = sumIncomeMonth > 0
    ? ((balanceMonth / sumIncomeMonth) * 100)
    : 0;

  const currencySymbol = el('currencyDisplay')?.innerText || '₹';

  function animateCount(el, start, end, prefix = '', suffix = '', duration = 800) {
    let startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const current = start + (end - start) * progress;
      el.textContent = `${prefix}${Math.round(current)}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const savingsTone = savingsPercentMonth > 0 ? 'positive' : savingsPercentMonth < 0 ? 'negative' : 'zero';
  const cards = [
    ['summaryIncomeCard', 'summaryIncome', 'Income', sumIncomeMonth, currencySymbol + ' ', '', '↗', 'mint'],
    ['summaryExpenseCard', 'summaryExpense', 'Expenses', sumExpenseMonth, currencySymbol + ' ', '', '↘', 'rose'],
    ['summarySavingsCard', 'summarySavings', 'Savings rate', savingsPercentMonth, '', '%', savingsPercentMonth < 0 ? '↘' : '↗', savingsPercentMonth < 0 ? 'rose' : 'mint']
  ];
  cards.forEach(([cardId, valueId, label, value, prefix, suffix, icon, tone]) => {
    const card = el(cardId);
    card.className = 'metric-card finance-reference-kpi';
    card.innerHTML = `<div><span class="finance-kpi-symbol" aria-hidden="true">${icon}</span><strong id="${valueId}"></strong></div><span class="finance-pill tone-${tone}">${label}</span>`;
    animateCount(el(valueId), 0, value, prefix, suffix);
  });
  el('summarySavingsCard').dataset.balance = savingsTone;
  const net = el('monthNetCash');
  net.dataset.balance = balanceMonth > 0 ? 'positive' : balanceMonth < 0 ? 'negative' : 'zero';
  net.textContent = currencySymbol + ' ' + balanceMonth.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  const spending = new Map();
  rows.forEach(row => {
    const date = new Date(row.date);
    if (String(row.type).toLowerCase() !== 'expense' || date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) return;
    const name = String(row.category || 'Uncategorized');
    spending.set(name, (spending.get(name) || 0) + Number(row.amount || 0));
  });
  const top = [...spending.entries()].sort((left, right) => right[1] - left[1])[0];
  el('topSpendingCategory').textContent = top ? top[0] : 'No expenses this month';
  el('topSpendingShare').textContent = top && sumExpenseMonth > 0
    ? (top[1] / sumExpenseMonth * 100).toFixed(1) + '% of monthly spending · ' + currencySymbol + ' ' + top[1].toLocaleString()
    : 'Current month expense categories';

}




/* ------- Charts ------- */
function renderMiniChart(inc, exp) {
  const savingsPct = inc > 0 ? ((inc - exp) / inc) * 100 : 0;
  const isPositive = savingsPct >= 0;

  const pctText = `${Math.round(savingsPct)}%`;
  const arrow = isPositive ? '▲' : '▼';
  const arrowColor = isPositive ? '#10b981' : '#ef4444';

  const ctx = document.getElementById('miniChart').getContext('2d');
  if (miniChart) miniChart.destroy();

  // Custom plugin for center text
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();

      const fontSize = Math.min(chartArea.width, chartArea.height) * 0.18;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#bbc5d6';
      ctx.fillText(pctText, centerX, centerY - fontSize * 0.3);

      const arrowFontSize = fontSize * 0.8;
      ctx.font = `bold ${arrowFontSize}px sans-serif`;
      ctx.fillStyle = arrowColor;
      ctx.fillText(arrow, centerX, centerY + arrowFontSize * 0.8);

      ctx.restore();
    }
  };

  miniChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [inc, exp],
        backgroundColor: ['#10b981', '#ef4444']
      }]
    },
    options: {
      cutout: '60%',
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,       // ✅ Show legend
          position: 'bottom',  // ✅ Place at bottom
          labels: { color: '#bbc5d6' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed;
              return `${label}: ${value.toLocaleString()}`;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

/* ------- Reports ------- */
// Chart instances to manage destroy/recreate
let chartIncomeVsExpenseInstance = null;
let chartExpensePctIncomeInstance = null;
let chartIncomeDistributionInstance = null;
let chartExpenseDistributionInstance = null;

function destroyChart(chartInstance) {
  if (chartInstance) {
    chartInstance.destroy();
  }
}

async function genReport() {
  const m = parseInt(el('reportMonth').value, 10);
  const y = parseInt(el('reportYear').value, 10);
  showLoading();
  try {
    const resp = await apiGet('reportMonthly', { month: m, year: y });
    if (resp?.error) throw new Error(resp.error);
    window.trackerMonthlyReportPeriod = {year:y,month:m,currency:el('currencyDisplay').innerText};

    const txList = resp.transactions || [];
    let transactionsData = txList;

    if (!transactionsData.length && resp.categories) {
      transactionsData = Object.entries(resp.categories).flatMap(([cat, vals]) => {
        const arr = [];
        if (vals.income) arr.push({ type: 'income', category: cat, amount: vals.income });
        if (vals.expense) arr.push({ type: 'expense', category: cat, amount: vals.expense });
        return arr;
      });
    }

    // ---- No Data Found ----
    if (!transactionsData.length) {
      // KPIs
      el("kpiTotalIncome").textContent = "₹ 0.00";
      el("kpiTotalExpense").textContent = "₹ 0.00";
      el("kpiTotalBalance").textContent = "₹ 0.00";
      el("kpiSavingRate").textContent = "0%";
      el("savingRateIcon").textContent = "";

      // Tables
      ["tableTopIncome", "tableTopExpense", "tableIncomeSummary", "tableExpenseSummary"]
        .forEach(id => {
          const tbody = document.querySelector(`#${id} tbody`);
          if (tbody) tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;color:#999'>No Data Found</td></tr>";
        });

      // Clear chart canvases with message
      ["chartIncomeVsExpense", "chartExpensePctIncome", "chartIncomeDistribution", "chartExpenseDistribution"]
        .forEach(id => {
          const canvas = el(id);
          Chart.getChart(canvas)?.destroy();
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = "16px Arial";
          ctx.fillStyle = "#999";
          ctx.textAlign = "center";
          ctx.fillText("No Data Found", canvas.width / 2, canvas.height / 2);
        });

      hideLoading();
      return;
    }

    // ---- Totals ----
    const totalIncome = transactionsData
      .filter(tx => String(tx.type).toLowerCase() === 'income')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalExpense = transactionsData
      .filter(tx => String(tx.type).toLowerCase() === 'expense')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalBalance = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

    // ---- KPIs ----
    updateMonthlyKPIs(
      totalIncome,
      totalExpense,
      totalBalance,
      document.getElementById('currencyDisplay')?.innerText || '₹'
    );
    // Saving rate value
    el("kpiSavingRate").textContent = savingRate.toFixed(1) + "%";

    // Arrow icon + color
    if (savingRate > 0) {
      el("savingRateIcon").textContent = "⬆";
      el("savingRateIcon").style.color = "#6ee7b7";
    } else if (savingRate < 0) {
      el("savingRateIcon").textContent = "⬇";
      el("savingRateIcon").style.color = "#fda4af";
    } else {
      el("savingRateIcon").textContent = "–";
      el("savingRateIcon").style.color = "#999";
    }

    // Progress bar update (two-direction fill)
    const progressEl = el("savingRateProgress");
    const absRate = Math.min(Math.abs(savingRate), 100); // cap at 100%

    if (savingRate >= 0) {
      progressEl.style.width = absRate + "%";
      progressEl.style.background = "green";
      progressEl.style.left = "0";
      progressEl.style.right = "auto";
    } else {
      progressEl.style.width = absRate + "%";
      progressEl.style.background = "red";
      progressEl.style.right = "0";
      progressEl.style.left = "auto";
    }

    // ---- Dynamic background fade ----
    const savingCard = el("savingRateCard");
    if (savingRate > 20) {
      savingCard.style.background = "linear-gradient(135deg, #143026, #101a18)"; // strong positive
    } else if (savingRate > 0) {
      savingCard.style.background = "linear-gradient(135deg, #27311b, #181e13)"; // mild positive
    } else if (savingRate < 0) {
      savingCard.style.background = "linear-gradient(135deg, #351d2a, #22151c)"; // negative
    } else {
      savingCard.style.background = "linear-gradient(135deg, #181923, #101117)"; // neutral
    }

    // ---- Chart 1: Income vs Expense ----
    destroyChart(chartIncomeVsExpenseInstance);
    chartIncomeVsExpenseInstance = new Chart(
      el("chartIncomeVsExpense").getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: ["Income", "Expense"],
          datasets: [{
            label: "Amount",
            data: [totalIncome, totalExpense],
            backgroundColor: ["#4ade80", "#f87171"]
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      }
    );




    // ---- Chart 2: Expense % of Income ----
    // Register plugin once (place this at the top of your JS file)
    Chart.register({
      id: 'centerText',
      beforeDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const { ctx, chartArea: { width, height } } = chart;
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#dbeafe'; // text color
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = chart.config.data.centerText || '';
        ctx.fillText(text, width / 2, height / 2);
        ctx.restore();
      }
    });

    // ---- Chart 2: Expense % of Income ----
    destroyChart(chartExpensePctIncomeInstance);

    let expensePct = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    chartExpensePctIncomeInstance = new Chart(
      el("chartExpensePctIncome").getContext('2d'),
      {
        type: "doughnut",
        data: {
          labels: ["Expenses", "Remaining"],
          datasets: [{
            data: [totalExpense, Math.max(totalIncome - totalExpense, 0)],
            backgroundColor: ["#f87171", "#93c5fd"]
          }],
          centerText: `${expensePct.toFixed(1)}%`
        },
        options: {
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      }
    );

    // ---- Group data ----
    const incomeByCat = groupByCategory(transactionsData.filter(tx => tx.type === 'income'));
    const expenseByCat = groupByCategory(transactionsData.filter(tx => tx.type === 'expense'));

    // ---- Chart 3: Income Distribution ----
    destroyChart(chartIncomeDistributionInstance);
    chartIncomeDistributionInstance = new Chart(el("chartIncomeDistribution").getContext('2d'), {
      type: "doughnut",
      data: {
        labels: Object.keys(incomeByCat),
        datasets: [{ data: Object.values(incomeByCat), backgroundColor: ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#2dd4bf', '#818cf8'] }]
      }
    });

    // ---- Chart 4: Expense Distribution ----
    destroyChart(chartExpenseDistributionInstance);
    chartExpenseDistributionInstance = new Chart(el("chartExpenseDistribution").getContext('2d'), {
      type: "doughnut",
      data: {
        labels: Object.keys(expenseByCat),
        datasets: [{ data: Object.values(expenseByCat), backgroundColor: ['#fb7185', '#f59e0b', '#a78bfa', '#38bdf8', '#f97316', '#e879f9'] }]
      }
    });

    // ---- Tables ----
    populateTopTable("tableTopIncome", incomeByCat, totalIncome);
    populateTopTable("tableTopExpense", expenseByCat, totalExpense);
    populateSummaryTable("tableIncomeSummary", incomeByCat, totalIncome, "#bfdbfe");
    populateSummaryTable("tableExpenseSummary", expenseByCat, totalExpense, "#492332");

  } catch (err) {
    console.error('Report error', err);
    alert('Report error: ' + (err.message || err));
  } finally {
    hideLoading();
  }
}

async function loadAnnual() {
  const year = el('reportYear').value;
  if (!year) return alert('Select year');
  showLoading();
  try {
    const resp = await apiGet('reportAnnual', { year });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const inc = (resp.monthlyTotals || []).map(m => m.income || 0);
    const exp = (resp.monthlyTotals || []).map(m => m.expense || 0);

    const ctxA = safeGetCtx('annualChart');
    if (!ctxA) return;

    if (annualChart) annualChart.destroy();
    annualChart = new Chart(ctxA, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Income', data: inc, backgroundColor: '#34d399' },
          { label: 'Expense', data: exp, backgroundColor: '#fb7185' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#edf1fa' } } },
        scales: {
          x: { ticks: { color: '#bbc5d6' } },
          y: { ticks: { color: '#bbc5d6' } }
        }
      }
    });

    // Render top categories
    const topDiv = el('topCategories');
    topDiv.innerHTML = '';
    (resp.topCategories || []).forEach(t => {
      const d = document.createElement('div');
      d.textContent = `${t.category} — ${el('currencyDisplay')?.innerText || '₹'}${Number(t.total).toFixed(2)}`;
      topDiv.appendChild(d);
    });

    // ✅ Now that all charts/tables are drawn, hide the loader
    hideLoading();

  } catch (err) {
    console.error('Annual report error', err);
    alert('Annual report error: ' + (err.message || err));
    hideLoading(); // still hide on error
  }
}

/* ------- Setup actions ------- */
let adjustmentContext;
const adjustmentDialog = el('accountAdjustmentDialog');
const adjustmentForm = el('accountAdjustmentForm');
const adjustmentSave = adjustmentForm.querySelector('[type="submit"]');
function openAccountAdjustment(account, type) {
  adjustmentContext = { account, type };
  adjustmentDialog.dataset.direction = type;
  adjustmentDialog.dataset.requestId = crypto.randomUUID();
  adjustmentForm.reset();
  el('accountAdjustmentCategory').disabled = false;
  el('accountAdjustmentCategory').required = true;
  adjustmentForm.querySelector('small').textContent = 'This entry updates the account and appears in your ledger and reports.';
  el('accountAdjustmentTitle').textContent = type === 'income' ? 'Add to account' : 'Deduct from account';
  el('accountAdjustmentName').textContent = account;
  el('accountAdjustmentStatus').textContent = '';
  const categories = type === 'income' ? incomeCats : expenseCats;
  el('accountAdjustmentCategory').replaceChildren(...categories.map(name => new Option(name, name)));
  adjustmentSave.disabled = !categories.length;
  if (!categories.length) el('accountAdjustmentStatus').textContent = 'Add a category in Setup before saving this adjustment.';
  adjustmentDialog.showModal();
}
el('accountAdjustmentCancel').addEventListener('click', () => {
  if (!adjustmentSave.dataset.busy) adjustmentDialog.close();
});
adjustmentDialog.addEventListener('cancel', event => {
  if (adjustmentSave.dataset.busy) event.preventDefault();
});
adjustmentForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (adjustmentSave.dataset.busy) return;
  const amount = Number(el('accountAdjustmentAmount').value);
  const category = el('accountAdjustmentCategory').value;
  if (!Number.isFinite(amount) || amount <= 0 || !category) return;
  adjustmentSave.dataset.busy = 'true';
  adjustmentSave.disabled = true;
  let saved = false;
  try {
    const result = await apiPost('addTransaction', {
      ...adjustmentContext, amount, category, date: localDateInput(), desc: 'Account balance adjustment'
    });
    if (result?.status !== 'ok') throw new Error(result?.error || result?.message || 'Unable to save adjustment.');
    saved = true;
    adjustmentDialog.close();
    showToast('Account adjustment saved');
    await loadSetupData();
    await loadTransactions();
  } catch (error) {
    el('accountAdjustmentStatus').textContent = error.message;
    if (saved) showSetupNotice('Adjustment saved. Refresh the page to update the displayed balances.');
  } finally {
    delete adjustmentSave.dataset.busy;
    adjustmentSave.disabled = false;
  }
});

const currencyDialog = el('currencyDialog');
const currencyForm = el('currencyForm');
const currencySave = currencyForm.querySelector('[type="submit"]');
el('manageCurrencies').addEventListener('click', () => {
  currencyForm.reset();
  el('currencyStatus').textContent = '';
  currencyDialog.showModal();
});
el('closeCurrencies').addEventListener('click', () => {
  if (!currencySave.disabled) currencyDialog.close();
});
currencyDialog.addEventListener('cancel', event => {
  if (currencySave.disabled) event.preventDefault();
});
currencyForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (currencySave.disabled) return;
  const values = el('currencyEntries').value.split(',').map(value => value.trim()).filter(Boolean);
  const status = el('currencyStatus');
  currencySave.disabled = true;
  try {
    const result = await apiPost('addCurrencies', { currencies: JSON.stringify(values) });
    if (result?.status !== 'ok') throw new Error(result?.error || 'Unable to save currencies.');
    currencyDialog.close();
    await loadSetupData();
    showToast(result.added ? 'Currencies saved' : 'These currencies are already saved');
  } catch (error) {
    status.textContent = error.message;
  } finally {
    currencySave.disabled = false;
  }
});

async function setCurrency() {
  const cur = el('setupCurrency').value.trim();
  if (!cur) return showSetupNotice('Enter currency');
  showLoading();
  try {
    const r = await apiPost('setCurrency', { currency: cur });
    if (r.status === 'ok') {
      el('currencyDisplay').innerText = cur;
      showToast('✅ Currency updated');
    } else {
      showSetupNotice('Save failed: ' + (r?.error || r?.message || 'The server rejected the change.'));
    }
    await loadSetupData();
  } catch (err) {
    console.error('Save currency failed', err);
    showSetupNotice('Save currency failed: ' + (err.message || err));
  } finally { hideLoading(); }
}

async function addCategory(type, value) {
  if (!value) return showSetupNotice('enter value');
  showLoading();
  try {
    const r = await apiPost('addCategory', { type, value });
    if (r.status === 'ok') {
      showToast('✅ Category added');
      await loadSetupData();
      return true;
    } else showSetupNotice('Add failed: ' + (r?.error || r?.message || 'The server rejected the change.'));
  } catch (err) {
    console.error('Add failed', err);
    showSetupNotice('Add failed: ' + (err.message || err));
  } finally { hideLoading(); }
}



function normalize(s) {
  return String(s ?? '').trim();
}

async function getSetupList(type) {
  try {
    const res = await apiGet('getSetup');
    if (!res) return [];
    if (type === 'income') return (res.incomeCategories || []).map(normalize);
    if (type === 'expense') return (res.expenseCategories || []).map(normalize);
    return (res.accounts || []).map(normalize);
  } catch (err) {
    console.error('getSetupList failed', err);
    return [];
  }
}

async function categoryExistsOnServer(type, name) {
  const list = await getSetupList(type);
  return list.includes(normalize(name));
}

// --- Remove category ---
// DELETE
async function removeCategory(type, name, li = null) {
  await window.trackerCatalogUI?.refresh();
  if (!name) {
    showSetupNotice('Delete failed: no name provided.');
    return false;
  }

  if (!await confirmFinanceAction(`Remove "${name}" from Setup? ${window.trackerCatalogUI?.usage(type,name)||""}. Referenced items can be archived using Group / archive.`, { title: 'Delete setup item?' })) return false;

  if (li) {
    li.style.transition = "all 0.3s ease";
    li.style.opacity = "0";
    li.style.transform = "translateX(-10px)";
    await sleep(250);
  }

  showLoading();
  try {
    const resp = await apiPost('deleteCatalogItem', { type, name });
    if (!resp || resp.status !== 'ok') {
      showSetupNotice('Remove failed: ' + (resp?.error || resp?.message || 'The server rejected the change.'));
      await loadSetupData();
      return false;
    }
    showToast(`✅ Deleted "${name}"`);
    await loadSetupData();
    return true;
  } catch (err) {
    console.error('removeCategory error', err);
    showSetupNotice('Remove failed: ' + (err.message || err));
    await loadSetupData();
    return false;
  } finally {
    hideLoading();
  }
}


async function renameCategory(type, index, newName = null, li = null, oldName = null) {
  const list = (type === 'income') ? incomeCats : (type === 'expense') ? expenseCats : accounts;
  const currentOldName = oldName || list[index];

  if (!currentOldName) {
    showSetupNotice('Rename failed: no old category name found.');
    return false;
  }

  if (!newName) return false;

  showLoading();
  try {
    const metadata=window.trackerCatalogUI?.item(type,currentOldName);
    const response=await apiPost('saveCatalogItem',{item:JSON.stringify({type,previousName:currentOldName,name:newName,version:metadata?.version||0,archived:metadata?.archived||false,group:metadata?.group||''})});
    if(response?.status!=='ok')throw new Error(response?.error||'Unable to save the setup change.');

    if (li) {
      li.style.transition = "background-color 0.8s ease";
      li.style.backgroundColor = "#163328"; // green highlight
      setTimeout(() => li.style.backgroundColor = "", 800);
    }

    showToast(`✅ Renamed "${currentOldName}" → "${newName}"`);
    await loadSetupData();
    return true;
  } catch (err) {
    console.error('renameCategory error', err);
    showSetupNotice('Rename failed: ' + (err.message || err));
    await loadSetupData();
    return false;
  } finally {
    hideLoading();
  }
}


const financeSetupDialog = el('financeSetupDialog');
const financeSetupForm = el('financeSetupForm');
const financeSetupSave = financeSetupForm.querySelector('[type="submit"]');
let financeSetupEdit;

async function openFinanceSetup(type, name = '') {
  if(name)await window.trackerCatalogUI?.refresh();
  financeSetupEdit = { type, name };
  const label = type === 'account' ? 'account' : type + ' category';
  el('financeSetupTitle').textContent = (name ? 'Edit ' : 'Add ') + label;
  el('financeSetupName').value = name;
  const usage=window.trackerCatalogUI?.usage(type,name);
  el('financeSetupUsage').textContent=usage?usage:'';
  financeSetupDialog.showModal();
}

el('financeSetupCancel').addEventListener('click', () => {
  if (!financeSetupSave.disabled) financeSetupDialog.close();
});
financeSetupDialog.addEventListener('cancel', event => {
  if (financeSetupSave.disabled) event.preventDefault();
});
financeSetupForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (financeSetupSave.disabled) return;
  const { type, name } = financeSetupEdit;
  const value = el('financeSetupName').value.trim();
  if (!value) return;
  if (value === name) return financeSetupDialog.close();
  const entries = type === 'account' ? accounts : type === 'income' ? incomeCats : expenseCats;
  if (entries.some(entry => normalize(entry).toLowerCase() === value.toLowerCase())) {
    showSetupNotice('This name already exists.');
    return;
  }
  financeSetupSave.disabled = true;
  try {
    const saved = name
      ? await renameCategory(type, -1, value, null, name)
      : await addCategory(type, value);
    if (saved) financeSetupDialog.close();
  } finally {
    financeSetupSave.disabled = false;
  }
});

const reportTables = el('reports');
function decorateReportRows() {
  reportTables.querySelectorAll('tbody td').forEach(cell => {
    if (cell.closest('.ws-scoped-report') || cell.colSpan > 1 || cell.dataset.reportTone || cell.firstElementChild?.classList.contains('finance-pill')) return;
    const text = [...cell.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (!text || text.textContent.trim() === '—') return;
    const badge = document.createElement('span');
    const table = cell.closest('table');
    const groupId = (table.id || table.closest('.table-holder')?.id || '').toLowerCase();
    const heading = table.tHead?.rows[table.tHead.rows.length - 1]?.cells[cell.cellIndex]?.textContent || '';
    const semantic = /income/i.test(heading) ? 'mint' : /expense/i.test(heading) ? 'rose'
      : /(?:top|summary).*income|income.*summary/.test(groupId) ? 'mint'
      : /(?:top|summary).*expense|expense.*summary/.test(groupId) ? 'rose' : '';
    const labelTone = ['sky', 'violet', 'mint', 'amber'][cell.parentElement.sectionRowIndex % 4];
    badge.className = 'finance-pill finance-report-pill tone-' + (cell.cellIndex === 0 ? labelTone : semantic || 'neutral');
    text.replaceWith(badge);
    badge.append(text);
  });
}
new MutationObserver(decorateReportRows).observe(reportTables, { childList: true, subtree: true });
decorateReportRows();

/* ------- helpers & events ------- */
function populateMonthYear() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const msel = el('reportMonth'); if (!msel) return;
  msel.innerHTML = '';
  months.forEach((m, i) => { const o = document.createElement('option'); o.value = (i + 1); o.text = m; msel.appendChild(o); });
  const ysel = el('reportYear'); ysel.innerHTML = '';
  const now = new Date(), cur = now.getFullYear();
  for (let y = cur - 3; y <= cur + 1; y++) { const o = document.createElement('option'); o.value = y; o.textContent = y; if (y === cur) o.selected = true; ysel.appendChild(o); }
  if (msel) msel.value = (new Date()).getMonth() + 1;
}

function escapeHtml(s) { if (!s) return ''; return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }

// global click handler for rename/delete & some buttons delegated
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (!t) return;

  if (t.matches('#saveCurrency')) { await setCurrency(); }

  if (t.matches('#addIncomeCat')) openFinanceSetup('income');
  if (t.matches('#addExpenseCat')) openFinanceSetup('expense');
  if (t.matches('#addAccount')) openFinanceSetup('account');

  if (t.matches('.small-btn') && t.dataset.act === 'del') {
    const idx = Number(t.dataset.idx), type = t.dataset.type;
    await removeCategory(type, idx);
  }
  if (t.matches('.small-btn') && t.dataset.act === 'rename') {
    const idx = Number(t.dataset.idx), type = t.dataset.type;
    await renameCategory(type, idx);
  }
});

// form wiring
el('txType').addEventListener('change', e => {updateCategoryDropdown(e.target.value);window.trackerCatalogUI?.filterSelects();});
el('saveTx').addEventListener('click', saveTransaction);
el('resetForm').addEventListener('click', () => {
  if (transactionDialog.dataset.adjusting !== 'true') return resetForm();
  el('txAmount').value = '';
  el('txDesc').value = 'Account balance adjustment';
  el('txAmount').focus();
});
//el('refreshBtn').addEventListener('click', () => { loadSetupData(); loadTransactions(); });

el('refreshBtn').addEventListener('click', async () => {
  try {
    showLoading();
    await loadSetupData();     // Now also fetches account balances
    const loaded=await loadTransactions();  // Fetch transactions after setup
    if(loaded===false)return;
    hideLoading();
    showToast("✅ Data refreshed");
  } catch (err) {
    hideLoading();
    console.error("Refresh failed:", err);
    alert("❌ Failed to refresh data. Check console for details.");
  }
});

el('refreshBtnRight').addEventListener('click', () => { loadSetupData(); loadTransactions(); });

el('genReport').addEventListener('click', genReport);
el('genAnnual').addEventListener('click', loadAnnual);

el('exportCsv').addEventListener('click', async () => {
  if(window.trackerLedger)return window.trackerLedger.export();
  showLoading();
  try {
    const res = await apiGet('listTransactions');
    const rows = res.rows || [];
    if (!rows.length) { showToast('No transactions to export'); hideLoading(); return; }
    const csv = [
      ['Date', 'Type', 'Category', 'Account', 'Amount', 'Desc'],
      ...rows.map(r => [r.date || '', r.type || '', r.category || '', r.account || '', r.amount || '', (r.desc || '')])
    ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
    showToast('✅ CSV exported');
  } catch (err) {
    console.error('Export failed', err);
    alert('Export failed: ' + (err.message || err));
  } finally { hideLoading(); }
});

/* ------- init ------- */
(async function init() {
  try {
    showLoading();

    // Default tab state
    qAll('.tab-content').forEach(s => s.style.display = 'none');
    el('transactions').style.display = 'block';
    qAll('.tab-btn').forEach(b => b.classList.remove('active'));
    q('.tab-btn[data-tab="transactions"]').classList.add('active');

    populateMonthYear();

    // Load setup + transactions in parallel
    await Promise.all([
      loadSetupData(),
      loadTransactions({ limit: 50 }) // Initial limit for speed
    ]);

  } catch (err) {
    console.error('init error', err);
    alert('Init failed: ' + (err.message || err));
  } finally { hideLoading(); }
})();


HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
  apply(target, thisArg, args) {
    if (!thisArg || !thisArg.id) console.warn("⚠️ getContext called on unnamed canvas:", thisArg);
    else console.warn("⚠️ getContext called on:", thisArg.id);
    return Reflect.apply(target, thisArg, args);
  }
});


/* ====== MONTHLY DASHBOARD JS ====== */

async function refreshMonthlyDashboard(){ try { showLoading(); await loadSetupData(); await loadTransactions(); } catch(e){ console.error('monthly refresh failed', e); } finally { hideLoading(); } }


/* ===== Animate Count (only once) ===== */
function animateCount(el, start, end, duration = 1000, prefix = '', suffix = '') {
  if (!el) return;
  const startTime = performance.now();
  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = start + (end - start) * progress;
    el.textContent = `${prefix}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}${suffix}`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ===== Monthly KPI Updater with Safety Check ===== */
function updateMonthlyKPIs(totalIncome, totalExpense, totalBalance, currency = '₹') {
  const incomeEl = document.getElementById("kpiTotalIncome");
  const expenseEl = document.getElementById("kpiTotalExpense");
  const balanceEl = document.getElementById("kpiTotalBalance");

  if (!incomeEl || !expenseEl || !balanceEl) {
    console.warn("KPI elements not yet loaded, retrying...");
    setTimeout(() => updateMonthlyKPIs(totalIncome, totalExpense, totalBalance, currency), 200);
    return;
  }

  // Inject animation styles once
  if (!document.getElementById("kpiPulseStyle")) {
    const style = document.createElement("style");
    style.id = "kpiPulseStyle";
    style.textContent = `
      @keyframes kpiPulse {
        0%   { transform: scale(1); opacity: 1; }
        30%  { transform: scale(1.12); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }
      .pulse {
        animation: kpiPulse 0.5s ease-out;
      }
      .fade-red {
        color: #fda4af !important; /* Tailwind red-600 */
        transition: color 0.4s ease;
      }
    `;
    document.head.appendChild(style);
  }

  // Animate numbers with ease-out cubic & pulse
  function animateCountNoDecimals(el, start, end, duration = 1000, prefix = '', suffix = '', fadeRed = false) {
    if (!el) return;
    el.classList.add("pulse");
    if (fadeRed) el.classList.add("fade-red");

    const startTime = performance.now();
    function update(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (end - start) * eased);
      el.textContent = `${prefix}${value.toLocaleString()}${suffix}`;
      if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);

    setTimeout(() => {
      el.classList.remove("pulse");
      if (fadeRed) el.classList.remove("fade-red");
    }, 500);
  }

  function iconWithGlassBg(icon, bgColorClass, textColorClass) {
    return `<span class="${bgColorClass} ${textColorClass} inline-flex items-center justify-center w-8 h-8 rounded-full text-lg bg-opacity-40 backdrop-blur-sm">
      ${icon}
    </span>`;
  }

  // Income card
  incomeEl.className =
    "metric-card card-enter bg-gradient-to-br from-lime-200 to-green-200 text-green-800 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white";
  incomeEl.innerHTML = `
    <div class="flex items-center justify-center gap-2 text-xl font-bold">
      ${iconWithGlassBg("💰", "bg-green-200", "text-green-800")}
      <span class="kpi-value"></span>
    </div>
    <div class="finance-pill tone-mint">Total Income</div>
  `;
  animateCountNoDecimals(incomeEl.querySelector(".kpi-value"), 0, totalIncome, 1000, `${currency} `);

  // Expense card
  expenseEl.className =
    "metric-card card-enter bg-gradient-to-br from-orange-100 to-rose-200 text-orange-800 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white";
  expenseEl.innerHTML = `
    <div class="flex items-center justify-center gap-2 text-xl font-bold">
      ${iconWithGlassBg("💸", "bg-rose-200", "text-rose-800")}
      <span class="kpi-value"></span>
    </div>
    <div class="finance-pill tone-amber">Total Expenses</div>
  `;
  animateCountNoDecimals(expenseEl.querySelector(".kpi-value"), 0, totalExpense, 1000, `${currency} `);

  // Balance card
  const balancePositive = totalBalance >= 0;
  balanceEl.className = balancePositive
    ? "metric-card card-enter bg-gradient-to-br from-indigo-100 to-purple-200 text-indigo-800 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white"
    : "metric-card card-enter bg-gradient-to-br from-pink-200 to-blue-200 text-pink-800 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white";

  balanceEl.dataset.balance = totalBalance > 0 ? 'positive' : totalBalance < 0 ? 'negative' : 'zero';
  balanceEl.innerHTML = `
    <div class="flex items-center justify-center gap-2 text-xl font-bold">
      ${iconWithGlassBg(balancePositive ? "📈" : "📉", balancePositive ? "bg-green-200" : "bg-rose-200", balancePositive ? "text-green-800" : "text-rose-800")}
      <span class="kpi-value"></span>
    </div>
    <div class="finance-pill tone-${balancePositive ? 'sky' : 'rose'}">Total Balance</div>
  `;
  animateCountNoDecimals(
    balanceEl.querySelector(".kpi-value"),
    0,
    totalBalance,
    1000,
    `${currency} `,
    '',
    !balancePositive // fadeRed if negative balance
  );
}



function renderMonthlyDashboard(month, year) {
  const monthlyTx = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });



  // Calculate totals
  const totalIncome = monthlyTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = monthlyTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const totalBalance = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

  // Update KPIs (will retry if HTML not loaded yet)
  updateMonthlyKPIs(totalIncome, totalExpense, totalBalance, document.getElementById('currencyDisplay')?.innerText || '₹');

  el("kpiSavingRate").textContent = savingRate.toFixed(1) + "%";
  el("savingRateIcon").textContent = savingRate >= 0 ? "⬆" : "⬇";

  /* ----- Chart: Income vs Expense ----- */
  new Chart(el("chartIncomeVsExpense"), {
    type: "bar",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{
        label: "Amount",
        data: [totalIncome, totalExpense],
        backgroundColor: ["#10b981", "#ef4444"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      animation: { duration: 800, easing: "easeOutQuart" }
    }
  });

  /* ----- Chart: Expense % of Income Donut (center % + arrow) ----- */
  new Chart(el("chartExpensePctIncome"), {
    type: "doughnut",
    data: {
      labels: ["Expenses", "Remaining"],
      datasets: [{
        data: [totalExpense, Math.max(totalIncome - totalExpense, 0)],
        backgroundColor: ["#ef4444", "#3b82f6"]
      }]
    },
    options: {
      responsive: true,
      cutout: "70%",
      animation: { duration: 800, easing: "easeOutBounce" },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } },
        beforeDraw(chart) {
          const { width, height } = chart;
          const ctx = chart.ctx;
          ctx.restore();
          const fontSize = (height / 100).toFixed(2);
          ctx.font = `${fontSize}em sans-serif`;
          ctx.textBaseline = "middle";

          const text = `${savingRate >= 0 ? "↑" : "↓"} ${Math.abs(savingRate).toFixed(1)}%`;
          ctx.fillStyle = savingRate >= 0 ? "#10b981" : "#ef4444";
          const textX = Math.round((width - ctx.measureText(text).width) / 2);
          const textY = height / 2;
          ctx.fillText(text, textX, textY);
          ctx.save();
        }
      }
    }
  });

  /* ----- Income Distribution ----- */
  const incomeByCat = groupByCategory(monthlyTx.filter(tx => tx.type === 'income'));
  new Chart(el("chartIncomeDistribution"), {
    type: "doughnut",
    data: {
      labels: Object.keys(incomeByCat).map(l => `${l} (${((incomeByCat[l] / totalIncome) * 100).toFixed(1)}%)`),
      datasets: [{ data: Object.values(incomeByCat), backgroundColor: paletteFromLabels(Object.keys(incomeByCat)) }]
    },
    options: { responsive: true, cutout: "65%", animation: { duration: 800 } }
  });

  /* ----- Expense Distribution ----- */
  const expenseByCat = groupByCategory(monthlyTx.filter(tx => tx.type === 'expense'));
  new Chart(el("chartExpenseDistribution"), {
    type: "doughnut",
    data: {
      labels: Object.keys(expenseByCat).map(l => `${l} (${((expenseByCat[l] / totalExpense) * 100).toFixed(1)}%)`),
      datasets: [{ data: Object.values(expenseByCat), backgroundColor: paletteFromLabels(Object.keys(expenseByCat)) }]
    },
    options: { responsive: true, cutout: "65%", animation: { duration: 800 } }
  });

  /* ----- Tables ----- */
  populateTopTable("tableTopIncome", incomeByCat, totalIncome);
  populateTopTable("tableTopExpense", expenseByCat, totalExpense);
  populateSummaryTable("tableIncomeSummary", incomeByCat, totalIncome, "#bfdbfe");
  populateSummaryTable("tableExpenseSummary", expenseByCat, totalExpense, "#492332");
}


/* ===== Helpers ===== */
function groupByCategory(arr) {
  return arr.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

function populateTopTable(tableId, dataObj, total) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  let sum = 0;

  const rows = Object.entries(dataObj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  rows.forEach(([cat, amt], idx) => {
    sum += amt;
    const tr = document.createElement("tr");
    tr.className = `${idx % 2 === 0 ? "strip-even" : "strip-odd"} fade-in-row`;
    tr.style.animationDelay = `${idx * 0.05}s`; // stagger fade-in

    tr.innerHTML = `
      <td>${escapeHtml(cat)}</td>
      <td style="text-align:right">${formatCurrency(amt)}</td>
      <td style="text-align:right">${((amt / total) * 100).toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });

  // TOTAL row
  const totalTr = document.createElement("tr");
  totalTr.className = "total-row fade-in-row";
  totalTr.style.animationDelay = `${rows.length * 0.05}s`;
  totalTr.innerHTML = `
    <td style="text-align:right"><strong>Total</strong></td>
    <td style="text-align:right"><strong>${formatCurrency(sum)}</strong></td>
    <td style="text-align:right"><strong>${total > 0 ? ((sum / total) * 100).toFixed(1) + '%' : ''}</strong></td>
  `;
  tbody.appendChild(totalTr);
}


function populateSummaryTable(tableId, dataObj, total) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  let sumAmount = 0;

  // Auto-pick base colors
  let baseColor = "gray";
  let percentTextColor = "#bbc5d6"; // default gray
  if (tableId.toLowerCase().includes("income")) {
    baseColor = "green";
    percentTextColor = "#6ee7b7"; // tailwind green-600
  } else if (tableId.toLowerCase().includes("expense")) {
    baseColor = "red";
    percentTextColor = "#fda4af"; // tailwind red-600
  }

  // Glassmorphism gradient generator
  function getGlassGradient(color, pct) {
    let start, end;
    if (color === "green") {
      start = "rgba(187, 247, 208, 0.4)"; // light green glass
      end = "rgba(21, 128, 61, 0.8)";     // dark green glass
    } else if (color === "red") {
      start = "rgba(254, 202, 202, 0.4)"; // light red glass
      end = "rgba(185, 28, 28, 0.8)";     // dark red glass
    } else {
      start = "rgba(229, 231, 235, 0.4)"; // light gray glass
      end = "rgba(75, 85, 99, 0.8)";      // dark gray glass
    }
    const intensity = Math.min(1, pct / 100);
    return `
      linear-gradient(90deg, ${start}, ${end} ${intensity * 100}%),
      rgba(255, 255, 255, 0.2)
    `;
  }

  Object.entries(dataObj)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt], idx) => {
      const pct = total > 0 ? (amt / total) * 100 : 0;
      sumAmount += amt;

      const tr = document.createElement("tr");
      tr.className = `${idx % 2 === 0 ? "strip-even" : "strip-odd"} fade-in-row`;
      tr.style.animationDelay = `${idx * 0.05}s`;

      tr.innerHTML = `
        <td>${escapeHtml(cat)}</td>
        <td style="text-align:right">${formatCurrency(amt)}</td>
        <td style="width:40%; text-align:right; color:${percentTextColor}; font-weight:500;">
          ${pct.toFixed(1)}%
          <div class="bar-container" style="
            display:inline-block; 
            vertical-align:middle; 
            width:60%; 
            margin-left:8px; 
            height:10px; 
            background:rgba(255,255,255,0.1); 
            border-radius:10px; 
            overflow:hidden; 
            backdrop-filter:blur(6px);
            box-shadow:inset 0 0 6px rgba(0,0,0,0.2);
          ">
            <div class="bar-fill" style="
              width:${pct}%; 
              height:100%; 
              background:${getGlassGradient(baseColor, pct)}; 
              box-shadow:0 1px 4px rgba(0,0,0,0.3);
            "></div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

  // TOTAL row
  const totalTr = document.createElement("tr");
  totalTr.className = "total-row fade-in-row";
  totalTr.style.animationDelay = `${Object.keys(dataObj).length * 0.05}s`;
  totalTr.innerHTML = `
    <td style="text-align:right"><strong>Total</strong></td>
    <td style="text-align:right"><strong>${formatCurrency(sumAmount)}</strong></td>
    <td></td>
  `;
  tbody.appendChild(totalTr);
}


function paletteFromLabels(labels) {
  const colors = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#38bdf8", "#4ade80", "#fb923c", "#94a3b8"];
  return labels.map((_, i) => colors[i % colors.length]);
}

function formatCurrency(num) {
  return "₹ " + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(amount) {
  const currencySymbol = el('currencyDisplay')?.innerText || '₹';
  return `${currencySymbol} ${Math.round(amount).toLocaleString()}`;
}

/* ====== Annual DASHBOARD JS ====== */
/* ---------- Annual Report JS (All 14 sections) ---------- */

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ID = {
  yearSelect: 'reportYear',
  genBtn: 'genAnnual',
  kpiIncome: 'annualKpiIncome',
  kpiExpense: 'annualKpiExpense',
  kpiBalance: 'annualKpiBalance',
  expensePct: 'annual_expense_pct',
  incomeGrowth: 'annual_income_growth',
  incomeVsExpense: 'annual_income_vs_expense',
  savingTrend: 'annual_saving_trend',
  monthlyOverview: 'annual_monthly_overview',
  monthlyIncomeExpenses: 'annual_monthly_income_expenses',
  incomeBreakdown: 'annual_income_breakdown',
  expenseBreakdown: 'annual_expense_breakdown',
  topIncome: 'annual_top_income',
  topExpense: 'annual_top_expense',
  cashflowSummary: 'annual_cashflow_summary',
  incomeSummary: 'annual_income_summary',
  expenseSummary: 'annual_expense_summary'
};

const annualCharts = {};

function safeGetCtx(containerId) {
  console.log(`[safeGetCtx] Checking container: ${containerId}`);
  const container = document.getElementById(containerId);
  if (!container || !container.offsetParent) { // ✅ skip if hidden or not in DOM
    console.warn(`[safeGetCtx] ❌ Missing or hidden container: ${containerId}`);
    return null;
  }
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn(`[safeGetCtx] ❌ Failed to getContext for: ${containerId}`);
    return null;
  }
  console.log(`[safeGetCtx] ✅ Context ready for: ${containerId}`);
  return ctx;
}

/* Destroy Chart.js instance safely */
function destroyChartInstance(inst) {
  if (inst && typeof inst.destroy === 'function') {
    try { inst.destroy(); } catch (e) { console.warn('destroyChart error', e); }
  }
}


function renderAnnualSavingRate(totalIncome, totalExpense) {
  const savingRateEl = el('annualKpiSavingRate');
  const savingRateCard = el('annualSavingRateCard');
  const progressEl = el('annualSavingRateProgress');

  let rate = 0;
  if (totalIncome > 0) {
    rate = ((totalIncome - totalExpense) / totalIncome) * 100;
  }

  // Determine icon, colors, and background
  let icon = '–';
  let iconColor = '#999';
  let gradient = 'linear-gradient(135deg, #181923, #101117)';
  let progressColor = '#999';

  if (rate > 0) {
    icon = '⬆';
    iconColor = '#6ee7b7';
    gradient = rate > 20
      ? 'linear-gradient(135deg, #143026, #101a18)'
      : 'linear-gradient(135deg, #27311b, #181e13)';
    progressColor = 'green';
  } else if (rate < 0) {
    icon = '⬇';
    iconColor = '#fda4af';
    gradient = 'linear-gradient(135deg, #351d2a, #22151c)';
    progressColor = 'red';
  }

  // Apply card background
  savingRateCard.style.background = gradient;

  // Format value with minus sign if negative
  const displayRate = rate < 0 ? `-${Math.abs(Math.round(rate))}` : Math.round(rate);

  // Render icon + value inline with bigger icon
  savingRateEl.innerHTML = `
    <span style="
      font-size: 1.6em;
      vertical-align: middle;
      color: ${iconColor};
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: bold;
    ">
      ${icon} <span>${displayRate}%</span>
    </span>
  `;

  // Progress bar (two-direction)
  const absRate = Math.min(Math.abs(rate), 100);
  progressEl.style.width = absRate + '%';
  progressEl.style.background = progressColor;
  if (rate >= 0) {
    progressEl.style.left = '0';
    progressEl.style.right = 'auto';
  } else {
    progressEl.style.right = '0';
    progressEl.style.left = 'auto';
  }
}



/* ---- KPI minicards ---- */
function renderAnnualKpi(totalIncome, totalExpense) {
  const totalBalance = totalIncome - totalExpense;
  const currencySymbol = el('currencyDisplay')?.innerText || '₹';

  const setKpi = (elId, icon, value, label, gradientClasses, textColorClass) => {
    const elTarget = el(elId);
    if (!elTarget) return;

    // Apply background classes directly to KPI container
    elTarget.className = `metric-card card-enter ${gradientClasses} ${textColorClass}`;

    // Fill in icon + value (one line) + label
    elTarget.innerHTML = `
      <div class="flex flex-col items-center space-y-2">
        <div class="flex items-center space-x-2 text-xl font-bold">
          <span class="kpi-icon-wrapper flex items-center justify-center w-10 h-10 rounded-full bg-white bg-opacity-40 shadow">
            <span class="kpi-icon">${icon}</span>
          </span>
          <span class="kpi-value"></span>
        </div>
        <span class="kpi-label finance-pill ${textColorClass}">${label}</span>
      </div>
    `;

    // Animate number (no decimals)
    const animateNoDecimal = (el, start, end, duration = 1000, prefix = '', suffix = '') => {
      if (!el) return;
      const startTime = performance.now();
      function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const valueNow = Math.round(start + (end - start) * progress);
        el.textContent = `${prefix}${valueNow.toLocaleString()}${suffix}`;
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    };

    animateNoDecimal(elTarget.querySelector('.kpi-value'), 0, value, 1000, `${currencySymbol} `);
  };

  // Income
  setKpi(
    'annualKpiIncome',
    '💰',
    totalIncome,
    'Total Income',
    'bg-gradient-to-br from-lime-200 to-green-200 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white',
    'text-green-800'
  );

  // Expense
  setKpi(
    'annualKpiExpense',
    '💸',
    totalExpense,
    'Total Expenses',
    'bg-gradient-to-br from-orange-100 to-rose-200 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white',
    'text-orange-800'
  );

  // Balance
  const balancePositive = totalBalance >= 0;
  setKpi(
    'annualKpiBalance',
    balancePositive ? '📈' : '📉',
    totalBalance,
    'Total Balance',
    balancePositive
      ? 'bg-gradient-to-br from-indigo-100 to-purple-200 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white'
      : 'bg-gradient-to-br from-pink-200 to-blue-200 backdrop-blur-md bg-opacity-60 shadow-lg hover:scale-105 transform transition-all duration-300 rounded-xl p-4 text-center border border-white',
    balancePositive ? 'text-indigo-800' : 'text-pink-800'
  );
  const balanceCard = el('annualKpiBalance');
  if (balanceCard) balanceCard.dataset.balance = totalBalance > 0 ? 'positive' : totalBalance < 0 ? 'negative' : 'zero';

  // Saving Rate
  renderAnnualSavingRate(totalIncome, totalExpense);
}



const STRIP_EVEN = "#15141d";
const STRIP_ODD = "#101117";

function applyModernTableStyles(table) {
  if (!table) return;
  // Gradient header
  const thead = table.querySelector("thead");
  if (thead) {
    thead.querySelectorAll("th").forEach(th => {
      //th.style.background = "linear-gradient(to right, #9a22f6, #f96fdc)";
      //th.style.color = "#fff";
      //th.style.fontWeight = "bold";
    });
  }
  // Striping
  table.querySelectorAll("tbody tr").forEach((tr, idx) => {
    tr.style.backgroundColor = idx % 2 === 0 ? STRIP_EVEN : STRIP_ODD;
  });
  // Total row pulse
  const lastRow = table.querySelector("tbody tr:last-child");
  if (lastRow) {
    lastRow.style.animation = "pulseRow 1.5s infinite";
    lastRow.style.backgroundColor = "#282039"
  }
}

function fadeInTableRows(tbody) {
  if (!tbody) return;
  tbody.querySelectorAll("tr").forEach((tr, idx) => {
    tr.style.opacity = 0;
    tr.style.transform = "translateY(10px)";
    tr.style.animation = `fadeInRow 0.4s ease forwards`;
    tr.style.animationDelay = `${idx * 0.05}s`;
  });
}

// Keyframe animations
const styleEl = document.createElement("style");
styleEl.innerHTML = `
@keyframes pulseRow {
  0% { background-color: inherit; }
  50% { background-color: #3d321b; }
  100% { background-color: inherit; }
}
@keyframes fadeInRow {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`;
document.head.appendChild(styleEl);

/* ---- Chart.js center-text plugin (used to show % inside doughnuts) ---- */
Chart.register({
  id: 'centerText',
  beforeDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const { ctx, chartArea: { width, height, top, bottom, left, right } } = chart;
    const opts = chart.config.options.plugins.centerText;
    if (!opts) return;
    ctx.save();
    ctx.font = opts.font || 'bold 16px Arial';
    ctx.fillStyle = opts.color || '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.text, (left + right) / 2, (top + bottom) / 2);
    ctx.restore();
  }
});

/* ---- 2. Expense % of Income donut ---- */
function renderExpensePct(totalIncome, totalExpense) {
  destroyChartInstance(annualCharts.expensePct);
  const ctx = safeGetCtx(ID.expensePct);
  if (!ctx) return;

  const remaining = Math.max(totalIncome - totalExpense, 0);
  const expensePct = totalIncome > 0 ? (totalExpense / totalIncome * 100) : 0;
  const pctText = expensePct.toFixed(1) + '%';
  const color = expensePct > 50 ? "#f87171" : "#4ade80";

  annualCharts.expensePct = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Expenses", "Remaining"],
      datasets: [{
        data: [totalExpense, remaining],
        backgroundColor: ["#f87171", "#93c5fd"]
      }]
    },
    options: {
      responsive: true,
      animation: { animateRotate: true, animateScale: true },
      plugins: {
        legend: { position: "bottom" },
        centerText: {
          text: (expensePct >= 0 ? "⬆ " : "⬇ ") + pctText,
          color: color,
          font: 'bold 24px Arial'
        }
      }
    }
  });
}

/* ---- 3. Income Growth line ---- */
function renderIncomeGrowth(monthlyArr) {
  destroyChartInstance(annualCharts.incomeGrowth);
  const ctx = safeGetCtx(ID.incomeGrowth);
  if (!ctx) return;
  annualCharts.incomeGrowth = new Chart(ctx, {
    type: 'line',
    data: { labels: MONTHS_LONG, datasets: [{ label: 'Income', data: monthlyArr.map(m => m.income), borderColor: '#2563eb', tension: 0.2, fill: false }] }
  });
}

/* ---- 4. Income vs Expenses bar ---- */
function renderIncomeVsExpenses(monthlyArr) {
  destroyChartInstance(annualCharts.incomeVsExpense);
  const ctx = safeGetCtx(ID.incomeVsExpense);
  if (!ctx) return;
  annualCharts.incomeVsExpense = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS_LONG,
      datasets: [
        { label: 'Income', data: monthlyArr.map(m => m.income), backgroundColor: '#2563eb' },
        { label: 'Expenses', data: monthlyArr.map(m => m.expense), backgroundColor: '#f97316' }
      ]
    }
  });
}

/* ---- 5. Saving Trend ---- */
function renderSavingTrend(monthlyArr) {
  destroyChartInstance(annualCharts.savingTrend);
  const ctx = safeGetCtx(ID.savingTrend);
  if (!ctx) return;

  // Monthly savings (income - expense)
  const savings = monthlyArr.map(m => (m.income || 0) - (m.expense || 0));

  // Cumulative savings for line trend
  let cumulative = 0;
  const cumulativeTrend = savings.map(v => (cumulative += v));

  annualCharts.savingTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS_LONG,
      datasets: [
        {
          type: 'line',
          label: 'Savings Trend',
          data: cumulativeTrend,
          borderColor: '#4a5568', // muted line color
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Monthly Savings',
          data: savings,
          backgroundColor: savings.map(v =>
            v >= 0 ? 'rgba(46, 204, 113, 0.5)' : 'rgba(236, 112, 99, 0.5)'
          ),
          borderColor: savings.map(v =>
            v >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(236, 112, 99, 1)'
          ),
          borderWidth: 1,
          barPercentage: 0.6,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          ticks: { maxRotation: 45, minRotation: 45 }
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => '₹ ' + Number(v).toLocaleString()
          }
        }
      }
    }
  });
}

/* ---- 6. Monthly Overview table ---- */
function renderMonthlyOverviewTable(monthlyArr) {
  const holder = document.querySelector('#annual_monthly_overview table tbody');
  if (!holder) return;
  holder.innerHTML = '';
  let sumIncome = 0, sumExpense = 0, sumTotal = 0;

  monthlyArr.forEach((m, idx) => {
    const inc = m.income || 0;
    const exp = m.expense || 0;
    const tot = inc - exp;
    sumIncome += inc; sumExpense += exp; sumTotal += tot;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${MONTHS_LONG[idx]}</td>
      <td data-report-tone="mint"><span class="finance-pill tone-mint">${formatCurrency(inc)}</span></td>
      <td data-report-tone="rose"><span class="finance-pill tone-rose">${formatCurrency(exp)}</span></td>
      <td><span class="finance-pill tone-${tot < 0 ? 'rose' : 'mint'}">${formatCurrency(tot)}</span></td>
    `;
    holder.appendChild(tr);
  });

  // Total row
  const totTr = document.createElement('tr');
  totTr.className = 'total-row';
  totTr.style.fontWeight = 'bold';
  totTr.innerHTML = `
    <td style="text-align:right">Total</td>
    <td data-report-tone="mint"><span class="finance-pill tone-mint">${formatCurrency(sumIncome)}</span></td>
    <td data-report-tone="rose"><span class="finance-pill tone-rose">${formatCurrency(sumExpense)}</span></td>
    <td><span class="finance-pill tone-${sumTotal < 0 ? 'rose' : 'mint'}">${formatCurrency(sumTotal)}</span></td>
  `;
  holder.appendChild(totTr);
}

/* ---- 7. Monthly Income & Expenses chart ---- */
function renderMonthlyIncomeExpensesChart(monthlyArr) {
  destroyChartInstance(annualCharts.monthlyIncomeExpenses);
  const ctx = safeGetCtx(ID.monthlyIncomeExpenses);
  if (!ctx) return;

  const incomeData = monthlyArr.map(m => m.income || 0);
  const expenseData = monthlyArr.map(m => m.expense || 0);
  const totalData = monthlyArr.map(m => (m.income || 0) - (m.expense || 0));

  annualCharts.monthlyIncomeExpenses = new Chart(ctx, {
    data: {
      labels: MONTHS_LONG,
      datasets: [
        {
          type: 'bar',
          label: 'Income',
          data: incomeData,
          backgroundColor: '#2563eb',
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#f9c6c0',
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Total',
          data: totalData,
          borderColor: '#b45309',
          backgroundColor: '#b45309',
          borderWidth: 2,
          tension: 0.2,
          fill: false,
          pointRadius: 3,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => '₹ ' + Number(v).toLocaleString()
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

/* ---- 8 & 9. Breakdown pie charts ---- */
function renderBreakdownPie(canvasId, byCategoryObj, chartKey, palette) {
  destroyChartInstance(annualCharts[chartKey]);
  const ctx = safeGetCtx(canvasId);
  if (!ctx) return;

  const labels = Object.keys(byCategoryObj || {});
  const data = labels.map(l => Number(byCategoryObj[l] || 0));
  const total = data.reduce((a, b) => a + b, 0);

  if (!labels.length) {
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No Data Found', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  const labelsWithPct = labels.map((l, i) =>
    `${l} (${((data[i] / total) * 100).toFixed(1)}%)`
  );

  annualCharts[chartKey] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labelsWithPct,
      datasets: [{
        data,
        backgroundColor: palette || [
          "#60a5fa", "#f97316", "#34d399", "#facc15", "#a78bfa", "#fb7185"
        ]
      }]
    },
    options: {
      responsive: true,
      animation: { animateRotate: true, animateScale: true },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

/* ---- 10 & 11. Top tables ---- */
function renderTopTable(tableId, byCategoryObj, total) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  const rows = Object.entries(byCategoryObj || {}).sort((a, b) => b[1] - a[1]).slice(0, 20);
  tbody.innerHTML = rows.length
    ? rows.map(([cat, amt]) => `<tr><td>${cat}</td><td style="text-align:right">${formatCurrency(amt)}</td><td style="text-align:right">${total ? ((amt / total) * 100).toFixed(1) : 0}%</td></tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#999">No Data Found</td></tr>`;
}

/* ---- 12. Cashflow summary ---- */
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderCashflowSummary(monthlyArr) {
  const tableWrapper = document.querySelector(`#${ID.cashflowSummary}`);
  const tbody = tableWrapper.querySelector('tbody');
  const thead = tableWrapper.querySelector('thead');

  // Ensure scroll container styling
  tableWrapper.style.overflowX = "auto";
  tableWrapper.style.position = "relative";

  function avg(arr) { return arr.reduce((a, b) => a + b, 0) / (arr.length || 1); }

  const incomeTotals = monthlyArr.map(m => m.income || 0);
  const expenseTotals = monthlyArr.map(m => m.expense || 0);
  const totalByMonth = incomeTotals.map((v, i) => v - expenseTotals[i]);

  const rows = [
    { label: 'Income', monthly: incomeTotals, total: incomeTotals.reduce((a, b) => a + b, 0) },
    { label: 'Expense', monthly: expenseTotals, total: expenseTotals.reduce((a, b) => a + b, 0) },
    { label: 'Total', monthly: totalByMonth, total: totalByMonth.reduce((a, b) => a + b, 0) }
  ];

  // Saving Trend row
  const savingRateMonthly = monthlyArr.map(m => {
    if ((m.income || 0) > 0) {
      return ((m.income - m.expense) / m.income) * 100;
    }
    return 0;
  });
  const savingRateTotal = (incomeTotals.reduce((a, b) => a + b, 0) > 0)
    ? (totalByMonth.reduce((a, b) => a + b, 0) / incomeTotals.reduce((a, b) => a + b, 0)) * 100
    : 0;

  rows.push({
    label: 'Saving Trend',
    monthly: savingRateMonthly.map(v => v),
    total: savingRateTotal,
    isSavingTrend: true
  });

  const cellValue = (row, value) => {
    const tone = row.label === 'Income' ? 'mint' : row.label === 'Expense' ? 'rose' : value < 0 ? 'rose' : 'mint';
    const text = row.isSavingTrend
      ? (value < 0 ? '↘ ' : '↗ ') + Math.abs(value).toFixed(1) + '%'
      : formatCurrency(value);
    return `<td class="finance-cashflow-value tone-${tone}" data-report-tone="${tone}">${text}</td>`;
  };
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.label}</td>
      ${cellValue(row, row.total)}
      ${cellValue(row, avg(row.monthly))}
      ${row.monthly.map(value => cellValue(row, value)).join('')}
    </tr>
  `).join('');

  // Sticky first 3 columns
  requestAnimationFrame(() => {
    const ths = Array.from(thead.querySelectorAll("th"));
    const leftOffsets = [];
    let offset = 0;
    for (let i = 0; i < 3; i++) {
      leftOffsets.push(offset);
      offset += ths[i].offsetWidth;
    }

    // Sticky header cells
    ths.forEach((th, idx) => {
      if (idx < 3) {
        th.style.position = "sticky";
        th.style.left = leftOffsets[idx] + "px";
        th.style.zIndex = 3;
        th.style.background = "linear-gradient(to right, #9a22f6, #f96fdc)";
        th.style.color = "#fff";
      }
      th.style.borderRight = "1px solid #e5e7eb";
    });

    // Sticky body cells
    Array.from(tbody.querySelectorAll("tr")).forEach((row, rIdx) => {
      const isEven = rIdx % 2 === 0;
      const bgColor = isEven ? "#101117" : "#171521";
      Array.from(row.querySelectorAll("td")).forEach((td, idx) => {
        if (idx < 3) {
          td.style.position = "sticky";
          td.style.left = leftOffsets[idx] + "px";
          td.style.background = bgColor;
          td.style.zIndex = 1;
        }
        td.style.borderRight = "1px solid #e5e7eb";
      });
    });

    // Smooth shadow fade
    let shadowEl = document.createElement("div");
    shadowEl.style.position = "absolute";
    shadowEl.style.top = "0";
    shadowEl.style.left = leftOffsets[2] + "px";
    shadowEl.style.width = "15px";
    shadowEl.style.height = "100%";
    shadowEl.style.pointerEvents = "none";
    shadowEl.style.background = "linear-gradient(to right, rgba(0,0,0,0.15), transparent)";
    shadowEl.style.opacity = "0";
    shadowEl.style.transition = "opacity 0.2s ease";
    tableWrapper.appendChild(shadowEl);

    tableWrapper.addEventListener("scroll", () => {
      shadowEl.style.opacity = tableWrapper.scrollLeft > 5 ? "1" : "0";
    });
  });
}



/* ---- 13 & 14. Category monthly summaries ---- */

// Use short month names for compact table headers

function renderCategorySummary(tableId, byCategoryMonthlyMap, isIncome = true) {
  const container = document.querySelector(`#${tableId}`);
  if (!container) return;

  // Make container scrollable only for this table
  container.style.overflowX = "auto";
  container.style.maxWidth = "100%";
  container.style.position = "relative";
  container.style.scrollbarWidth = "thin"; // Firefox
  container.style.overflowY = "hidden"; // Prevent vertical scrollbar

  const table = container.querySelector("table");
  if (!table) return;

  table.style.borderCollapse = "collapse";
  table.style.width = "max-content";
  table.style.minWidth = "100%";

  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  if (!thead || !tbody) return;

  const categories = Object.keys(byCategoryMonthlyMap || {});
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsHeader = MONTHS_SHORT.map(m => `<th style="white-space:nowrap;padding:6px 8px;border-bottom:2px solid #ddd;">${m}</th>`).join('');

  // Header
  thead.innerHTML = `
    <tr style="background:linear-gradient(to right,#9a22f6,#f96fdc);color:#fff;">
      <th style="white-space:nowrap;padding:6px 8px;">Category</th>
      <th style="text-align:right;white-space:nowrap;padding:6px 8px;">Total</th>
      <th style="white-space:nowrap;padding:6px 8px;">Progress</th>
      <th style="text-align:right;white-space:nowrap;padding:6px 8px;">% of Total</th>
      <th style="text-align:right;white-space:nowrap;padding:6px 8px;">Average</th>
      ${monthsHeader}
    </tr>
  `;

  if (!categories.length) {
    tbody.innerHTML = `<tr><td colspan="${5 + MONTHS_SHORT.length}" style="text-align:center;color:#999;padding:8px;">No Data Found</td></tr>`;
    return;
  }

  const sum = a => a.reduce((s, v) => s + v, 0);
  const avg = a => sum(a) / (a.length || 1);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const gradientFor = (pct, income) => {
    const hue = income ? 142 : 0; // green | red
    const sat = income ? 70 : 80;
    const lStart = clamp(96 - pct * 0.35, 40, 96);
    const lEnd = clamp(74 - pct * 0.45, 28, 74);
    return `linear-gradient(90deg,hsl(${hue} ${sat}% ${lStart}%),hsl(${hue} ${sat}% ${lEnd}%))`;
  };

  const pctColor = isIncome ? '#6ee7b7' : '#fda4af';

  // Grand totals
  const totalByMonth = Array(12).fill(0);
  categories.forEach(cat => {
    (byCategoryMonthlyMap[cat] || Array(12).fill(0))
      .forEach((v, i) => totalByMonth[i] += v);
  });
  const grandTotal = sum(totalByMonth);

  let rowsHtml = categories.map((cat, i) => {
    const monthsArr = byCategoryMonthlyMap[cat] || Array(12).fill(0);
    const totalVal = sum(monthsArr);
    const avgVal = avg(monthsArr);
    const pct = grandTotal ? +(totalVal / grandTotal * 100).toFixed(1) : 0;
    const bar = `
      <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">
        <div style="height:6px;width:${pct}%;background:${gradientFor(pct, isIncome)}"></div>
      </div>
    `;
    const bgColor = i % 2 === 0 ? "#101117" : "#171521";

    return `
      <tr style="background:${bgColor};">
        <td style="white-space:nowrap;padding:6px 8px;">${cat}</td>
        <td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(totalVal)}</td>
        <td style="padding:6px 8px;">${bar}</td>
        <td style="text-align:right;color:${pctColor};font-weight:700;white-space:nowrap;padding:6px 8px;">${pct}%</td>
        <td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(avgVal)}</td>
        ${monthsArr.map(v => `<td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(v)}</td>`).join('')}
      </tr>
    `;
  }).join('');

  // Total row
  const grandAverage = avg(totalByMonth);
  const totalBar = `
    <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">
      <div style="height:6px;width:100%;background:${gradientFor(100, isIncome)}"></div>
    </div>
  `;
  rowsHtml += `
    <tr style="font-weight:bold;background:#282039;">
      <td style="white-space:nowrap;padding:6px 8px;">Total</td>
      <td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(grandTotal)}</td>
      <td style="padding:6px 8px;">${totalBar}</td>
      <td style="text-align:right;color:${pctColor};white-space:nowrap;padding:6px 8px;">100%</td>
      <td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(grandAverage)}</td>
      ${totalByMonth.map(v => `<td style="text-align:right;white-space:nowrap;padding:6px 8px;">${formatCurrency(v)}</td>`).join('')}
    </tr>
  `;
  tbody.innerHTML = rowsHtml;

  // Sticky first 5 columns
  requestAnimationFrame(() => {
    const ths = Array.from(thead.querySelectorAll("th"));
    const firstCols = 5;
    let leftOffsets = [];
    let offset = 0;
    for (let i = 0; i < firstCols; i++) {
      leftOffsets.push(offset);
      offset += ths[i].offsetWidth;
    }

    // Header styling
    ths.forEach((th, idx) => {
      if (idx < firstCols) {
        th.style.position = "sticky";
        th.style.left = leftOffsets[idx] + "px";
        th.style.zIndex = 3;
        th.style.background = "linear-gradient(to right, #9a22f6, #f96fdc)";
        th.style.color = "#fff";
      }
    });

    // Body styling
    Array.from(tbody.querySelectorAll("tr")).forEach((row, rIdx) => {
      const bgColor = rIdx % 2 === 0 ? "#101117" : "#171521";
      Array.from(row.querySelectorAll("td")).forEach((td, idx) => {
        if (idx < firstCols) {
          td.style.position = "sticky";
          td.style.left = leftOffsets[idx] + "px";
          td.style.background = bgColor;
          td.style.zIndex = 1;
        }
        td.style.borderRight = "1px solid #e5e7eb";
      });
    });

    // Shadow fade effect
    const shadowDiv = document.createElement("div");
    shadowDiv.style.position = "absolute";
    shadowDiv.style.top = "0";
    shadowDiv.style.left = leftOffsets[firstCols - 1] + ths[firstCols - 1].offsetWidth + "px";
    shadowDiv.style.height = "100%";
    shadowDiv.style.width = "10px";
    shadowDiv.style.pointerEvents = "none";
    shadowDiv.style.background = "linear-gradient(to right, rgba(0,0,0,0.15), transparent)";
    shadowDiv.style.opacity = "0";
    shadowDiv.style.transition = "opacity 0.3s";
    container.appendChild(shadowDiv);

    container.addEventListener("scroll", () => {
      shadowDiv.style.opacity = container.scrollLeft > 0 ? "1" : "0";
    });
  });
}



/* ---- 13 & 14. Category monthly end ---- */

function enhanceAnnualTables() {
  [
    "annual_monthly_overview",
    "annual_top_income",
    "annual_top_expense",
    "annual_cashflow_summary",
    "annual_income_summary",
    "annual_expense_summary"
  ].forEach(id => {
    const table = document.querySelector(`#${id} table`);
    if (table) {
      applyModernTableStyles(table);
      fadeInTableRows(table.querySelector("tbody"));

      // Extra for wide tables
      if (["annual_cashflow_summary", "annual_income_summary", "annual_expense_summary"].includes(id)) {
        table.classList.add("wide-table");
      }
    }
  });
}

/* ---- Hook into your existing report generation ---- */
const originalGenAnnualReportFull = genAnnualReportFull;
genAnnualReportFull = async function () {
  await originalGenAnnualReportFull();
  enhanceAnnualTables();
};


function normalizeMonthlyMap(map) {
  const normalized = {};
  Object.keys(map || {}).forEach(cat => {
    let arr = Array.isArray(map[cat]) ? map[cat] : Array(12).fill(0);
    if (arr.length < 12) arr = [...arr, ...Array(12 - arr.length).fill(0)];
    normalized[cat] = arr.map(v => Number(v || 0));
  });
  return normalized;
}

/* ---------- Main generator ---------- */
async function genAnnualReportFull() {


  if (!document.getElementById('annualDashboard')?.offsetParent) return;
  const yearEl = document.getElementById('annualReportYear');
  const year = yearEl ? yearEl.value : new Date().getFullYear();
  console.log(`📊 Generating Annual Report for ${year}`);
  showLoading();
  try {
    // Fetch data
    let resp = await apiGet('reportAnnual', { year });
    let transactions = Array.isArray(resp.transactions) ? resp.transactions : [];
    if (!transactions.length) {
      const txResp = await apiGet('listTransactions');
      transactions = Array.isArray(txResp.rows) ? txResp.rows : [];
    }
    // Filter by year
    window.trackerAnnualReportPeriod = {year:Number(year),currency:el('currencyDisplay').innerText};
    transactions = transactions.filter(t => {
      const d = new Date(t.date || t.txDate);
      return d.getFullYear() == year;
    });

    if (!transactions.length) {
      console.warn(`No transactions for ${year}`);
      showNoDataForAllAnnualWidgets();
      hideLoading();
      return;
    }

    // 3) Monthly totals
    let monthlyTotals = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    if (Array.isArray(resp.monthlyTotals) && resp.monthlyTotals.length >= 1) {
      for (let i = 0; i < 12; i++) {
        const it = resp.monthlyTotals[i] || {};
        monthlyTotals[i] = { income: Number(it.income || 0), expense: Number(it.expense || 0) };
      }
    } else {
      transactions.forEach(tx => {
        const m = new Date(tx.date).getMonth();
        if (tx.type === 'income') monthlyTotals[m].income += tx.amount;
        else monthlyTotals[m].expense += tx.amount;
      });
    }

    // 4) Category data
    let incomeByCategory = { ...resp.incomeByCategory };
    let expenseByCategory = { ...resp.expenseByCategory };
    let incomeByCategoryMonthly = normalizeMonthlyMap(resp.incomeByCategoryMonthly);
    let expenseByCategoryMonthly = normalizeMonthlyMap(resp.expenseByCategoryMonthly);

    if (!Object.keys(incomeByCategory).length && !Object.keys(expenseByCategory).length) {
      incomeByCategory = {};
      expenseByCategory = {};
      incomeByCategoryMonthly = {};
      expenseByCategoryMonthly = {};

      transactions.forEach(tx => {
        const m = new Date(tx.date).getMonth();
        const cat = tx.category || 'Uncategorized';
        if (tx.type === 'income') {
          incomeByCategory[cat] = (incomeByCategory[cat] || 0) + tx.amount;
          if (!incomeByCategoryMonthly[cat]) incomeByCategoryMonthly[cat] = Array(12).fill(0);
          incomeByCategoryMonthly[cat][m] += tx.amount;
        } else {
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + tx.amount;
          if (!expenseByCategoryMonthly[cat]) expenseByCategoryMonthly[cat] = Array(12).fill(0);
          expenseByCategoryMonthly[cat][m] += tx.amount;
        }
      });
    }

    incomeByCategoryMonthly = normalizeMonthlyMap(incomeByCategoryMonthly);
    expenseByCategoryMonthly = normalizeMonthlyMap(expenseByCategoryMonthly);

    const totalIncome = monthlyTotals.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthlyTotals.reduce((s, m) => s + m.expense, 0);

    // 5) If no data, show message
    if (
      !monthlyTotals.some(m => m.income || m.expense) &&
      !Object.keys(incomeByCategory).length &&
      !Object.keys(expenseByCategory).length
    ) {
      const msg = '<div style="text-align:center;color:#999;padding:18px">No Data Found</div>';
      [
        'annualKpiIncome', 'annualKpiExpense', 'annualKpiBalance', 'annual_expense_pct', 'annual_income_growth',
        'annual_income_vs_expense', 'annual_saving_trend', 'annual_monthly_overview', 'annual_monthly_income_expenses',
        'annual_income_breakdown', 'annual_expense_breakdown', 'annual_top_income', 'annual_top_expense',
        'annual_cashflow_summary', 'annual_income_summary', 'annual_expense_summary'
      ].forEach(id => {
        const c = document.getElementById(id);
        setAnnualEmpty(id, msg);
      });
      hideLoading();
      return;
    }

    // 6) Render all
    renderAnnualKpi(totalIncome, totalExpense);
    renderExpensePct(totalIncome, totalExpense);
    renderIncomeGrowth(monthlyTotals);
    renderIncomeVsExpenses(monthlyTotals);
    renderSavingTrend(monthlyTotals);
    renderMonthlyOverviewTable(monthlyTotals);
    renderMonthlyIncomeExpensesChart(monthlyTotals);
    renderBreakdownPie('annual_income_breakdown', incomeByCategory, 'incomeBreakdown');
    renderBreakdownPie('annual_expense_breakdown', expenseByCategory, 'expenseBreakdown');
    renderTopTable('annual_top_income', incomeByCategory, totalIncome);
    renderTopTable('annual_top_expense', expenseByCategory, totalExpense);
    renderCashflowSummary(monthlyTotals, incomeByCategory, expenseByCategory);
    renderCategorySummary('annual_income_summary', incomeByCategoryMonthly, true);
    renderCategorySummary('annual_expense_summary', expenseByCategoryMonthly, false);
    console.log("✅ Annual report loaded successfully");
  } catch (err) {
    console.error('Annual report error', err);
    alert(`Annual report error: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}

// Ensure DOM ready before binding
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('genAnnual');
  if (btn) {
    btn.removeEventListener('click', genAnnualReportFull);
    btn.addEventListener('click', genAnnualReportFull);
  }
});
// wire button (if not already wired)
const genBtn = el('genAnnual') || el('genAnnualReport') || el('generateAnnual');
if (genBtn) {
  genBtn.removeEventListener?.('click', genAnnualReportFull);
  genBtn.addEventListener('click', genAnnualReportFull);
}

/* Optional: ensure year dropdown (reportYear) is populated if empty */
(function ensureYearDropdown() {
  const ysel = el(ID.yearSelect);
  if (!ysel) return;
  if (ysel.options.length > 0) return; // already filled elsewhere
  const now = new Date(), cur = now.getFullYear();
  for (let y = cur - 3; y <= cur + 1; y++) {
    const o = document.createElement('option'); o.value = y; o.textContent = y;
    if (y === cur) o.selected = true;
    ysel.appendChild(o);
  }
})();

function setAnnualEmpty(id, message) {
  const target = document.getElementById(id);
  if (!target) return;
  target.querySelectorAll('canvas').forEach(canvas => Chart.getChart(canvas)?.destroy());
  const body = target.querySelector('table tbody');
  if (body) {
    const columns = target.querySelector('thead tr')?.cells.length || 1;
    body.innerHTML = '<tr><td colspan="' + columns + '">No Data Found</td></tr>';
  } else target.innerHTML = message;
}

function showNoDataForAllAnnualWidgets() {
  const msg = '<div style="text-align:center;color:#999;padding:18px">No Data Found</div>';
  [
    ID.kpiIncome, ID.kpiExpense, ID.kpiBalance,
    ID.expensePct, ID.incomeGrowth, ID.incomeVsExpense, ID.savingTrend,
    ID.monthlyOverview, ID.monthlyIncomeExpenses, ID.incomeBreakdown, ID.expenseBreakdown,
    ID.topIncome, ID.topExpense, ID.cashflowSummary, ID.incomeSummary, ID.expenseSummary
  ].forEach(id => {
    setAnnualEmpty(id, msg);
  });
}


(function populateAnnualYearDropdown() {
  const ysel = document.getElementById('annualReportYear');
  if (!ysel) {
    console.warn("[Annual] Year dropdown not found!");
    return;
  }
  ysel.innerHTML = "";
  for (let y = 2025; y <= 2032; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === new Date().getFullYear()) opt.selected = true;
    ysel.appendChild(opt);
  }
})();


document.getElementById("genAnnual").addEventListener("click", () => {
  const dash = document.getElementById("annualDashboard");
  if (!dash || dash.offsetParent === null) {
    // Show the annual tab first
    document.querySelector('[data-subtab="annual"]').click();
    setTimeout(genAnnualReportFull, 100); // small delay so DOM updates
  } else {
    genAnnualReportFull();
  }
});

/**
 * Update KPI card style for positive/negative values
 * @param {string} cardId - The ID of the KPI card container
 * @param {number} value - The numeric value to check
 */
function updateKpiCardStyle(cardId, value) {
  const card = document.getElementById(cardId);
  if (!card) return;

  card.classList.remove('kpi-positive', 'kpi-negative');
  if (value >= 0) {
    card.classList.add('kpi-positive');
  } else {
    card.classList.add('kpi-negative');
  }
}



function showReportDashboard() {
  if (!window.reportsLoaded) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'asset/tracker/reportdashboard.css';
    document.head.appendChild(css);

    const js = document.createElement('script');
    js.src = 'asset/tracker/reportdashboard.js';
    js.onload = () => {
      ReportsDashboard.init();
    };
    document.body.appendChild(js);

    window.reportsLoaded = true;
  } else {
    ReportsDashboard.show();
  }
  document.querySelector('#reportdashboard').style.display = 'block';
}

