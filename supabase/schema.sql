create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists citext with schema extensions;

create table if not exists public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  discipline text not null,
  email extensions.citext not null,
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.teacher_requests(id) on delete set null,
  full_name text not null,
  discipline text not null,
  email extensions.citext not null unique,
  password_hash text not null,
  contract_start date not null default current_date,
  contract_end date,
  contract_status text not null default 'active' check (contract_status in ('active', 'ending', 'ended')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  floor text not null,
  kind text not null default 'Sala',
  status text not null default 'free' check (status in ('free', 'occupied', 'reserved')),
  current_teacher_id uuid references public.teachers(id) on delete set null,
  current_teacher_name text,
  current_class text,
  current_period text,
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'Geral',
  expires_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  original_teacher_id uuid references public.teachers(id) on delete set null,
  original_teacher_name text not null,
  substitute_teacher_id uuid references public.teachers(id) on delete set null,
  substitute_teacher_name text not null,
  discipline text not null,
  class_group text not null,
  room_id uuid references public.rooms(id) on delete set null,
  room_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  teacher_name text not null,
  discipline text not null,
  class_group text not null,
  room_id uuid references public.rooms(id) on delete set null,
  room_name text not null,
  weekday smallint not null check (weekday between 1 and 5),
  period_label text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  teacher_name text not null,
  room_id uuid references public.rooms(id) on delete set null,
  room_name text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target_role text not null check (target_role in ('manager', 'teacher')),
  teacher_id uuid references public.teachers(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teacher_requests_status_created_idx
  on public.teacher_requests (status, created_at desc);
create index if not exists teachers_email_idx on public.teachers (email);
create index if not exists substitutions_date_idx on public.substitutions (date, created_at desc);
create index if not exists schedules_teacher_weekday_idx on public.schedules (teacher_id, weekday, start_time);
create index if not exists reservations_teacher_date_idx on public.reservations (teacher_id, date);
create index if not exists notifications_role_created_idx on public.notifications (target_role, created_at desc);
create index if not exists teachers_request_id_idx on public.teachers (request_id);
create index if not exists rooms_current_teacher_id_idx on public.rooms (current_teacher_id);
create index if not exists substitutions_original_teacher_id_idx on public.substitutions (original_teacher_id);
create index if not exists substitutions_substitute_teacher_id_idx on public.substitutions (substitute_teacher_id);
create index if not exists substitutions_room_id_idx on public.substitutions (room_id);
create index if not exists schedules_room_id_idx on public.schedules (room_id);
create index if not exists reservations_room_id_idx on public.reservations (room_id);
create index if not exists notifications_teacher_id_idx on public.notifications (teacher_id);

alter table public.teacher_requests enable row level security;
alter table public.teachers enable row level security;
alter table public.rooms enable row level security;
alter table public.notices enable row level security;
alter table public.substitutions enable row level security;
alter table public.schedules enable row level security;
alter table public.reservations enable row level security;
alter table public.notifications enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

drop policy if exists "deny anon direct access to teacher requests" on public.teacher_requests;
create policy "deny anon direct access to teacher requests"
  on public.teacher_requests for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to teachers" on public.teachers;
create policy "deny anon direct access to teachers"
  on public.teachers for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to rooms" on public.rooms;
create policy "deny anon direct access to rooms"
  on public.rooms for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to notices" on public.notices;
create policy "deny anon direct access to notices"
  on public.notices for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to substitutions" on public.substitutions;
create policy "deny anon direct access to substitutions"
  on public.substitutions for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to schedules" on public.schedules;
create policy "deny anon direct access to schedules"
  on public.schedules for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to reservations" on public.reservations;
create policy "deny anon direct access to reservations"
  on public.reservations for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny anon direct access to notifications" on public.notifications;
create policy "deny anon direct access to notifications"
  on public.notifications for all to anon, authenticated using (false) with check (false);

insert into public.rooms (name, floor, kind)
values
  ('Auditório', 'Térreo', 'Evento'),
  ('Lab. Informática', '2º andar', 'Laboratório'),
  ('Lab. Química', '2º andar', 'Laboratório'),
  ('Sala 01', 'Térreo', 'Sala'),
  ('Sala 02', 'Térreo', 'Sala'),
  ('Sala 03', 'Térreo', 'Sala'),
  ('Sala 04', '1º andar', 'Sala'),
  ('Sala 05', '1º andar', 'Sala'),
  ('Sala 06', '1º andar', 'Sala'),
  ('Sala 07', '2º andar', 'Sala'),
  ('Sala 08', '2º andar', 'Sala'),
  ('Sala Maker', 'Bloco B', 'Laboratório')
on conflict (name) do nothing;

insert into public.notices (title, body, category)
values
  ('4º andar interditado', 'O 4º andar está interditado para manutenção até sexta-feira. Por favor, utilize as salas dos andares inferiores.', 'Manutenção'),
  ('Reunião pedagógica', 'Reunião pedagógica obrigatória na sexta-feira às 14h no auditório. Presença confirmada para todos os professores.', 'Geral'),
  ('Entrega de notas', 'Prazo para entrega do boletim final: 20 de junho. Utilize o sistema de gestão acadêmica.', 'Atenção')
on conflict do nothing;
