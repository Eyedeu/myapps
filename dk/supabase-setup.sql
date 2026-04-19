-- Supabase → SQL Editor’de çalıştır (bir kez).
-- Sonra Project Settings → API: URL ve anon public key’i kopyala.

create table if not exists public.words (
  id text primary key,
  de text not null,
  tr text not null,
  example text not null,
  level text not null,
  shown_at timestamptz not null default now()
);

alter table public.words enable row level security;

create policy "words_select" on public.words for select using (true);
create policy "words_insert" on public.words for insert with check (true);
create policy "words_update" on public.words for update using (true);
create policy "words_delete" on public.words for delete using (true);
