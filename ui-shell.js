/* ============================================================
   All-in-One Business Toolkit — Shared App Shell
   Injects bottom navigation + shared branding into each page.
   ============================================================ */

'use strict';

const SHELL_CONFIG = {
  appName: 'Invoice2Excel Pro',
  shortName: 'Biz Toolkit',
  logoSrc: 'assets/logo.png', // Assumed path for uploaded logo
};

function initAppShell() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const page = body.getAttribute('data-page') || 'dashboard';
    injectBottomNav(page);
  });
}

function injectBottomNav(active) {
  // Avoid duplicate nav
  if (document.getElementById('bottom-nav-shell')) return;

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav-shell';
  nav.className =
    'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(15,23,42,0.06)]';

  const itemBase =
    'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[11px] font-semibold transition-colors';
  const inactive =
    'text-slate-400 hover:text-primary';
  const activeCls =
    'text-primary';

  function cls(id) {
    return itemBase + ' ' + (active === id ? activeCls : inactive);
  }

  nav.innerHTML = `
    <div class="max-w-4xl mx-auto px-2">
      <div class="flex items-stretch gap-1">
        <a href="home.html" class="${cls('dashboard')}">
          <i class="fas fa-home text-base"></i>
          <span>Dashboard</span>
        </a>
        <a href="dashboard.html" class="${cls('invoices')}">
          <i class="fas fa-file-invoice text-base"></i>
          <span>Invoices</span>
        </a>
        <a href="tools.html" class="${cls('tools')}">
          <i class="fas fa-toolbox text-base"></i>
          <span>Tools</span>
        </a>
        <a href="clients.html" class="${cls('clients')}">
          <i class="fas fa-users text-base"></i>
          <span>Clients</span>
        </a>
        <a href="invoice-converter.html" class="${cls('converter')}">
          <i class="fas fa-file-import text-base"></i>
          <span>Convert</span>
        </a>
        <a href="settings.html" class="${cls('settings')}">
          <i class="fas fa-cog text-base"></i>
          <span>Settings</span>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(nav);
}

initAppShell();

console.log('[UI Shell] Bottom navigation initialized');

