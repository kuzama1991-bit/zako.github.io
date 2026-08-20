# D3 Leaderboards (Website)

Web version of the Diablo 3 Paragon Leaderboard.

**Live (after Pages deploy):** https://kuzama1991-bit.github.io/D3Leaderboards/

**Repo:** https://github.com/kuzama1991-bit/D3Leaderboards

## Local dev

```bash
npm install
npm run dev
```

Open the URL Vite prints (include `/D3Leaderboards/` if shown).

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

1. Push this project to branch `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy-pages.yml` builds and deploys `dist/`.

`vite.config.ts` uses `base: "/D3Leaderboards/"` (must match the repo name).
