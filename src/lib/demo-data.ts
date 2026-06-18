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
    email: "ana.martins@etec.sp.gov.br",
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
    email: "bruno.gola@etec.sp.gov.br",
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
    email: "camila.santos@etec.sp.gov.br",
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
    title: "4º andar interditado",
    body: "O 4º andar está interditado para manutenção até sexta-feira. Por favor, utilize as salas dos andares inferiores.",
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

export const demoRooms: Room[] = [
  ["Auditório", "Térreo", "Evento"],
  ["Lab. Informática", "2º andar", "Laboratório"],
  ["Lab. Química", "2º andar", "Laboratório"],
  ["Sala 01", "Térreo", "Sala"],
  ["Sala 02", "Térreo", "Sala"],
  ["Sala 03", "Térreo", "Sala"],
  ["Sala 04", "1º andar", "Sala"],
  ["Sala 05", "1º andar", "Sala"],
  ["Sala 06", "1º andar", "Sala"],
  ["Sala 07", "2º andar", "Sala"],
  ["Sala 08", "2º andar", "Sala"],
  ["Sala Maker", "Bloco B", "Laboratório"],
].map(([name, floor, kind], index) => ({
  id: `room-${index + 1}`,
  name,
  floor,
  kind,
  status: index === 4 ? "occupied" : "free",
  currentTeacherId: index === 4 ? "teacher-ana" : null,
  currentTeacherName: index === 4 ? "Ana Beatriz Martins" : null,
  currentClass: index === 4 ? "2º DS" : null,
  currentPeriod: index === 4 ? "07h00-07h50" : null,
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
    roomId: "room-4",
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
    classGroup: "1º DS",
    roomId: "room-4",
    roomName: "Sala 01",
    weekday: new Date().getDay() || 1,
    periodLabel: "1º período",
    startTime: "07:00",
    endTime: "07:50",
  },
  {
    id: "schedule-2",
    teacherId: "teacher-bruno",
    teacherName: "Bruno Queiroz Gola",
    discipline: "Português",
    classGroup: "2º DS",
    roomId: "room-5",
    roomName: "Sala 02",
    weekday: new Date().getDay() || 1,
    periodLabel: "2º período",
    startTime: "07:50",
    endTime: "08:40",
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
