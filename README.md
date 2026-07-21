# Fitness AI Coach

Osobní fitness a výživový kouč s AI generovanými plány.

## Stack

- Frontend: React 18 + Vite + Tailwind (bez routeru, navigace přes tab state v `src/App.jsx`)
- Backend: Supabase (Auth, Postgres + RLS, Storage bucket `measurement-photos`)
- AI: Netlify Functions jako proxy na Anthropic API (klíč jen na serveru)

## Vývoj

```bash
npm install
cp .env.example .env   # doplň Supabase klíče
npm run dev
```

Pro lokální běh Netlify Functions (AI generování) použij `netlify dev` (Netlify CLI) místo
`npm run dev` — potřebuje i proměnné `SUPABASE_SERVICE_ROLE_KEY` a `ANTHROPIC_API_KEY`.

## Build

```bash
npm run build
npm run preview
```

## Databáze

Schéma a RLS politiky jsou v `supabase/schema.sql` — spusť v Supabase SQL editoru.
