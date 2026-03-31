/* ============================================================
   Invoice2Excel Pro — Generator Step 1 Logic
   Invoice Details, Items Table, Calculations
   ============================================================ */

'use strict';

/* ---- Shared state ---- */
const GEN = {
  currentStep: 1,
  invoiceData: {},
  items: [],
  logo: null,
  signature: null,
  currency: '₹',
  isPremium: false,
  autosaveTimer: null,
  lastSaved: null,
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initGenerator();
});

function initGenerator() {
  GEN.isPremium = localStorage.getItem('inv2xl_premium') === 'true';

  // Set defaults
  const today = new Date();
  document.getElementById('inv-date').value = toDateInput(today);
  const due = new Date(today); due.setDate(due.getDate() + 15);
  document.getElementById('inv-due-date').value = toDateInput(due);

  autoGenInvNum();
  addItemRow();
  addItemRow();

  // Load draft (async — Supabase cloud or localStorage)
  loadDraft();

  // Autosave every 30 seconds
  GEN.autosaveTimer = setInterval(() => saveDraft(true), 30000);

  // Update currency to match country
  updateCurrency();
  updateCounts();

  // Sync auth UI from localStorage / Supabase session
  syncGenAuthUI();
}

/* Sync generator header avatar from current session */
function syncGenAuthUI() {
  const raw = localStorage.getItem('inv2xl_user');
  if (!raw) return;
  try {
    const user = JSON.parse(raw);
    const wrap   = document.getElementById('gen-user-avatar-wrap');
    const avatar = document.getElementById('gen-user-avatar');
    if (!wrap || !avatar) return;
    wrap.classList.remove('hidden');
    if (user.avatar) {
      avatar.innerHTML = `<img src="${user.avatar}" class="w-full h-full object-cover" alt="${user.name}" onerror="this.parentElement.textContent='${(user.name||'U').charAt(0).toUpperCase()}'" />`;
    } else {
      avatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
    }
    avatar.title = user.name || 'My Account';
  } catch(e) {}
}

/* Called by supabase.js when session changes */
function onAuthChange(user) {
  if (user) syncGenAuthUI();
}

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   INVOICE NUMBER AUTO GENERATE
   ============================================================ */
function autoGenInvNum() {
  const saved = localStorage.getItem('inv2xl_inv_counter');
  const counter = (parseInt(saved) || 0) + 1;
  localStorage.setItem('inv2xl_inv_counter', counter);
  const y = new Date().getFullYear();
  document.getElementById('inv-number').value = `INV-${y}-${String(counter).padStart(4,'0')}`;
}

/* ============================================================
   DUE DATE TOGGLE
   ============================================================ */
function toggleDueDate() {
  const cb = document.getElementById('due-date-toggle');
  const inp = document.getElementById('inv-due-date');
  inp.disabled = !cb.checked;
  if (cb.checked) inp.focus();
}

/* ============================================================
   OPTIONAL FIELDS TOGGLE
   ============================================================ */
function toggleOptField(prefix, field) {
  const wrap = document.getElementById(`${prefix}-${field}-wrap`);
  if (!wrap) return;
  const isHidden = wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden', !isHidden);
  if (isHidden) {
    const inp = wrap.querySelector('input');
    if (inp) inp.focus();
  }
}

/* ============================================================
   CURRENCY UPDATE
   ============================================================ */
function updateCurrency() {
  const country = document.getElementById('biz-country').value;
  const map = { India:'₹', USA:'$', UK:'£', EU:'€', Australia:'A$', Canada:'C$' };
  GEN.currency = map[country] || '₹';
  recalcTotals();
}

/* ============================================================
   LOGO UPLOAD
   ============================================================ */
function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    GEN.logo = e.target.result;
    const img = document.getElementById('logo-preview-img');
    const ph = document.getElementById('logo-placeholder');
    img.src = GEN.logo;
    img.classList.remove('hidden');
    ph.classList.add('hidden');
    if (typeof updatePreview === 'function') updatePreview();
    showToastGen('Logo uploaded!', 'success');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  GEN.logo = null;
  const img = document.getElementById('logo-preview-img');
  const ph = document.getElementById('logo-placeholder');
  img.src = ''; img.classList.add('hidden');
  ph.classList.remove('hidden');
  document.getElementById('logo-input').value = '';
  if (typeof updatePreview === 'function') updatePreview();
}

/* ============================================================
   SIGNATURE UPLOAD
   ============================================================ */
function handleSigUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    GEN.signature = e.target.result;
    const img = document.getElementById('sig-preview');
    const ph = document.getElementById('sig-placeholder');
    img.src = GEN.signature;
    img.classList.remove('hidden');
    ph.classList.add('hidden');
    if (typeof updatePreview === 'function') updatePreview();
  };
  reader.readAsDataURL(file);
}

/* ============================================================
   SECTION TOGGLES
   ============================================================ */
function toggleSection(id) {
  const bodyMap = {
    terms: 'terms-body', notes: 'notes-body',
    sig: 'sig-body', addinfo: 'addinfo-body',
  };
  const cb = document.getElementById(`${id}-toggle`);
  const body = document.getElementById(bodyMap[id]);
  if (!body) return;
  if (cb.checked) {
    body.classList.remove('hidden');
    body.style.animation = 'slideDown 0.25s ease both';
  } else {
    body.classList.add('hidden');
  }
  if (typeof updatePreview === 'function') updatePreview();
}

/* ============================================================
   TABLE COLUMN TOGGLES
   ============================================================ */
function toggleTableCol(col) {
  const els = document.querySelectorAll(`.col-${col}`);
  const cb = document.getElementById(`show-${col}`);
  els.forEach(el => el.classList.toggle('hidden', !cb.checked));
  recalcTotals();
}

/* ============================================================
   ITEM ROW MANAGEMENT
   ============================================================ */
let rowIdCounter = 0;

function addItemRow() {
  rowIdCounter++;
  const id = rowIdCounter;
  GEN.items.push({ id, name: '', hsn: '', gst: 18, qty: 1, rate: 0, disc: 0, amount: 0, description: '' });
  renderItemRow(id);
  updateCounts();
  recalcTotals();
}

function renderItemRow(id) {
  const tbody = document.getElementById('items-gen-tbody');
  const item = GEN.items.find(i => i.id === id);
  if (!item) return;

  const showHsn = document.getElementById('show-hsn').checked;
  const showGst = document.getElementById('show-gst').checked;
  const showDisc = document.getElementById('show-disc').checked;

  const tr = document.createElement('tr');
  tr.className = 'item-row';
  tr.id = `item-row-${id}`;

  const idx = GEN.items.findIndex(i => i.id === id) + 1;

  tr.innerHTML = `
    <td class="gen-th text-center">${idx}</td>
    <td class="p-1">
      <div class="flex items-center gap-1">
        <input type="text" class="item-input flex-1" placeholder="Item name..." value="${escapeAttr(item.name)}"
          oninput="updateItem(${id},'name',this.value)" />
        <button class="item-desc-btn text-slate-300 hover:text-primary transition-colors text-xs px-1" title="Add description"
          onclick="toggleDescRow(${id})"><i class="fas fa-align-left"></i></button>
      </div>
    </td>
    <td class="p-1 col-hsn ${showHsn?'':'hidden'}">
      <input type="text" class="item-input center" placeholder="0000" value="${escapeAttr(item.hsn)}"
        oninput="updateItem(${id},'hsn',this.value)" style="width:64px" />
    </td>
    <td class="p-1 col-gst ${showGst?'':'hidden'}">
      <select class="item-input center" style="width:72px" onchange="updateItem(${id},'gst',this.value)">
        ${[0,5,9,12,18,28].map(r=>`<option value="${r}" ${item.gst==r?'selected':''}>${r}%</option>`).join('')}
      </select>
    </td>
    <td class="p-1">
      <input type="number" class="item-input center" placeholder="1" value="${item.qty}" min="0" step="0.01"
        oninput="updateItem(${id},'qty',this.value)" style="width:52px" />
    </td>
    <td class="p-1">
      <input type="number" class="item-input right" placeholder="0.00" value="${item.rate}" min="0" step="0.01"
        oninput="updateItem(${id},'rate',this.value)" style="width:80px" />
    </td>
    <td class="p-1 col-disc ${showDisc?'':'hidden'}">
      <input type="number" class="item-input center" placeholder="0" value="${item.disc}" min="0" max="100" step="0.1"
        oninput="updateItem(${id},'disc',this.value)" style="width:52px" />
    </td>
    <td class="p-1">
      <div class="item-amount" id="item-amount-${id}">${GEN.currency}0</div>
    </td>
    <td class="p-1 text-center">
      <button class="item-del-btn" onclick="deleteItemRow(${id})"><i class="fas fa-trash"></i></button>
    </td>
  `;

  tbody.appendChild(tr);

  // Description row (initially hidden)
  const descTr = document.createElement('tr');
  descTr.className = 'item-desc-row hidden';
  descTr.id = `item-desc-${id}`;
  descTr.innerHTML = `
    <td colspan="9" class="px-3 pb-1.5">
      <textarea class="item-desc-input w-full" rows="2" placeholder="Item description (optional)..."
        oninput="updateItem(${id},'description',this.value)">${escapeAttr(item.description)}</textarea>
    </td>
  `;
  tbody.appendChild(descTr);
}

function toggleDescRow(id) {
  const row = document.getElementById(`item-desc-${id}`);
  if (row) row.classList.toggle('hidden');
}

function deleteItemRow(id) {
  GEN.items = GEN.items.filter(i => i.id !== id);
  const row = document.getElementById(`item-row-${id}`);
  const descRow = document.getElementById(`item-desc-${id}`);
  if (row) row.remove();
  if (descRow) descRow.remove();
  // Renumber
  GEN.items.forEach((item, idx) => {
    const r = document.getElementById(`item-row-${item.id}`);
    if (r) r.cells[0].textContent = idx + 1;
  });
  updateCounts();
  recalcTotals();
}

function updateItem(id, field, value) {
  const item = GEN.items.find(i => i.id === id);
  if (!item) return;
  if (field === 'qty' || field === 'rate' || field === 'gst' || field === 'disc') {
    item[field] = parseFloat(value) || 0;
  } else {
    item[field] = value;
  }
  calcItemAmount(item);
  const amountEl = document.getElementById(`item-amount-${id}`);
  if (amountEl) amountEl.textContent = formatAmt(item.amount);
  recalcTotals();
}

function calcItemAmount(item) {
  const base = item.qty * item.rate;
  const disc = item.disc > 0 ? base * (item.disc / 100) : 0;
  item.amount = base - disc;
}

function updateCounts() {
  const el = document.getElementById('item-row-count');
  if (el) el.textContent = GEN.items.length;
}

/* ============================================================
   CALCULATIONS ENGINE
   ============================================================ */
function recalcTotals() {
  const sym = GEN.currency;
  const items = GEN.items;

  // Subtotal
  const subtotal = items.reduce((s, i) => {
    calcItemAmount(i);
    return s + i.amount;
  }, 0);

  // Invoice-level discount
  const discType = document.getElementById('disc-type').value;
  const discVal = parseFloat(document.getElementById('disc-value').value) || 0;
  const discAmount = discType === 'pct' ? subtotal * discVal / 100 : discVal;

  const taxable = Math.max(0, subtotal - discAmount);

  // GST (split CGST + SGST for domestic, IGST for interstate)
  // Determine if same state (simplified: always split for now)
  const gstGrouped = {};
  items.forEach(item => {
    const rate = item.gst;
    if (!gstGrouped[rate]) gstGrouped[rate] = 0;
    const itemTaxable = item.amount * (1 - discAmount / (subtotal || 1));
    gstGrouped[rate] += itemTaxable;
  });

  let totalCGST = 0, totalSGST = 0, totalIGST = 0;
  const showGst = document.getElementById('show-gst').checked;
  if (showGst) {
    Object.entries(gstGrouped).forEach(([rate, base]) => {
      const r = parseFloat(rate);
      if (r > 0) {
        totalCGST += base * (r / 2) / 100;
        totalSGST += base * (r / 2) / 100;
        totalIGST += base * r / 100;
      }
    });
  }

  // Extra charge
  const extraLabel = document.getElementById('extra-charge-label').value;
  const extraVal = parseFloat(document.getElementById('extra-charge-value').value) || 0;

  let grandTotal = taxable + totalCGST + totalSGST + extraVal;

  // Round off
  const roundOff = document.getElementById('round-off-toggle').checked;
  let roundOffAmt = 0;
  if (roundOff) {
    const rounded = Math.round(grandTotal);
    roundOffAmt = rounded - grandTotal;
    grandTotal = rounded;
  }

  // Update UI
  setTotal('total-subtotal', subtotal);
  setTotal('total-disc-val', -discAmount, true);
  setTotal('total-taxable', taxable);
  setTotal('total-cgst', totalCGST);
  setTotal('total-sgst', totalSGST);
  setTotal('total-igst', totalIGST);
  setTotal('total-extra-val', extraVal);
  setTotal('total-roundoff', roundOffAmt);
  setTotal('total-grand', grandTotal);

  // Show/hide rows
  toggleRow('total-disc-row', discAmount > 0);
  toggleRow('total-taxable-row', discAmount > 0 || showGst);
  toggleRow('total-cgst-row', totalCGST > 0 && showGst);
  toggleRow('total-sgst-row', totalSGST > 0 && showGst);
  toggleRow('total-igst-row', false); // show CGST+SGST by default
  toggleRow('total-extra-row', extraVal > 0);
  toggleRow('total-roundoff-row', roundOff && roundOffAmt !== 0);

  // Extra label
  if (extraLabel) {
    const el = document.getElementById('total-extra-label');
    if (el) el.textContent = extraLabel;
  }

  // Total in words
  const words = numberToWords(Math.round(grandTotal));
  const wordsEl = document.getElementById('total-in-words');
  if (wordsEl) wordsEl.textContent = words ? `${words} Only` : '';

  // Update item amounts display
  GEN.items.forEach(item => {
    const el = document.getElementById(`item-amount-${item.id}`);
    if (el) el.textContent = formatAmt(item.amount);
  });

  // Store totals for template use
  GEN.totals = { subtotal, discAmount, taxable, cgst: totalCGST, sgst: totalSGST, igst: totalIGST, extra: extraVal, extraLabel, roundOff: roundOffAmt, grandTotal };

  // Trigger preview update if on step 3
  if (GEN.currentStep === 3 && typeof updatePreview === 'function') {
    updatePreview();
  }
}

function setTotal(id, val, isNeg = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const formatted = formatAmt(Math.abs(val));
  el.textContent = isNeg && val < 0 ? `-${formatted}` : formatted;
}

function toggleRow(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', !show);
}

function formatAmt(num) {
  if (isNaN(num)) return GEN.currency + '0';
  return GEN.currency + Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================================
   CUSTOM FIELDS
   ============================================================ */
let customFieldCount = 0;

function addCustomField() {
  customFieldCount++;
  const container = document.getElementById('custom-fields-container');
  container.classList.remove('hidden');
  const div = document.createElement('div');
  div.className = 'grid grid-cols-2 gap-2 items-end';
  div.id = `custom-field-${customFieldCount}`;
  div.innerHTML = `
    <div class="gen-field">
      <label class="gen-label">Field Label</label>
      <input type="text" class="gen-input" placeholder="e.g. PO Number" id="cf-label-${customFieldCount}" />
    </div>
    <div class="gen-field">
      <label class="gen-label">Value</label>
      <div class="flex gap-1">
        <input type="text" class="gen-input flex-1" placeholder="Value" id="cf-value-${customFieldCount}" />
        <button onclick="document.getElementById('custom-field-${customFieldCount}').remove()" class="text-danger text-xs p-2 hover:bg-red-50 rounded-lg transition-colors"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `;
  container.appendChild(div);
  showToastGen('Custom field added', 'success');
}

/* ============================================================
   STEP NAVIGATION
   ============================================================ */
function goToStep(step) {
  if (step > 1 && !validateStep1()) return;

  GEN.currentStep = step;

  // Panel visibility
  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`step-panel-${i}`);
    if (panel) {
      panel.classList.toggle('active', i === step);
      panel.classList.toggle('hidden', i !== step);
    }
    // Stepper UI
    const s = document.getElementById(`stepper-${i}`);
    if (s) {
      s.classList.remove('active', 'done');
      if (i < step) s.classList.add('done');
      else if (i === step) s.classList.add('active');
    }
    // Lines
    if (i < 3) {
      const line = document.getElementById(`line-${i}-${i+1}`);
      if (line) {
        line.classList.remove('done', 'active');
        if (i < step) line.classList.add('done');
        else if (i === step) line.classList.add('active');
      }
    }
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // If step 3, render templates + preview
  if (step === 3) {
    setTimeout(() => {
      if (typeof initStep3 === 'function') initStep3();
    }, 100);
  }
}

function validateStep1() {
  const bizName = document.getElementById('biz-name').value.trim();
  const clientName = document.getElementById('client-name').value.trim();
  const invNum = document.getElementById('inv-number').value.trim();

  if (!invNum) {
    showToastGen('Please enter an Invoice Number', 'error');
    document.getElementById('inv-number').focus();
    return false;
  }
  if (!bizName) {
    showToastGen('Please enter your Business Name', 'error');
    document.getElementById('biz-name').focus();
    return false;
  }
  if (!clientName) {
    showToastGen('Please enter the Client Name', 'error');
    document.getElementById('client-name').focus();
    return false;
  }
  if (GEN.items.length === 0) {
    showToastGen('Please add at least one line item', 'error');
    return false;
  }
  return true;
}

/* ============================================================
   COLLECT FORM DATA
   ============================================================ */
function collectInvoiceData() {
  const getValue = (id) => (document.getElementById(id) || {}).value || '';
  const getChecked = (id) => (document.getElementById(id) || {}).checked || false;

  // Custom fields
  const customFields = [];
  for (let i = 1; i <= customFieldCount; i++) {
    const label = getValue(`cf-label-${i}`);
    const value = getValue(`cf-value-${i}`);
    if (label && value) customFields.push({ label, value });
  }

  return {
    invoiceNumber: getValue('inv-number'),
    invoiceType: getValue('inv-type'),
    invoiceDate: getValue('inv-date'),
    dueDate: getChecked('due-date-toggle') ? getValue('inv-due-date') : '',
    customFields,
    business: {
      name: getValue('biz-name'),
      country: getValue('biz-country'),
      phone: getValue('biz-phone'),
      address: getValue('biz-address'),
      city: getValue('biz-city'),
      state: getValue('biz-state'),
      pin: getValue('biz-pin'),
      email: getValue('biz-email'),
      gstin: getValue('biz-gstin'),
      pan: getValue('biz-pan'),
    },
    client: {
      name: getValue('client-name'),
      country: getValue('client-country'),
      phone: getValue('client-phone'),
      address: getValue('client-address'),
      city: getValue('client-city'),
      state: getValue('client-state'),
      pin: getValue('client-pin'),
      email: getValue('client-email'),
      gstin: getValue('client-gstin'),
      pan: getValue('client-pan'),
    },
    items: GEN.items.map(i => ({ ...i })),
    totals: { ...GEN.totals },
    terms: getChecked('terms-toggle') ? getValue('terms-text') : '',
    notes: getChecked('notes-toggle') ? getValue('notes-text') : '',
    signature: getChecked('sig-toggle') ? { name: getValue('sig-name'), image: GEN.signature } : null,
    additionalInfo: getChecked('addinfo-toggle') ? {
      irn: getValue('addinfo-irn'),
      eway: getValue('addinfo-eway'),
      pos: getValue('addinfo-pos'),
    } : null,
    logo: GEN.logo,
    currency: GEN.currency,
    bank: collectBankData(),
    upi: collectUpiData(),
  };
}

/* ============================================================
   DRAFT SAVE / LOAD  (Supabase cloud + localStorage fallback)
   ============================================================ */
async function saveDraft(silent = false) {
  try {
    const data = collectInvoiceData();
    const draft = { ...data, savedAt: new Date().toISOString() };

    // Always save to localStorage as immediate fallback
    localStorage.setItem('inv2xl_gen_draft', JSON.stringify(draft));
    GEN.lastSaved = new Date();

    // Also push to Supabase if available
    if (typeof saveDraftToSupabase === 'function') {
      saveDraftToSupabase(draft).catch(() => {}); // fire-and-forget
    }

    if (!silent) showToastGen('Draft saved ☁️', 'success');
  } catch (e) {
    if (!silent) showToastGen('Could not save draft', 'error');
  }
}

async function loadDraft() {
  try {
    // Try Supabase first, fall back to localStorage
    let data = null;
    if (typeof getDraftFromSupabase === 'function') {
      const sbDraft = await getDraftFromSupabase();
      if (sbDraft) {
        data = sbDraft.draft_data || sbDraft;
      }
    }
    if (!data) {
      const raw = localStorage.getItem('inv2xl_gen_draft');
      if (!raw) return;
      data = JSON.parse(raw);
    }

    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

    setVal('inv-number', data.invoiceNumber);
    setVal('inv-type', data.invoiceType);
    setVal('inv-date', data.invoiceDate);
    setVal('inv-due-date', data.dueDate);

    if (data.business) {
      Object.entries(data.business).forEach(([k, v]) => setVal(`biz-${k.replace(/([A-Z])/g,'-$1').toLowerCase()}`, v));
    }
    if (data.client) {
      Object.entries(data.client).forEach(([k, v]) => setVal(`client-${k.replace(/([A-Z])/g,'-$1').toLowerCase()}`, v));
    }

    // Restore items
    if (data.items && data.items.length > 0) {
      GEN.items = [];
      document.getElementById('items-gen-tbody').innerHTML = '';
      rowIdCounter = 0;
      data.items.forEach(item => {
        rowIdCounter++;
        item.id = rowIdCounter;
        GEN.items.push(item);
        renderItemRow(item.id);
        // Restore values
        const row = document.getElementById(`item-row-${item.id}`);
        if (row) {
          const inputs = row.querySelectorAll('input, select');
          // inputs are already pre-filled via renderItemRow
        }
      });
      updateCounts();
      recalcTotals();
    }

    if (data.logo) {
      GEN.logo = data.logo;
      const img = document.getElementById('logo-preview-img');
      const ph = document.getElementById('logo-placeholder');
      if (img && ph) {
        img.src = data.logo; img.classList.remove('hidden'); ph.classList.add('hidden');
      }
    }

    setVal('terms-text', data.terms);
    setVal('notes-text', data.notes);

    showToastGen('Draft restored', 'info');
  } catch (e) {
    // Silently fail
  }
}

/* ============================================================
   NEW INVOICE
   ============================================================ */
function newInvoice() {
  if (!confirm('Start a new invoice? Unsaved changes will be lost.')) return;
  localStorage.removeItem('inv2xl_gen_draft');
  location.reload();
}

/* ============================================================
   NUMBER TO WORDS
   ============================================================ */
function numberToWords(num) {
  if (isNaN(num) || num < 0) return '';
  if (num === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function words(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + words(n%100) : '');
    if (n < 100000) return words(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + words(n%1000) : '');
    if (n < 10000000) return words(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + words(n%100000) : '');
    return words(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + words(n%10000000) : '');
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = words(intPart);
  if (GEN.currency === '₹') {
    result += ' Rupees';
    if (decPart > 0) result += ' and ' + words(decPart) + ' Paise';
  }
  return result;
}

/* ============================================================
   TOAST (shared across all steps)
   ============================================================ */
function showToastGen(msg, type = 'info') {
  const container = document.getElementById('gen-toast-container');
  if (!container) return;
  const icons = { success:'fa-check', error:'fa-exclamation-circle', info:'fa-info', warning:'fa-exclamation-triangle' };
  const div = document.createElement('div');
  div.className = `gen-toast ${type}`;
  div.innerHTML = `<i class="fas ${icons[type]||'fa-info'} text-sm" style="color:${type==='success'?'#059669':type==='error'?'#DC2626':type==='warning'?'#D97706':'#2563EB'}"></i><span>${escapeHtmlG(msg)}</span>`;
  container.appendChild(div);
  setTimeout(() => { div.classList.add('hide'); setTimeout(() => div.remove(), 300); }, 3500);
}

/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtmlG(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(s) {
  return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function openPricingModal() {
  document.getElementById('gen-pricing-modal').classList.remove('hidden');
}
function closePricingModal() {
  document.getElementById('gen-pricing-modal').classList.add('hidden');
}
function requirePro() {
  openPricingModal();
  showToastGen('This feature requires a Pro subscription', 'warning');
}

// Format date for display
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return dateStr; }
}

console.log('[Generator Step 1] Loaded');
