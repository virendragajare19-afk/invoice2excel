# AI Development Rules - Invoice2Excel Pro

This document outlines the technical standards and library usage rules for the Invoice2Excel Pro codebase.

## 🚀 Tech Stack

*   **Frontend Architecture**: Vanilla JavaScript (ES6+) using a multi-page application (MPA) structure (`index.html`, `invoice-generator.html`, `dashboard.html`).
*   **Styling**: Tailwind CSS (via CDN) for all UI components, ensuring a mobile-first and responsive design.
*   **Backend**: Node.js with Express for server-side processing (OCR and advanced PDF parsing).
*   **Database & Auth**: Supabase for PostgreSQL storage, Row Level Security (RLS), and Authentication (Google OAuth & Email/Password).
*   **PDF Processing**: `pdf.js` for client-side text extraction; `pdf-parse` and `Tesseract.js` (OCR) for server-side processing.
*   **Excel Generation**: `SheetJS` (XLSX) for client-side exports; `ExcelJS` for server-side workbook creation.
*   **PDF Export**: `html2canvas` combined with `jsPDF` for converting HTML invoice templates into downloadable PDF files.
*   **PWA**: Progressive Web App implementation with `manifest.json` and a Service Worker (`sw.js`) for offline caching.

## 📏 Library Usage Rules

### 1. Styling & UI
*   **Tailwind First**: Always use Tailwind CSS utility classes for layout, spacing, and colors. Avoid adding new rules to `style.css` or `generator.css` unless it's for complex animations or print-specific overrides.
*   **Icons**: Use Font Awesome 6 (already linked) for consistency across the existing UI.

### 2. Data & Persistence
*   **Supabase**: All user data (invoices, profiles, drafts) must be stored in Supabase. Use the `supabase.js` utility for all database interactions.
*   **LocalStorage**: Use `localStorage` only as a fallback for guest users or for temporary offline caching (e.g., `inv2xl_usage`, `inv2xl_gen_draft`).
*   **State Management**: Maintain a global `appState` or `GEN` object for runtime data, but ensure it syncs with the persistent layer.

### 3. File Processing
*   **PDF Extraction**: Use `pdf.js` for standard text-based PDFs on the frontend. If a PDF is an image or parsing fails, delegate to the `/upload` endpoint for OCR.
*   **Excel Export**: Use `XLSX.writeFile` for immediate client-side downloads. Ensure headers are styled and column widths are auto-calculated.

### 4. Code Structure
*   **Modularity**: Keep logic separated by concern (e.g., `generator-step1.js` for UI logic, `templates.js` for rendering, `supabase.js` for data).
*   **Vanilla JS**: Maintain the current Vanilla JS pattern. Do not introduce React or other frameworks unless a full project migration is explicitly requested.
*   **Error Handling**: Do not use silent `try/catch` blocks for critical operations; allow errors to bubble up or use the `showToast` utility to inform the user.

### 5. PWA & Offline
*   **Service Worker**: Any new assets or pages must be added to the `APP_SHELL` array in `sw.js` to ensure they are available offline.