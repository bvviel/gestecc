create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  target_role text not null default 'teacher',
  teacher_id uuid references public.teachers(id) on delete cascade,
  manager_key text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
  add column if not exists target_role text not null default 'teacher';

alter table public.push_subscriptions
  alter column teacher_id drop not null;

alter table public.push_subscriptions
  add column if not exists manager_key text;

update public.push_subscriptions
set target_role = 'teacher'
where target_role is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_target_role_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_target_role_check
      check (target_role in ('manager', 'teacher'));
  end if;
end $$;

create index if not exists push_subscriptions_teacher_id_idx
  on public.push_subscriptions (teacher_id);

create index if not exists push_subscriptions_manager_idx
  on public.push_subscriptions (target_role, manager_key);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to service_role;

drop policy if exists "deny anon direct access to push subscriptions" on public.push_subscriptions;
create policy "deny anon direct access to push subscriptions"
  on public.push_subscriptions for all to anon, authenticated using (false) with check (false);
