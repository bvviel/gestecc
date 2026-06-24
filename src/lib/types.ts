export const DISCIPLINES = [
  "Matemática",
  "Geografia",
  "História",
  "Português",
  "Biologia",
  "Artes",
  "Química",
  "Física",
  "Filosofia",
  "Sociologia",
  "Língua Espanhola",
  "Língua Inglesa",
  "Educação Física",
  "ACPS",
  "AIDJ",
  "Banco de Dados",
  "CPRT",
  "ECO",
  "Estudos Avançados",
  "GAMES",
  "IAM",
  "LMIS",
  "LPC",
  "LPL",
  "NRJD",
  "OSA",
  "PMCC",
  "PTIC",
  "PVM",
  "Prática Empreendedora",
  "Programação e Algoritmos",
  "Programação Web I",
  "Projeto Integrador",
  "Sistemas Embarcados e IoT",
] as const;

export const SHIFTS = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "night", label: "Noite" },
] as const;

export const SHIFT_PERIODS = {
  morning: [
    { label: "1º período", start: "07:30", end: "08:20" },
    { label: "2º período", start: "08:20", end: "09:10" },
    { label: "3º período", start: "09:10", end: "10:00" },
    { label: "4º período", start: "10:15", end: "11:05" },
    { label: "5º período", start: "11:05", end: "11:55" },
    { label: "6º período", start: "11:55", end: "12:45" },
    { label: "7º período", start: "12:45", end: "13:35" },
  ],
  afternoon: [
    { label: "1º período", start: "13:00", end: "13:50" },
    { label: "2º período", start: "13:50", end: "14:40" },
    { label: "3º período", start: "14:40", end: "15:30" },
    { label: "4º período", start: "15:45", end: "16:35" },
    { label: "5º período", start: "16:35", end: "17:25" },
    { label: "6º período", start: "17:25", end: "18:15" },
    { label: "7º período", start: "18:15", end: "19:05" },
  ],
  night: [
    { label: "1º período", start: "18:30", end: "19:20" },
    { label: "2º período", start: "19:20", end: "20:10" },
    { label: "3º período", start: "20:10", end: "21:00" },
    { label: "4º período", start: "21:10", end: "22:00" },
    { label: "5º período", start: "22:00", end: "22:50" },
  ],
} as const;

export const SHIFT_BREAKS = {
  morning: { label: "Intervalo", start: "10:00", end: "10:15" },
  afternoon: { label: "Intervalo", start: "15:30", end: "15:45" },
  night: { label: "Intervalo", start: "21:00", end: "21:10" },
} as const;

export const CLASS_GROUPS_BY_SHIFT = {
  morning: [
    "1º EM A - Ciências Sociais",
    "2º EM A - Ciências Sociais",
    "3º EM A - Ciências Sociais",
    "1º DS",
    "1º TEC ADM",
    "2º TEC ADM",
    "3º TEC ADM",
    "1º TEC RH",
    "Novo TEC RH",
  ],
  afternoon: [
    "1º TEC S.Jur",
    "2º TEC S.Jur",
    "3º TEC S.Jur",
    "TEC DG",
    "Jogos Digitais",
  ],
  night: [
    "1º Marketing",
    "2º Marketing",
    "3º Marketing",
  ],
} as const;

export const DEFAULT_CLASS_GROUPS = [
  ...CLASS_GROUPS_BY_SHIFT.morning,
  ...CLASS_GROUPS_BY_SHIFT.afternoon,
  ...CLASS_GROUPS_BY_SHIFT.night,
] as const;

export type Discipline = (typeof DISCIPLINES)[number];
export type Role = "manager" | "teacher";
export type RequestStatus = "pending" | "approved" | "rejected";
export type RoomStatus = "free" | "occupied" | "reserved";
export type ReservationStatus = "pending" | "approved" | "rejected";
export type ContractType = "permanent" | "temporary";
export type Shift = "morning" | "afternoon" | "night";

export type SessionClaims = {
  role: Role;
  name: string;
  email: string;
  teacherId?: string;
  exp: number;
};

export type ClientSession = Omit<SessionClaims, "exp"> & {
  token: string;
};

export type Teacher = {
  id: string;
  fullName: string;
  discipline: string;
  disciplines: string[];
  email: string;
  contractType: ContractType;
  contractStart: string;
  contractEnd: string | null;
  contractStatus: "active" | "ending" | "ended";
  avatarUrl: string | null;
  createdAt: string;
};

export type TeacherRequest = {
  id: string;
  fullName: string;
  discipline: string;
  disciplines: string[];
  email: string;
  contractType: ContractType;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  expiresAt: string | null;
};

export type Room = {
  id: string;
  name: string;
  floor: string;
  kind: string;
  status: RoomStatus;
  isAvailable: boolean;
  availabilityNote: string | null;
  currentTeacherId: string | null;
  currentTeacherName: string | null;
  currentClass: string | null;
  currentPeriod: string | null;
  updatedAt: string;
};

export type Substitution = {
  id: string;
  date: string;
  originalTeacherId: string | null;
  originalTeacherName: string;
  substituteTeacherId: string | null;
  substituteTeacherName: string;
  discipline: string;
  classGroup: string;
  roomId: string | null;
  roomName: string;
  createdAt: string;
};

export type Schedule = {
  id: string;
  teacherId: string;
  teacherName: string;
  discipline: string;
  shift: Shift;
  classGroup: string;
  roomId: string | null;
  roomName: string;
  weekday: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
};

export type Reservation = {
  id: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  status: ReservationStatus;
  createdAt: string;
};

export type Notification = {
  id: string;
  targetRole: Role;
  teacherId: string | null;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AppSnapshot = {
  configured: boolean;
  mode: "supabase" | "memory";
  now: string;
  notices: Notice[];
  rooms: Room[];
  substitutions: Substitution[];
  teachers: Teacher[];
  requests: TeacherRequest[];
  schedules: Schedule[];
  reservations: Reservation[];
  notifications: Notification[];
};
