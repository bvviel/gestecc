import type {
  AppSnapshot,
  Notice,
  Notification,
  Reservation,
  Room,
  Schedule,
  Substitution,
  Teacher,
  TeacherRequest,
} from "./types";

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export const demoTeachers: Teacher[] = [
  {
    id: "teacher-ana",
    fullName: "Ana Beatriz Martins",
    discipline: "Matemática",
    disciplines: ["Matemática"],
    email: "ana.martins@etec.sp.gov.br",
    contractType: "permanent",
    contractStart: "2024-02-05",
    contractEnd: null,
    contractStatus: "active",
    avatarUrl: null,
    createdAt: "2024-02-05T09:00:00.000Z",
  },
  {
    id: "teacher-bruno",
    fullName: "Bruno Queiroz Gola",
    discipline: "Português",
    disciplines: ["Português", "LPL"],
    email: "bruno.gola@etec.sp.gov.br",
    contractType: "temporary",
    contractStart: "2023-08-01",
    contractEnd: "2026-12-20",
    contractStatus: "active",
    avatarUrl: null,
    createdAt: "2023-08-01T09:00:00.000Z",
  },
  {
    id: "teacher-camila",
    fullName: "Camila Ferreira Santos",
    discipline: "Biologia",
    disciplines: ["Biologia"],
    email: "camila.santos@etec.sp.gov.br",
    contractType: "permanent",
    contractStart: "2022-01-24",
    contractEnd: null,
    contractStatus: "active",
    avatarUrl: null,
    createdAt: "2022-01-24T09:00:00.000Z",
  },
];

export const demoNotices: Notice[] = [
  {
    id: "notice-1",
    title: "Área em manutenção",
    body: "Uma área da escola está em manutenção até sexta-feira. Confira a orientação da gestão antes de usar os espaços próximos.",
    category: "Manutenção",
    createdAt: nowIso(),
    expiresAt: null,
  },
  {
    id: "notice-2",
    title: "Reunião pedagógica",
    body: "Reunião pedagógica obrigatória na sexta-feira às 14h no auditório. Presença confirmada para todos os professores.",
    category: "Geral",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    expiresAt: null,
  },
  {
    id: "notice-3",
    title: "Entrega de notas",
    body: "Prazo para entrega do boletim final: 20 de junho. Utilize o sistema de gestão acadêmica.",
    category: "Atenção",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
    expiresAt: null,
  },
];

const roomDetails: Array<{ kind: string; isAvailable?: boolean; note?: string }> = [
  { kind: "Datacenter" },
  { kind: "Direção" },
  { kind: "Assessoria APM" },
  { kind: "Secretaria" },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Setor Administrativo" },
  { kind: "Coordenação pedagógica" },
  { kind: "Sala dos professores" },
  { kind: "Auditório" },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sala Maker" },
  { kind: "Laboratório (Química)" },
  { kind: "Laboratório (Química)" },
  { kind: "Interditado", isAvailable: false, note: "Sala interditada." },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Armazém de comida" },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Almoxarifado" },
  { kind: "Sala TI" },
  { kind: "Sala Prof. Valdson" },
  { kind: "Laboratório (computadores)" },
  { kind: "Laboratório (computadores)" },
  { kind: "Laboratório (computadores)" },
  { kind: "Laboratório (computadores)" },
  { kind: "Laboratório (computadores)" },
  { kind: "Laboratório (computadores)" },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sala de coordenação" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sem uso", isAvailable: false, note: "Sem uso para reservas e horários." },
  { kind: "Sala TI" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
  { kind: "Sala de aula" },
];

export const demoRooms: Room[] = Array.from({ length: 47 }, (_, index) => ({
  id: `room-${index + 1}`,
  name: `Sala ${String(index + 1).padStart(2, "0")}`,
  floor: "",
  kind: roomDetails[index]?.kind ?? "Sala",
  status: index === 1 ? "occupied" : "free",
  isAvailable: roomDetails[index]?.isAvailable ?? true,
  availabilityNote: roomDetails[index]?.note ?? null,
  currentTeacherId: index === 1 ? "teacher-ana" : null,
  currentTeacherName: index === 1 ? "Ana Beatriz Martins" : null,
  currentClass: index === 1 ? "1º EM A - Ciências Sociais" : null,
  currentPeriod: index === 1 ? "07h30-08h20" : null,
  updatedAt: nowIso(),
}));

export const demoSubstitutions: Substitution[] = [
  {
    id: "subst-1",
    date: today(),
    originalTeacherId: "teacher-camila",
    originalTeacherName: "Camila Ferreira Santos",
    substituteTeacherId: "teacher-bruno",
    substituteTeacherName: "Bruno Queiroz Gola",
    discipline: "Biologia",
    classGroup: "3º Administração",
    roomId: "room-1",
    roomName: "Sala 01",
    createdAt: nowIso(),
  },
];

export const demoSchedules: Schedule[] = [
  {
    id: "schedule-1",
    teacherId: "teacher-ana",
    teacherName: "Ana Beatriz Martins",
    discipline: "Matemática",
    shift: "morning",
    classGroup: "1º DS",
    roomId: "room-1",
    roomName: "Sala 01",
    weekday: new Date().getDay() || 1,
    periodLabel: "1º período",
    startTime: "07:30",
    endTime: "08:20",
  },
  {
    id: "schedule-2",
    teacherId: "teacher-bruno",
    teacherName: "Bruno Queiroz Gola",
    discipline: "Português",
    shift: "morning",
    classGroup: "1º EM A - Ciências Sociais",
    roomId: "room-2",
    roomName: "Sala 02",
    weekday: new Date().getDay() || 1,
    periodLabel: "2º período",
    startTime: "08:20",
    endTime: "09:10",
  },
];

export const demoReservations: Reservation[] = [];
export const demoRequests: TeacherRequest[] = [];
export const demoNotifications: Notification[] = [];

export type MemoryState = Omit<AppSnapshot, "configured" | "mode" | "now"> & {
  requestSecrets: Record<string, string>;
  teacherSecrets: Record<string, string>;
};

export function createMemoryState(): MemoryState {
  return {
    notices: structuredClone(demoNotices),
    rooms: structuredClone(demoRooms),
    substitutions: structuredClone(demoSubstitutions),
    teachers: structuredClone(demoTeachers),
    requests: structuredClone(demoRequests),
    schedules: structuredClone(demoSchedules),
    reservations: structuredClone(demoReservations),
    notifications: structuredClone(demoNotifications),
    requestSecrets: {},
    teacherSecrets: {},
  };
}
