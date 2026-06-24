alter table public.rooms
  add column if not exists is_available boolean not null default true;

alter table public.rooms
  add column if not exists availability_note text;

create index if not exists rooms_is_available_idx
  on public.rooms (is_available, name);

with room_details(name, kind, is_available, availability_note) as (
  values
    ('Sala 01', 'Datacenter', true, null),
    ('Sala 02', 'Direção', true, null),
    ('Sala 03', 'Assessoria APM', true, null),
    ('Sala 04', 'Secretaria', true, null),
    ('Sala 05', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 06', 'Setor Administrativo', true, null),
    ('Sala 07', 'Coordenação pedagógica', true, null),
    ('Sala 08', 'Sala dos professores', true, null),
    ('Sala 09', 'Auditório', true, null),
    ('Sala 10', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 11', 'Sala Maker', true, null),
    ('Sala 12', 'Laboratório (Química)', true, null),
    ('Sala 13', 'Laboratório (Química)', true, null),
    ('Sala 14', 'Interditado', false, 'Sala interditada.'),
    ('Sala 15', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 16', 'Armazém de comida', true, null),
    ('Sala 17', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 18', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 19', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 20', 'Almoxarifado', true, null),
    ('Sala 21', 'Sala TI', true, null),
    ('Sala 22', 'Sala Prof. Valdson', true, null),
    ('Sala 23', 'Laboratório (computadores)', true, null),
    ('Sala 24', 'Laboratório (computadores)', true, null),
    ('Sala 25', 'Laboratório (computadores)', true, null),
    ('Sala 26', 'Laboratório (computadores)', true, null),
    ('Sala 27', 'Laboratório (computadores)', true, null),
    ('Sala 28', 'Laboratório (computadores)', true, null),
    ('Sala 29', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 30', 'Sala de coordenação', true, null),
    ('Sala 31', 'Sala de aula', true, null),
    ('Sala 32', 'Sala de aula', true, null),
    ('Sala 33', 'Sala de aula', true, null),
    ('Sala 34', 'Sala de aula', true, null),
    ('Sala 35', 'Sala de aula', true, null),
    ('Sala 36', 'Sala de aula', true, null),
    ('Sala 37', 'Sala de aula', true, null),
    ('Sala 38', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 39', 'Sem uso', false, 'Sem uso para reservas e horários.'),
    ('Sala 40', 'Sala TI', true, null),
    ('Sala 41', 'Sala de aula', true, null),
    ('Sala 42', 'Sala de aula', true, null),
    ('Sala 43', 'Sala de aula', true, null),
    ('Sala 44', 'Sala de aula', true, null),
    ('Sala 45', 'Sala de aula', true, null),
    ('Sala 46', 'Sala de aula', true, null),
    ('Sala 47', 'Sala de aula', true, null)
)
update public.rooms as room
set
  kind = room_details.kind,
  is_available = room_details.is_available,
  availability_note = room_details.availability_note,
  updated_at = now()
from room_details
where room.name = room_details.name;
