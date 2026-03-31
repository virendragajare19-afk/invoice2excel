/* ============================================================
   Invoice2Excel Pro — Invoice Template Renderers
   7 distinct templates, each returns an HTML string
   ============================================================ */

'use strict';

/* ============================================================
   MAIN ROUTER
   ============================================================ */
function renderTemplate(id, data, color, hFont, bFont, isPreview) {
  const renderers = {
    1: tpl1_ClassicLight,
    2: tpl2_DarkHeader,
    3: tpl3_BlueBanner,
    4: tpl4_GreenAccent,
    5: tpl5_PurpleModern,
    6: tpl6_MinimalClean,
    7: tpl7_ModernCard,
  };
  const fn = renderers[id] || tpl1_ClassicLight;
  return fn(data, color, hFont, bFont, isPreview);
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */
function H(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtAmt(sym, n) {
  if (!n && n !== 0) return sym + '0';
  return sym + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return s; }
}

function buildAddress(p) {
  const parts = [p.address, p.city, p.state, p.pin, p.country].filter(Boolean);
  return parts.join(', ');
}

function logoHtml(data, maxH = '40px') {
  if (data.logo) return `<img src="${data.logo}" style="max-height:${maxH};max-width:100px;object-fit:contain;" alt="Logo" crossorigin="anonymous">`;
  return `<div style="width:40px;height:40px;background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:14px">${H((data.business?.name||'I').charAt(0))}</div>`;
}

function tableHeaderCss(color) {
  return `background:${color};color:white;`;
}

function buildItemRows(data, color) {
  const sym = data.currency || '₹';
  const items = data.items || [];
  if (!items.length) return `<tr><td colspan="8" style="text-align:center;padding:16px;color:#94A3B8;font-size:11px">No items</td></tr>`;

  return items.map((item, i) => {
    const amount = item.amount || (item.qty * item.rate);
    const bg = i % 2 === 1 ? '#F8FAFC' : 'white';
    return `
      <tr style="background:${bg}">
        <td style="padding:6px 8px;color:#94A3B8;font-size:10px;text-align:center">${i+1}</td>
        <td style="padding:6px 8px;">
          <div style="font-weight:600;font-size:11px">${H(item.name)}</div>
          ${item.description ? `<div style="font-size:9px;color:#94A3B8;font-style:italic;margin-top:1px">${H(item.description)}</div>` : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;font-size:10px;color:#64748B">${H(item.hsn)||'—'}</td>
        <td style="padding:6px 8px;text-align:center;font-size:10px">${item.gst||0}%</td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${item.qty||0}</td>
        <td style="padding:6px 8px;text-align:right;font-size:11px">${fmtAmt(sym, item.rate)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;font-size:11px">${fmtAmt(sym, amount)}</td>
      </tr>
    `;
  }).join('');
}

function buildSummaryRows(data, color) {
  const sym = data.currency || '₹';
  const t = data.totals || {};
  const rows = [];
  rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#64748B"><span>Subtotal</span><span style="font-weight:600">${fmtAmt(sym, t.subtotal)}</span></div>`);
  if (t.discAmount > 0) rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#EF4444"><span>Discount</span><span>-${fmtAmt(sym, t.discAmount)}</span></div>`);
  if (t.taxable !== t.subtotal && t.taxable !== undefined) rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#64748B"><span>Taxable Amount</span><span style="font-weight:600">${fmtAmt(sym, t.taxable)}</span></div>`);
  if (t.cgst > 0) rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#64748B"><span>CGST</span><span>${fmtAmt(sym, t.cgst)}</span></div>`);
  if (t.sgst > 0) rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#64748B"><span>SGST</span><span>${fmtAmt(sym, t.sgst)}</span></div>`);
  if (t.extra > 0) rows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #E2E8F0;font-size:10px;color:#64748B"><span>${H(t.extraLabel)||'Extra'}</span><span>${fmtAmt(sym, t.extra)}</span></div>`);
  rows.push(`<div style="display:flex;justify-content:space-between;padding:8px;background:${color}15;border-radius:8px;margin-top:6px"><span style="font-weight:700;color:${color};font-size:12px">Grand Total</span><span style="font-weight:800;color:${color};font-size:13px">${fmtAmt(sym, t.grandTotal)}</span></div>`);
  return rows.join('');
}

function buildBankSection(data) {
  const b = data.bank;
  const u = data.upi;
  if (!b && !u) return '';

  return `
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #F1F5F9;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:6px">Bank & UPI Details</div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${b ? `
        <div style="flex:1;font-size:9px;line-height:1.8">
          <div><span style="color:#94A3B8">Bank Name:</span> <strong>${H(b.name)}</strong></div>
          <div><span style="color:#94A3B8">A/C Holder:</span> <strong>${H(b.holder)}</strong></div>
          <div><span style="color:#94A3B8">Account No:</span> <strong>${H(b.acno)}</strong></div>
          <div><span style="color:#94A3B8">IFSC:</span> <strong>${H(b.ifsc)}</strong></div>
          <div><span style="color:#94A3B8">A/C Type:</span> <strong>${H(b.type)}</strong></div>
        </div>
        ` : ''}
        ${u ? `
        <div style="text-align:center;font-size:9px">
          ${u.qrUrl ? `<img src="${u.qrUrl}" style="width:56px;height:56px;border-radius:6px;border:1px solid #E2E8F0" alt="UPI QR" crossorigin="anonymous" onerror="this.outerHTML='<div style=\\'width:56px;height:56px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#CBD5E1\\'>&#x2612;</div>'" />` : '<div style="width:56px;height:56px;background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94A3B8">QR Code</div>'}
          <div style="color:#64748B;margin-top:2px;max-width:64px;word-break:break-all">${H(u.id)}</div>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

function buildTermsNotes(data) {
  let out = '';
  if (data.terms) {
    out += `
      <div style="margin-top:10px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:4px">Terms & Conditions</div>
        <div style="font-size:9px;color:#64748B;line-height:1.6;white-space:pre-line">${H(data.terms)}</div>
      </div>
    `;
  }
  if (data.notes) {
    out += `
      <div style="margin-top:8px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:4px">Additional Notes</div>
        <div style="font-size:9px;color:#64748B;line-height:1.6;white-space:pre-line">${H(data.notes)}</div>
      </div>
    `;
  }
  return out;
}

function buildSignature(data) {
  if (!data.signature) return '';
  const { name, image } = data.signature;
  return `
    <div style="margin-top:12px;text-align:right">
      ${image ? `<img src="${image}" style="max-height:36px;max-width:100px;object-fit:contain;margin-bottom:4px" alt="Signature" crossorigin="anonymous">` : '<div style="height:36px"></div>'}
      <div style="border-top:1px solid #CBD5E1;padding-top:4px;font-size:9px;color:#64748B;min-width:100px;display:inline-block;text-align:center">${H(name) || 'Authorised Signatory'}</div>
    </div>
  `;
}

function totalInWords(data) {
  const t = data.totals;
  if (!t) return '';
  const sym = data.currency || '₹';
  const num = Math.round(t.grandTotal || 0);
  const words = numberToWords(num);
  if (!words) return '';
  const currency = sym === '₹' ? 'Rupees' : 'Only';
  return `<div style="font-size:9px;font-style:italic;color:#64748B;margin-top:4px"><strong>Amount in Words:</strong> ${words} ${currency} Only</div>`;
}

/* ============================================================
   TEMPLATE 1 — Classic Light (White, minimal, professional)
   Based on Foobar Labs Classic analysis
   ============================================================ */
function tpl1_ClassicLight(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;padding:24px;background:white;color:#1E293B;min-height:560px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>${logoHtml(data,'44px')}<div style="font-weight:700;font-size:11px;margin-top:4px">${H(biz.name)}</div></div>
      <div style="text-align:right">
        <div style="font-family:'${hFont}',Inter,sans-serif;font-size:24px;font-weight:800;color:#1E293B">${H(data.invoiceType||'Invoice')}</div>
        ${data.status ? `<div style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:9px;font-weight:700;background:#FEF3C7;color:#B45309;margin-top:2px">${H(data.status)}</div>` : ''}
      </div>
    </div>
    <div style="height:1px;background:#E2E8F0;margin-bottom:12px"></div>

    <!-- Billing & Invoice info -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:4px">Billed By</div>
        <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
        ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8">GSTIN: <strong>${H(biz.gstin)}</strong></div>` : ''}
        ${biz.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(biz.pan)}</strong></div>` : ''}
      </div>
      <div>
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:4px">Billed To</div>
        <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
        ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8">GSTIN: <strong>${H(cli.gstin)}</strong></div>` : ''}
        ${cli.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(cli.pan)}</strong></div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:4px">Invoice Details</div>
        <div style="font-size:9px;line-height:1.8">
          <div><span style="color:#94A3B8">Invoice #:</span> <strong>${H(data.invoiceNumber)}</strong></div>
          <div><span style="color:#94A3B8">Date:</span> ${H(fmtDate(data.invoiceDate))}</div>
          ${data.dueDate ? `<div><span style="color:#94A3B8">Due:</span> ${H(fmtDate(data.dueDate))}</div>` : ''}
          ${data.additionalInfo?.pos ? `<div><span style="color:#94A3B8">Place of Supply:</span> ${H(data.additionalInfo.pos)}</div>` : ''}
        </div>
        <div style="margin-top:6px;font-size:10px;font-weight:700;color:${color}">Due: ${fmtAmt(sym, data.totals?.grandTotal)}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px">
      <thead>
        <tr style="${tableHeaderCss(color)}">
          <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">#</th>
          <th style="padding:7px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">Item Name & Description</th>
          <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">HSN</th>
          <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">GST%</th>
          <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">Qty</th>
          <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">Rate</th>
          <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">Amount</th>
        </tr>
      </thead>
      <tbody>${buildItemRows(data, color)}</tbody>
    </table>

    <!-- Summary + Bottom -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <div style="min-width:200px">${buildSummaryRows(data, color)}</div>
    </div>
    ${totalInWords(data)}
    ${buildBankSection(data)}
    ${buildTermsNotes(data)}
    ${buildSignature(data)}
  </div>`;
}

/* ============================================================
   TEMPLATE 2 — Dark Header
   Dark navy header, clean body, item descriptions, status badge
   ============================================================ */
function tpl2_DarkHeader(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const darkColor = '#1E293B';
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;background:white;color:#1E293B;min-height:560px;overflow:hidden">
    <!-- Dark Header Bar -->
    <div style="background:${darkColor};padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px">
        ${logoHtml(data, '36px')}
        <div>
          <div style="font-family:'${hFont}',Inter,sans-serif;font-size:18px;font-weight:800;color:white">${H(data.invoiceType||'Invoice')}</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.6)">${H(biz.name)}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;color:rgba(255,255,255,0.7);line-height:1.8">
          <div>Invoice #: <strong style="color:white">${H(data.invoiceNumber)}</strong></div>
          <div>Date: <strong style="color:white">${H(fmtDate(data.invoiceDate))}</strong></div>
          ${data.dueDate ? `<div>Due: <strong style="color:white">${H(fmtDate(data.dueDate))}</strong></div>` : ''}
        </div>
        <div style="margin-top:4px;display:inline-block;padding:2px 10px;border-radius:999px;font-size:9px;font-weight:700;background:#FEF3C7;color:#92400E">UNPAID</div>
      </div>
    </div>

    <div style="padding:16px 20px">
      <!-- Billing -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:#F8FAFC;border-radius:10px;padding:10px">
          <div style="font-size:8px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">Billed By</div>
          <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
          <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
          ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(biz.gstin)}</strong></div>` : ''}
          ${biz.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(biz.pan)}</strong></div>` : ''}
        </div>
        <div style="background:#F8FAFC;border-radius:10px;padding:10px">
          <div style="font-size:8px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">Billed To</div>
          <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
          <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
          ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(cli.gstin)}</strong></div>` : ''}
          ${cli.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(cli.pan)}</strong></div>` : ''}
        </div>
      </div>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px">
        <thead>
          <tr style="background:${darkColor};color:white">
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">#</th>
            <th style="padding:7px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase">Item Name & Description</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">HSN</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">GST%</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">Qty</th>
            <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Rate</th>
            <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${buildItemRows(data, darkColor)}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <div style="min-width:200px">${buildSummaryRows(data, darkColor)}</div>
      </div>
      ${totalInWords(data)}
      ${buildBankSection(data)}
      ${buildTermsNotes(data)}
      ${buildSignature(data)}
    </div>
  </div>`;
}

/* ============================================================
   TEMPLATE 3 — Blue Banner Header
   Full-width colored banner with embedded billing info
   ============================================================ */
function tpl3_BlueBanner(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;background:white;color:#1E293B;min-height:560px;overflow:hidden">
    <!-- Full-width Banner -->
    <div style="background:linear-gradient(135deg,${color},${color}DD);padding:16px 20px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          ${logoHtml(data,'36px')}
          <div>
            <div style="font-weight:700;font-size:12px;color:white">${H(biz.name)}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.7)">${H(buildAddress(biz))}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'${hFont}',Inter,sans-serif;font-size:20px;font-weight:800;color:white;letter-spacing:0.02em">${H(data.invoiceType||'Invoice')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px">
          <div style="font-size:8px;color:rgba(255,255,255,0.6);text-transform:uppercase;font-weight:600;margin-bottom:3px">Invoice #</div>
          <div style="font-size:10px;font-weight:700;color:white">${H(data.invoiceNumber)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px">
          <div style="font-size:8px;color:rgba(255,255,255,0.6);text-transform:uppercase;font-weight:600;margin-bottom:3px">Invoice Date</div>
          <div style="font-size:10px;font-weight:700;color:white">${H(fmtDate(data.invoiceDate))}</div>
          ${data.dueDate ? `<div style="font-size:8px;color:rgba(255,255,255,0.7)">Due: ${H(fmtDate(data.dueDate))}</div>` : ''}
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px">
          <div style="font-size:8px;color:rgba(255,255,255,0.6);text-transform:uppercase;font-weight:600;margin-bottom:3px">Total Amount</div>
          <div style="font-size:12px;font-weight:800;color:white">${fmtAmt(sym, data.totals?.grandTotal)}</div>
        </div>
      </div>
    </div>

    <div style="padding:0 20px">
      <!-- Billing -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${color};margin-bottom:4px">Billed By</div>
          <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
          <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
          ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8">GSTIN: <strong>${H(biz.gstin)}</strong></div>` : ''}
          ${biz.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(biz.pan)}</strong></div>` : ''}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${color};margin-bottom:4px">Billed To</div>
          <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
          <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
          ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8">GSTIN: <strong>${H(cli.gstin)}</strong></div>` : ''}
          ${cli.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(cli.pan)}</strong></div>` : ''}
        </div>
      </div>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <thead>
          <tr style="background:${color};color:white">
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">#</th>
            <th style="padding:7px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase">Item Name/Description</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">HSN</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">GST%</th>
            <th style="padding:7px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">Qty</th>
            <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Rate</th>
            <th style="padding:7px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${buildItemRows(data, color)}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <div style="min-width:200px">${buildSummaryRows(data, color)}</div>
      </div>
      ${totalInWords(data)}
      ${buildBankSection(data)}
      ${buildTermsNotes(data)}
      ${buildSignature(data)}
    </div>
  </div>`;
}

/* ============================================================
   TEMPLATE 4 — Green Accent
   Clean white with green accents, bordered billing boxes
   ============================================================ */
function tpl4_GreenAccent(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const accentColor = color; // use user-selected color as accent
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;padding:24px;background:white;color:#1E293B;min-height:560px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>${logoHtml(data,'40px')}</div>
      <div style="text-align:right">
        <div style="font-family:'${hFont}',Inter,sans-serif;font-size:22px;font-weight:800;color:${accentColor}">${H(data.invoiceType||'Tax Invoice')}</div>
        <div style="font-size:9px;color:#64748B">Invoice #: <strong>${H(data.invoiceNumber)}</strong></div>
        <div style="font-size:9px;color:#64748B">Date: ${H(fmtDate(data.invoiceDate))}</div>
        ${data.dueDate ? `<div style="font-size:9px;color:#64748B">Due: ${H(fmtDate(data.dueDate))}</div>` : ''}
      </div>
    </div>
    <div style="height:2px;background:${accentColor};margin-bottom:12px;border-radius:1px"></div>

    <!-- Billing with borders -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="border:1.5px solid ${accentColor}40;border-radius:10px;padding:10px">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${accentColor};margin-bottom:4px">Billed By</div>
        <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
        ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(biz.gstin)}</strong></div>` : ''}
        ${biz.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(biz.pan)}</strong></div>` : ''}
      </div>
      <div style="border:1.5px solid ${accentColor}40;border-radius:10px;padding:10px">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${accentColor};margin-bottom:4px">Billed To</div>
        <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
        ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(cli.gstin)}</strong></div>` : ''}
        ${cli.pan ? `<div style="font-size:8px;color:#94A3B8">PAN: <strong>${H(cli.pan)}</strong></div>` : ''}
      </div>
    </div>

    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;border:1px solid ${accentColor}30;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:${accentColor};color:white">
          <th style="padding:8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">#</th>
          <th style="padding:8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase">Item Name & Description</th>
          <th style="padding:8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">HSN</th>
          <th style="padding:8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">GST%</th>
          <th style="padding:8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase">Qty</th>
          <th style="padding:8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Rate</th>
          <th style="padding:8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase">Amount</th>
        </tr>
      </thead>
      <tbody>${buildItemRows(data, accentColor)}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <div style="min-width:200px">${buildSummaryRows(data, accentColor)}</div>
    </div>
    ${totalInWords(data)}
    ${buildBankSection(data)}
    ${buildTermsNotes(data)}
    ${buildSignature(data)}
  </div>`;
}

/* ============================================================
   TEMPLATE 5 — Purple / CGST+SGST columns
   Status badge, swapped billing positions, split tax in table
   ============================================================ */
function tpl5_PurpleModern(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';
  const items = data.items || [];

  const itemRows = items.map((item, i) => {
    const base = item.qty * item.rate;
    const cgst = base * (item.gst / 2) / 100;
    const sgst = cgst;
    const total = base + cgst + sgst;
    const bg = i % 2 === 1 ? '#FAF5FF' : 'white';
    return `
      <tr style="background:${bg}">
        <td style="padding:6px 8px;text-align:center;font-size:9px;color:#94A3B8">${i+1}</td>
        <td style="padding:6px 8px">
          <div style="font-weight:600;font-size:10px">${H(item.name)}</div>
          ${item.description ? `<div style="font-size:8px;color:#94A3B8;font-style:italic">${H(item.description)}</div>` : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;font-size:9px;color:#64748B">${H(item.hsn)||'—'}</td>
        <td style="padding:6px 8px;text-align:center;font-size:9px">${item.qty||0}</td>
        <td style="padding:6px 8px;text-align:center;font-size:9px">${item.gst||0}%</td>
        <td style="padding:6px 8px;text-align:right;font-size:9px">${fmtAmt(sym, cgst)}</td>
        <td style="padding:6px 8px;text-align:right;font-size:9px">${fmtAmt(sym, sgst)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;font-size:10px">${fmtAmt(sym, item.amount || base)}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="8" style="text-align:center;padding:16px;font-size:10px;color:#94A3B8">No items</td></tr>`;

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;padding:24px;background:white;color:#1E293B;min-height:560px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-family:'${hFont}',Inter,sans-serif;font-size:20px;font-weight:800;color:${color}">${H(data.invoiceType||'Invoice')}</div>
          <div style="padding:2px 8px;border-radius:999px;font-size:8px;font-weight:700;background:#FEF3C7;color:#B45309">UNPAID</div>
        </div>
        <div style="font-size:9px;color:#64748B;margin-top:4px">
          <span>#: <strong>${H(data.invoiceNumber)}</strong></span>
          <span style="margin-left:10px">Date: ${H(fmtDate(data.invoiceDate))}</span>
          ${data.dueDate ? `<span style="margin-left:10px">Due: ${H(fmtDate(data.dueDate))}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right">${logoHtml(data,'40px')}</div>
    </div>

    <!-- Billing -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="background:#FAF5FF;border-radius:10px;padding:10px;border-left:3px solid ${color}">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${color};margin-bottom:4px">Billed By</div>
        <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
        ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(biz.gstin)}</strong></div>` : ''}
      </div>
      <div style="background:#FAF5FF;border-radius:10px;padding:10px;border-left:3px solid ${color}">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${color};margin-bottom:4px">Billed To</div>
        <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
        <div style="font-size:9px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
        ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: <strong>${H(cli.gstin)}</strong></div>` : ''}
      </div>
    </div>

    <!-- Table with CGST + SGST split -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead>
        <tr style="background:${color};color:white">
          <th style="padding:7px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">#</th>
          <th style="padding:7px;text-align:left;font-size:7px;font-weight:700;text-transform:uppercase">Item & Description</th>
          <th style="padding:7px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">HSN</th>
          <th style="padding:7px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">Qty</th>
          <th style="padding:7px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">GST%</th>
          <th style="padding:7px;text-align:right;font-size:7px;font-weight:700;text-transform:uppercase">CGST</th>
          <th style="padding:7px;text-align:right;font-size:7px;font-weight:700;text-transform:uppercase">SGST</th>
          <th style="padding:7px;text-align:right;font-size:7px;font-weight:700;text-transform:uppercase">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <div style="min-width:200px">${buildSummaryRows(data, color)}</div>
    </div>
    ${totalInWords(data)}
    ${buildBankSection(data)}
    ${buildTermsNotes(data)}
    ${buildSignature(data)}
  </div>`;
}

/* ============================================================
   TEMPLATE 6 — Minimal Clean (ultra-minimal, letterpress feel)
   ============================================================ */
function tpl6_MinimalClean(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;padding:32px;background:white;color:#1E293B;min-height:560px">
    <!-- Minimal Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E293B;padding-bottom:12px;margin-bottom:14px">
      <div>
        <div style="font-family:'${hFont}',Inter,sans-serif;font-size:26px;font-weight:300;letter-spacing:0.15em;color:#1E293B;text-transform:uppercase">${H(data.invoiceType||'Invoice')}</div>
        <div style="font-size:9px;color:#94A3B8;margin-top:2px">${H(biz.name)}</div>
      </div>
      <div style="text-align:right">${logoHtml(data,'36px')}</div>
    </div>

    <!-- Details row -->
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:9px;line-height:2">
        <div><span style="color:#94A3B8;text-transform:uppercase;font-size:8px;font-weight:600">Invoice #</span><br><strong>${H(data.invoiceNumber)}</strong></div>
        <div style="margin-top:4px"><span style="color:#94A3B8;text-transform:uppercase;font-size:8px;font-weight:600">Date</span><br>${H(fmtDate(data.invoiceDate))}</div>
        ${data.dueDate ? `<div style="margin-top:4px"><span style="color:#94A3B8;text-transform:uppercase;font-size:8px;font-weight:600">Due Date</span><br>${H(fmtDate(data.dueDate))}</div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="font-size:9px">
          <div style="color:#94A3B8;text-transform:uppercase;font-size:8px;font-weight:600;margin-bottom:4px">From</div>
          <div style="font-weight:700">${H(biz.name)}</div>
          <div style="color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
          ${biz.gstin ? `<div style="color:#94A3B8;font-size:8px">GST: ${H(biz.gstin)}</div>` : ''}
        </div>
        <div style="font-size:9px">
          <div style="color:#94A3B8;text-transform:uppercase;font-size:8px;font-weight:600;margin-bottom:4px">To</div>
          <div style="font-weight:700">${H(cli.name)}</div>
          <div style="color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
          ${cli.gstin ? `<div style="color:#94A3B8;font-size:8px">GST: ${H(cli.gstin)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Table - no colors, just lines -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead>
        <tr style="border-bottom:1.5px solid #1E293B">
          <th style="padding:6px 8px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">#</th>
          <th style="padding:6px 8px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Description</th>
          <th style="padding:6px 8px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Qty</th>
          <th style="padding:6px 8px 8px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">GST</th>
          <th style="padding:6px 8px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Rate</th>
          <th style="padding:6px 8px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(data.items||[]).map((item,i) => `
          <tr style="border-bottom:1px solid #F1F5F9">
            <td style="padding:7px 8px;text-align:center;font-size:9px;color:#94A3B8">${i+1}</td>
            <td style="padding:7px 8px;font-size:10px">
              <div style="font-weight:600">${H(item.name)}</div>
              ${item.description ? `<div style="font-size:8px;color:#94A3B8">${H(item.description)}</div>` : ''}
            </td>
            <td style="padding:7px 8px;text-align:center;font-size:10px">${item.qty||0}</td>
            <td style="padding:7px 8px;text-align:center;font-size:10px">${item.gst||0}%</td>
            <td style="padding:7px 8px;text-align:right;font-size:10px">${fmtAmt(sym, item.rate)}</td>
            <td style="padding:7px 8px;text-align:right;font-weight:700;font-size:10px">${fmtAmt(sym, item.amount || item.qty*item.rate)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;border-top:1.5px solid #1E293B;padding-top:8px">
      <div style="min-width:200px">${buildSummaryRows(data, '#1E293B')}</div>
    </div>
    ${totalInWords(data)}
    ${buildBankSection(data)}
    ${buildTermsNotes(data)}
    ${buildSignature(data)}
  </div>`;
}

/* ============================================================
   TEMPLATE 7 — Modern Card (left accent bar, card style)
   ============================================================ */
function tpl7_ModernCard(data, color, hFont, bFont, isPreview) {
  const sym = data.currency || '₹';
  const biz = data.business || {};
  const cli = data.client || {};
  const scale = isPreview ? '0.54' : '1';
  const width = isPreview ? '150%' : '100%';
  const bgColor = '#F0F9FF';

  return `
  <div style="font-family:'${bFont}',Inter,sans-serif;width:${width};transform:scale(${scale});transform-origin:top left;background:${bgColor};color:#1E293B;min-height:560px;position:relative;overflow:hidden">
    <!-- Left accent bar -->
    <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:${color}"></div>

    <div style="padding:24px 24px 24px 30px">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          ${logoHtml(data,'36px')}
          <div style="font-family:'${hFont}',Inter,sans-serif;font-size:18px;font-weight:800;color:${color};margin-top:4px">${H(data.invoiceType||'Invoice')}</div>
          <div style="font-size:9px;color:#64748B">${H(biz.name)}</div>
        </div>
        <div style="background:white;border-radius:12px;padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:right">
          <div style="font-size:8px;color:#94A3B8;font-weight:600;text-transform:uppercase">Invoice #</div>
          <div style="font-weight:700;font-size:11px">${H(data.invoiceNumber)}</div>
          <div style="font-size:8px;color:#64748B;margin-top:4px">${H(fmtDate(data.invoiceDate))}</div>
          ${data.dueDate ? `<div style="font-size:8px;color:#EF4444">Due: ${H(fmtDate(data.dueDate))}</div>` : ''}
          <div style="margin-top:6px;font-size:13px;font-weight:800;color:${color}">${fmtAmt(sym, data.totals?.grandTotal)}</div>
        </div>
      </div>

      <!-- Billing cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:white;border-radius:10px;padding:10px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
          <div style="font-size:8px;font-weight:700;color:${color};text-transform:uppercase;margin-bottom:4px">From</div>
          <div style="font-weight:700;font-size:10px">${H(biz.name)}</div>
          <div style="font-size:8px;color:#64748B;line-height:1.5">${H(buildAddress(biz))}</div>
          ${biz.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: ${H(biz.gstin)}</div>` : ''}
        </div>
        <div style="background:white;border-radius:10px;padding:10px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
          <div style="font-size:8px;font-weight:700;color:${color};text-transform:uppercase;margin-bottom:4px">To</div>
          <div style="font-weight:700;font-size:10px">${H(cli.name)}</div>
          <div style="font-size:8px;color:#64748B;line-height:1.5">${H(buildAddress(cli))}</div>
          ${cli.gstin ? `<div style="font-size:8px;color:#94A3B8;margin-top:2px">GSTIN: ${H(cli.gstin)}</div>` : ''}
        </div>
      </div>

      <!-- Table on white card -->
      <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:${color};color:white">
              <th style="padding:8px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">#</th>
              <th style="padding:8px;text-align:left;font-size:7px;font-weight:700;text-transform:uppercase">Item</th>
              <th style="padding:8px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">HSN</th>
              <th style="padding:8px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">GST%</th>
              <th style="padding:8px;text-align:center;font-size:7px;font-weight:700;text-transform:uppercase">Qty</th>
              <th style="padding:8px;text-align:right;font-size:7px;font-weight:700;text-transform:uppercase">Rate</th>
              <th style="padding:8px;text-align:right;font-size:7px;font-weight:700;text-transform:uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>${buildItemRows(data, color)}</tbody>
        </table>
      </div>

      <!-- Summary on white card -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <div style="background:white;border-radius:10px;padding:12px;min-width:200px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
          ${buildSummaryRows(data, color)}
        </div>
      </div>
      ${totalInWords(data)}
      ${buildBankSection(data)}
      ${buildTermsNotes(data)}
      ${buildSignature(data)}
    </div>
  </div>`;
}

console.log('[Templates] 7 templates loaded');
