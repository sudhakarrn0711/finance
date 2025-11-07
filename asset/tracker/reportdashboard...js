// Report Dashboard – safely scoped module
window.ReportsDashboard = (function () {
  /* ====== SCOPE HELPERS ====== */
  const RD_ROOT = document.getElementById("reportdashboard") || document;
  const qs  = (sel, el = RD_ROOT) => el.querySelector(sel);
  const qsa = (sel, el = RD_ROOT) => Array.from(el.querySelectorAll(sel));
  const fmt = (n) => Number(n || 0).toLocaleString();

  const todayYM = () => {
    const d = new Date(), m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  };
  function periodRangeKey(range) {
    const now = new Date();
    const firstDay = (y,m)=>new Date(y,m,1);
    const lastDay  = (y,m)=>new Date(y,m+1,0);
    if(range==="this-month"){ const d= new Date(); return [firstDay(d.getFullYear(), d.getMonth()), lastDay(d.getFullYear(), d.getMonth())];}
    if(range==="last-month"){ const d= new Date(); d.setMonth(d.getMonth()-1); return [firstDay(d.getFullYear(), d.getMonth()), lastDay(d.getFullYear(), d.getMonth())];}
    if(range==="this-year"){ const y=now.getFullYear(); return [new Date(y,0,1), new Date(y,11,31)]; }
    return [new Date(2000,0,1), new Date(2100,11,31)];
  }

  // Use the global apiGet (from finance_tracker.js)
  async function apiGet(action, params = {}) {
    if (typeof window.apiGet === "function") return await window.apiGet(action, params);
    throw new Error("apiGet not found (load finance_tracker.js first).");
  }

  /* ====== STATE ====== */
  let __busy = false;
  const charts = {}; // canvasId -> Chart instance
  let nwChart = null;
  let cashFlowChart = null;
  let topExpenseChart = null;
  let topIncomeChart = null;

  // Category Insights state
  let ciLevel = "category";
  let ciSelectedCategory = null;
  let ciAllTx = [];

  /* ====== CHART HELPERS ====== */
  function destroyChartById(canvasId) {
    const ch = charts[canvasId];
    if (ch && typeof ch.destroy === "function") {
      try { ch.destroy(); } catch (e) {}
    }
    delete charts[canvasId];
  }

  function getCtxFresh(canvasId) {
    const el = RD_ROOT.querySelector(`#${canvasId}`);
    if (!el) return null;
    // if a Chart is bound to this canvas, destroy it
    const existing = (window.Chart && typeof Chart.getChart === "function")
      ? Chart.getChart(el) : charts[canvasId];
    if (existing) {
      try { existing.destroy(); } catch(e) {}
    }
    destroyChartById(canvasId);
    return el.getContext("2d");
  }

  function resetChartCanvases() {
    const fresh = {
      topExpenseChart: '<canvas id="topExpenseChart" height="220"></canvas>',
      topIncomeChart:  '<canvas id="topIncomeChart"  height="220"></canvas>',
      cashFlowChart:   '<canvas id="cashFlowChart"   height="280"></canvas>',
      nwChart:         '<canvas id="nwChart"         height="260"></canvas>',
    };
    Object.entries(fresh).forEach(([id, html]) => {
      const old = RD_ROOT.querySelector(`#${id}`);
      if (old) old.outerHTML = html;
    });
  }

  // keep compatibility with any external code that tracks charts
  function track(chart, id) {
    charts[id] = chart;
    if (!Array.isArray(window.reportCharts)) window.reportCharts = [];
    window.reportCharts.push(chart);
  }

  /* ====== SUB-TABS (INSIDE REPORT DASHBOARD) ====== */
  // We attach to ANY button with [data-tab] inside #reportdashboard; no class dependency.
  qsa('[data-tab]').forEach(btn => {
    btn.addEventListener("click", () => {
      // toggle active button
      qsa('[data-tab]').forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // toggle sections within this dashboard only
      const id = btn.getAttribute("data-tab");
      qsa("main > section").forEach(s => s.classList.add("hidden"));
      const target = qs("#" + id);
      if (target) target.classList.remove("hidden");

      // When a chart tab becomes visible, ensure charts are laid out correctly
      // (e.g., switching to "Top" or "Cash Flow")
      setTimeout(reflow, 0);
    });
  });

  // Optional refresh button inside this dashboard
  const refreshBtn = qs("#refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", initAll);

  /* ====== 1) Category Insights ====== */
async function loadCategoryInsights() {
  showCiLoader();   // show loader before fetching

  try {
    const tx = await apiGet("listTransactions");
    ciAllTx = (tx.rows || []).map(r => ({ ...r, dateObj: new Date(r.date) }));

    const type = qs("#ciType")?.value || "";
    const range = qs("#ciTime")?.value || "this-month";
    const typeChip = qs("#ciTypeChip");
    const timeChip = qs("#ciTimeChip");

    if (typeChip) typeChip.textContent = type;
    if (timeChip) {
      const opt = qs("#ciTime")?.selectedOptions?.[0];
      timeChip.textContent = opt ? opt.textContent : "";
    }

    const [from, to] = periodRangeKey(range);
    const filtered = ciAllTx.filter(r => {
      if (type && r.type?.toLowerCase() !== type) return false;
      const d = r.dateObj;
      return d >= from && d <= to;
    });

    const map = {}, countMap = {};
    filtered.forEach(r => {
      const k = (r.category || "Uncategorized").trim();
      map[k] = (map[k] || 0) + Number(r.amount || 0);
      countMap[k] = (countMap[k] || 0) + 1;
    });
    const totalSum = Object.values(map).reduce((s, v) => s + v, 0) || 1;

    const search = (qs("#ciSearch")?.value || "").toLowerCase().trim();
    const rows = Object.keys(map)
      .filter(n => !search || n.toLowerCase().includes(search))
      .map(n => ({ name: n, total: map[n], pct: (map[n] / totalSum) * 100, count: countMap[n] }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    ciLevel = "category";
    ciSelectedCategory = null;
    const level = qs("#ciLevel");
    if (level) level.textContent = "Category";

    qs("#ciBack")?.classList.add("hidden");
    qs("#ciDrillTransactions")?.classList.add("hidden");

    renderCiTable(rows, totalSum, type);

  } catch (err) {
    console.error("Error loading category insights:", err);
  } finally {
    hideCiLoader();   // always hide loader at the end
  }
}


function renderCiTable(rows, totalSum, type) {
  const body = qs("#ciBody");
  if (!body) return;
  body.innerHTML = "";

  rows.forEach((r,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>
    <button class="ci-cat-label ${type === "income" ? "ci-cat-income" : "ci-cat-expense"}"
            data-ci-drill="${r.name}">
      ${r.name}
    </button>
    <div class="ci-bar-wrap">
      <div class="ci-bar-fill ${type === "income" ? "ci-bar-income" : "ci-bar-expense"}"
           style="width:${Math.max(4,r.pct)}%"></div>
    </div>
  </td>
  <td class="text-right">${fmt(r.total)}</td>
  <td class="text-right">${r.pct.toFixed(1)}%</td>
  <td class="text-right">${r.count}</td>
`;
    body.appendChild(tr);
  });

  qsa("[data-ci-drill]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      ciSelectedCategory = btn.getAttribute("data-ci-drill");
      drillToDescriptions();
    });
  });
}

  function drillToDescriptions() {
  if (!ciSelectedCategory) return;
  const type = qs("#ciType")?.value || "";
  const range = qs("#ciTime")?.value || "this-month";
  const [from,to] = periodRangeKey(range);

  const filtered = ciAllTx.filter(r => {
    if (type && r.type?.toLowerCase() !== type) return false;
    if ((r.category || "").trim().toLowerCase() !== ciSelectedCategory.trim().toLowerCase()) return false;
    return r.dateObj >= from && r.dateObj <= to;
  });

  const map = {}, countMap = {};
  filtered.forEach(r=>{
    const d = (r.desc || "—").trim();
    map[d] = (map[d] || 0) + Number(r.amount || 0);
    countMap[d] = (countMap[d] || 0) + 1;
  });
  const total = Object.values(map).reduce((s,v)=>s+v,0) || 1;

  const rows = Object.keys(map).map(n => ({
    name:n,
    total:map[n],
    pct:(map[n]/total)*100,
    count:countMap[n]
  })).sort((a,b)=> Math.abs(b.total)-Math.abs(a.total));

  ciLevel = "description";
  qs("#ciLevel").textContent = "Description (within " + ciSelectedCategory + ")";
  qs("#ciBack")?.classList.remove("hidden");

  renderCiTable(rows, total, type);

  // bind click for transaction drill
  qsa("#ciBody tr").forEach(tr=>{
    tr.addEventListener("click", ()=>{
      const name = tr.querySelector("[data-ci-drill]")?.getAttribute("data-ci-drill") || "";
      showCiTransactions(type, ciSelectedCategory, name);
    });
  });
}

// tram

  function showCiTransactions(type, category, desc) {
  const range = qs("#ciTime")?.value || "this-month";
  const [from,to] = periodRangeKey(range);

  const rows = ciAllTx.filter(r=>{
    if (type && r.type?.toLowerCase() !== type) return false;
    if ((r.category||"").trim().toLowerCase() !== category.trim().toLowerCase()) return false;
    if ((r.desc||"").trim() !== desc.trim()) return false;
    return r.dateObj >= from && r.dateObj <= to;
  }).sort((a,b)=> new Date(b.date) - new Date(a.date));

  qs("#ciDrillHdr")?.classList.remove("hidden");
  qs("#ciDrillWrap")?.classList.remove("hidden");

  const body = qs("#ciTxBody");
  if (!body) return;
  body.innerHTML = "";

  rows.forEach((r,i)=>{
    const zebra = i%2 ? "row-alt": "";
    const tr = document.createElement("tr");
    tr.className = zebra;
    tr.innerHTML = `
      <td class="px-3 py-2">${r.date}</td>
      <td class="px-3 py-2">${r.account || ""}</td>
      <td class="px-3 py-2">${r.category || ""}</td>
      <td class="px-3 py-2">${r.desc || ""}</td>
      <td class="px-3 py-2 text-right">${fmt(r.amount)}</td>
    `;
    body.appendChild(tr);
  });

  // ✅ track state
  ciLevel = "transactions";
}
const ciBack = qs("#ciBack");
if (ciBack) {
  ciBack.addEventListener("click", () => {
    // Always hide transactions drill when going back
    qs("#ciDrillTransactions")?.classList.add("hidden");
    qs("#ciDrillHdr")?.classList.add("hidden");
    qs("#ciDrillWrap")?.classList.add("hidden");

    // Reload the top-level Category view
    loadCategoryInsights();
  });
}

// Filters still reload
["#ciType","#ciTime","#ciSearch"].forEach(id => {
  const el = qs(id);
  if (el) el.addEventListener("input", loadCategoryInsights);
});
// back

  function showCiLoader() {
  const loader = qs("#ciLoader");
  if (loader) loader.classList.remove("hidden");
}

function hideCiLoader() {
  const loader = qs("#ciLoader");
  if (loader) loader.classList.add("hidden");
}

  /* ====== 2) Goals ====== */
  async function loadGoals(){
    const data = await apiGet("getGoals");
    const wrap = qs("#goalsWrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    (data.goals || []).forEach(g=>{
      const pct = g.target ? Math.min(100, (g.current/g.target)*100) : 0;
      const isDebt = (g.type || "").toLowerCase()==="debt";
      const badge = isDebt ? "💸" : "💰";
      const color = isDebt ? "grad-red" : "grad-green";
      const bar = isDebt ? "bar-fill-neg" : "bar-fill-pos";
      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date())/86400000) : "";
      const card = document.createElement("div");
      card.className = `glass-soft card p-4 ${color}`;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="text-lg font-semibold">${badge} ${g.name}</div>
          <span class="badge">${g.type || "saving"}</span>
        </div>
        <div class="mt-2 text-sm muted">Target: ${fmt(g.target)} · Current: ${fmt(g.current)}${g.deadline?` · Deadline: ${g.deadline}`:""}${daysLeft!==""?` · ${daysLeft} days left`:""}</div>
        <div class="mt-3 h-2 w-full bar-bg rounded overflow-hidden">
          <div class="h-full ${bar}" style="width:${pct}%;"></div>
        </div>
        <div class="mt-2 text-right text-sm ${isDebt?"headline-red":"headline"}"><b>${pct.toFixed(1)}%</b> complete</div>
      `;
      wrap.appendChild(card);
    });
  }

  /* ====== 3) Top Spends & Income ====== */
  async function loadTop() {
    const range = qs("#topRange")?.value || "this-month";
    const tx = await apiGet("listTransactions");
    const [from,to] = periodRangeKey(range);
    const rows = (tx.rows || []).map(r=> ({...r, dateObj: new Date(r.date)}))
      .filter(r=> r.dateObj >= from && r.dateObj <= to);

    const agg = (type) => {
      const map = {};
      rows.filter(r=> (r.type||"").toLowerCase()===type)
        .forEach(r=> map[r.category] = (map[r.category]||0) + Number(r.amount||0));
      return Object.entries(map).sort((a,b)=> b[1]-a[1]).slice(0,8);
    };
    const eData = agg("expense"), iData = agg("income");

    renderPie("topExpenseChart", eData, c => (topExpenseChart=c));
    renderPie("topIncomeChart",  iData, c => (topIncomeChart=c));
  }

  function renderPie(canvasId, pairs, cb) {
    const ctx = getCtxFresh(canvasId);
    if (!ctx) return;

    const labels = pairs.map(p => Array.isArray(p) ? (p[0] ?? "—") : (p.name ?? "—"));
    const values = pairs.map(p => Array.isArray(p) ? (p[1] ?? 0)   : (p.total ?? 0));

    const chart = new Chart(ctx, {
      type: "pie",
      data: { labels, datasets: [{ data: values }] },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (tt) => `${tt.label}: ${fmt(tt.raw)}` } }
        }
      }
    });
    track(chart, canvasId);
    if (typeof cb === "function") cb(chart);
  }

  const topRangeEl = qs("#topRange");
  if (topRangeEl) topRangeEl.addEventListener("change", loadTop);

  /* ====== 4) Cash Flow (12 months) ====== */
  async function loadCashFlow() {
    const tx = await apiGet("listTransactions");
    const rows = (tx.rows || []);
    const now = new Date();
    const seq = [];
    for(let i=11;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      seq.push({ key: d.toISOString().slice(0,7), label: d.toLocaleString(undefined,{month:"short", year:"2-digit"}), income:0, expense:0 });
    }
    const idx = (ym)=> seq.findIndex(s=> s.key===ym);
    rows.forEach(r=>{
      const ym = new Date(r.date).toISOString().slice(0,7);
      const i = idx(ym);
      if (i>-1) {
        const t = (r.type||"").toLowerCase();
        const amt = Number(r.amount||0);
        if (t==="income") seq[i].income += amt; else if (t==="expense") seq[i].expense += amt;
      }
    });

    const ctx = getCtxFresh("cashFlowChart");
    if (!ctx) return;

    if (cashFlowChart) { try { cashFlowChart.destroy(); } catch(e){} }
    cashFlowChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: seq.map(s=>s.label),
        datasets: [
          { label:"Income",   data: seq.map(s=>s.income),  borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,.25)", tension:.3, fill:true },
          { label:"Expenses", data: seq.map(s=>s.expense), borderColor:"#f43f5e", backgroundColor:"rgba(244,63,94,.18)", tension:.3, fill:true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins:{ legend:{ labels:{ color:"rgba(255,255,255,.85)"} } },
        scales:{ x:{ ticks:{ color:"rgba(255,255,255,.8)"}}, y:{ ticks:{ color:"rgba(255,255,255,.8)"} } }
      }
    });
    track(cashFlowChart, "cashFlowChart");
  }

  /* ====== 5) Accounts (current) ====== */
  async function loadAccounts() {
    const data = await apiGet("getAccounts");
    const body = qs("#acctBody");
    if (!body) return;
    body.innerHTML = "";
    (data.accounts||[]).forEach((a,i)=>{
      const zebra = i%2 ? "row-alt":"";
      const tr = document.createElement("tr");
      tr.className = zebra;
      tr.innerHTML = `<td class="px-3 py-2">${a.name||""}</td><td class="px-3 py-2 text-right">${fmt(a.balance)}</td>`;
      body.appendChild(tr);
    });
  }

  /* ====== 6) Recurring ====== */
  async function loadRecurring(){
    const data = await apiGet("listTransactions");
    const rows = (data.rows||[]).map(r=> ({...r, d:new Date(r.date)})).sort((a,b)=> a.d - b.d);
    const key = r=> [String(r.desc||"").trim().toLowerCase(), String(r.category||"").trim().toLowerCase(), (r.type||"").toLowerCase(), (Number(r.amount)>=0?"pos":"neg")].join("|");
    const map = {};
    rows.forEach(r=>{ (map[key(r)] = map[key(r)] || []).push(r); });
    const items = Object.entries(map)
      .map(([k,arr])=>{
        const avg = arr.reduce((s,x)=>s+Number(x.amount||0),0) / arr.length;
        const last = arr[arr.length-1];
        const deltas = [];
        for(let i=1;i<arr.length;i++){ deltas.push((arr[i].d - arr[i-1].d)/86400000); }
        const med = deltas.sort((a,b)=>a-b)[Math.floor(deltas.length/2)] || null;
        const cadence = med ? (med>25 && med<35?"Monthly": (med>6 && med<8?"Weekly":"Variable")) : "Unknown";
        return { name: k.split("|")[0] + " · " + (arr[0].category||""), type: arr[0].type, avg, count: arr.length, last: last.date, cadence };
      })
      .filter(x=> x.count>=3)
      .sort((a,b)=> Math.abs(b.avg)-Math.abs(a.avg));

    const body = qs("#recBody");
    if (!body) return;
    body.innerHTML = "";
    items.forEach((it,i)=>{
      const zebra = i%2?"row-alt":"";
      const tr = document.createElement("tr");
      tr.className = zebra;
      tr.innerHTML = `
        <td class="px-3 py-2">${it.name}</td>
        <td class="px-3 py-2">${it.type}</td>
        <td class="px-3 py-2 text-right">${fmt(it.avg)}</td>
        <td class="px-3 py-2 text-right">${fmt(it.count)}</td>
        <td class="px-3 py-2">${it.last}</td>
        <td class="px-3 py-2">${it.cadence}</td>
      `;
      body.appendChild(tr);
    });
  }

  /* ====== 7) Budgets vs Actual ====== */
  async function loadBudgets(period) {
    const perEl = qs("#budPeriod");
    const per = period || perEl?.value || todayYM();
    if (perEl) perEl.value = per;
    const data = await apiGet("getBudgets", { period: per });
    const body = qs("#budBody");
    if (!body) return;
    body.innerHTML = "";
    (data.budgets||[]).forEach((b,i)=>{
      const zebra = i%2?"row-alt":"";
      const over = b.actual > b.budget;
      const pct = b.budget ? Math.min(100, (b.actual/b.budget)*100) : 0;
      const tr = document.createElement("tr");
      tr.className = zebra;
      tr.innerHTML = `
        <td class="px-3 py-2">${b.category}</td>
        <td class="px-3 py-2">${b.type}</td>
        <td class="px-3 py-2 text-right">${fmt(b.budget)}</td>
        <td class="px-3 py-2 text-right">${fmt(b.actual)}</td>
        <td class="px-3 py-2 text-right ${over?"text-red-300":""}">${fmt(b.variance)}</td>
        <td class="px-3 py-2">
          <div class="h-2 w-full bar-bg rounded overflow-hidden">
            <div class="h-full ${over?"bar-fill-neg":"bar-fill-pos"}" style="width:${pct}%;"></div>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });
  }
  const budGo = qs("#budGo");
  if (budGo) budGo.addEventListener("click", ()=> loadBudgets());

  /* ====== 8) Net Worth ====== */
  async function loadNetWorth(){
    const data = await apiGet("getNetWorth");
    const assets = data.assets || [];
    const liabs  = data.liabilities || [];
    const hist   = data.history || [];

    const aBody = qs("#nwAssets"); if (aBody) aBody.innerHTML = "";
    const lBody = qs("#nwLiabs");  if (lBody) lBody.innerHTML = "";
    assets.forEach((a,i)=>{
      const tr = document.createElement("tr"); tr.className = i%2?"row-alt":"";
      tr.innerHTML = `<td class="px-3 py-2">${a.name}</td><td class="px-3 py-2 text-right">${fmt(a.amount)}</td>`;
      aBody && aBody.appendChild(tr);
    });
    liabs.forEach((l,i)=>{
      const tr = document.createElement("tr"); tr.className = i%2?"row-alt":"";
      tr.innerHTML = `<td class="px-3 py-2">${l.name}</td><td class="px-3 py-2 text-right">${fmt(l.amount)}</td>`;
      lBody && lBody.appendChild(tr);
    });

    const labels = hist.map(h=> h.date);
    const net    = hist.map(h=> h.netWorth);
    const aVals  = hist.map(h=> h.assets);
    const dVals  = hist.map(h=> h.liabilities);

    const ctx = getCtxFresh("nwChart");
    if (!ctx) return;

    if (nwChart) { try { nwChart.destroy(); } catch(e){} }
    nwChart = new Chart(ctx, {
      type:"line",
      data:{ labels,
        datasets:[
          { label:"Net Worth",   data: net,   borderColor:"#60a5fa", backgroundColor:"rgba(96,165,250,.22)", tension:.3, fill:true },
          { label:"Assets",      data: aVals, borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,.18)", tension:.3, fill:true },
          { label:"Liabilities", data: dVals, borderColor:"#f43f5e", backgroundColor:"rgba(244,63,94,.14)", tension:.3, fill:true }
        ]
      },
      options:{
        responsive: true,
        maintainAspectRatio: false,
        plugins:{ legend:{ labels:{ color:"rgba(255,255,255,.85)" } } },
        scales:{ x:{ ticks:{ color:"rgba(255,255,255,.8)"}}, y:{ ticks:{ color:"rgba(255,255,255,.8)"} } }
      }
    });
    track(nwChart, "nwChart");
  }

  /* ====== MASTER INIT / REFRESH / SHOW / HIDE ====== */
  async function initAll() {
    if (__busy) return;
    __busy = true;
    try {
      const bp = qs("#budPeriod"); if (bp) bp.value = todayYM();
      // IMPORTANT: reset canvases before first load to guarantee fresh contexts
      resetChartCanvases();
      await Promise.all([
        loadCategoryInsights(),
        loadGoals(),
        loadTop(),
        loadCashFlow(),
        loadAccounts(),
        loadRecurring(),
        loadBudgets(qs("#budPeriod")?.value),
        loadNetWorth()
      ]);
    } catch (e) {
      console.error(e);
      alert("Failed to load one or more reports. Check console.");
    } finally {
      __busy = false;
    }
  }

  async function refresh() {
    // Called when the dashboard tab becomes visible again
    destroyCharts();         // remove old instances
    resetChartCanvases();    // replace canvases so width/height are correct
    await initAll();         // rebuild data + charts
    reflow();                // final layout pass
  }

  function reflow() {
    // Force Chart.js to recompute sizes after visibility change
    Object.values(charts).forEach(c => {
      try { c.resize(); } catch(e) {}
      try { c.update(); } catch(e) {}
    });
  }

  function show() { if (RD_ROOT) RD_ROOT.style.display = "block"; }
  function hide() { if (RD_ROOT) RD_ROOT.style.display = "none"; destroyCharts(); }

  function destroyCharts() {
    Object.keys(charts).forEach(id => destroyChartById(id));
    if (nwChart)         { try { nwChart.destroy(); }         catch(e){} nwChart=null; }
    if (cashFlowChart)   { try { cashFlowChart.destroy(); }   catch(e){} cashFlowChart=null; }
    if (topExpenseChart) { try { topExpenseChart.destroy(); } catch(e){} topExpenseChart=null; }
    if (topIncomeChart)  { try { topIncomeChart.destroy(); }  catch(e){} topIncomeChart=null; }
    if (Array.isArray(window.reportCharts)) {
      window.reportCharts.forEach(c => { try { c.destroy(); } catch(e){} });
      window.reportCharts = [];
    }
  }

  /* ====== PUBLIC API ====== */
  return {
    init: initAll,
    refresh,
    show,
    hide,
    reflow,
    destroyCharts,
    charts
  };
})();

/* ====== Compatibility wrappers (optional) ====== */
window.refreshReportDashboard = async function () {
  if (window.ReportsDashboard && typeof window.ReportsDashboard.refresh === "function") {
    await window.ReportsDashboard.refresh();
  }
};
window.refreshReportCharts = function () {
  if (window.ReportsDashboard && typeof window.ReportsDashboard.reflow === "function") {
    window.ReportsDashboard.reflow();
  }
};
window.resizeReportCharts = window.refreshReportCharts;
