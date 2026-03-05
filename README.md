# Flutter Signal

Earn a Flutter interview signal. Don't study. Prove it.

## Local run

```bash
npm run ingest-content
npm run build
npm run dev
```

Open: `http://localhost:5173/flutter_signal/`

## Content ingestion

- Script: `scripts/fetchContent.mjs`
- Attempts to pull markdown from `debasmitasarkar/flutter_interview_topics` and parse question sections.
- If network or parsing fails, it falls back to bundled questions and marks status in `src/content/contentHealth.json`.
- Content Health page: `#/content-health`

## GitHub Pages (project pages)

- Base path is hardcoded to `/flutter_signal/` for all assets/routes.
- Workflow: `.github/workflows/pages.yml` using **Source: GitHub Actions**.
- Output directory is `dist/`.

### Troubleshooting base path

- If blank page appears on Pages, verify `index.html` asset URLs start with `/flutter_signal/`.
- Ensure repository is configured as **Project Pages** and workflow is enabled.

## Notes

This implementation is static-only and stores progress locally in browser storage (IndexedDB + localStorage).
