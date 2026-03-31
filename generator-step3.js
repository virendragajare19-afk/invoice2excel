/* ============================================================
   Invoice2Excel Pro — Generator Step 3 Logic
   Templates, Customization, PDF Export
   ============================================================ */

'use strict';

/* ---- Step 3 State ---- */
const S3 = {
  selectedTemplate: 1,
  themeColor: '#2563EB',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  previewScale: 0.56,
  previewDebounce: null,
};

/* ============================================================
   INIT STEP 3
   ============================================================ */
function initStep3() {
  renderTemplateThumbs();
  updateTheme();
  updatePreview();
}

/* ============================================================
   TEMPLATE THUMBNAILS
   ============================================================ */
const TEMPLATE_DEFS = [
  { id: 1, name: 'Classic\nLight',  color: '#2563EB', bg: '#fff',    accent: '#f8fafc' },
  { id: 2, name: 'Dark\nHeader',   color: '#1E293B', bg: '#fff',    accent: '#1E293B' },
  { id: 3, name: 'Blue\nBanner',   color: '#1D4ED8', bg: '#fff',    accent: '#2563EB' },
  { id: 4, name: 'Green\nAccent',  color: '#059669', bg: '#fff',    accent: '#D1FAE5' },
  { id: 5, name: 'Purple\nTheme',  color: '#7C3AED', bg: '#fff',    accent: '#EDE9FE' },
  { id: 6, name: 'Minimal\nClean', color: '#1E293B', bg: '#fff',    accent: '#fff' },
  { id: 7, name: 'Modern\nCard',   color: '#0891B2', bg: '#F0F9FF', accent: '#0891B2' },
];

function renderTemplateThumbs() {
  const container = document.getElementById('template-selector');
  if (!container) return;

  container.innerHTML = TEMPLATE_DEFS.map(t => `
    <div class="template-thumb ${t.id === S3.selectedTemplate ? 'selected' : ''}" id="thumb-${t.id}" onclick="selectTemplate(${t.id})">
      <div class="template-thumb-inner" style="background:${t.bg}">
        ${buildThumbPreview(t)}
      </div>
      <div class="template-thumb-label">${t.name.replace('\n','<br>')}</div>
    </div>
  `).join('');
}

function buildThumbPreview(t) {
  if (t.id === 1) return `
    <div class="tpl-mini-header" style="justify-content:space-between">
      <div style="width:14px;height:8px;background:${t.color};border-radius:2px;opacity:0.8"></div>
      <div style="font-size:5px;font-weight:800;color:#1E293B">Invoice</div>
    </div>
    <div style="height:1px;background:#E2E8F0;margin:2px 4px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:2px 4px">
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
    </div>
    <div class="tpl-mini-table-header" style="background:${t.color}"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
    <div style="height:8px;background:${t.color};opacity:0.15;margin:2px 4px;border-radius:2px"></div>
  `;
  if (t.id === 2) return `
    <div class="tpl-mini-header" style="background:${t.accent};border-radius:4px 4px 0 0">
      <div style="font-size:5px;font-weight:800;color:white">Invoice</div>
      <div style="width:6px;height:6px;background:rgba(255,255,255,0.3);border-radius:50%;margin-left:auto"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:2px 4px">
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
    </div>
    <div class="tpl-mini-table-header" style="background:${t.accent}"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
  `;
  if (t.id === 3) return `
    <div class="tpl-mini-header" style="background:${t.accent};border-radius:4px 4px 0 0;padding:3px 4px">
      <div style="font-size:4px;color:white;font-weight:700">BIZ NAME</div>
      <div style="font-size:5px;color:white;font-weight:800;margin-left:auto">INVOICE</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:2px 4px">
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
      <div style="height:8px;background:#F8FAFC;border-radius:2px"></div>
    </div>
    <div class="tpl-mini-table-header" style="background:${t.color}"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
    <div style="margin:2px 4px;display:flex;justify-content:flex-end"><div style="width:40%;height:6px;background:${t.color};opacity:0.2;border-radius:3px"></div></div>
  `;
  if (t.id === 4) return `
    <div class="tpl-mini-header">
      <div style="font-size:5px;font-weight:800;color:${t.color}">Tax Invoice</div>
    </div>
    <div style="height:1px;background:${t.color};margin:2px 4px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:2px 4px">
      <div style="height:8px;background:${t.accent};border-radius:2px;border:1px solid ${t.color}33"></div>
      <div style="height:8px;background:${t.accent};border-radius:2px;border:1px solid ${t.color}33"></div>
    </div>
    <div class="tpl-mini-table-header" style="background:${t.color}"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
  `;
  if (t.id === 5) return `
    <div class="tpl-mini-header" style="justify-content:space-between">
      <div>
        <div style="font-size:5px;font-weight:800;color:${t.color}">Invoice</div>
        <div style="font-size:3px;background:#FEF3C7;color:#B45309;padding:1px 3px;border-radius:99px;display:inline-block">UNPAID</div>
      </div>
    </div>
    <div style="height:1px;background:${t.accent};margin:2px 4px"></div>
    <div class="tpl-mini-table-header" style="background:${t.color}"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
    <div style="margin:2px 4px;display:flex;justify-content:flex-end"><div style="width:40%;height:6px;background:${t.color};opacity:0.2;border-radius:3px"></div></div>
  `;
  if (t.id === 6) return `
    <div style="border-bottom:2px solid #1E293B;margin:4px 4px 2px;padding-bottom:3px;display:flex;justify-content:space-between;align-items:flex-end">
      <div style="font-size:5px;font-weight:300;letter-spacing:2px;color:#1E293B">INVOICE</div>
      <div style="width:14px;height:10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:2px"></div>
    </div>
    <div class="tpl-mini-table-header" style="background:#1E293B"></div>
    ${[1,2,3].map(()=>`<div class="tpl-mini-row"></div>`).join('')}
    <div style="margin:2px 4px;display:flex;justify-content:flex-end"><div style="width:40%;height:6px;background:#1E293B;opacity:0.15;border-radius:3px"></div></div>
  `;
  // 7 - Modern Card
  return `
    <div style="position:relative;height:96px;display:flex;flex-direction:column">
      <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${t.color};border-radius:3px 0 0 3px"></div>
      <div class="tpl-mini-header" style="padding-left:6px">
        <div style="font-size:5px;font-weight:800;color:${t.color}">Invoice</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:2px 4px 2px 7px">
        <div style="height:7px;background:#F0F9FF;border-radius:2px"></div>
        <div style="height:7px;background:#F0F9FF;border-radius:2px"></div>
      </div>
      <div class="tpl-mini-table-header" style="background:${t.color};margin-left:7px"></div>
      ${[1,2,3].map(()=>`<div class="tpl-mini-row" style="margin-left:7px"></div>`).join('')}
    </div>
  `;
}

function selectTemplate(id) {
  S3.selectedTemplate = id;
  document.querySelectorAll('.template-thumb').forEach(el => el.classList.remove('selected'));
  const thumb = document.getElementById(`thumb-${id}`);
  if (thumb) thumb.classList.add('selected');

  // Update label
  const t = TEMPLATE_DEFS.find(t => t.id === id);
  if (t) {
    const lbl = document.getElementById('preview-template-label');
    if (lbl) lbl.textContent = t.name.replace('\n', ' ');
    // Set theme color to match template default
    setColor(t.color);
  }

  // Pro-only templates (3-7)
  if (id > 2 && !GEN.isPremium) {
    showToastGen('Templates 3-7 are Pro only. Showing preview...', 'warning');
  }

  updatePreview();
}

/* ============================================================
   THEME / DESIGN
   ============================================================ */
function setColor(hex) {
  document.getElementById('theme-color').value = hex;
  S3.themeColor = hex;
  updatePreview();
}

function updateTheme() {
  S3.themeColor = document.getElementById('theme-color').value;
  S3.headingFont = document.getElementById('heading-font').value;
  S3.bodyFont = document.getElementById('body-font').value;
  updatePreview();
}

/* ============================================================
   LIVE PREVIEW
   ============================================================ */
function updatePreview() {
  clearTimeout(S3.previewDebounce);
  S3.previewDebounce = setTimeout(_renderPreview, 150);
}

function _renderPreview() {
  const container = document.getElementById('invoice-preview-content');
  if (!container) return;

  const data = collectInvoiceData();
  const html = renderTemplate(S3.selectedTemplate, data, S3.themeColor, S3.headingFont, S3.bodyFont, true);

  container.innerHTML = html;

  // Update watermark
  const wm = document.getElementById('preview-watermark');
  const wmText = document.getElementById('wm-text-preview');
  const wmToggle = document.getElementById('watermark-toggle');
  if (wm && wmText) {
    wmText.textContent = document.getElementById('watermark-text').value || 'Invoice2Excel Pro';
    wm.style.display = wmToggle && wmToggle.checked ? 'flex' : 'none';
  }
}

/* ============================================================
   PDF DOWNLOAD
   ============================================================ */
async function downloadPDF() {
  if (!validateStep1()) { goToStep(1); return; }

  // Show auth modal first (for free users who haven't signed in)
  const user = localStorage.getItem('inv2xl_user');
  if (!user) {
    document.getElementById('gen-auth-modal').classList.remove('hidden');
    return;
  }

  _doDownloadPDF();
}

async function _doDownloadPDF() {
  showToastGen('Generating PDF...', 'info');

  const data = collectInvoiceData();
  const color = S3.themeColor;
  const hFont = S3.headingFont;
  const bFont = S3.bodyFont;

  try {
    // Build a full HTML invoice for PDF rendering
    const invoiceHTML = renderTemplate(S3.selectedTemplate, data, color, hFont, bFont, false);

    // Create hidden div to render
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:white;padding:0;z-index:-1;';
    div.innerHTML = `
      <div style="width:794px;min-height:1123px;background:white;font-family:${bFont},Inter,sans-serif;position:relative;">
        ${invoiceHTML}
        ${data.watermark ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.07;transform:rotate(-35deg)"><span style="font-size:60px;font-weight:900;color:#64748B;white-space:nowrap">${data.watermark}</span></div>` : ''}
      </div>
    `;
    document.body.appendChild(div);

    // html2canvas → jsPDF
    const canvas = await html2canvas(div, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(div);

    const { jsPDF } = window.jspdf;
    const pageSize = document.getElementById('pdf-pagesize').value;
    const isLandscape = document.getElementById('pdf-landscape').checked;
    const orientation = isLandscape ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: pageSize.toLowerCase() });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = pdfW / imgW;
    const scaledH = imgH * ratio;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (scaledH <= pdfH || document.getElementById('pdf-pageless').checked) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, scaledH);
    } else {
      // Multi-page
      let yOffset = 0;
      while (yOffset < scaledH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yOffset, pdfW, scaledH);
        yOffset += pdfH;
      }
    }

    const filename = `invoice_${data.invoiceNumber || 'draft'}_${Date.now()}.pdf`;
    pdf.save(filename);

    showToastGen('PDF downloaded! 🎉', 'success');

    // Save to history
    saveToHistory(data);

  } catch (err) {
    console.error('[PDF Error]', err);
    showToastGen('PDF generation failed. Try print instead.', 'error');
  }
}

async function authAndDownload(method) {
  document.getElementById('gen-auth-modal').classList.add('hidden');

  if (method === 'google') {
    // Use real Supabase Google OAuth or demo fallback
    if (typeof signInWithGoogle === 'function') {
      await signInWithGoogle();
    } else {
      const name = prompt('Enter your name (Demo – configure Supabase for real Google auth):');
      if (name) {
        localStorage.setItem('inv2xl_user', JSON.stringify({ name, provider: 'google' }));
        showToastGen(`Welcome, ${name}!`, 'success');
      }
    }
  } else {
    // Guest mode
    localStorage.setItem('inv2xl_user', JSON.stringify({ name: 'Guest', provider: 'guest', isPremium: false }));
  }
  _doDownloadPDF();
}

/* ============================================================
   SHARE ACTIONS
   ============================================================ */
function shareWhatsApp() {
  const data = collectInvoiceData();
  const msg = `Hi, please find the invoice${data.invoiceNumber ? ' #'+data.invoiceNumber : ''} attached.
  
Amount: ${data.currency || '₹'}${(data.totals?.grandTotal || 0).toLocaleString('en-IN')}
Due: ${data.dueDate ? formatDisplayDate(data.dueDate) : 'On receipt'}

Generated via Invoice2Excel Pro`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

function shareEmail() {
  const data = collectInvoiceData();
  const subject = `Invoice ${data.invoiceNumber || ''} from ${data.business?.name || ''}`;
  const body = `Dear ${data.client?.name || 'Client'},\n\nPlease find the invoice attached.\n\nInvoice #: ${data.invoiceNumber}\nAmount: ${data.currency}${(data.totals?.grandTotal||0).toLocaleString('en-IN')}\nDue Date: ${data.dueDate || 'On Receipt'}\n\nThank you for your business.\n\n${data.business?.name || ''}`;
  window.location.href = `mailto:${data.client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function printInvoice() {
  const data = collectInvoiceData();
  const html = renderTemplate(S3.selectedTemplate, data, S3.themeColor, S3.headingFont, S3.bodyFont, false);
  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${data.invoiceNumber || ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Serif:wght@400;700&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: '${S3.bodyFont}', Inter, sans-serif; background: white; }
        @media print { @page { margin: 0; } body { margin: 0; } }
      </style>
    </head>
    <body style="padding:20px;">${html}</body>
    </html>
  `);
  printWin.document.close();
  setTimeout(() => printWin.print(), 800);
}

/* ============================================================
   SAVE / DUPLICATE / HISTORY  (Supabase + localStorage)
   ============================================================ */
async function saveInvoice() {
  const data = collectInvoiceData();
  data.templateId = S3.selectedTemplate;
  data.status = 'saved';

  // Save to Supabase cloud
  if (typeof saveInvoiceToSupabase === 'function') {
    showToastGen('Saving to cloud…', 'info');
    const result = await saveInvoiceToSupabase(data);
    if (result) {
      data._dbId = result.id; // Store DB id for future updates
      showToastGen('Invoice saved to cloud ☁️', 'success');
    } else {
      // Fallback to localStorage
      saveToHistoryLocal(data);
      showToastGen('Saved locally (sign in to sync cloud)', 'info');
    }
  } else {
    saveToHistoryLocal(data);
    showToastGen('Invoice saved!', 'success');
  }
}

async function saveToHistory(data) {
  // Save to Supabase cloud
  if (typeof saveInvoiceToSupabase === 'function') {
    const result = await saveInvoiceToSupabase({ ...data, templateId: S3.selectedTemplate, status: 'downloaded' });
    if (result) return;
  }
  // Fallback
  saveToHistoryLocal(data);
}

function saveToHistoryLocal(data) {
  try {
    const history = JSON.parse(localStorage.getItem('inv2xl_history') || '[]');
    const filtered = history.filter(h => h.invoiceNumber !== data.invoiceNumber);
    filtered.unshift({ ...data, savedAt: new Date().toISOString() });
    localStorage.setItem('inv2xl_history', JSON.stringify(filtered.slice(0, 50)));
  } catch (e) { /* ignore */ }
}

function duplicateInvoice() {
  const data = collectInvoiceData();
  // Increment invoice number
  const num = data.invoiceNumber || '';
  const match = num.match(/(\d+)$/);
  const newNum = match ? num.replace(/\d+$/, String(parseInt(match[1]) + 1).padStart(match[1].length, '0')) : num + '-2';
  document.getElementById('inv-number').value = newNum;
  // Set today's date
  document.getElementById('inv-date').value = toDateInput(new Date());
  showToastGen('Invoice duplicated with new number: ' + newNum, 'success');
  goToStep(1);
}

console.log('[Generator Step 3] Loaded');
