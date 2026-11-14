/** Income & Expense backend — minimal, robust CORS + POST parsing (JSON or form-encoded) */

const SPREADSHEET_ID = "1yN6r7Ypi0soIuuqelJoVsBkGat-NGHFmF8ZCXZUUgKw";
const SETUP_SHEET = "Setup";
const TX_SHEET = "Transactions";
const TIMEZONE = "Asia/Kolkata";

/* -------------------- Preflight -------------------- */
function doOptions(e) {
  // Respond to preflight. Browsers will accept this.
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/* -------------------- GET -------------------- */
function doGet(e) {
  const action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
  try {
    if (action === "getSetup") return jsonResponse(getSetup());
    if (action === "listTransactions") return jsonResponse(listTransactions());
    if (action === "getTransaction") return jsonResponse(getTransaction(e.parameter.row));
    if (action === "reportMonthly") return jsonResponse(reportMonthly(e.parameter));
    if (action === "reportAnnual") return jsonResponse(reportAnnual(e.parameter));
    if (action === "getAccounts") return jsonResponse(getAccounts());
    return jsonResponse({ error: "unknown action" });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/* -------------------- POST -------------------- */
function doPost(e) {
  // parse payload that supports JSON or application/x-www-form-urlencoded
  const action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
  let payload = {};

  if (e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    const contentType = (e.postData.type || "").toLowerCase();

    // prefer JSON
    if (contentType.indexOf('application/json') !== -1) {
      try { payload = JSON.parse(raw); } catch (err) { payload = {}; }
    } else {
      // parse form-encoded or fallback
      try {
        // If Apps Script already parsed e.parameter, merge those first
        payload = Object.assign({}, e.parameter || {});
      } catch (e1) { payload = {}; }

      // raw might be key=value&...
      if (raw && raw.indexOf('=') !== -1) {
        raw.split('&').forEach(kv => {
          if (!kv) return;
          const parts = kv.split('=');
          const key = decodeURIComponent(parts.shift().replace(/\+/g, ' '));
          const val = decodeURIComponent((parts.join('=') || '').replace(/\+/g, ' '));
          payload[key] = val;
        });
      }
    }
  } else {
    // fallback: use e.parameter
    payload = (e.parameter || {});
  }

  try {
    let out;
    if (action === "addTransaction") out = addTransaction(payload);
    else if (action === "updateTransaction") out = updateTransaction(payload);
    else if (action === "deleteTransaction") out = deleteTransaction(payload);
    else if (action === "setCurrency") out = setCurrency(payload.currency || payload);
    else if (action === "addCategory") out = addCategory(payload.type, payload.value);
    else if (action === "removeCategory")
      out = removeCategory(payload.type, { index: payload.index, name: payload.name });
    else out = { error: "unknown action" };
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function handleGetTransaction(e) {
  const row = parseInt(e.parameter.row, 10);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!row || row <= 1 || row > sheet.getLastRow()) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid row' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = {
    type: data[0] || '',
    date: data[1] || '',
    category: data[2] || '',
    account: data[3] || '',
    amount: data[4] || '',
    desc: data[5] || ''
  };
  return ContentService.createTextOutput(JSON.stringify({ row, rowData }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------- Helper to return JSON -------------------- */
function jsonResponse(obj) {
  // NOTE: Apps Script/TextOutput doesn't give us a direct .setHeader() API for CORS.
  // If the webapp is deployed "Anyone, even anonymous" the browser will accept responses.
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------- Setup Sheet Helpers -------------------- */
function getSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let sh = ss.getSheetByName(SETUP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SETUP_SHEET);
    sh.getRange("A1").setValue("Currency");
    sh.getRange("A2").setValue("₹");
    sh.getRange("A3").setValue("Qnet Business");
    sh.getRange("A4").setValue("E-Commerce");
  }

  const currency = (sh.getRange("A2").getValue() || "").toString();
  const lastRow = Math.max(sh.getLastRow(), 3);
  const raw = sh.getRange(3, 1, Math.max(1, lastRow - 2), 3).getValues();
  const incomeCategories = raw.map(r => r[0]).filter(Boolean);
  const expenseCategories = raw.map(r => r[1]).filter(Boolean);
  const accounts = raw.map(r => r[2]).filter(Boolean);

  // ✅ Fetch balances from Accounts sheet
  const accSheet = ensureAccountsSheet();
  const accData = accSheet.getDataRange().getValues();
  const accountBalances = accData.slice(1)
    .filter(r => r[0])
    .map(r => ({
      name: r[0],
      balance: r[1]
    }));

  return { currency, incomeCategories, expenseCategories, accounts, accountBalances };
}

function setCurrency(cur) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SETUP_SHEET);
  if (!sh) sh = ss.insertSheet(SETUP_SHEET);
  sh.getRange("A2").setValue(cur);
  return { status: "ok", currency: cur };
}

function addCategory(type, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SETUP_SHEET);
  if (!sh) sh = ss.insertSheet(SETUP_SHEET);
  if (sh.getLastRow() < 3) sh.insertRows(3);
  const col = (type === "income") ? 1 : (type === "expense" ? 2 : 3);
  let r = 3;
  while (sh.getRange(r, col).getValue()) r++;
  sh.getRange(r, col).setValue(value);
  return { status: "ok", type, value };
}

function removeCategory(type, payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SETUP_SHEET);
  if (!sh) return { error: "setup sheet not found" };

  const col = (type === "income") ? 1 : (type === "expense" ? 2 : 3);
  const lastRow = sh.getLastRow();
  const values = sh
    .getRange(3, col, Math.max(1, lastRow - 2), 1)
    .getValues()
    .map(r => (r[0] || "").toString().trim().replace(/\s+/g, " "));

  let targetRow = null;
  let targetName = null;

  if (payload && typeof payload === "object") {
    if (payload.name) {
      targetName = payload.name.toString().trim().replace(/\s+/g, " ").toLowerCase();
    } else if (payload.index != null) {
      targetRow = 3 + Number(payload.index);
    }
  } else if (typeof payload === "string") {
    targetName = payload.trim().replace(/\s+/g, " ").toLowerCase();
  } else if (!isNaN(Number(payload))) {
    targetRow = 3 + Number(payload);
  }

  if (targetName) {
    const idx = values.findIndex(v => v.toLowerCase() === targetName);
    if (idx !== -1) targetRow = 3 + idx;
  }

  if (!targetRow) {
    return { error: "category not found", list: values };
  }

  sh.getRange(targetRow, col).clearContent();
  return { status: "ok", removedRow: targetRow, type, list: values };
}

/* -------------------- Transactions -------------------- */
function ensureTxSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(TX_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TX_SHEET);
    sh.appendRow(["Timestamp", "Date", "Type", "Category", "Amount", "Account", "Description"]);
  }
  return sh;
}

/* -------------------- Transactions -------------------- */
function ensureAccountsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName("Accounts");
  if (!sh) {
    sh = ss.insertSheet("Accounts");
    sh.appendRow(["Account Name", "Balance"]);
  }
  return sh;
}

function updateAccountBalance(accountName, amount, type) {
  if (!accountName) return;
  const sh = ensureAccountsSheet();
  const data = sh.getDataRange().getValues();

  const normalizedName = accountName.toString().trim().toLowerCase();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    const existingName = (data[i][0] || "").toString().trim().toLowerCase();
    if (existingName === normalizedName) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    // No match → create new account
    const initialBalance = (type === "income") ? amount : -amount;
    sh.appendRow([accountName.trim(), initialBalance]);
  } else {
    // Found → update balance
    const currentBalance = Number(sh.getRange(rowIndex, 2).getValue()) || 0;
    const newBalance = (type === "income") 
      ? currentBalance + amount 
      : currentBalance - amount;
    sh.getRange(rowIndex, 2).setValue(newBalance);
  }
}


function addTransaction(obj) {
  const sh = ensureTxSheet();
  const timestamp = new Date();
  const date = obj.date || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const type = (obj.type || "income").toString().toLowerCase();
  // support both 'desc' and 'description' sent from client
  const category = obj.category || obj.cat || "";
  const amount = Number(obj.amount || obj.amt || 0);
  const account = obj.account || obj.acc || "";
  const desc = obj.desc || obj.description || "";
  sh.appendRow([timestamp, date, type, category, amount, account, desc]);
  updateAccountBalance(account, amount, type);
  return { status: "ok" };
}

function listTransactions() {
  const sh = ensureTxSheet();
  const data = sh.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    rows.push({
      row: i + 1,
      timestamp: r[0],
      date: r[1],
      type: r[2],
      category: r[3],
      amount: r[4],
      account: r[5],
      desc: r[6]
    });
  }
  return { rows };
}

function getTransaction(row) {
  row = parseInt(row, 10);
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TX_SHEET);

  if (!row || row <= 1 || row > sheet.getLastRow()) {
    return { error: 'Invalid row' };
  }

  // Get exactly 7 columns
  const data = sheet.getRange(row, 1, 1, 7).getValues()[0];

  Logger.log('Raw row data: ' + JSON.stringify(data));

  const rowData = {
    timestamp: data[0] || '',
    date: data[1] ? Utilities.formatDate(new Date(data[1]), Session.getScriptTimeZone(), "yyyy-MM-dd") : '',
    type: (data[2] || '').toString().trim(),
    category: (data[3] || '').toString().trim(),
    amount: data[4] || '',
    account: (data[5] || '').toString().trim(),
    desc: (data[6] || '').toString().trim()
  };

  Logger.log('Processed rowData: ' + JSON.stringify(rowData));

  return { row: row, rowData: rowData };
}

function updateTransaction(payload) {
  const sh = ensureTxSheet();
  const row = Number(payload.row);
  if (!row || row <= 1) return { error: "invalid row" };
  const date = payload.date || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const type = (payload.type || "income").toString().toLowerCase();
  const category = payload.category || "";
  const amount = Number(payload.amount || 0);
  const account = payload.account || "";
  const desc = payload.desc || "";
  sh.getRange(row, 2, 1, 6).setValues([[date, type, category, amount, account, desc]]);
  return { status: "ok" };
}

function deleteTransaction(payload) {
  const sh = ensureTxSheet();
  const row = Number(payload.row);
  if (!row || row <= 1) return { error: "invalid row" };
  sh.deleteRow(row);
  return { status: "ok" };
}

/* -------------------- Reporting -------------------- */
function reportMonthly(params) {
  const month = Number(params.month) || (new Date()).getMonth() + 1;
  const year = Number(params.year) || (new Date()).getFullYear();
  const sh = ensureTxSheet();
  const data = sh.getDataRange().getValues().slice(1);
  const categories = {};
  let incomeTotal = 0, expenseTotal = 0;
  const topAgg = {};

  data.forEach(r => {
    const dateVal = r[1];
    if (!dateVal) return;
    const d = new Date(dateVal);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    if (m !== month || y !== year) return;
    const type = (r[2] || "").toString().toLowerCase();
    const cat = r[3] || "Uncategorized";
    const amt = Number(r[4]) || 0;
    if (!categories[cat]) categories[cat] = { income: 0, expense: 0 };
    if (type === "income") { categories[cat].income += amt; incomeTotal += amt; }
    else { categories[cat].expense += amt; expenseTotal += amt; }
    topAgg[cat] = (topAgg[cat] || 0) + amt;
  });

  const topCategories = Object.keys(topAgg).map(k => ({ category: k, total: topAgg[k] }))
    .sort((a, b) => b.total - a.total).slice(0, 20);

  return {
    categories,
    monthlyTotals: { income: incomeTotal, expense: expenseTotal },
    topCategories
  };
}

function reportAnnual(params) {
  const year = Number(params.year) || (new Date()).getFullYear();
  const sh = ensureTxSheet();
  const data = sh.getDataRange().getValues().slice(1);

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
  const categories = {};
  const topAgg = {};
  const accountBalances = {};

  data.forEach(r => {
    const dateVal = r[1];
    if (!dateVal) return;
    const d = new Date(dateVal);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    if (y !== year) return;
    const type = (r[2] || "").toString().toLowerCase();
    const cat = r[3] || "Uncategorized";
    const amt = Number(r[4]) || 0;
    const account = r[5] || "Unknown";

    if (!categories[cat]) categories[cat] = { total: 0, monthly: Array(12).fill(0) };
    if (type === "income") {
      monthlyTotals[m - 1].income += amt;
      categories[cat].monthly[m - 1] += amt;
      categories[cat].total += amt;
      topAgg[cat] = (topAgg[cat] || 0) + amt;
      accountBalances[account] = (accountBalances[account] || 0) + amt;
    } else {
      monthlyTotals[m - 1].expense += amt;
      categories[cat].monthly[m - 1] -= amt;
      categories[cat].total -= amt;
      topAgg[cat] = (topAgg[cat] || 0) + amt;
      accountBalances[account] = (accountBalances[account] || 0) - amt;
    }
  });

  const topCategories = Object.keys(topAgg).map(k => ({ category: k, total: topAgg[k] }))
    .sort((a, b) => b.total - a.total).slice(0, 20);

  const incomeRow = { label: "Income", total: 0, monthly: monthlyTotals.map(m => m.income) };
  const expenseRow = { label: "Expense", total: 0, monthly: monthlyTotals.map(m => m.expense) };
  incomeRow.total = incomeRow.monthly.reduce((s, v) => s + v, 0);
  expenseRow.total = expenseRow.monthly.reduce((s, v) => s + v, 0);

  const categorySummary = Object.keys(categories).map(cat => {
    const monthly = categories[cat].monthly;
    const total = monthly.reduce((s, v) => s + v, 0);
    const avg = monthly.reduce((s, v) => s + Math.abs(v), 0) / 12;
    return { category: cat, total, average: avg, monthly };
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  return {
    year,
    monthlyTotals,
    incomeRow,
    expenseRow,
    categorySummary,
    topCategories,
    accountBalances
  };
}

function ensureAccountsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName("Accounts");
  if (!sh) {
    sh = ss.insertSheet("Accounts");
    sh.appendRow(["Account Name", "Balance"]);
  }
  return sh;
}


function getAccounts() {
  const sh = ensureAccountsSheet();
  const data = sh.getDataRange().getValues();
  const accounts = [];
  for (let i = 1; i < data.length; i++) {
    accounts.push({
      name: data[i][0],
      balance: data[i][1]
    });
  }
  return { accounts };
}
