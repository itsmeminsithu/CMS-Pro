<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Thai Visa CMS Pro

React + Vite admin panel ("VisaCMS Admin Panel") for tracking Thai visa service applications: visa extensions, letter services, TM30 tracking, Easy Pass services, and ticketing. It has a dashboard, one application list per service, and Excel/PDF export. Data sits in the browser's localStorage. There is no backend or database in this repo.


## What it does

- Dashboard with counts per service: Visa Extension, Letter Portal, TM30 Tracking, Easy Pass Hub, and Ticket Matrix, plus walk-in / VIP / E-extension breakdowns.
- One view per service: Walk In Extension (GC / IT), E Extension (GC), VIP Extension (GC / IT), Letter Service, TM30 Service, Easy Pass Service, Ticketing Service.
- An application form and list per service, with status updates and flight-number normalisation.
- Excel backup export, PDF manifest export, and restore from an Excel file (via `xlsx` and `jspdf`).
- Duplicate clean-up for stored applications.
- Light / dark / system theme, saved in the browser.
- Local login screen: in the current code, any non-empty email and password opens the panel. There is no server-side account check, so do not treat it as real authentication.

## Stack

- React 19, TypeScript, Vite 6
- Tailwind CSS (via CDN in `index.html`)
- Recharts for charts, `xlsx` and `jspdf` for export
- Google Gemini API (`@google/genai`, via `services/geminiService.ts`)

## Structure

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

## Run it

You need Node.js.

1. `npm install`
2. Set `GEMINI_API_KEY` in [.env.local](.env.local)
3. `npm run dev`

`npm run build` builds for production. `npm run preview` serves that build locally.

## Live preview (GitHub Pages — post-merge step, not yet live)

Pages serves the production build of a Vite app, not the source tree. No mock or screenshot page has been added.

- `vite.config.ts` sets `base: '/CMS-Pro/'`, which a project Pages site at `https://itsmeminsithu.github.io/CMS-Pro/` needs.
- After this PR is merged, add a Pages build workflow by hand in the GitHub web UI. Workflow files cannot be pushed through the Muse GitHub App — they return 403. The workflow is described in full in the PR description: install dependencies, run `npm run build`, deploy `dist/` with GitHub Pages. Pages source then becomes GitHub Actions.
- Pages is not live until that workflow file exists, a run succeeds, and the URL loads. This PR alone does not make it live.
- The Gemini helper needs a `GEMINI_API_KEY` secret at build time (the app inlines it via `vite.config.ts`). Without it the page loads, but AI calls fail. Application data in the preview is per-browser localStorage, not shared.

## License

MIT License. See [`LICENSE`](./LICENSE).
