# Oddbridge

Link two random words in **one sentence** — a ~3 minute creative break. React + TypeScript + Vite.

## Scripts

- `npm run dev` — local dev server  
- `npm run build` — production build  
- `npm run preview` — preview the build

## Layout in `myapps`

- **Oddbridge (this app):** `myapps/oddbridge`  
- **Floret (planned):** `../floret`  
- **Scoop (planned):** `../scoop`  

If an older copy named `Yeni klasör` still exists (folder was locked), delete it manually after closing anything that has it open.

Word pairs live in `src/wordPairs.ts`.

## GitHub Pages

The repo workflow `.github/workflows/deploy-pages.yml` builds this app with  
`npm run build -- --base=/<repo>/oddbridge/` and publishes it under `/oddbridge/` on Pages.  
Enable **Settings → Pages → Source: GitHub Actions** once.
