# Invoice2Excel Pro — v2.0

A full-featured, mobile-first Progressive Web App (PWA) that:
- Converts invoice PDFs → Excel (`.xlsx`) using pdf.js + SheetJS
- Creates professional GST invoices (3-step generator, 7 templates)
- Authenticates users via **real Google OAuth** (Supabase) or email/password
- Persists invoices & drafts to **Supabase Postgres** (with localStorage fallback)
- Works fully offline via Service Worker caching

---

## 🚀 Entry Points

| Path | Description |
|---|---|
| `index.html` | Main app — PDF → Excel converter + auth modal |
| `invoice-generator.html` | 3-step invoice creator |
| `dashboard.html` | Invoice history & management |
| `auth-callback.html` | OAuth redirect handler (Google sign-in return URL) |

---

## ✅ Completed Features

### Auth System (v2.0)
- **Real Google OAuth** via Supabase Auth — redirects to Google, returns to `auth-callback.html`
- **Email/Password** sign-up and sign-in with Supabase
- **Guest mode** (local-only, no account needed)
- Session persisted in `localStorage` (`inv2xl_sb_session`) + auto-refreshed by Supabase SDK
- Avatar with Google profile photo displayed in headers across all pages
- Sign-out clears Supabase session + localStorage
- Tab-based Sign In / Sign Up UI in auth modal
- `auth-callback.html` handles the OAuth code exchange, shows countdown redirect

### Database (Supabase)
- **`profiles` table** — auto-created on first login via trigger; stores name, avatar, premium status
- **`invoices` table** — per-user invoice storage with RLS policies
- **`drafts` table** — per-user single active draft (cloud autosave)
- Full Row Level Security — users only see/edit their own data
- `supabase.js` provides all CRUD helpers with localStorage fallback when offline

### PDF → Excel Converter
- pdf.js text extraction with dual regex engine
- Detects: line items, invoice#, date, vendor, customer, subtotal, GST/VAT, total, currency (₹/$€£)
- Fallback demo data if parsing fails
- Editable preview table with add/delete rows, auto-recalculate
- SheetJS `.xlsx` export with bold headers, number formatting, auto column widths
- 3 free/day usage counter (localStorage, date-keyed)

### Invoice Generator (3-Step)
- **Step 1**: Auto invoice#, dates, business/client info, logo upload, dynamic item table (HSN/SAC, GST%, CGST/SGST), number-to-words, terms/notes/signature, auto-save draft every 30s → Supabase cloud
- **Step 2**: Bank details (IFSC, account no.) + UPI with live QR code
- **Step 3**: 7 template thumbnails, color picker, font selector, PDF settings (A4/Letter, margin, scale, landscape), watermark (free users), live preview, PDF download, WhatsApp/email/print share
- Invoices saved to Supabase on download/save; falls back to localStorage

### Dashboard
- Invoice history loaded from Supabase (or localStorage for guests)
- Stats row: total, saved, drafts, total value
- Search by invoice# or client name
- Filter by status (saved/draft/downloaded)
- Sort: newest, oldest, amount ↑↓
- Paginated list (10/page)
- Invoice detail modal: line items preview, totals, open/edit → generator, delete
- Delete from Supabase or localStorage

### Monetization
- Free tier: 3 conversions/day, 2 templates, watermark, banner + rewarded ads
- Pro tier: Stripe test card `4242 4242 4242 4242`, unlimited, no watermark
- Interstitial ad (5s countdown), reward ad (+1 conversion)
- Premium badge in header

### PWA
- `manifest.json` with standalone display, SVG icons (192/512)
- `sw.js` caches entire app shell (v2.0 cache busted) + offline fallback
- Custom install prompt after 30s or on 2nd visit
- Background sync & push notification stubs

---

## ⚙️ Supabase Setup (One-Time)

### 1. Create Project
1. Sign up free at [supabase.com](https://supabase.com)
2. Create a new project, note the **Project URL** and **anon public key**

### 2. Configure Keys
Edit **`supabase.js`** and **`auth-callback.html`** — replace:
```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
```

### 3. Create Tables
In Supabase Dashboard → SQL Editor, run the SQL block at the top of `supabase.js` (inside the large comment block). It creates:
- `profiles` table + RLS policies + auto-create trigger
- `invoices` table + RLS
- `drafts` table + RLS

### 4. Enable Google OAuth
1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Paste your **Google Client ID** and **Client Secret** (from Google Cloud Console → OAuth 2.0)
3. Add Authorized Redirect URI in Google Cloud: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
4. Set Site URL in Supabase → Authentication → URL Configuration: `https://YOUR_DOMAIN`
5. Add `https://YOUR_DOMAIN/auth-callback.html` to Redirect URLs

### 5. Deploy
Publish via the **Publish tab** — your domain becomes the redirect URL.

---

## 📁 File Structure

```
index.html              Main PDF→Excel page
invoice-generator.html  3-step invoice creator
dashboard.html          Invoice history dashboard
auth-callback.html      Google OAuth return handler
supabase.js             Supabase client, auth, CRUD helpers
app.js                  PDF extraction, auth UI, export logic
generator-step1.js      Step 1: invoice details, items, draft save
generator-step2.js      Step 2: bank & UPI details
generator-step3.js      Step 3: templates, PDF export, Supabase save
templates.js            7 invoice template renderers
style.css               Global styles & animations
generator.css           Generator-specific styles
manifest.json           PWA manifest
sw.js                   Service worker (cache v2.0)
README.md               This file
icons/
  icon-192.svg
  icon-512.svg
```

---

## 🗃️ Data Models

### Supabase Tables

**profiles**
```
id (uuid PK), email, full_name, avatar_url, is_premium, plan, created_at, updated_at
```

**invoices**
```
id (uuid), user_id (FK), invoice_number, invoice_date, due_date, vendor_name,
client_name, subtotal, tax, discount, grand_total, currency, status,
template_id, data (jsonb), created_at, updated_at
```

**drafts**
```
id (uuid), user_id (FK), draft_data (jsonb), updated_at
```

### localStorage Keys (fallback / offline)
| Key | Description |
|---|---|
| `inv2xl_sb_session` | Supabase session token |
| `inv2xl_user` | Current user object |
| `inv2xl_premium` | Premium flag (`'true'/'false'`) |
| `inv2xl_usage` | `{date, count}` daily usage |
| `inv2xl_gen_draft` | Current invoice draft (JSON) |
| `inv2xl_history` | Array of saved invoices (last 50) |
| `inv2xl_inv_counter` | Auto-increment invoice number |
| `app_visits` | Visit count for install prompt |

---

## 🔧 Not Yet Implemented
- Stripe live-mode payment (currently test card only)
- Record payment feature
- E-Way Bill generation
- Invoice duplication from dashboard (UI button present)
- Letterhead/footer upload for Pro users
- Email verification flow UI
- Password reset flow
- Multiple drafts support

## 🛣️ Recommended Next Steps
1. Replace `SUPABASE_URL` + `SUPABASE_ANON` with real values and run the SQL setup
2. Configure Google OAuth credentials in Supabase
3. Implement Stripe live payments for Pro tier
4. Add password reset via `supabase.auth.resetPasswordForEmail()`
5. Build invoice duplication & load-from-dashboard-into-generator flow
6. Add email invoice delivery (Supabase Edge Functions + Resend)
