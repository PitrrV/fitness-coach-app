# Fitness AI Coach

Osobní fitness a výživový kouč s AI generovanými plány.

## Stack

- Frontend: React 18 + Vite + Tailwind (bez routeru, navigace přes tab state v `src/App.jsx`),
  nasazený staticky na GitHub Pages
- Backend: Supabase (Auth, Postgres + RLS, Storage bucket `measurement-photos`)
- AI: Supabase Edge Functions (`supabase/functions/`) jako proxy na Anthropic API — klíč jen
  na serveru, nikdy ve frontendu

## Vývoj

```bash
npm install
cp .env.example .env   # doplň VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Databáze

Schéma a RLS politiky jsou v `supabase/schema.sql` — spusť v Supabase SQL editoru (vytvoří i
Storage bucket `measurement-photos`).

## Edge Functions (AI proxy)

Vyžaduje [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref <tvůj-project-ref>
supabase secrets set ANTHROPIC_API_KEY=xxxxx
supabase functions deploy generate-meal-plan
supabase functions deploy generate-training-plan
supabase functions deploy delete-account
```

Lokální vývoj funkcí: `supabase functions serve`.

## Nasazení na GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` appku automaticky sestaví a nasadí při pushi na
`main`. V nastavení repozitáře (Settings → Secrets and variables → Actions) je potřeba založit
repository secrets `SUPABASE_URL` a `SUPABASE_ANON_KEY`, a v Settings → Pages přepnout zdroj na
"GitHub Actions".
