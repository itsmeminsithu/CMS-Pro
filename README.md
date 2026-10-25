<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Thai Visa CMS Pro

A React + Vite admin panel ("VisaCMS Admin Panel") for tracking Thai visa
service applications — visa extensions, letter services, TM30 tracking, Easy
Pass services, and ticketing — with a dashboard, per-service application
lists, and Excel/PDF export. Data is stored in the browser's localStorage;
there is no backend or database in this repo.

View your app in AI Studio: https://ai.studio/apps/drive/18tdCk3OpRwGcdqFDgwYTeZlckFY5t_qA

## Features

- Dashboard with counts per service: Visa Extension, Letter Portal, TM30
  Tracking, Easy Pass Hub, and Ticket Matrix, plus walk-in / VIP / E-extension
  breakdowns.
- Service views: Walk In Extension (GC / IT), E Extension (GC), VIP Extension
  (GC / IT), Letter Service, TM30 Service, Easy Pass Service, and Ticketing
  Service.
- Application form and application list per service, with status updates and
  flight-number normalisation.
- Excel backup export, PDF manifest export, and restore from an Excel file
  (via `xlsx` and `jspdf`).
- Duplicate clean-up for stored applications.
- Light / dark / system theme, with the choice saved in the browser.
- Local login screen: in the current code, any non-empty email and password
  unlocks the panel — there is no server-side account check, so do not treat
  it as real authentication.

## Tech Stack

- React 19, TypeScript, Vite 6
- Tailwind CSS (via CDN in `index.html`)
- Recharts for charts, `xlsx` and `jspdf` for export
- Google Gemini API (`@google/genai`, via `services/geminiService.ts`)

## Project Structure

```txt
CMS-Pro/
├── App.tsx                  # Login screen, theme, view routing
├── index.tsx                # React entry point
├── index.html               # Page shell (title: Thai Visa CMS Pro)
├── constants.ts             # Service definitions
├── types.ts                 # Application and service types
├── components/
│   ├── Dashboard.tsx        # Service count cards
│   ├── ApplicationList.tsx  # Per-service list, Excel/PDF export, restore
│   ├── ApplicationForm.tsx  # Application entry form
│   └── Sidebar.tsx          # Navigation
├── services/
│   ├── dataStore.ts         # localStorage-backed application store
│   └── geminiService.ts     # Gemini helper
├── package.json
├── vite.config.ts
├── tsconfig.json
└── metadata.json
```

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Other scripts: `npm run build` builds for production, `npm run preview`
previews the production build locally.

## Live preview (GitHub Pages — post-merge step, not yet live)

This is a Vite app, so Pages serves the production build, not the source
tree — and no mock or screenshot page has been added:

- `vite.config.ts` now sets `base: '/CMS-Pro/'`, which is required for a
  project Pages site at `https://itsmeminsithu.github.io/CMS-Pro/`.
- After this PR is merged, add a Pages build workflow manually via the GitHub
  web UI (workflow files cannot be pushed through the Muse GitHub App — they
  return 403). The workflow is described in full in the PR description: it
  installs dependencies, runs `npm run build`, and deploys `dist/` with
  GitHub Pages. The repository's Pages source then becomes GitHub Actions.
- Pages is NOT live until that workflow file exists, a run succeeds, and the
  URL actually loads — this PR alone does not make it live.
- Note: the Gemini helper in the preview needs a `GEMINI_API_KEY` secret
  available at build time (the app inlines it via `vite.config.ts`); without
  it, the page loads but AI calls will fail. Application data in the preview
  is per-browser localStorage, not shared.

## License

MIT License. See [`LICENSE`](./LICENSE).
