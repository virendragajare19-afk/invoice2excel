/* ============================================================
   Invoice2Excel Pro — Supabase Client & Auth Module
   Version 2.0.0
   ============================================================
   SETUP INSTRUCTIONS:
   1. Create a free project at https://supabase.com
   2. Go to Settings → API → copy Project URL & anon public key
   3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
   4. In Supabase Dashboard → Authentication → Providers → Google:
      - Enable Google provider
      - Set Client ID & Secret from Google Cloud Console
      - Add redirect URL: https://YOUR_DOMAIN/auth-callback.html
   5. Run the SQL in setupDatabase() to create tables
   ============================================================ */

'use strict';

/* ============================================================
   CONFIGURATION  ← ★ REPLACE THESE WITH YOUR PROJECT VALUES ★
   ============================================================ */
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

/* ============================================================
   SQL TO RUN IN SUPABASE SQL EDITOR (one-time setup)
   ============================================================
   -- Profiles table (auto-created on first login)
   create table if not exists public.profiles (
     id           uuid references auth.users on delete cascade primary key,
     email        text,
     full_name    text,
     avatar_url   text,
     is_premium   boolean default false,
     plan         text default 'free',
     created_at   timestamptz default now(),
     updated_at   timestamptz default now()
   );
   alter table public.profiles enable row level security;
   create policy "Users can view own profile" on public.profiles
     for select using (auth.uid() = id);
   create policy "Users can update own profile" on public.profiles
     for update using (auth.uid() = id);

   -- Invoices table
   create table if not exists public.invoices (
     id           uuid default gen_random_uuid() primary key,
     user_id      uuid references auth.users on delete cascade not null,
     invoice_number text,
     invoice_date text,
     due_date     text,
     vendor_name  text,
     client_name  text,
     subtotal     numeric default 0,
     tax          numeric default 0,
     discount     numeric default 0,
     grand_total  numeric default 0,
     currency     text default '₹',
     status       text default 'draft',
     template_id  integer default 1,
     data         jsonb,
     created_at   timestamptz default now(),
     updated_at   timestamptz default now()
   );
   alter table public.invoices enable row level security;
   create policy "Users can CRUD own invoices" on public.invoices
     for all using (auth.uid() = user_id);

   -- Drafts table
   create table if not exists public.drafts (
     id           uuid default gen_random_uuid() primary key,
     user_id      uuid references auth.users on delete cascade not null,
     draft_data   jsonb,
     updated_at   timestamptz default now()
   );
   alter table public.drafts enable row level security;
   create policy "Users can CRUD own drafts" on public.drafts
     for all using (auth.uid() = user_id);

   -- Trigger to auto-create profile on signup
   create or replace function public.handle_new_user()
   returns trigger as $$
   begin
     insert into public.profiles (id, email, full_name, avatar_url)
     values (
       new.id,
       new.email,
       new.raw_user_meta_data->>'full_name',
       new.raw_user_meta_data->>'avatar_url'
     );
     return new;
   end;
   $$ language plpgsql security definer;

   drop trigger if exists on_auth_user_created on auth.users;
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute procedure public.handle_new_user();
   ============================================================ */

/* ============================================================
   SUPABASE CLIENT INITIALISATION
   ============================================================ */
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.warn('[Supabase] SDK not loaded yet. Using offline/localStorage fallback.');
    return null;
  }

  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'inv2xl_sb_session',
    }
  });

  // Listen to auth state changes globally
  _supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth]', event, session?.user?.email ?? 'no user');

    if (event === 'SIGNED_IN' && session?.user) {
      await syncProfileToLocal(session.user);
      triggerAuthUpdate(session.user);
    }

    if (event === 'SIGNED_OUT') {
      clearLocalSession();
      triggerAuthUpdate(null);
    }

    if (event === 'TOKEN_REFRESHED') {
      console.log('[Auth] Token refreshed');
    }
  });

  return _supabase;
}

/* ============================================================
   GOOGLE OAUTH SIGN IN
   ============================================================ */
async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) {
    // Fallback: simulated sign-in when Supabase not configured
    return simulatedGoogleSignIn();
  }

  // Determine redirect URL
  const redirectTo = window.location.origin + '/auth-callback.html';

  showAuthLoading(true);

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error('[Auth] Google sign-in error:', error.message);
    showAuthLoading(false);
    showToast('Google sign-in failed: ' + error.message, 'error');
    return null;
  }

  // Browser will redirect to Google — no further action needed here
  return data;
}

/* ============================================================
   EMAIL / PASSWORD SIGN IN
   ============================================================ */
async function signInWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) return simulatedEmailSignIn(email);

  showAuthLoading(true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  showAuthLoading(false);

  if (error) {
    showToast('Sign in failed: ' + error.message, 'error');
    return null;
  }

  return data.user;
}

/* ============================================================
   EMAIL SIGN UP
   ============================================================ */
async function signUpWithEmail(email, password, fullName) {
  const sb = getSupabase();
  if (!sb) return null;

  showAuthLoading(true);
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  showAuthLoading(false);

  if (error) {
    showToast('Sign up failed: ' + error.message, 'error');
    return null;
  }

  showToast('Verification email sent! Check your inbox.', 'success');
  return data.user;
}

/* ============================================================
   SIGN OUT
   ============================================================ */
async function signOutUser() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  clearLocalSession();
  triggerAuthUpdate(null);
  showToast('Signed out successfully', 'info');
}

/* ============================================================
   GET CURRENT SESSION / USER
   ============================================================ */
async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) {
    // Fallback to localStorage
    const raw = localStorage.getItem('inv2xl_user');
    return raw ? JSON.parse(raw) : null;
  }

  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return null;
  return session.user;
}

async function getCurrentSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

/* ============================================================
   PROFILE MANAGEMENT
   ============================================================ */
async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[Profile] fetch error:', error.message);
    return null;
  }
  return data;
}

async function updateProfile(userId, updates) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.warn('[Profile] update error:', error.message);
    return null;
  }
  return data;
}

/* ============================================================
   SYNC SUPABASE USER → localStorage
   ============================================================ */
async function syncProfileToLocal(sbUser) {
  if (!sbUser) return;

  // Try to get profile from DB
  const profile = await getProfile(sbUser.id);

  const userObj = {
    id:        sbUser.id,
    email:     sbUser.email,
    name:      profile?.full_name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
    avatar:    profile?.avatar_url || sbUser.user_metadata?.avatar_url || null,
    provider:  sbUser.app_metadata?.provider || 'email',
    isPremium: profile?.is_premium || false,
    plan:      profile?.plan || 'free',
    supabase:  true,
  };

  localStorage.setItem('inv2xl_user', JSON.stringify(userObj));
  localStorage.setItem('inv2xl_premium', userObj.isPremium ? 'true' : 'false');

  return userObj;
}

function clearLocalSession() {
  localStorage.removeItem('inv2xl_user');
  localStorage.removeItem('inv2xl_premium');
}

/* ============================================================
   INVOICES — CRUD
   ============================================================ */
async function saveInvoiceToSupabase(invoiceData) {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) {
    // Fall back to localStorage
    return saveInvoiceLocal(invoiceData);
  }

  const payload = {
    user_id:        user.id,
    invoice_number: invoiceData.invoiceNumber || '',
    invoice_date:   invoiceData.invoiceDate || '',
    due_date:       invoiceData.dueDate || '',
    vendor_name:    invoiceData.businessName || invoiceData.vendorName || '',
    client_name:    invoiceData.clientName || '',
    subtotal:       parseFloat(invoiceData.subtotal) || 0,
    tax:            parseFloat(invoiceData.totalGST) || parseFloat(invoiceData.tax) || 0,
    discount:       parseFloat(invoiceData.discount) || 0,
    grand_total:    parseFloat(invoiceData.grandTotal) || 0,
    currency:       invoiceData.currency || '₹',
    status:         invoiceData.status || 'saved',
    template_id:    invoiceData.templateId || 1,
    data:           invoiceData,
    updated_at:     new Date().toISOString(),
  };

  let result;
  if (invoiceData._dbId) {
    // Update existing
    const { data, error } = await sb
      .from('invoices')
      .update(payload)
      .eq('id', invoiceData._dbId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) { console.error('[Invoice] update error:', error.message); return null; }
    result = data;
  } else {
    // Insert new
    const { data, error } = await sb
      .from('invoices')
      .insert(payload)
      .select()
      .single();

    if (error) { console.error('[Invoice] insert error:', error.message); return null; }
    result = data;
  }

  return result;
}

async function getInvoices(page = 1, limit = 20) {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) return getInvoicesLocal();

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  const { data, error, count } = await sb
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) { console.error('[Invoices] fetch error:', error.message); return []; }
  return { data: data || [], total: count || 0 };
}

async function getInvoiceById(id) {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) return null;

  const { data, error } = await sb
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) { console.error('[Invoice] get error:', error.message); return null; }
  return data;
}

async function deleteInvoice(id) {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) return;

  const { error } = await sb
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) console.error('[Invoice] delete error:', error.message);
  return !error;
}

/* ============================================================
   DRAFTS — CLOUD SYNC
   ============================================================ */
async function saveDraftToSupabase(draftData) {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) {
    localStorage.setItem('inv2xl_draft', JSON.stringify({ data: draftData, savedAt: new Date().toISOString() }));
    return;
  }

  // Upsert single draft per user (one active draft)
  const existing = await getDraftFromSupabase();

  if (existing) {
    await sb
      .from('drafts')
      .update({ draft_data: draftData, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  } else {
    await sb
      .from('drafts')
      .insert({ user_id: user.id, draft_data: draftData, updated_at: new Date().toISOString() });
  }
}

async function getDraftFromSupabase() {
  const sb = getSupabase();
  const user = await getCurrentUser();
  if (!sb || !user) {
    const raw = localStorage.getItem('inv2xl_draft');
    return raw ? JSON.parse(raw) : null;
  }

  const { data, error } = await sb
    .from('drafts')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

async function deleteDraft() {
  const sb = getSupabase();
  const user = await getCurrentUser();
  localStorage.removeItem('inv2xl_draft');
  if (!sb || !user) return;

  await sb.from('drafts').delete().eq('user_id', user.id);
}

/* ============================================================
   LOCAL FALLBACKS (when Supabase not configured)
   ============================================================ */
function saveInvoiceLocal(invoiceData) {
  const list = JSON.parse(localStorage.getItem('inv2xl_invoices') || '[]');
  const invoice = { ...invoiceData, _localId: Date.now().toString(), savedAt: new Date().toISOString() };
  list.unshift(invoice);
  if (list.length > 50) list.splice(50);
  localStorage.setItem('inv2xl_invoices', JSON.stringify(list));
  return invoice;
}

function getInvoicesLocal() {
  const list = JSON.parse(localStorage.getItem('inv2xl_invoices') || '[]');
  return { data: list, total: list.length };
}

/* ============================================================
   SIMULATED AUTH FALLBACKS (demo mode)
   ============================================================ */
function simulatedGoogleSignIn() {
  return new Promise((resolve) => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      // Show name prompt inside existing modal
      showSimulatedAuthPrompt(resolve);
    } else {
      const name = prompt('Enter your name (Demo — configure Supabase for real Google login):');
      if (name && name.trim()) {
        const user = createSimulatedUser(name.trim(), 'google');
        localStorage.setItem('inv2xl_user', JSON.stringify(user));
        triggerAuthUpdate(user);
        showToast(`Welcome, ${user.name}! 👋`, 'success');
        resolve(user);
      } else {
        resolve(null);
      }
    }
  });
}

function simulatedEmailSignIn(email) {
  const user = createSimulatedUser(email.split('@')[0], 'email', email);
  localStorage.setItem('inv2xl_user', JSON.stringify(user));
  triggerAuthUpdate(user);
  showToast(`Welcome back! 👋`, 'success');
  return user;
}

function createSimulatedUser(name, provider = 'google', email = null) {
  return {
    id: 'local_' + Date.now(),
    name,
    email: email || name.toLowerCase().replace(/\s+/g, '.') + '@gmail.com',
    provider,
    avatar: null,
    isPremium: false,
    plan: 'free',
    supabase: false,
  };
}

function showSimulatedAuthPrompt(resolve) {
  // Inject a simple prompt into the auth modal
  const container = document.getElementById('auth-modal-body');
  if (!container) {
    simulatedGoogleSignIn_fallback(resolve);
    return;
  }

  const orig = container.innerHTML;
  container.innerHTML = `
    <div class="text-center py-4">
      <div class="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg class="w-8 h-8" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      </div>
      <p class="text-sm text-muted mb-3">Demo mode — configure Supabase for real Google OAuth</p>
      <input id="sim-name-input" type="text" placeholder="Your name" class="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <button onclick="window._simResolve && window._simResolve(document.getElementById('sim-name-input').value)" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm">Continue</button>
      <button onclick="document.getElementById('auth-modal-body').innerHTML=window._simOrig" class="mt-2 text-xs text-muted underline">Back</button>
    </div>
  `;
  window._simOrig = orig;
  window._simResolve = (name) => {
    container.innerHTML = orig;
    delete window._simResolve;
    delete window._simOrig;
    if (name && name.trim()) {
      const user = createSimulatedUser(name.trim(), 'google');
      localStorage.setItem('inv2xl_user', JSON.stringify(user));
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.add('hidden');
      triggerAuthUpdate(user);
      showToast(`Welcome, ${user.name}! 👋`, 'success');
      resolve(user);
    } else {
      resolve(null);
    }
  };
}

/* ============================================================
   AUTH STATE CHANGE TRIGGER
   Calls updateAuthUI() on whichever page is active
   ============================================================ */
function triggerAuthUpdate(user) {
  // Update localStorage user
  if (user) {
    const existing = localStorage.getItem('inv2xl_user');
    if (!existing || JSON.parse(existing).id !== user.id) {
      if (!user.name && user.user_metadata) {
        user.name = user.user_metadata.full_name || user.email?.split('@')[0] || 'User';
      }
      localStorage.setItem('inv2xl_user', JSON.stringify(user));
    }
  }

  // Call page-level update function if it exists
  if (typeof updateAuthUI === 'function') updateAuthUI(user);
  if (typeof onAuthChange === 'function') onAuthChange(user);
}

/* ============================================================
   AUTH LOADING STATE
   ============================================================ */
function showAuthLoading(show) {
  const btn = document.getElementById('google-signin-btn');
  if (!btn) return;
  if (show) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin w-5 h-5 mr-2 inline" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Connecting to Google…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-5 h-5 mr-2 inline" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google`;
  }
}

/* ============================================================
   UTILITY — safe showToast (works even if not loaded yet)
   ============================================================ */
function _sbToast(msg, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    console.log(`[Toast][${type}]`, msg);
  }
}

/* Re-export as showToast alias for internal use */
const _origShowToast = typeof showToast !== 'undefined' ? showToast : null;

/* ============================================================
   INIT — Auto-restore session on page load
   ============================================================ */
(async function initSupabase() {
  const sb = getSupabase();
  if (!sb) {
    console.warn('[Supabase] Running in offline/demo mode. Configure SUPABASE_URL & SUPABASE_ANON to enable real auth.');
    return;
  }

  // Restore session
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await syncProfileToLocal(session.user);
    // Notify UI after a short delay (let page scripts load)
    setTimeout(() => triggerAuthUpdate(session.user), 300);
  }
})();
