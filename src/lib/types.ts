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
] as const;

export type Discipline = (typeof DISCIPLINES)[number];
export type Role = "manager" | "teacher";
export type RequestStatus = "pending" | "approved" | "rejected";
export type RoomStatus = "free" | "occupied" | "reserved";
export type ReservationStatus = "pending" | "approved" | "rejected";

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
  email: string;
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
  email: string;
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
