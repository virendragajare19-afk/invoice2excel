/* ============================================================
   Invoice2Excel Pro — Main Application Logic
   Version 1.0.0
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const APP_CONFIG = {
  FREE_DAILY_LIMIT: 3,
  INTERSTITIAL_COUNTDOWN: 5,
  REWARD_AD_DURATION: 5,
  INSTALL_PROMPT_DELAY: 30000, // 30 seconds
};

const DEMO_DATA = {
  invoiceNumber: 'INV-2025-0042',
  invoiceDate: '15/03/2025',
  vendorName: 'Tech Office Supplies Co.',
  customerName: 'Acme Solutions Pvt. Ltd.',
  items: [
    { name: 'Office Chair Premium', qty: 2,  unitPrice: 8500,  total: 17000 },
    { name: 'Standing Desk',        qty: 1,  unitPrice: 15000, total: 15000 },
    { name: 'Monitor 27"',          qty: 3,  unitPrice: 22000, total: 66000 },
    { name: 'Keyboard Wireless',    qty: 5,  unitPrice: 2200,  total: 11000 },
    { name: 'Mouse Ergonomic',      qty: 5,  unitPrice: 1800,  total:  9000 },
  ],
  subtotal: 118000,
  gstRate: 18,
  gst: 21240,
  grandTotal: 139240,
  currency: '₹',
  isDemo: true,
};

/* ============================================================
   STATE
   ============================================================ */
let appState = {
  currentFile: null,
  extractedData: null,
  isPremium: false,
  user: null,
  installPromptEvent: null,
};

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  loadUserState();
  updateUsageCounter();
  setupPDFWorker();
  registerServiceWorker();
  setupInstallPrompt();
  checkOnlineStatus();
  updateAuthUI();

  // Show install banner on second visit
  const visits = parseInt(localStorage.getItem('app_visits') || '0') + 1;
  localStorage.setItem('app_visits', visits);
  if (visits >= 2) {
    setTimeout(showInstallBanner, APP_CONFIG.INSTALL_PROMPT_DELAY);
  }
}

/* ============================================================
   PDF.JS WORKER SETUP
   ============================================================ */
function setupPDFWorker() {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
}

/* ============================================================
   SERVICE WORKER
   ============================================================ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[SW] Registered'))
      .catch(err => console.warn('[SW] Registration failed:', err));
  }
}

/* ============================================================
   ONLINE / OFFLINE
   ============================================================ */
function checkOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  const update = () => {
    if (!navigator.onLine) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

/* ============================================================
   PWA INSTALL PROMPT
   ============================================================ */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.installPromptEvent = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (appState.installPromptEvent) {
    banner.classList.remove('hidden');
  }
  document.getElementById('install-dismiss').onclick = () => {
    banner.classList.add('hidden');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (appState.installPromptEvent) {
        appState.installPromptEvent.prompt();
        const result = await appState.installPromptEvent.userChoice;
        if (result.outcome === 'accepted') {
          showToast('App installed successfully!', 'success');
          document.getElementById('install-banner').classList.add('hidden');
        }
        appState.installPromptEvent = null;
      }
    });
  }
});

/* ============================================================
   USER / AUTH STATE  (Supabase-powered, localStorage fallback)
   ============================================================ */
function loadUserState() {
  const savedUser = localStorage.getItem('inv2xl_user');
  if (savedUser) {
    try { appState.user = JSON.parse(savedUser); } catch(e) {}
  }
  appState.isPremium = localStorage.getItem('inv2xl_premium') === 'true';
}

function saveUserState() {
  if (appState.user) {
    localStorage.setItem('inv2xl_user', JSON.stringify(appState.user));
  }
  localStorage.setItem('inv2xl_premium', appState.isPremium ? 'true' : 'false');
}

/* Called by supabase.js triggerAuthUpdate() and directly */
function updateAuthUI(userOverride) {
  // Sync state from localStorage or override
  if (userOverride !== undefined) {
    appState.user = userOverride;
    if (userOverride) appState.isPremium = userOverride.isPremium || false;
  }

  const avatarWrap = document.getElementById('user-avatar-wrap');
  const authBtn    = document.getElementById('auth-btn');
  const avatar     = document.getElementById('user-avatar');
  const upgradeBtn = document.getElementById('upgrade-btn-header');
  if (!authBtn) return;

  if (appState.user) {
    const u = appState.user;
    if (avatarWrap) avatarWrap.classList.remove('hidden');

    if (avatar) {
      if (u.avatar) {
        // Google photo
        avatar.innerHTML = `<img src="${u.avatar}" class="w-full h-full rounded-full object-cover" alt="${u.name}" onerror="this.parentElement.textContent='${(u.name||'U').charAt(0).toUpperCase()}'" />`;
      } else {
        avatar.textContent = (u.name || 'U').charAt(0).toUpperCase();
      }
      avatar.title = u.name || 'User';

      // Click avatar → go to dashboard
      avatar.onclick = () => { window.location.href = 'dashboard.html'; };
      avatar.style.cursor = 'pointer';
    }

    authBtn.innerHTML = '<i class="fas fa-sign-out-alt text-lg text-muted"></i>';
    authBtn.title = 'Sign out';
    authBtn.onclick = signOut;
  } else {
    if (avatarWrap) avatarWrap.classList.add('hidden');
    authBtn.innerHTML = '<i class="fas fa-user-circle text-lg"></i>';
    authBtn.title = 'Sign in';
    authBtn.onclick = toggleAuth;
  }

  if (appState.isPremium && upgradeBtn) {
    upgradeBtn.innerHTML = '<i class="fas fa-crown text-xs"></i><span class="hidden sm:inline">Pro ✓</span>';
    upgradeBtn.className = 'bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1';
    const adBanner = document.getElementById('ad-banner');
    if (adBanner) adBanner.style.display = 'none';
  }

  updateUsageCounter();
}

function toggleAuth() {
  if (appState.user) signOut();
  else openAuthModal();
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
  switchAuthTab('signin');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function closeAuthOnBackdrop(e) {
  if (e.target === document.getElementById('auth-modal')) closeAuthModal();
}

/* Tab switcher for Sign In / Sign Up panels */
function switchAuthTab(tab) {
  const signin = document.getElementById('panel-signin');
  const signup = document.getElementById('panel-signup');
  const tabSI  = document.getElementById('tab-signin');
  const tabSU  = document.getElementById('tab-signup');
  if (!signin || !signup) return;

  if (tab === 'signin') {
    signin.classList.remove('hidden');
    signup.classList.add('hidden');
    if (tabSI) { tabSI.className = 'flex-1 py-2 text-xs font-semibold bg-primary text-white transition-colors'; }
    if (tabSU) { tabSU.className = 'flex-1 py-2 text-xs font-semibold bg-white text-muted transition-colors'; }
  } else {
    signin.classList.add('hidden');
    signup.classList.remove('hidden');
    if (tabSI) { tabSI.className = 'flex-1 py-2 text-xs font-semibold bg-white text-muted transition-colors'; }
    if (tabSU) { tabSU.className = 'flex-1 py-2 text-xs font-semibold bg-primary text-white transition-colors'; }
  }
}

/* ---- Email Sign In ---- */
async function handleEmailSignIn(e) {
  e.preventDefault();
  const email    = document.getElementById('signin-email')?.value?.trim();
  const password = document.getElementById('signin-password')?.value;
  if (!email || !password) return;

  const user = await signInWithEmail(email, password);
  if (user) {
    appState.user = JSON.parse(localStorage.getItem('inv2xl_user') || 'null') || { name: email.split('@')[0], email, provider: 'email' };
    appState.isPremium = appState.user?.isPremium || false;
    updateAuthUI();
    closeAuthModal();
    showToast(`Welcome back! 👋`, 'success');
  }
}

/* ---- Email Sign Up ---- */
async function handleEmailSignUp(e) {
  e.preventDefault();
  const name     = document.getElementById('signup-name')?.value?.trim();
  const email    = document.getElementById('signup-email')?.value?.trim();
  const password = document.getElementById('signup-password')?.value;
  if (!name || !email || !password) return;

  const user = await signUpWithEmail(email, password, name);
  if (user) {
    closeAuthModal();
    // Toast is shown by signUpWithEmail (check email)
  }
}

/* ---- Google OAuth (uses supabase.js) ---- */
// signInWithGoogle() is already defined in supabase.js
// This is a page-level wrapper that also closes the modal after demo mode
const _origSignInWithGoogle = typeof signInWithGoogle === 'function' ? signInWithGoogle : null;

/* ---- Guest mode ---- */
function guestMode() {
  appState.user = { name: 'Guest', provider: 'guest', email: '', isPremium: false };
  saveUserState();
  updateAuthUI();
  closeAuthModal();
  showToast('Continuing as Guest', 'info');
}

/* ---- Sign Out ---- */
function signOut() {
  // Use supabase sign out if available
  if (typeof signOutUser === 'function') {
    signOutUser().then(() => {
      appState.user = null;
      appState.isPremium = false;
      updateAuthUI();
    });
  } else {
    appState.user = null;
    appState.isPremium = false;
    localStorage.removeItem('inv2xl_user');
    updateAuthUI();
    showToast('Signed out successfully', 'info');
  }
}

/* googleSignIn legacy alias — delegates to supabase.js */
function googleSignIn() {
  if (typeof signInWithGoogle === 'function') return signInWithGoogle();
}

/* ============================================================
   USAGE TRACKING
   ============================================================ */
function getUsage() {
  const today = new Date().toDateString();
  const raw = localStorage.getItem('inv2xl_usage');
  let usage = raw ? JSON.parse(raw) : {};
  if (usage.date !== today) {
    usage = { date: today, count: 0 };
    localStorage.setItem('inv2xl_usage', JSON.stringify(usage));
  }
  return usage;
}

function incrementUsage() {
  const usage = getUsage();
  usage.count += 1;
  localStorage.setItem('inv2xl_usage', JSON.stringify(usage));
  updateUsageCounter();
}

function updateUsageCounter() {
  const counter = document.getElementById('usage-counter');
  const text = document.getElementById('usage-text');
  if (!counter || !text) return;

  if (appState.isPremium) {
    counter.classList.add('hidden');
    return;
  }

  const usage = getUsage();
  counter.classList.remove('hidden');
  text.textContent = `${usage.count}/${APP_CONFIG.FREE_DAILY_LIMIT} today`;

  if (usage.count >= APP_CONFIG.FREE_DAILY_LIMIT) {
    counter.className = 'text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-full font-medium';
  } else if (usage.count === APP_CONFIG.FREE_DAILY_LIMIT - 1) {
    counter.className = 'text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-full font-medium';
  } else {
    counter.className = 'text-xs bg-slate-100 text-muted px-2 py-1 rounded-full font-medium';
  }
}

function canConvert() {
  if (appState.isPremium) return true;
  const usage = getUsage();
  return usage.count < APP_CONFIG.FREE_DAILY_LIMIT;
}

/* ============================================================
   FILE UPLOAD HANDLERS
   ============================================================ */
function triggerFileInput() {
  document.getElementById('file-input').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const zone = document.getElementById('drop-zone');
  zone.classList.add('drag-active');
  document.getElementById('drop-overlay').classList.remove('hidden');
}

function handleDragLeave(event) {
  event.preventDefault();
  const zone = document.getElementById('drop-zone');
  zone.classList.remove('drag-active');
  document.getElementById('drop-overlay').classList.add('hidden');
}

function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const zone = document.getElementById('drop-zone');
  zone.classList.remove('drag-active');
  document.getElementById('drop-overlay').classList.add('hidden');

  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      processFile(file);
    } else {
      showToast('Please upload a PDF file', 'error');
    }
  }
}

/* ============================================================
   MAIN PROCESS FILE
   ============================================================ */
async function processFile(file) {
  // Check usage limit
  if (!canConvert()) {
    openLimitModal();
    return;
  }

  appState.currentFile = file;

  // UI transitions
  showLoadingState();
  setStep(2);

  try {
    updateLoadingUI('Reading PDF...', 'Extracting text from pages', 20);

    const text = await extractTextFromPDF(file);

    updateLoadingUI('Analysing content...', 'Detecting line items & totals', 55);
    await sleep(400);

    const data = parseInvoiceData(text);

    updateLoadingUI('Building preview...', 'Almost done!', 85);
    await sleep(300);

    updateLoadingUI('Complete!', 'Your data is ready', 100);
    await sleep(400);

    // Store result
    appState.extractedData = data;

    // Increment usage
    incrementUsage();

    // Show results
    showResults(data);
    setStep(3);

    // Show interstitial ad (for free users)
    if (!appState.isPremium) {
      showInterstitialAd();
    }

  } catch (err) {
    console.error('[PDF Processing Error]', err);
    showToast('Error reading PDF. Showing demo data.', 'warning');

    // Fallback to demo data
    const demoData = { ...DEMO_DATA };
    appState.extractedData = demoData;
    incrementUsage();
    showResults(demoData);
    setStep(3);

    if (!appState.isPremium) showInterstitialAd();
  }
}

/* ============================================================
   PDF TEXT EXTRACTION
   ============================================================ */
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('PDF.js not loaded');
        }

        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }

        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

/* ============================================================
   INVOICE PARSING ENGINE
   ============================================================ */
function parseInvoiceData(text) {
  if (!text || text.trim().length < 20) {
    return { ...DEMO_DATA, isDemo: true };
  }

  const result = {
    invoiceNumber: '',
    invoiceDate: '',
    vendorName: '',
    customerName: '',
    items: [],
    subtotal: 0,
    gst: 0,
    gstRate: 0,
    grandTotal: 0,
    currency: detectCurrency(text),
    isDemo: false,
  };

  // --- Invoice Number ---
  const invNumMatch = text.match(/(?:invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*)([A-Z0-9\-\/]+)/i);
  result.invoiceNumber = invNumMatch ? invNumMatch[1].trim() : generateInvoiceNumber();

  // --- Invoice Date ---
  const datePatterns = [
    /(?:invoice\s*date|date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) { result.invoiceDate = m[1].trim(); break; }
  }
  if (!result.invoiceDate) result.invoiceDate = formatDate(new Date());

  // --- Vendor / Bill From ---
  const vendorMatch = text.match(/(?:from|vendor|supplier|billed?\s*by|company)[:\s]+([A-Za-z0-9\s&\.,]+?)(?:\n|,|\.|pvt|ltd|llc|inc)/i);
  result.vendorName = vendorMatch ? vendorMatch[1].trim().substring(0, 50) : extractFirstCompanyName(text);

  // --- Customer / Bill To ---
  const custMatch = text.match(/(?:to|bill\s*to|ship\s*to|customer|client)[:\s]+([A-Za-z0-9\s&\.,]+?)(?:\n|,|\.|pvt|ltd|llc|inc)/i);
  result.customerName = custMatch ? custMatch[1].trim().substring(0, 50) : '';

  // --- Line Items Extraction ---
  result.items = extractLineItems(text, result.currency);

  // --- Subtotal ---
  const subtotalMatch = text.match(/(?:sub\s*total|amount\s*before\s*tax)[:\s]*([\d,\.]+)/i);
  if (subtotalMatch) {
    result.subtotal = parseAmount(subtotalMatch[1]);
  }

  // --- GST / Tax ---
  const gstPatterns = [
    /(?:CGST|SGST|IGST|GST|VAT|Tax)\s*@?\s*(\d+(?:\.\d+)?)\s*%[:\s]*([\d,\.]+)/gi,
    /(?:tax\s*amount|GST\s*amount)[:\s]*([\d,\.]+)/i,
  ];
  let totalGST = 0;
  for (const p of gstPatterns) {
    const matches = [...text.matchAll(p)];
    for (const m of matches) {
      if (m[2]) {
        totalGST += parseAmount(m[2]);
        if (!result.gstRate && m[1]) result.gstRate = parseFloat(m[1]);
      } else if (m[1]) {
        totalGST += parseAmount(m[1]);
      }
    }
    if (totalGST > 0) break;
  }
  result.gst = totalGST;

  // --- Grand Total ---
  const grandPatterns = [
    /(?:grand\s*total|total\s*amount|net\s*payable|amount\s*due|total\s*payable)[:\s]*([\d,\.]+)/i,
    /(?:^|\s)total[:\s]*([\d,\.]+)/im,
  ];
  for (const p of grandPatterns) {
    const m = text.match(p);
    if (m) {
      result.grandTotal = parseAmount(m[1]);
      break;
    }
  }

  // --- Derive missing subtotal / grand total ---
  if (result.items.length > 0) {
    const calcSubtotal = result.items.reduce((s, i) => s + i.total, 0);
    if (!result.subtotal) result.subtotal = calcSubtotal;
    if (!result.grandTotal) {
      result.grandTotal = result.subtotal + result.gst;
    }
  }

  // If no items found at all, fall back to demo
  if (result.items.length === 0) {
    return { ...DEMO_DATA, isDemo: true,
      invoiceNumber: result.invoiceNumber || DEMO_DATA.invoiceNumber,
      invoiceDate: result.invoiceDate || DEMO_DATA.invoiceDate,
    };
  }

  return result;
}

/* ---- Line item extraction ---- */
function extractLineItems(text, currency) {
  const items = [];

  // Pattern: <description> <qty> <unit price> <total>
  // Multiple approaches for robustness

  // Approach 1: Look for rows with 3+ numbers that could be qty, price, total
  const itemPattern = /([A-Za-z][A-Za-z0-9\s\-\/\(\)\.,"']+?)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/g;
  const matches = [...text.matchAll(itemPattern)];

  for (const m of matches) {
    const name = m[1].trim();
    const qty = parseFloat(m[2]);
    const unitPrice = parseAmount(m[3]);
    const total = parseAmount(m[4]);

    // Validate: total should roughly = qty * unitPrice (within 5%)
    const calcTotal = qty * unitPrice;
    const diff = Math.abs(calcTotal - total);
    const tolerance = calcTotal * 0.05 + 1;

    // Filter out noise lines
    if (name.length < 2 || name.length > 80) continue;
    if (qty <= 0 || qty > 9999) continue;
    if (unitPrice <= 0) continue;
    if (total <= 0) continue;
    if (diff > tolerance && total > 0) continue; // doesn't compute

    // Skip lines that look like headers or totals
    const skipWords = /\b(total|subtotal|gst|tax|vat|cgst|sgst|igst|discount|amount|invoice|date|no\.|number|bill|from|to|payment)\b/i;
    if (skipWords.test(name) && name.split(' ').length < 3) continue;

    items.push({ name, qty, unitPrice, total });
  }

  // Approach 2: Simpler pattern if nothing found
  if (items.length === 0) {
    const simplePattern = /([A-Za-z][A-Za-z0-9\s\-\/\.]+?)\s+([\d,]+(?:\.\d{1,2})?)\s*(?:[\$₹€£])?\s*([\d,]+(?:\.\d{1,2})?)/g;
    const simple = [...text.matchAll(simplePattern)];
    for (const m of simple) {
      const name = m[1].trim();
      const unitPrice = parseAmount(m[2]);
      const total = parseAmount(m[3]);
      if (name.length < 3 || name.length > 60) continue;
      if (unitPrice <= 0 || total <= 0) continue;
      if (total < unitPrice) continue;
      const skipWords = /\b(total|subtotal|gst|tax|vat)\b/i;
      if (skipWords.test(name)) continue;
      const qty = Math.round(total / unitPrice) || 1;
      items.push({ name, qty, unitPrice, total });
      if (items.length >= 20) break;
    }
  }

  return items.slice(0, 30); // cap at 30 items
}

/* ---- Helper: detect currency ---- */
function detectCurrency(text) {
  if (/₹|INR|Rs\.?/i.test(text)) return '₹';
  if (/€|EUR/i.test(text)) return '€';
  if (/£|GBP/i.test(text)) return '£';
  if (/\$/i.test(text)) return '$';
  return '₹'; // default
}

/* ---- Helper: parse amount ---- */
function parseAmount(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;
}

/* ---- Helper: extract first company name ---- */
function extractFirstCompanyName(text) {
  const m = text.match(/([A-Z][A-Za-z\s]+(?:Pvt|Ltd|Inc|Corp|Co|LLP|Solutions|Services|Enterprises|Trading)[.\s]?[A-Za-z]*)/);
  return m ? m[1].trim().substring(0, 40) : '';
}

/* ---- Helper: generate invoice number ---- */
function generateInvoiceNumber() {
  return 'INV-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
}

/* ---- Helper: format date ---- */
function formatDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

/* ---- Helper: sleep ---- */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================================
   LOADING UI
   ============================================================ */
function showLoadingState() {
  document.getElementById('upload-section').classList.add('hidden');
  document.getElementById('how-it-works').classList.add('hidden');
  document.getElementById('testimonials').classList.add('hidden');
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('loading-section').classList.remove('hidden');
  setProgress(0);
}

function updateLoadingUI(title, subtitle, progress) {
  document.getElementById('loading-title').textContent = title;
  document.getElementById('loading-subtitle').textContent = subtitle;
  setProgress(progress);
}

function setProgress(pct) {
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  bar.style.width = pct + '%';
  if (text) text.textContent = pct + '%';
}

/* ============================================================
   STEP INDICATOR
   ============================================================ */
function setStep(step) {
  for (let i = 2; i <= 4; i++) {
    const el = document.getElementById('step-' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < step) {
      el.classList.add('done');
      el.className = 'step-item flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold';
      el.querySelector('.step-num').className = 'step-num w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs text-white';
      el.querySelector('.step-num').innerHTML = '<i class="fas fa-check text-xs"></i>';
    } else if (i === step) {
      el.className = 'step-item flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold';
      el.querySelector('.step-num').className = 'step-num w-4 h-4 bg-white/30 rounded-full flex items-center justify-center text-xs text-white';
      el.querySelector('.step-num').textContent = i;
    }
  }
}

/* ============================================================
   RESULTS RENDERING
   ============================================================ */
function showResults(data) {
  // Hide loading
  document.getElementById('loading-section').classList.add('hidden');
  // Show results
  document.getElementById('results-section').classList.remove('hidden');

  // Demo badge
  const demoBadge = document.getElementById('demo-badge');
  if (data.isDemo) {
    demoBadge.classList.remove('hidden');
  } else {
    demoBadge.classList.add('hidden');
  }

  // Render metadata
  renderInvoiceMeta(data);

  // Render table
  renderItemsTable(data);

  // Render summary
  renderSummary(data);

  // Update item count
  document.getElementById('item-count').textContent = data.items.length + ' items';

  // Scroll to results
  setTimeout(() => {
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  setStep(4);
}

function renderInvoiceMeta(data) {
  const meta = document.getElementById('invoice-meta');
  const fields = [
    { label: 'Invoice #', value: data.invoiceNumber || '—' },
    { label: 'Date', value: data.invoiceDate || '—' },
    { label: 'From', value: data.vendorName || '—' },
    { label: 'Bill To', value: data.customerName || '—' },
  ];

  meta.innerHTML = fields.map(f => `
    <div class="meta-card">
      <div class="meta-label">${f.label}</div>
      <div class="meta-value">${escapeHtml(f.value)}</div>
    </div>
  `).join('');
}

function renderItemsTable(data) {
  const tbody = document.getElementById('items-tbody');
  const sym = data.currency || '₹';

  if (data.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted text-sm">No items found</td></tr>`;
    return;
  }

  tbody.innerHTML = data.items.map((item, i) => `
    <tr style="animation-delay:${i * 60}ms">
      <td class="text-xs text-muted font-medium">${i + 1}</td>
      <td>
        <div class="editable-cell" contenteditable="true" data-field="name" data-idx="${i}"
          onblur="updateCell(${i},'name',this)">${escapeHtml(item.name)}</div>
      </td>
      <td class="text-center">
        <div class="editable-cell text-center" contenteditable="true" data-field="qty" data-idx="${i}"
          onblur="updateCell(${i},'qty',this)">${item.qty}</div>
      </td>
      <td class="text-right">
        <div class="editable-cell text-right" contenteditable="true" data-field="unitPrice" data-idx="${i}"
          onblur="updateCell(${i},'unitPrice',this)">${formatCurrency(sym, item.unitPrice)}</div>
      </td>
      <td class="text-right">
        <div class="font-semibold text-ink text-right px-1" id="total-${i}">${formatCurrency(sym, item.total)}</div>
      </td>
      <td>
        <button class="delete-row-btn" onclick="deleteRow(${i})" title="Delete row">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderSummary(data) {
  const sym = data.currency || '₹';
  const summary = document.getElementById('summary-section');

  let html = `
    <div class="summary-row subtotal">
      <span class="flex items-center gap-2"><i class="fas fa-receipt text-slate-400"></i>Subtotal</span>
      <span class="font-semibold">${formatCurrency(sym, data.subtotal)}</span>
    </div>
  `;

  if (data.gst > 0) {
    html += `
      <div class="summary-row gst">
        <span class="flex items-center gap-2"><i class="fas fa-percent text-amber-500"></i>GST${data.gstRate ? ' (' + data.gstRate + '%)' : ''}</span>
        <span>${formatCurrency(sym, data.gst)}</span>
      </div>
    `;
  }

  html += `
    <div class="summary-row grand-total mt-1">
      <span class="flex items-center gap-2"><i class="fas fa-check-circle text-primary"></i>Grand Total</span>
      <span>${formatCurrency(sym, data.grandTotal)}</span>
    </div>
  `;

  summary.innerHTML = html;
}

/* ============================================================
   TABLE EDITING
   ============================================================ */
function updateCell(idx, field, el) {
  if (!appState.extractedData) return;
  const raw = el.textContent.trim();

  if (field === 'name') {
    appState.extractedData.items[idx].name = raw;
  } else if (field === 'qty') {
    const qty = parseFloat(raw.replace(/[^\d.]/g, '')) || 0;
    appState.extractedData.items[idx].qty = qty;
    recalcTotal(idx);
  } else if (field === 'unitPrice') {
    const price = parseAmount(raw);
    appState.extractedData.items[idx].unitPrice = price;
    recalcTotal(idx);
  }
}

function recalcTotal(idx) {
  const item = appState.extractedData.items[idx];
  item.total = item.qty * item.unitPrice;
  const totalEl = document.getElementById('total-' + idx);
  if (totalEl) {
    totalEl.textContent = formatCurrency(appState.extractedData.currency || '₹', item.total);
  }
  recalcSummary();
}

function recalcSummary() {
  if (!appState.extractedData) return;
  const data = appState.extractedData;
  const newSubtotal = data.items.reduce((s, i) => s + i.total, 0);
  data.subtotal = newSubtotal;
  if (data.gstRate > 0) {
    data.gst = Math.round(newSubtotal * data.gstRate / 100);
  }
  data.grandTotal = data.subtotal + data.gst;
  renderSummary(data);
}

function addRow() {
  if (!appState.extractedData) return;
  const sym = appState.extractedData.currency || '₹';
  appState.extractedData.items.push({ name: 'New Item', qty: 1, unitPrice: 0, total: 0 });
  renderItemsTable(appState.extractedData);
  document.getElementById('item-count').textContent = appState.extractedData.items.length + ' items';
  showToast('Row added', 'success');
}

function deleteRow(idx) {
  if (!appState.extractedData) return;
  appState.extractedData.items.splice(idx, 1);
  renderItemsTable(appState.extractedData);
  recalcSummary();
  document.getElementById('item-count').textContent = appState.extractedData.items.length + ' items';
  showToast('Row deleted', 'info');
}

function clearAll() {
  if (!appState.extractedData) return;
  if (!confirm('Clear all items?')) return;
  appState.extractedData.items = [];
  renderItemsTable(appState.extractedData);
  recalcSummary();
  document.getElementById('item-count').textContent = '0 items';
}

/* ============================================================
   EXCEL EXPORT
   ============================================================ */
function exportToExcel() {
  if (!appState.extractedData) {
    showToast('No data to export', 'error');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Please refresh.', 'error');
    return;
  }

  const data = appState.extractedData;
  const sym = data.currency || '₹';
  const wb = XLSX.utils.book_new();

  // --- Build worksheet data ---
  const wsData = [];

  // App header
  wsData.push(['Invoice2Excel Pro', '', '', '', '']);
  wsData.push(['', '', '', '', '']);

  // Invoice metadata
  wsData.push(['Invoice Number', data.invoiceNumber || '', '', 'Date', data.invoiceDate || '']);
  wsData.push(['From', data.vendorName || '', '', 'Bill To', data.customerName || '']);
  wsData.push(['', '', '', '', '']);

  // Column headers
  wsData.push(['#', 'Item Description', 'Qty', `Unit Price (${sym})`, `Total (${sym})`]);

  // Items
  data.items.forEach((item, i) => {
    wsData.push([
      i + 1,
      item.name,
      item.qty,
      item.unitPrice,
      item.total,
    ]);
  });

  // Blank row
  wsData.push(['', '', '', '', '']);

  // Summary
  wsData.push(['', '', '', 'Subtotal', data.subtotal]);
  if (data.gst > 0) {
    wsData.push(['', '', '', `GST${data.gstRate ? ' (' + data.gstRate + '%)' : ''}`, data.gst]);
  }
  wsData.push(['', '', '', 'GRAND TOTAL', data.grandTotal]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // --- Column widths ---
  ws['!cols'] = [
    { wch: 4  },  // #
    { wch: 38 },  // Description
    { wch: 8  },  // Qty
    { wch: 16 },  // Unit Price
    { wch: 16 },  // Total
  ];

  // --- Cell styling ---
  const headerRowIdx = 5; // 0-indexed row for column headers (row 6 in 1-indexed)

  // Title cell
  const titleCell = ws['A1'];
  if (titleCell) {
    titleCell.s = {
      font: { bold: true, sz: 16, color: { rgb: '2563EB' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
    };
  }

  // Column header row styling
  ['A', 'B', 'C', 'D', 'E'].forEach(col => {
    const cell = ws[col + (headerRowIdx + 1)];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '2563EB' } },
        alignment: { horizontal: 'center' },
      };
    }
  });

  // Grand total row
  const grandTotalRowIdx = wsData.length;
  const grandTotalCell = ws['D' + grandTotalRowIdx];
  const grandTotalValCell = ws['E' + grandTotalRowIdx];
  if (grandTotalCell) {
    grandTotalCell.s = { font: { bold: true, sz: 12, color: { rgb: '1D4ED8' } } };
  }
  if (grandTotalValCell) {
    grandTotalValCell.s = { font: { bold: true, sz: 12, color: { rgb: '1D4ED8' } } };
  }

  // Number format for price columns
  const startDataRow = headerRowIdx + 2;
  const endDataRow = headerRowIdx + 1 + data.items.length;
  for (let r = startDataRow; r <= endDataRow; r++) {
    const priceCell = ws['D' + r];
    const totalCell = ws['E' + r];
    if (priceCell) priceCell.z = '#,##0.00';
    if (totalCell) totalCell.z = '#,##0.00';
  }

  // Append sheet
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice Data');

  // --- Generate filename ---
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `invoice_${ts}.xlsx`;

  // Write and download
  XLSX.writeFile(wb, filename);

  showToast('Excel file downloaded! 🎉', 'success');
  triggerConfetti();
  setStep(4);
}

/* ============================================================
   RESET APP
   ============================================================ */
function resetApp() {
  appState.currentFile = null;
  appState.extractedData = null;

  // Reset file input
  const fi = document.getElementById('file-input');
  if (fi) fi.value = '';

  // Show upload
  document.getElementById('upload-section').classList.remove('hidden');
  document.getElementById('how-it-works').classList.remove('hidden');
  document.getElementById('testimonials').classList.remove('hidden');
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('loading-section').classList.add('hidden');

  // Reset steps
  ['step-2','step-3','step-4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = 'step-item flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-muted text-xs font-semibold';
      const stepNum = el.querySelector('.step-num');
      if (stepNum) {
        stepNum.className = 'step-num w-4 h-4 bg-slate-300 rounded-full flex items-center justify-center text-xs text-white';
        stepNum.innerHTML = id.replace('step-','');
      }
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ADS SYSTEM
   ============================================================ */
let interstitialTimer = null;

function showInterstitialAd() {
  if (appState.isPremium) return;
  const modal = document.getElementById('interstitial-modal');
  const closeBtn = document.getElementById('interstitial-close-btn');
  const countdown = document.getElementById('interstitial-countdown');

  modal.classList.remove('hidden');
  closeBtn.disabled = true;

  let secs = APP_CONFIG.INTERSTITIAL_COUNTDOWN;
  countdown.textContent = secs;

  interstitialTimer = setInterval(() => {
    secs--;
    countdown.textContent = secs;
    if (secs <= 0) {
      clearInterval(interstitialTimer);
      closeBtn.disabled = false;
      countdown.textContent = '✓';
    }
  }, 1000);
}

function closeInterstitial() {
  if (interstitialTimer) clearInterval(interstitialTimer);
  document.getElementById('interstitial-modal').classList.add('hidden');
  // Scroll to results after closing
  const results = document.getElementById('results-section');
  if (results && !results.classList.contains('hidden')) {
    results.scrollIntoView({ behavior: 'smooth' });
  }
}

function dismissAd() {
  const banner = document.getElementById('ad-banner');
  banner.classList.add('hidden-banner');
  setTimeout(() => banner.classList.add('hidden'), 350);
}

/* ---- Reward Ad ---- */
let rewardAdTimer = null;
let rewardAdRunning = false;

function watchRewardAd() {
  if (appState.isPremium) return;
  document.getElementById('reward-modal').classList.remove('hidden');
}

function closeRewardModal() {
  document.getElementById('reward-modal').classList.add('hidden');
  if (rewardAdTimer) clearInterval(rewardAdTimer);
  rewardAdRunning = false;
}

function startRewardAd() {
  if (rewardAdRunning) return;
  rewardAdRunning = true;

  const startBtn = document.getElementById('reward-start-btn');
  const progressBar = document.getElementById('reward-progress-bar');
  const timer = document.getElementById('reward-timer');
  const content = document.getElementById('reward-video-content');

  startBtn.disabled = true;
  progressBar.classList.remove('hidden');

  content.innerHTML = `
    <div class="text-center text-white p-4">
      <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-2">
        <i class="fas fa-chart-bar text-3xl"></i>
      </div>
      <p class="font-bold">FreshBooks Accounting</p>
      <p class="text-xs opacity-70">Invoicing made simple</p>
    </div>
  `;

  let elapsed = 0;
  const total = APP_CONFIG.REWARD_AD_DURATION;

  rewardAdTimer = setInterval(() => {
    elapsed++;
    const pct = (elapsed / total) * 100;
    progressBar.style.width = pct + '%';
    timer.textContent = (total - elapsed) + 's';

    if (elapsed >= total) {
      clearInterval(rewardAdTimer);
      rewardAdRunning = false;
      grantRewardConversion();
    }
  }, 1000);
}

function grantRewardConversion() {
  // Add 1 extra conversion
  const usage = getUsage();
  if (usage.count > 0) usage.count--;
  localStorage.setItem('inv2xl_usage', JSON.stringify(usage));
  updateUsageCounter();

  closeRewardModal();
  showToast('+1 conversion unlocked! 🎁', 'success');
}

/* ============================================================
   PRICING MODAL
   ============================================================ */
function openPricingModal() {
  document.getElementById('pricing-modal').classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricing-modal').classList.add('hidden');
}

function closePricingOnBackdrop(e) {
  if (e.target === document.getElementById('pricing-modal')) closePricingModal();
}

/* ---- Card formatting helpers ---- */
function formatCardNumber(el) {
  let val = el.value.replace(/\D/g, '').substring(0, 16);
  val = val.replace(/(.{4})/g, '$1 ').trim();
  el.value = val;
}

function formatExpiry(el) {
  let val = el.value.replace(/\D/g, '').substring(0, 4);
  if (val.length >= 3) val = val.substring(0,2) + '/' + val.substring(2);
  el.value = val;
}

function processPurchase() {
  const cardNum = (document.getElementById('card-number').value || '').replace(/\s/g, '');
  const expiry  = document.getElementById('card-expiry').value || '';
  const cvv     = document.getElementById('card-cvv').value || '';

  // Validation
  if (cardNum.length !== 16) {
    showToast('Please enter a valid 16-digit card number', 'error');
    return;
  }
  if (expiry.length !== 5) {
    showToast('Please enter a valid expiry date (MM/YY)', 'error');
    return;
  }
  if (cvv.length !== 3) {
    showToast('Please enter a valid 3-digit CVV', 'error');
    return;
  }

  // Simulate processing
  const btn = event.target.closest('button');
  const origText = btn.innerHTML;
  btn.innerHTML = '<div class="loading-spinner-sm mr-2"></div> Processing...';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = origText;
    btn.disabled = false;

    if (cardNum === '4242424242424242') {
      // Success
      appState.isPremium = true;
      saveUserState();
      updateAuthUI();
      closePricingModal();
      showToast('🎉 Welcome to Pro! Unlimited conversions unlocked!', 'success');
      updateUsageCounter();
      // Hide ads
      document.getElementById('ad-banner').style.display = 'none';
    } else {
      showToast('Payment failed. Use test card: 4242 4242 4242 4242', 'error');
    }
  }, 2000);
}

/* ============================================================
   LIMIT MODAL
   ============================================================ */
function openLimitModal() {
  document.getElementById('limit-modal').classList.remove('hidden');
}

function closeLimitModal() {
  document.getElementById('limit-modal').classList.add('hidden');
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<i class="fas fa-check"></i>',
    error:   '<i class="fas fa-exclamation-circle"></i>',
    info:    '<i class="fas fa-info"></i>',
    warning: '<i class="fas fa-exclamation-triangle"></i>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <span class="toast-msg">${escapeHtml(msg)}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ============================================================
   CONFETTI
   ============================================================ */
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext('2d');
  const colors = ['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      p.opacity = Math.max(0, 1 - p.y / (canvas.height * 0.85));

      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.angle);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (frame < 120) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
    }
  }

  animate();
}

/* ============================================================
   HELPER UTILITIES
   ============================================================ */
function formatCurrency(sym, amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return sym + '0';
  return sym + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', (e) => {
  // Escape closes modals
  if (e.key === 'Escape') {
    document.getElementById('pricing-modal').classList.add('hidden');
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('reward-modal').classList.add('hidden');
    document.getElementById('limit-modal').classList.add('hidden');
    if (!document.getElementById('interstitial-close-btn').disabled) {
      closeInterstitial();
    }
  }
  // Ctrl+S exports
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (appState.extractedData) exportToExcel();
  }
});

/* ============================================================
   TOUCH / MOBILE ENHANCEMENTS
   ============================================================ */
// Prevent double-tap zoom on buttons — attach after DOM is ready
function applyTouchEnhancements() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.touchBound) return;
    btn.dataset.touchBound = '1';
    btn.addEventListener('touchend', (e) => {
      // Only prevent default on buttons that are not inside editable areas
      if (!btn.closest('[contenteditable]')) {
        e.preventDefault();
        btn.click();
      }
    }, { passive: false });
  });
}
// Run once on init and after dynamic content renders
document.addEventListener('DOMContentLoaded', applyTouchEnhancements);

/* ============================================================
   DEMO TRIGGER (for testing)
   ============================================================ */
// Expose demo function for easy testing
window.loadDemo = function() {
  appState.extractedData = { ...DEMO_DATA };
  showLoadingState();
  setStep(2);
  setTimeout(() => {
    updateLoadingUI('Analysing...', 'Detecting items', 60);
    setTimeout(() => {
      updateLoadingUI('Done!', 'Preview ready', 100);
      setTimeout(() => {
        appState.extractedData = { ...DEMO_DATA };
        showResults(appState.extractedData);
      }, 300);
    }, 600);
  }, 400);
};

console.log('%cInvoice2Excel Pro v1.0', 'color:#2563EB;font-weight:bold;font-size:16px;');
console.log('%cTip: Run loadDemo() to load sample data', 'color:#64748B;');
