-- Supabase → SQL Editor’de çalıştır.
-- Tablo + politikalar zaten varsa hata almamak için politikalar önce silinir (yeniden oluşturulur).
-- Sadece "pos" sütunu eklemek istiyorsanız: `supabase-migration-pos.sql` yeterli.
-- Sonra Project Settings → API: URL ve Publishable/anon key’i kopyala.

create table if not exists public.words (
  id text primary key,
  de text not null,
  tr text not null,
  example text not null,
  level text not null,
  shown_at timestamptz not null default now()
);

-- Kelime türü (PWA filtre + Scriptable): noun|verb|adj|phrase|prep|conj|adv|other
alter table public.words add column if not exists pos text;

alter table public.words enable row level security;

drop policy if exists "words_select" on public.words;
drop policy if exists "words_insert" on public.words;
drop policy if exists "words_update" on public.words;
drop policy if exists "words_delete" on public.words;

create policy "words_select" on public.words for select using (true);
create policy "words_insert" on public.words for insert with check (true);
create policy "words_update" on public.words for update using (true);
create policy "words_delete" on public.words for delete using (true);
