-- Fitness AI Coach — databázové schéma (Postgres + Row Level Security)
-- Spouštět v Supabase SQL editoru. Idempotentní (IF NOT EXISTS / OR REPLACE kde to jde).

-- ─── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  sex text not null check (sex in ('male', 'female')),
  age int not null check (age between 10 and 100),
  height_cm numeric not null check (height_cm between 100 and 250),
  weight_kg numeric not null check (weight_kg between 30 and 300),
  activity_level text not null default 'moderate',
  goal text not null default 'maintain',
  target_weight_kg numeric,
  budget_czk_week numeric,
  favorite_foods text,
  disliked_foods text,
  allergens text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotentní přidání sloupců pro už existující databáze (migrace ze starší verze schématu).
alter table public.profiles add column if not exists budget_czk_week numeric;
alter table public.profiles add column if not exists favorite_foods text;
alter table public.profiles add column if not exists disliked_foods text;
alter table public.profiles add column if not exists allergens text[] not null default '{}';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- ─── check_ins ─────────────────────────────────────────────────────────────
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  photo_path text,
  created_at timestamptz not null default now()
);

create index if not exists check_ins_user_date_idx on public.check_ins (user_id, date desc);

alter table public.check_ins enable row level security;

drop policy if exists "check_ins_select_own" on public.check_ins;
create policy "check_ins_select_own" on public.check_ins
  for select using (auth.uid() = user_id);

drop policy if exists "check_ins_insert_own" on public.check_ins;
create policy "check_ins_insert_own" on public.check_ins
  for insert with check (auth.uid() = user_id);

drop policy if exists "check_ins_update_own" on public.check_ins;
create policy "check_ins_update_own" on public.check_ins
  for update using (auth.uid() = user_id);

drop policy if exists "check_ins_delete_own" on public.check_ins;
create policy "check_ins_delete_own" on public.check_ins
  for delete using (auth.uid() = user_id);

-- ─── meal_plans ────────────────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  days int not null default 1,
  plan_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists meal_plans_user_created_idx on public.meal_plans (user_id, created_at desc);

alter table public.meal_plans enable row level security;

drop policy if exists "meal_plans_select_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans
  for select using (auth.uid() = user_id);

drop policy if exists "meal_plans_insert_own" on public.meal_plans;
create policy "meal_plans_insert_own" on public.meal_plans
  for insert with check (auth.uid() = user_id);

-- ─── training_plans ────────────────────────────────────────────────────────
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists training_plans_user_created_idx on public.training_plans (user_id, created_at desc);

alter table public.training_plans enable row level security;

drop policy if exists "training_plans_select_own" on public.training_plans;
create policy "training_plans_select_own" on public.training_plans
  for select using (auth.uid() = user_id);

drop policy if exists "training_plans_insert_own" on public.training_plans;
create policy "training_plans_insert_own" on public.training_plans
  for insert with check (auth.uid() = user_id);

-- ─── ai_usage (rate limiting, spravováno jen server-side přes service role) ─
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  count int not null default 0,
  unique (user_id, date)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

-- ─── chat_messages (historie konverzace s AI koučem) ────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- ─── Storage: measurement-photos (soukromý bucket) ─────────────────────────
insert into storage.buckets (id, name, public)
values ('measurement-photos', 'measurement-photos', false)
on conflict (id) do nothing;

drop policy if exists "measurement_photos_own_folder_select" on storage.objects;
create policy "measurement_photos_own_folder_select" on storage.objects
  for select using (
    bucket_id = 'measurement-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "measurement_photos_own_folder_insert" on storage.objects;
create policy "measurement_photos_own_folder_insert" on storage.objects
  for insert with check (
    bucket_id = 'measurement-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "measurement_photos_own_folder_delete" on storage.objects;
create policy "measurement_photos_own_folder_delete" on storage.objects
  for delete using (
    bucket_id = 'measurement-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
