create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_teacher_id_idx
  on public.push_subscriptions (teacher_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to service_role;

drop policy if exists "deny anon direct access to push subscriptions" on public.push_subscriptions;
create policy "deny anon direct access to push subscriptions"
  on public.push_subscriptions for all to anon, authenticated using (false) with check (false);
