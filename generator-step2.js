/* ============================================================
   Invoice2Excel Pro — Generator Step 2 Logic
   Bank & UPI Details
   ============================================================ */

'use strict';

/* ============================================================
   BANK SECTION TOGGLE
   ============================================================ */
function toggleBankSection() {
  const cb = document.getElementById('bank-enable');
  const body = document.getElementById('bank-body');
  const msg = document.getElementById('bank-disabled-msg');
  if (cb.checked) {
    body.classList.remove('hidden');
    body.style.animation = 'slideDown 0.25s ease both';
    msg.classList.add('hidden');
    document.getElementById('bank-holder').focus();
  } else {
    body.classList.add('hidden');
    msg.classList.remove('hidden');
  }
}

/* ============================================================
   UPI SECTION TOGGLE
   ============================================================ */
function toggleUpiSection() {
  const cb = document.getElementById('upi-enable');
  const body = document.getElementById('upi-body');
  const msg = document.getElementById('upi-disabled-msg');
  if (cb.checked) {
    body.classList.remove('hidden');
    body.style.animation = 'slideDown 0.25s ease both';
    msg.classList.add('hidden');
    document.getElementById('upi-id').focus();
  } else {
    body.classList.add('hidden');
    msg.classList.remove('hidden');
  }
}

/* ============================================================
   QR CODE UPDATE
   Uses Google Charts QR API (no key required, open API)
   ============================================================ */
function updateQRCode() {
  const upiId = document.getElementById('upi-id').value.trim();
  const name = document.getElementById('upi-name').value.trim() || 'Merchant';

  const qrContainer = document.getElementById('qr-preview-container');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const qrDisplay = document.getElementById('qr-code-display');
  const qrLabel = document.getElementById('qr-upi-label');

  if (!upiId) {
    qrContainer.classList.add('hidden');
    qrContainer.classList.remove('flex');
    qrPlaceholder.classList.remove('hidden');
    return;
  }

  // Build UPI deep link
  const upiStr = encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${upiStr}`;

  qrContainer.classList.remove('hidden');
  qrContainer.classList.add('flex');
  qrPlaceholder.classList.add('hidden');

  qrDisplay.innerHTML = `<img src="${qrUrl}" alt="UPI QR" class="w-full h-full object-contain rounded-xl" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-qrcode text-slate-300 text-4xl\\'></i>'" />`;

  if (qrLabel) qrLabel.textContent = upiId;

  // Update preview if on step 3
  if (GEN.currentStep === 3 && typeof updatePreview === 'function') {
    updatePreview();
  }
}

/* ============================================================
   COLLECT BANK DATA (called from collectInvoiceData in step1)
   ============================================================ */
function collectBankData() {
  const enabled = document.getElementById('bank-enable').checked;
  if (!enabled) return null;

  return {
    enabled: true,
    holder: document.getElementById('bank-holder').value.trim(),
    acno: document.getElementById('bank-acno').value.trim(),
    ifsc: document.getElementById('bank-ifsc').value.trim(),
    name: document.getElementById('bank-name').value.trim(),
    type: document.getElementById('bank-type').value,
  };
}

/* ============================================================
   COLLECT UPI DATA
   ============================================================ */
function collectUpiData() {
  const enabled = document.getElementById('upi-enable').checked;
  if (!enabled) return null;

  const upiId = document.getElementById('upi-id').value.trim();
  const name = document.getElementById('upi-name').value.trim();

  if (!upiId) return null;

  // Generate QR URL
  const upiStr = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(upiStr)}`;

  return {
    enabled: true,
    id: upiId,
    name,
    qrUrl,
  };
}

/* ============================================================
   RESTORE BANK/UPI FROM DRAFT
   ============================================================ */
function restoreBankFromDraft(data) {
  if (!data) return;
  if (data.bank) {
    document.getElementById('bank-enable').checked = true;
    toggleBankSection();
    const fields = ['holder','acno','ifsc','name','type'];
    fields.forEach(f => {
      const el = document.getElementById(`bank-${f}`);
      if (el && data.bank[f] !== undefined) el.value = data.bank[f];
    });
  }
  if (data.upi) {
    document.getElementById('upi-enable').checked = true;
    toggleUpiSection();
    const upiEl = document.getElementById('upi-id');
    const nameEl = document.getElementById('upi-name');
    if (upiEl) upiEl.value = data.upi.id || '';
    if (nameEl) nameEl.value = data.upi.name || '';
    updateQRCode();
  }
}

console.log('[Generator Step 2] Loaded');
