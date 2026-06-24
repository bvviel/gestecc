import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createMemoryState, type MemoryState } from "./demo-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";
import { hashPassword, signSession, verifyPassword } from "./security";
import { CLASS_GROUPS_BY_SHIFT } from "./types";
import type {
  AppSnapshot,
  ContractType,
  Notification,
  Reservation,
  Room,
  Schedule,
  SessionClaims,
  Shift,
  Substitution,
  Teacher,
  TeacherRequest,
} from "./types";

type LoginResult =
  | { ok: true; token: string; role: "manager"; name: string; email: string }
  | { ok: true; token: string; role: "teacher"; name: string; email: string; teacherId: string }
  | { ok: false; message: string; status?: "pending" | "rejected" | "invalid" };

type ActionPayload = Record<string, unknown>;
type PushTarget =
  | { role: "teacher"; teacherId: string }
  | { role: "manager" };

const globalForMemory = globalThis as typeof globalThis & {
  __gesteccMemory?: MemoryState;
};
const MANAGER_PUSH_KEY = "primary-manager";

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabelForNotification(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function weekdaysLabel(weekday: number) {
  return ["Domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][weekday] ?? "dia útil";
}

function addYears(date: string, years: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setFullYear(value.getFullYear() + years);
  return value.toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function pushVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:gestec@example.com";

  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

function toRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function subscriptionFromPayload(payload: ActionPayload): WebPushSubscription {
  const subscription = toRecord(payload.subscription);
  const keys = toRecord(subscription.keys);
  const endpoint = String(subscription.endpoint ?? "");
  const p256dh = String(keys.p256dh ?? "");
  const auth = String(keys.auth ?? "");

  if (!endpoint || !p256dh || !auth) {
    rowError("Inscrição de notificação inválida.");
  }

  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

function memory() {
  if (!globalForMemory.__gesteccMemory) {
    const state = createMemoryState();
    state.teacherSecrets["teacher-ana"] = hashPassword("professor123");
    state.teacherSecrets["teacher-bruno"] = hashPassword("professor123");
    state.teacherSecrets["teacher-camila"] = hashPassword("professor123");
    globalForMemory.__gesteccMemory = state;
  }

  return globalForMemory.__gesteccMemory;
}

function rowError(message: string): never {
  throw new Error(message);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeContractType(value: string): ContractType {
  return value === "permanent" ? "permanent" : "temporary";
}

function contractTypeText(value: ContractType) {
  return value === "permanent" ? "concursado" : "não concursado";
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function arrayFromUnknown(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDisciplines(value: unknown, fallback = "") {
  const values = uniqueStrings([...arrayFromUnknown(value), fallback].filter(Boolean));
  return values.length > 0 ? values : fallback ? [fallback] : [];
}

function normalizeShift(value: unknown): Shift {
  return value === "afternoon" || value === "night" ? value : "morning";
}

function classGroupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[º°ª]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function canonicalClassGroupForShift(value: string, shift: Shift) {
  const key = classGroupKey(value);
  return CLASS_GROUPS_BY_SHIFT[shift].find((classGroup) => classGroupKey(classGroup) === key) ?? "";
}

function roomDisplayName(room: Pick<Room, "name" | "kind">) {
  return room.kind && room.kind !== "Sala" ? `${room.name} - ${room.kind}` : room.name;
}

function roomUnavailableMessage(room: Pick<Room, "name" | "kind" | "availabilityNote">) {
  const note = room.availabilityNote ? ` Motivo: ${room.availabilityNote}` : "";
  return `${roomDisplayName(room)} está indisponível para reservas e horários.${note}`;
}

function assertRoomAvailable(room: Room) {
  if (!room.isAvailable) rowError(roomUnavailableMessage(room));
}

function shiftFromTime(startTime: string): Shift {
  const normalized = startTime.slice(0, 5);
  if (normalized >= "18:30") return "night";
  if (normalized >= "13:00") return "afternoon";
  return "morning";
}

function teacherCanTeach(teacher: Pick<Teacher, "discipline" | "disciplines">, discipline: string) {
  const normalized = discipline.trim().toLocaleLowerCase("pt-BR");
  return normalizeDisciplines(teacher.disciplines, teacher.discipline)
    .some((item) => item.toLocaleLowerCase("pt-BR") === normalized);
}

function isMissingColumnError(error: { message?: string; code?: string }) {
  return error.code === "42703" || /column .* does not exist|schema cache|could not find/i.test(error.message ?? "");
}

function getManagerCredentials() {
  return {
    username: process.env.GESTECC_MANAGER_USERNAME,
    password: process.env.GESTECC_MANAGER_PASSWORD,
  };
}

function normalizeManagerUsername(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function mapTeacher(row: Record<string, unknown>): Teacher {
  const discipline = String(row.discipline ?? "");
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    discipline,
    disciplines: normalizeDisciplines(row.disciplines, discipline),
    email: String(row.email),
    contractType: normalizeContractType(String(row.contract_type ?? (row.contract_end ? "temporary" : "permanent"))),
    contractStart: String(row.contract_start),
    contractEnd: row.contract_end ? String(row.contract_end) : null,
    contractStatus: String(row.contract_status ?? "active") as Teacher["contractStatus"],
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    createdAt: String(row.created_at),
  };
}

function mapRequest(row: Record<string, unknown>): TeacherRequest {
  const discipline = String(row.discipline);
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    discipline,
    disciplines: normalizeDisciplines(row.disciplines, discipline),
    email: String(row.email),
    contractType: normalizeContractType(String(row.contract_type ?? "temporary")),
    status: String(row.status) as TeacherRequest["status"],
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

function mapNotice(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    category: String(row.category ?? "Geral"),
    createdAt: String(row.created_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
  };
}

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    name: String(row.name),
    floor: String(row.floor),
    kind: String(row.kind),
    status: String(row.status) as Room["status"],
    isAvailable: row.is_available !== false,
    availabilityNote: row.availability_note ? String(row.availability_note) : null,
    currentTeacherId: row.current_teacher_id ? String(row.current_teacher_id) : null,
    currentTeacherName: row.current_teacher_name ? String(row.current_teacher_name) : null,
    currentClass: row.current_class ? String(row.current_class) : null,
    currentPeriod: row.current_period ? String(row.current_period) : null,
    updatedAt: String(row.updated_at),
  };
}

function mapSubstitution(row: Record<string, unknown>): Substitution {
  return {
    id: String(row.id),
    date: String(row.date),
    originalTeacherId: row.original_teacher_id ? String(row.original_teacher_id) : null,
    originalTeacherName: String(row.original_teacher_name),
    substituteTeacherId: row.substitute_teacher_id ? String(row.substitute_teacher_id) : null,
    substituteTeacherName: String(row.substitute_teacher_name),
    discipline: String(row.discipline),
    classGroup: String(row.class_group),
    roomId: row.room_id ? String(row.room_id) : null,
    roomName: String(row.room_name),
    createdAt: String(row.created_at),
  };
}

function mapSchedule(row: Record<string, unknown>): Schedule {
  const startTime = String(row.start_time).slice(0, 5);
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    teacherName: String(row.teacher_name),
    discipline: String(row.discipline),
    shift: normalizeShift(row.shift ?? shiftFromTime(startTime)),
    classGroup: String(row.class_group),
    roomId: row.room_id ? String(row.room_id) : null,
    roomName: String(row.room_name),
    weekday: Number(row.weekday),
    periodLabel: String(row.period_label),
    startTime,
    endTime: String(row.end_time).slice(0, 5),
  };
}

function mapReservation(row: Record<string, unknown>): Reservation {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    teacherName: String(row.teacher_name),
    roomId: row.room_id ? String(row.room_id) : null,
    roomName: String(row.room_name),
    date: String(row.date),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    reason: row.reason ? String(row.reason) : null,
    status: String(row.status) as Reservation["status"],
    createdAt: String(row.created_at),
  };
}

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    targetRole: String(row.target_role) as Notification["targetRole"],
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    title: String(row.title),
    body: String(row.body),
    kind: String(row.kind),
    readAt: row.read_at ? String(row.read_at) : null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
  };
}

async function queryAll<T>(
  table: string,
  mapper: (row: Record<string, unknown>) => T,
  orderColumn = "created_at",
  ascending = false,
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");

  const { data, error } = await supabase.from(table).select("*").order(orderColumn, { ascending });
  if (error) rowError(error.message);
  return (data ?? []).map((row) => mapper(row as Record<string, unknown>));
}

export async function getSnapshot(claims: SessionClaims): Promise<AppSnapshot> {
  if (!isSupabaseConfigured()) {
    const state = memory();
    const teacherFilter = (item: { teacherId?: string; targetRole?: string }) =>
      claims.role === "manager" ||
      item.teacherId === claims.teacherId ||
      item.targetRole === "manager";

    return {
      configured: false,
      mode: "memory",
      now: nowIso(),
      notices: [...state.notices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      rooms: [...state.rooms],
      substitutions: state.substitutions.filter((item) => item.date === today()),
      teachers: claims.role === "manager"
        ? [...state.teachers]
        : state.teachers.filter((item) => item.id === claims.teacherId),
      requests: claims.role === "manager" ? [...state.requests] : [],
      schedules: claims.role === "manager"
        ? [...state.schedules]
        : state.schedules.filter((item) => item.teacherId === claims.teacherId),
      reservations: state.reservations.filter((item) => teacherFilter(item)),
      notifications: state.notifications.filter((item) =>
        claims.role === "manager"
          ? item.targetRole === "manager"
          : item.teacherId === claims.teacherId,
      ),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");

  const [
    notices,
    rooms,
    substitutions,
    teachers,
    requests,
    schedules,
    reservations,
    notifications,
  ] = await Promise.all([
    queryAll("notices", mapNotice),
    queryAll("rooms", mapRoom, "name", true),
    supabase
      .from("substitutions")
      .select("*")
      .eq("date", today())
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) rowError(error.message);
        return (data ?? []).map((row) => mapSubstitution(row as Record<string, unknown>));
      }),
    supabase
      .from("teachers")
      .select("*")
      .order("full_name", { ascending: true })
      .then(({ data, error }) => {
        if (error) rowError(error.message);
        const mapped = (data ?? []).map((row) => mapTeacher(row as Record<string, unknown>));
        return claims.role === "manager"
          ? mapped
          : mapped.filter((item) => item.id === claims.teacherId);
      }),
    claims.role === "manager" ? queryAll("teacher_requests", mapRequest) : Promise.resolve([]),
    supabase
      .from("schedules")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data, error }) => {
        if (error) rowError(error.message);
        const mapped = (data ?? []).map((row) => mapSchedule(row as Record<string, unknown>));
        return claims.role === "manager"
          ? mapped
          : mapped.filter((item) => item.teacherId === claims.teacherId);
      }),
    supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) rowError(error.message);
        const mapped = (data ?? []).map((row) => mapReservation(row as Record<string, unknown>));
        return claims.role === "manager"
          ? mapped
          : mapped.filter((item) => item.teacherId === claims.teacherId);
      }),
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) rowError(error.message);
        const mapped = (data ?? []).map((row) => mapNotification(row as Record<string, unknown>));
        return mapped.filter((item) =>
          claims.role === "manager"
            ? item.targetRole === "manager"
            : item.teacherId === claims.teacherId,
        );
      }),
  ]);

  return {
    configured: true,
    mode: "supabase",
    now: nowIso(),
    notices,
    rooms,
    substitutions,
    teachers,
    requests,
    schedules,
    reservations,
    notifications,
  };
}

export async function loginManager(username: string, password: string): Promise<LoginResult> {
  const credentials = getManagerCredentials();
  if (!credentials.username || !credentials.password) {
    return {
      ok: false,
      status: "invalid",
      message: "Login da gestão ainda não foi configurado no servidor.",
    };
  }

  const acceptedUsernames = [
    credentials.username,
    "ETECMAS@GESTÃO-GESTEC",
    "ETECMAS@GESTAO-GESTEC",
  ]
    .filter(Boolean)
    .map((value) => normalizeManagerUsername(value!));

  if (!acceptedUsernames.includes(normalizeManagerUsername(username)) || password !== credentials.password) {
    return { ok: false, status: "invalid", message: "Usuário ou senha da gestão inválidos." };
  }

  const token = signSession({
    role: "manager",
    name: "Gestão ETEC",
    email: credentials.username,
  });

  return { ok: true, token, role: "manager", name: "Gestão ETEC", email: credentials.username };
}

export async function loginTeacher(emailValue: string, password: string): Promise<LoginResult> {
  const email = normalizeEmail(emailValue);

  if (!isSupabaseConfigured()) {
    const state = memory();
    const teacher = state.teachers.find((item) => item.email.toLowerCase() === email);
    if (teacher) {
      const hash = state.teacherSecrets[teacher.id];
      if (hash && verifyPassword(password, hash)) {
        const token = signSession({
          role: "teacher",
          name: teacher.fullName,
          email: teacher.email,
          teacherId: teacher.id,
        });
        return {
          ok: true,
          token,
          role: "teacher",
          name: teacher.fullName,
          email: teacher.email,
          teacherId: teacher.id,
        };
      }
    }

    const request = state.requests.find((item) => item.email.toLowerCase() === email);
    if (request?.status === "pending") {
      return {
        ok: false,
        status: "pending",
        message: "Seu acesso está pendente de aprovação pela gestão.",
      };
    }
    if (request?.status === "rejected") {
      return {
        ok: false,
        status: "rejected",
        message: "Sua solicitação foi recusada pela gestão.",
      };
    }

    return { ok: false, status: "invalid", message: "E-mail ou senha inválidos." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");

  const { data: teacherRow, error: teacherError } = await supabase
    .from("teachers")
    .select("*, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (teacherError) rowError(teacherError.message);

  if (teacherRow) {
    const hash = String((teacherRow as Record<string, unknown>).password_hash ?? "");
    if (hash && verifyPassword(password, hash)) {
      const teacher = mapTeacher(teacherRow as Record<string, unknown>);
      const token = signSession({
        role: "teacher",
        name: teacher.fullName,
        email: teacher.email,
        teacherId: teacher.id,
      });
      return {
        ok: true,
        token,
        role: "teacher",
        name: teacher.fullName,
        email: teacher.email,
        teacherId: teacher.id,
      };
    }
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("teacher_requests")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) rowError(requestError.message);

  if (requestRow) {
    const request = mapRequest(requestRow as Record<string, unknown>);
    if (request.status === "pending") {
      return {
        ok: false,
        status: "pending",
        message: "Seu acesso está pendente de aprovação pela gestão.",
      };
    }
    if (request.status === "rejected") {
      return {
        ok: false,
        status: "rejected",
        message: "Sua solicitação foi recusada pela gestão.",
      };
    }
  }

  return { ok: false, status: "invalid", message: "E-mail ou senha inválidos." };
}

export async function createTeacherRequest(payload: ActionPayload) {
  const fullName = String(payload.fullName ?? "").trim();
  const disciplines = normalizeDisciplines(payload.disciplines, String(payload.discipline ?? ""));
  const discipline = disciplines[0] ?? "";
  const email = normalizeEmail(String(payload.email ?? ""));
  const password = String(payload.password ?? "");
  const contractType = normalizeContractType(String(payload.contractType ?? "temporary"));

  if (!fullName || !discipline || !email || password.length < 6) {
    rowError("Preencha todos os dados obrigatórios para solicitar cadastro.");
  }

  const passwordHash = hashPassword(password);

  if (!isSupabaseConfigured()) {
    const state = memory();
    if (
      state.teachers.some((item) => item.email.toLowerCase() === email) ||
      state.requests.some((item) => item.email.toLowerCase() === email && item.status === "pending")
    ) {
      rowError("Já existe um cadastro ou solicitação pendente para este e-mail.");
    }

    const request: TeacherRequest = {
      id: newId("request"),
      fullName,
      discipline,
      disciplines,
      email,
      contractType,
      status: "pending",
      rejectionReason: null,
      createdAt: nowIso(),
      reviewedAt: null,
    };
    state.requests.unshift(request);
    state.requestSecrets[request.id] = passwordHash;
    await addManagerNotification(
      "Nova solicitação de cadastro",
      `${fullName} solicitou acesso como professor de ${disciplines.join(", ")}. E-mail: ${email}. Vínculo: ${contractTypeText(contractType)}.`,
      "teacher_request",
      { requestId: request.id },
    );
    return request;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");

  const { data: existingTeacher, error: existingTeacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingTeacherError) rowError(existingTeacherError.message);
  if (existingTeacher) rowError("Já existe um professor aprovado com este e-mail.");

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("teacher_requests")
    .select("id,status")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingRequestError) rowError(existingRequestError.message);
  if (existingRequest) rowError("Já existe uma solicitação pendente para este e-mail.");

  let requestInsert = await supabase
    .from("teacher_requests")
    .insert({
      full_name: fullName,
      discipline,
      disciplines,
      email,
      password_hash: passwordHash,
      contract_type: contractType,
      status: "pending",
    })
    .select("*")
    .single();

  if (requestInsert.error && isMissingColumnError(requestInsert.error)) {
    requestInsert = await supabase
      .from("teacher_requests")
      .insert({
        full_name: fullName,
        discipline,
        email,
        password_hash: passwordHash,
        contract_type: contractType,
        status: "pending",
      })
      .select("*")
      .single();
  }

  if (requestInsert.error) rowError(requestInsert.error.message);
  const request = mapRequest(requestInsert.data as Record<string, unknown>);

  await addManagerNotification(
    "Nova solicitação de cadastro",
    `${fullName} solicitou acesso como professor de ${disciplines.join(", ")}. E-mail: ${email}. Vínculo: ${contractTypeText(contractType)}.`,
    "teacher_request",
    { requestId: request.id },
  );
  return request;
}

async function approveRequest(claims: SessionClaims, requestId: string) {
  if (claims.role !== "manager") rowError("Apenas a gestão pode aprovar cadastros.");

  if (!isSupabaseConfigured()) {
    const state = memory();
    const request = state.requests.find((item) => item.id === requestId);
    if (!request || request.status !== "pending") rowError("Solicitação não encontrada.");

    request.status = "approved";
    request.reviewedAt = nowIso();
    const contractStart = today();

    const teacher: Teacher = {
      id: newId("teacher"),
      fullName: request.fullName,
      discipline: request.discipline,
      disciplines: request.disciplines,
      email: request.email,
      contractType: request.contractType,
      contractStart,
      contractEnd: request.contractType === "temporary" ? addYears(contractStart, 2) : null,
      contractStatus: "active",
      avatarUrl: null,
      createdAt: nowIso(),
    };

    state.teachers.push(teacher);
    state.teacherSecrets[teacher.id] = state.requestSecrets[request.id];
    await addTeacherNotification(
      teacher.id,
      "Cadastro aprovado",
      "Sua solicitação foi aprovada. Você já pode acessar o GESTEC.",
      "request_approved",
      { teacherId: teacher.id },
    );
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");

  const { data: requestRow, error: requestError } = await supabase
    .from("teacher_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (requestError) rowError(requestError.message);
  const requestData = requestRow as Record<string, unknown>;
  const requestDiscipline = String(requestData.discipline ?? "");
  const requestDisciplines = normalizeDisciplines(requestData.disciplines, requestDiscipline);

  let teacherInsert = await supabase
    .from("teachers")
    .insert({
      request_id: requestId,
      full_name: requestData.full_name,
      discipline: requestDiscipline,
      disciplines: requestDisciplines,
      email: requestData.email,
      password_hash: requestData.password_hash,
      contract_type: requestData.contract_type,
      contract_start: today(),
      contract_end: normalizeContractType(String(requestData.contract_type ?? "temporary")) === "temporary"
        ? addYears(today(), 2)
        : null,
      contract_status: "active",
    })
    .select("*")
    .single();

  if (teacherInsert.error && isMissingColumnError(teacherInsert.error)) {
    teacherInsert = await supabase
      .from("teachers")
      .insert({
        request_id: requestId,
        full_name: requestData.full_name,
        discipline: requestDiscipline,
        email: requestData.email,
        password_hash: requestData.password_hash,
        contract_type: requestData.contract_type,
        contract_start: today(),
        contract_end: normalizeContractType(String(requestData.contract_type ?? "temporary")) === "temporary"
          ? addYears(today(), 2)
          : null,
        contract_status: "active",
      })
      .select("*")
      .single();
  }

  if (teacherInsert.error) rowError(teacherInsert.error.message);
  const teacher = mapTeacher(teacherInsert.data as Record<string, unknown>);

  const { error: updateError } = await supabase
    .from("teacher_requests")
    .update({ status: "approved", reviewed_at: nowIso() })
    .eq("id", requestId);
  if (updateError) rowError(updateError.message);

  await addTeacherNotification(
    teacher.id,
    "Cadastro aprovado",
    "Sua solicitação foi aprovada. Você já pode acessar o GESTEC.",
    "request_approved",
    { teacherId: teacher.id },
  );
}

async function rejectRequest(claims: SessionClaims, requestId: string, reason: string) {
  if (claims.role !== "manager") rowError("Apenas a gestão pode recusar cadastros.");

  if (!isSupabaseConfigured()) {
    const state = memory();
    const request = state.requests.find((item) => item.id === requestId);
    if (!request || request.status !== "pending") rowError("Solicitação não encontrada.");
    request.status = "rejected";
    request.rejectionReason = reason || "Solicitação recusada pela gestão.";
    request.reviewedAt = nowIso();
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { error } = await supabase
    .from("teacher_requests")
    .update({
      status: "rejected",
      rejection_reason: reason || "Solicitação recusada pela gestão.",
      reviewed_at: nowIso(),
    })
    .eq("id", requestId);
  if (error) rowError(error.message);
}

function requireManager(claims: SessionClaims) {
  if (claims.role !== "manager") rowError("Ação permitida apenas para a gestão.");
}

function findMemoryTeacher(state: MemoryState, teacherId: string) {
  return state.teachers.find((item) => item.id === teacherId) ?? rowError("Professor não encontrado.");
}

function findMemoryRoom(state: MemoryState, roomId: string) {
  return state.rooms.find((item) => item.id === roomId) ?? rowError("Sala não encontrada.");
}

async function lookupTeacher(teacherId: string) {
  if (!isSupabaseConfigured()) return findMemoryTeacher(memory(), teacherId);
  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase.from("teachers").select("*").eq("id", teacherId).single();
  if (error) rowError(error.message);
  return mapTeacher(data as Record<string, unknown>);
}

async function lookupRoom(roomId: string) {
  if (!isSupabaseConfigured()) return findMemoryRoom(memory(), roomId);
  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (error) rowError(error.message);
  return mapRoom(data as Record<string, unknown>);
}

function findMemorySchedule(state: MemoryState, scheduleId: string) {
  return state.schedules.find((item) => item.id === scheduleId) ?? rowError("Aula não encontrada.");
}

async function lookupSchedule(scheduleId: string) {
  if (!isSupabaseConfigured()) return findMemorySchedule(memory(), scheduleId);
  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
  if (error) rowError(error.message);
  return mapSchedule(data as Record<string, unknown>);
}

function findMemoryReservation(state: MemoryState, reservationId: string) {
  return state.reservations.find((item) => item.id === reservationId) ?? rowError("Reserva não encontrada.");
}

async function lookupReservation(reservationId: string) {
  if (!isSupabaseConfigured()) return findMemoryReservation(memory(), reservationId);
  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase.from("reservations").select("*").eq("id", reservationId).single();
  if (error) rowError(error.message);
  return mapReservation(data as Record<string, unknown>);
}

function validateSchedulePayload(payload: ActionPayload, fallbackDiscipline: string) {
  const rawClassGroup = String(payload.classGroup ?? "").trim();
  const periodLabel = String(payload.periodLabel ?? "").trim();
  const discipline = String(payload.discipline ?? fallbackDiscipline).trim();
  const shift = normalizeShift(payload.shift);
  const classGroup = canonicalClassGroupForShift(rawClassGroup, shift);
  const startTime = String(payload.startTime ?? "");
  const endTime = String(payload.endTime ?? "");
  const weekday = Number(payload.weekday ?? 1);

  if (!rawClassGroup || !periodLabel || !discipline || !startTime || !endTime) {
    rowError("Preencha todos os dados do horário.");
  }
  if (!classGroup) rowError("Selecione uma turma válida para esse turno.");
  if (weekday < 1 || weekday > 5) rowError("Selecione um dia útil para a aula.");

  return { classGroup, periodLabel, discipline, shift, startTime, endTime, weekday };
}

type ScheduleDetails = ReturnType<typeof validateSchedulePayload>;

function sameScheduleSlot(schedule: Schedule, details: ScheduleDetails) {
  return (
    schedule.weekday === details.weekday &&
    schedule.shift === details.shift &&
    schedule.startTime.slice(0, 5) === details.startTime.slice(0, 5) &&
    schedule.endTime.slice(0, 5) === details.endTime.slice(0, 5) &&
    schedule.discipline.trim().toLocaleLowerCase("pt-BR") === details.discipline.trim().toLocaleLowerCase("pt-BR")
  );
}

async function findScheduleSlotConflicts(details: ScheduleDetails, excludeScheduleId?: string) {
  if (!isSupabaseConfigured()) {
    return memory().schedules.filter((schedule) =>
      schedule.id !== excludeScheduleId && sameScheduleSlot(schedule, details),
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("weekday", details.weekday)
    .order("created_at", { ascending: true });
  if (error) rowError(error.message);

  return (data ?? [])
    .map((row) => mapSchedule(row as Record<string, unknown>))
    .filter((schedule) => schedule.id !== excludeScheduleId && sameScheduleSlot(schedule, details));
}

function applyScheduleDetails(schedule: Schedule, teacher: Teacher, room: Room, details: ScheduleDetails) {
  schedule.teacherId = teacher.id;
  schedule.teacherName = teacher.fullName;
  schedule.discipline = details.discipline;
  schedule.shift = details.shift;
  schedule.classGroup = details.classGroup;
  schedule.roomId = room.id;
  schedule.roomName = roomDisplayName(room);
  schedule.weekday = details.weekday;
  schedule.periodLabel = details.periodLabel;
  schedule.startTime = details.startTime;
  schedule.endTime = details.endTime;
}

async function updateScheduleRecord(scheduleId: string, teacher: Teacher, room: Room, details: ScheduleDetails) {
  if (!isSupabaseConfigured()) {
    applyScheduleDetails(findMemorySchedule(memory(), scheduleId), teacher, room, details);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { error } = await supabase
    .from("schedules")
    .update({
      teacher_id: teacher.id,
      teacher_name: teacher.fullName,
      discipline: details.discipline,
      shift: details.shift,
      class_group: details.classGroup,
      room_id: room.id,
      room_name: roomDisplayName(room),
      weekday: details.weekday,
      period_label: details.periodLabel,
      start_time: details.startTime,
      end_time: details.endTime,
    })
    .eq("id", scheduleId);
  if (error && isMissingColumnError(error)) {
    const fallback = await supabase
      .from("schedules")
      .update({
        teacher_id: teacher.id,
        teacher_name: teacher.fullName,
        discipline: details.discipline,
        class_group: details.classGroup,
        room_id: room.id,
        room_name: roomDisplayName(room),
        weekday: details.weekday,
        period_label: details.periodLabel,
        start_time: details.startTime,
        end_time: details.endTime,
      })
      .eq("id", scheduleId);
    if (fallback.error) rowError(fallback.error.message);
    return;
  }
  if (error) rowError(error.message);
}

async function deleteScheduleRecords(scheduleIds: string[]) {
  if (scheduleIds.length === 0) return;

  if (!isSupabaseConfigured()) {
    const state = memory();
    state.schedules = state.schedules.filter((schedule) => !scheduleIds.includes(schedule.id));
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { error } = await supabase.from("schedules").delete().in("id", scheduleIds);
  if (error) rowError(error.message);
}

async function addTeacherNotification(
  teacherId: string,
  title: string,
  body: string,
  kind: string,
  payload: Record<string, unknown> | null = null,
) {
  if (!isSupabaseConfigured()) {
    memory().notifications.unshift({
      id: newId("notification"),
      targetRole: "teacher",
      teacherId,
      title,
      body,
      kind,
      readAt: null,
      payload,
      createdAt: nowIso(),
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { error } = await supabase.from("notifications").insert({
    target_role: "teacher",
    teacher_id: teacherId,
    title,
    body,
    kind,
    payload,
  });
  if (error) rowError(error.message);
  await sendTeacherPushNotification(teacherId, title, body, { kind, payload });
}

async function addTeacherNotificationForAll(
  title: string,
  body: string,
  kind: string,
  payload: Record<string, unknown> | null = null,
) {
  if (!isSupabaseConfigured()) {
    await Promise.all(
      memory().teachers.map((teacher) =>
        addTeacherNotification(teacher.id, title, body, kind, payload),
      ),
    );
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { data, error } = await supabase
    .from("teachers")
    .select("id")
    .eq("contract_status", "active");
  if (error) rowError(error.message);

  await Promise.all(
    (data ?? []).map((teacher) =>
      addTeacherNotification(
        String((teacher as Record<string, unknown>).id),
        title,
        body,
        kind,
        payload,
      ),
    ),
  );
}

async function sendTeacherPushNotification(
  teacherId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  await sendPushNotificationToTarget({ role: "teacher", teacherId }, title, body, data);
}

async function sendManagerPushNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  await sendPushNotificationToTarget({ role: "manager" }, title, body, data);
}

async function sendPushNotificationToTarget(
  target: PushTarget,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  if (!isSupabaseConfigured() || !pushVapidConfig()) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");

  query = target.role === "teacher"
    ? query.eq("teacher_id", target.teacherId)
    : query.eq("target_role", "manager").eq("manager_key", MANAGER_PUSH_KEY);

  const { data: subscriptions, error } = await query;

  if (error) {
    console.warn("Push notifications are not ready:", error.message);
    return;
  }

  await Promise.all(
    (subscriptions ?? []).map(async (row) => {
      const endpoint = String((row as Record<string, unknown>).endpoint ?? "");
      const subscription: WebPushSubscription = {
        endpoint,
        keys: {
          p256dh: String((row as Record<string, unknown>).p256dh ?? ""),
          auth: String((row as Record<string, unknown>).auth ?? ""),
        },
      };

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title,
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            url: "/",
            data: { ...data, targetRole: target.role },
          }),
        );
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        } else {
          console.warn("Failed to send push notification:", error);
        }
      }
    }),
  );
}

async function addManagerNotification(
  title: string,
  body: string,
  kind: string,
  payload: Record<string, unknown> | null = null,
) {
  if (!isSupabaseConfigured()) {
    memory().notifications.unshift({
      id: newId("notification"),
      targetRole: "manager",
      teacherId: null,
      title,
      body,
      kind,
      readAt: null,
      payload,
      createdAt: nowIso(),
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) rowError("Supabase não configurado.");
  const { error } = await supabase.from("notifications").insert({
    target_role: "manager",
    teacher_id: null,
    title,
    body,
    kind,
    payload,
  });
  if (error) rowError(error.message);
  await sendManagerPushNotification(title, body, { kind, payload });
}

export async function performAction(
  claims: SessionClaims,
  action: string,
  payload: ActionPayload,
) {
  if (action === "approveRequest") {
    await approveRequest(claims, String(payload.requestId ?? ""));
    return getSnapshot(claims);
  }

  if (action === "rejectRequest") {
    await rejectRequest(
      claims,
      String(payload.requestId ?? ""),
      String(payload.reason ?? "Solicitação recusada pela gestão."),
    );
    return getSnapshot(claims);
  }

  if (action === "deleteTeacher") {
    requireManager(claims);
    const teacherId = String(payload.teacherId ?? "");
    const teacher = await lookupTeacher(teacherId);

    if (!isSupabaseConfigured()) {
      const state = memory();
      state.teachers = state.teachers.filter((item) => item.id !== teacherId);
      state.schedules = state.schedules.filter((item) => item.teacherId !== teacherId);
      state.reservations = state.reservations.filter((item) => item.teacherId !== teacherId);
      state.notifications = state.notifications.filter((item) => item.teacherId !== teacherId);
      delete state.teacherSecrets[teacherId];
      for (const room of state.rooms) {
        if (room.currentTeacherId === teacherId) {
          room.status = "free";
          room.currentTeacherId = null;
          room.currentTeacherName = null;
          room.currentClass = null;
          room.currentPeriod = null;
          room.updatedAt = nowIso();
        }
      }
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          status: "free",
          current_teacher_id: null,
          current_teacher_name: null,
          current_class: null,
          current_period: null,
          updated_at: nowIso(),
        })
        .eq("current_teacher_id", teacherId);
      if (roomError) rowError(roomError.message);

      const { error: deleteError } = await supabase.from("teachers").delete().eq("id", teacherId);
      if (deleteError) rowError(deleteError.message);
    }

    await addManagerNotification(
      "Professor removido",
      `${teacher.fullName} (${teacher.email}) foi removido pela gestão.`,
      "teacher_deleted",
      { teacherId },
    );
    return getSnapshot(claims);
  }

  if (action === "addNotice") {
    requireManager(claims);
    const title = String(payload.title ?? "").trim();
    const body = String(payload.body ?? "").trim();
    const category = String(payload.category ?? "Geral").trim() || "Geral";
    if (!title || !body) rowError("Informe título e descrição do aviso.");

    let noticeId = "";

    if (!isSupabaseConfigured()) {
      noticeId = newId("notice");
      memory().notices.unshift({
        id: noticeId,
        title,
        body,
        category,
        createdAt: nowIso(),
        expiresAt: payload.expiresAt ? String(payload.expiresAt) : null,
      });
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { data, error } = await supabase
        .from("notices")
        .insert({
          title,
          body,
          category,
          expires_at: payload.expiresAt || null,
        })
        .select("id")
        .single();
      if (error) rowError(error.message);
      noticeId = String((data as Record<string, unknown>).id);
    }

    await addTeacherNotificationForAll(
      "Novo aviso publicado",
      `${title}: ${body}`,
      "notice_created",
      { noticeId },
    );
    return getSnapshot(claims);
  }

  if (action === "deleteNotice") {
    requireManager(claims);
    const noticeId = String(payload.noticeId ?? "");
    if (!isSupabaseConfigured()) {
      const state = memory();
      state.notices = state.notices.filter((item) => item.id !== noticeId);
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase.from("notices").delete().eq("id", noticeId);
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "updateRoomAvailability") {
    requireManager(claims);
    const room = await lookupRoom(String(payload.roomId ?? ""));
    const isAvailable = payload.isAvailable === true || payload.isAvailable === "true";
    const availabilityNote = String(payload.availabilityNote ?? "").trim() || null;

    if (!isSupabaseConfigured()) {
      const target = findMemoryRoom(memory(), room.id);
      target.isAvailable = isAvailable;
      target.availabilityNote = availabilityNote;
      target.updatedAt = nowIso();
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("rooms")
        .update({
          is_available: isAvailable,
          availability_note: availabilityNote,
          updated_at: nowIso(),
        })
        .eq("id", room.id);
      if (error) {
        if (isMissingColumnError(error)) {
          rowError("Atualize a tabela rooms no Supabase antes de gerenciar disponibilidade das salas.");
        }
        rowError(error.message);
      }
    }

    return getSnapshot(claims);
  }

  if (action === "addSubstitution") {
    requireManager(claims);
    const originalTeacher = await lookupTeacher(String(payload.originalTeacherId ?? ""));
    const substituteTeacher = await lookupTeacher(String(payload.substituteTeacherId ?? ""));
    const room = await lookupRoom(String(payload.roomId ?? ""));
    assertRoomAvailable(room);
    const date = String(payload.date ?? today());
    const discipline = String(payload.discipline ?? substituteTeacher.discipline);
    const classGroup = String(payload.classGroup ?? "").trim();
    if (!classGroup) rowError("Informe a turma da substituição.");

    if (!isSupabaseConfigured()) {
      memory().substitutions.unshift({
        id: newId("substitution"),
        date,
        originalTeacherId: originalTeacher.id,
        originalTeacherName: originalTeacher.fullName,
        substituteTeacherId: substituteTeacher.id,
        substituteTeacherName: substituteTeacher.fullName,
        discipline,
        classGroup,
        roomId: room.id,
        roomName: roomDisplayName(room),
        createdAt: nowIso(),
      });
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase.from("substitutions").insert({
        date,
        original_teacher_id: originalTeacher.id,
        original_teacher_name: originalTeacher.fullName,
        substitute_teacher_id: substituteTeacher.id,
        substitute_teacher_name: substituteTeacher.fullName,
        discipline,
        class_group: classGroup,
        room_id: room.id,
        room_name: roomDisplayName(room),
      });
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "addSchedule") {
    requireManager(claims);
    const teacher = await lookupTeacher(String(payload.teacherId ?? ""));
    const room = await lookupRoom(String(payload.roomId ?? ""));
    assertRoomAvailable(room);
    const details = validateSchedulePayload(payload, teacher.discipline);
    if (!teacherCanTeach(teacher, details.discipline)) {
      rowError(`Selecione um professor aprovado para ${details.discipline}.`);
    }

    const conflicts = await findScheduleSlotConflicts(details);
    const replacedSchedule = conflicts[0] ?? null;
    const extraConflictIds = conflicts.slice(1).map((schedule) => schedule.id);
    let scheduleId = replacedSchedule?.id ?? null;

    if (replacedSchedule) {
      await updateScheduleRecord(replacedSchedule.id, teacher, room, details);
      await deleteScheduleRecords(extraConflictIds);
    } else if (!isSupabaseConfigured()) {
      const schedule: Schedule = {
        id: newId("schedule"),
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        discipline: details.discipline,
        shift: details.shift,
        classGroup: details.classGroup,
        roomId: room.id,
        roomName: roomDisplayName(room),
        weekday: details.weekday,
        periodLabel: details.periodLabel,
        startTime: details.startTime,
        endTime: details.endTime,
      };
      scheduleId = schedule.id;
      memory().schedules.push(schedule);
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      let insertSchedule = await supabase
        .from("schedules")
        .insert({
          teacher_id: teacher.id,
          teacher_name: teacher.fullName,
          discipline: details.discipline,
          shift: details.shift,
          class_group: details.classGroup,
          room_id: room.id,
          room_name: roomDisplayName(room),
          weekday: details.weekday,
          period_label: details.periodLabel,
          start_time: details.startTime,
          end_time: details.endTime,
        })
        .select("id")
        .single();
      if (insertSchedule.error && isMissingColumnError(insertSchedule.error)) {
        insertSchedule = await supabase
          .from("schedules")
          .insert({
            teacher_id: teacher.id,
            teacher_name: teacher.fullName,
            discipline: details.discipline,
            class_group: details.classGroup,
            room_id: room.id,
            room_name: roomDisplayName(room),
            weekday: details.weekday,
            period_label: details.periodLabel,
            start_time: details.startTime,
            end_time: details.endTime,
          })
          .select("id")
          .single();
      }
      if (insertSchedule.error) rowError(insertSchedule.error.message);
      scheduleId = String((insertSchedule.data as Record<string, unknown>).id);
    }
    await addTeacherNotification(
      teacher.id,
      replacedSchedule ? "Aula substituída na grade" : "Nova aula cadastrada",
      `${details.discipline} em ${details.classGroup}, ${weekdaysLabel(details.weekday)}, ${details.periodLabel}, sala ${roomDisplayName(room)}.`,
      replacedSchedule ? "schedule_replaced" : "schedule_created",
      { scheduleId, replacedScheduleId: replacedSchedule?.id ?? null },
    );
    if (replacedSchedule && replacedSchedule.teacherId !== teacher.id) {
      await addTeacherNotification(
        replacedSchedule.teacherId,
        "Aula substituída pela gestão",
        `${replacedSchedule.discipline} em ${replacedSchedule.classGroup}, ${weekdaysLabel(replacedSchedule.weekday)}, ${replacedSchedule.periodLabel}, sala ${replacedSchedule.roomName}, foi substituída por outra aula da mesma disciplina e período.`,
        "schedule_replaced",
        { scheduleId, replacedScheduleId: replacedSchedule.id },
      );
    }
    return getSnapshot(claims);
  }

  if (action === "updateSchedule") {
    requireManager(claims);
    const scheduleId = String(payload.scheduleId ?? "");
    const current = await lookupSchedule(scheduleId);
    const teacher = await lookupTeacher(String(payload.teacherId ?? current.teacherId));
    const room = await lookupRoom(String(payload.roomId ?? current.roomId ?? ""));
    assertRoomAvailable(room);
    const details = validateSchedulePayload(
      payload,
      teacher.discipline,
    );
    if (!teacherCanTeach(teacher, details.discipline)) {
      rowError(`Selecione um professor aprovado para ${details.discipline}.`);
    }
    const { classGroup, periodLabel, discipline, shift, startTime, endTime, weekday } = details;
    const conflicts = await findScheduleSlotConflicts(details, scheduleId);

    if (!isSupabaseConfigured()) {
      const target = findMemorySchedule(memory(), scheduleId);
      target.teacherId = teacher.id;
      target.teacherName = teacher.fullName;
      target.discipline = discipline;
      target.shift = shift;
      target.classGroup = classGroup;
      target.roomId = room.id;
      target.roomName = roomDisplayName(room);
      target.weekday = weekday;
      target.periodLabel = periodLabel;
      target.startTime = startTime;
      target.endTime = endTime;
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("schedules")
        .update({
          teacher_id: teacher.id,
          teacher_name: teacher.fullName,
          discipline,
          shift,
          class_group: classGroup,
          room_id: room.id,
          room_name: roomDisplayName(room),
          weekday,
          period_label: periodLabel,
          start_time: startTime,
          end_time: endTime,
        })
        .eq("id", scheduleId);
      if (error && isMissingColumnError(error)) {
        const fallback = await supabase
          .from("schedules")
          .update({
            teacher_id: teacher.id,
            teacher_name: teacher.fullName,
            discipline,
            class_group: classGroup,
            room_id: room.id,
            room_name: roomDisplayName(room),
            weekday,
            period_label: periodLabel,
            start_time: startTime,
            end_time: endTime,
          })
          .eq("id", scheduleId);
        if (fallback.error) rowError(fallback.error.message);
      } else if (error) {
        rowError(error.message);
      }
    }
    await deleteScheduleRecords(conflicts.map((schedule) => schedule.id));

    await addTeacherNotification(
      teacher.id,
      "Aula atualizada",
      `${discipline} em ${classGroup}, ${weekdaysLabel(weekday)}, ${periodLabel}, sala ${roomDisplayName(room)}.`,
      "schedule_updated",
      { scheduleId },
    );
    return getSnapshot(claims);
  }

  if (action === "deleteSchedule") {
    requireManager(claims);
    const scheduleId = String(payload.scheduleId ?? "");
    const schedule = await lookupSchedule(scheduleId);

    if (!isSupabaseConfigured()) {
      const state = memory();
      state.schedules = state.schedules.filter((item) => item.id !== scheduleId);
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase.from("schedules").delete().eq("id", scheduleId);
      if (error) rowError(error.message);
    }

    await addTeacherNotification(
      schedule.teacherId,
      "Aula removida",
      `${schedule.discipline} em ${schedule.classGroup}, ${weekdaysLabel(schedule.weekday)}, ${schedule.periodLabel}, sala ${schedule.roomName}.`,
      "schedule_deleted",
      { scheduleId },
    );
    return getSnapshot(claims);
  }

  if (action === "markNotificationRead") {
    const notificationId = String(payload.notificationId ?? "");
    if (!notificationId) rowError("Notificação não encontrada.");

    if (!isSupabaseConfigured()) {
      const notification = memory().notifications.find((item) => item.id === notificationId);
      if (!notification) rowError("Notificação não encontrada.");
      const canRead =
        claims.role === "manager"
          ? notification.targetRole === "manager"
          : notification.teacherId === claims.teacherId;
      if (!canRead) rowError("Notificação não encontrada.");
      notification.readAt = notification.readAt ?? nowIso();
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      let query = supabase.from("notifications").update({ read_at: nowIso() }).eq("id", notificationId);
      query = claims.role === "manager"
        ? query.eq("target_role", "manager")
        : query.eq("teacher_id", claims.teacherId ?? "");
      const { error } = await query;
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "markNotificationsRead") {
    if (!isSupabaseConfigured()) {
      const state = memory();
      for (const notification of state.notifications) {
        const canRead =
          claims.role === "manager"
            ? notification.targetRole === "manager"
            : notification.teacherId === claims.teacherId;
        if (canRead && !notification.readAt) notification.readAt = nowIso();
      }
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const stamp = nowIso();
      let query = supabase.from("notifications").update({ read_at: stamp }).is("read_at", null);
      query = claims.role === "manager"
        ? query.eq("target_role", "manager")
        : query.eq("teacher_id", claims.teacherId ?? "");
      const { error } = await query;
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "subscribePush") {
    if (claims.role === "teacher" && !claims.teacherId) rowError("Professor não encontrado.");
    const subscription = subscriptionFromPayload(payload);

    if (!isSupabaseConfigured()) {
      rowError("Configure o Supabase para salvar notificações em segundo plano.");
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) rowError("Supabase não configurado.");
    const subscriptionRow = {
      target_role: claims.role,
      teacher_id: claims.role === "teacher" ? claims.teacherId : null,
      manager_key: claims.role === "manager" ? MANAGER_PUSH_KEY : null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: String(payload.userAgent ?? ""),
      updated_at: nowIso(),
    };

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(subscriptionRow, { onConflict: "endpoint" });
    if (error) {
      if (
        claims.role === "teacher" &&
        (error.message.includes("target_role") || error.message.includes("manager_key"))
      ) {
        const { error: fallbackError } = await supabase.from("push_subscriptions").upsert(
          {
            teacher_id: claims.teacherId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_agent: String(payload.userAgent ?? ""),
            updated_at: nowIso(),
          },
          { onConflict: "endpoint" },
        );
        if (fallbackError) rowError(fallbackError.message);
      } else {
        rowError(
          claims.role === "manager"
            ? "Atualize a tabela push_subscriptions no Supabase antes de ativar notificações da gestão."
            : error.message,
        );
      }
    }

    if (!payload.silent) {
      if (claims.role === "teacher" && claims.teacherId) {
        await addTeacherNotification(
          claims.teacherId,
          "Notificações ativadas",
          "Este navegador receberá avisos, aulas, reservas e comunicados publicados pela gestão.",
          "push_enabled",
          null,
        );
      } else {
        await addManagerNotification(
          "Notificações ativadas",
          "Este navegador receberá novas solicitações, reservas pendentes e alertas da gestão.",
          "push_enabled",
          null,
        );
      }
    }
    return getSnapshot(claims);
  }

  if (action === "unsubscribePush") {
    const endpoint = String(payload.endpoint ?? "");
    if (!endpoint) rowError("Inscrição de notificação não encontrada.");

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      let query = supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);
      query = claims.role === "teacher"
        ? query.eq("teacher_id", claims.teacherId ?? "")
        : query.eq("target_role", "manager").eq("manager_key", MANAGER_PUSH_KEY);
      const { error } = await query;
      if (error) rowError(error.message);
    }

    return getSnapshot(claims);
  }

  if (action === "occupyRoom") {
    if (claims.role !== "teacher" || !claims.teacherId) rowError("Apenas professores podem ocupar sala.");
    const room = await lookupRoom(String(payload.roomId ?? ""));
    assertRoomAvailable(room);
    const classGroup = String(payload.classGroup ?? "").trim();
    const period = String(payload.period ?? "").trim();

    if (!isSupabaseConfigured()) {
      const state = memory();
      const target = findMemoryRoom(state, room.id);
      target.status = "occupied";
      target.currentTeacherId = claims.teacherId;
      target.currentTeacherName = claims.name;
      target.currentClass = classGroup || null;
      target.currentPeriod = period || null;
      target.updatedAt = nowIso();
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("rooms")
        .update({
          status: "occupied",
          current_teacher_id: claims.teacherId,
          current_teacher_name: claims.name,
          current_class: classGroup || null,
          current_period: period || null,
          updated_at: nowIso(),
        })
        .eq("id", room.id);
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "releaseRoom") {
    if (claims.role !== "teacher" || !claims.teacherId) rowError("Apenas professores podem liberar sala.");
    const room = await lookupRoom(String(payload.roomId ?? ""));

    if (!isSupabaseConfigured()) {
      const target = findMemoryRoom(memory(), room.id);
      if (target.currentTeacherId !== claims.teacherId) rowError("Você não está ocupando esta sala.");
      target.status = "free";
      target.currentTeacherId = null;
      target.currentTeacherName = null;
      target.currentClass = null;
      target.currentPeriod = null;
      target.updatedAt = nowIso();
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("rooms")
        .update({
          status: "free",
          current_teacher_id: null,
          current_teacher_name: null,
          current_class: null,
          current_period: null,
          updated_at: nowIso(),
        })
        .eq("id", room.id)
        .eq("current_teacher_id", claims.teacherId);
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "addReservation") {
    if (claims.role !== "teacher" || !claims.teacherId) rowError("Apenas professores podem reservar sala.");
    const room = await lookupRoom(String(payload.roomId ?? ""));
    assertRoomAvailable(room);
    const date = String(payload.date ?? today());
    const startTime = String(payload.startTime ?? "");
    const endTime = String(payload.endTime ?? "");
    const reason = String(payload.reason ?? "").trim() || null;
    if (!date || !startTime || !endTime) rowError("Preencha data e horário da reserva.");

    if (!isSupabaseConfigured()) {
      const state = memory();
      const reservationId = newId("reservation");
      state.reservations.unshift({
        id: reservationId,
        teacherId: claims.teacherId,
        teacherName: claims.name,
        roomId: room.id,
        roomName: roomDisplayName(room),
        date,
        startTime,
        endTime,
        reason,
        status: "pending",
        createdAt: nowIso(),
      });
      await addManagerNotification(
        "Nova reserva pendente",
        `${claims.name} solicitou ${roomDisplayName(room)} em ${dateLabelForNotification(date)}, das ${startTime} às ${endTime}.`,
        "reservation_pending",
        { reservationId },
      );
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { data, error: reservationError } = await supabase
        .from("reservations")
        .insert({
          teacher_id: claims.teacherId,
          teacher_name: claims.name,
          room_id: room.id,
          room_name: roomDisplayName(room),
          date,
          start_time: startTime,
          end_time: endTime,
          reason,
          status: "pending",
        })
        .select("id")
        .single();
      if (reservationError) rowError(reservationError.message);
      const reservationId = String((data as Record<string, unknown>).id);
      await addManagerNotification(
        "Nova reserva pendente",
        `${claims.name} solicitou ${roomDisplayName(room)} em ${dateLabelForNotification(date)}, das ${startTime} às ${endTime}.`,
        "reservation_pending",
        { reservationId },
      );
    }
    return getSnapshot(claims);
  }

  if (action === "approveReservation") {
    requireManager(claims);
    const reservationId = String(payload.reservationId ?? "");
    const reservation = await lookupReservation(reservationId);
    const reservationRoom = reservation.roomId ? await lookupRoom(reservation.roomId) : null;
    if (reservationRoom) assertRoomAvailable(reservationRoom);

    if (!isSupabaseConfigured()) {
      const state = memory();
      const target = findMemoryReservation(state, reservationId);
      target.status = "approved";
      if (target.roomId) {
        const room = findMemoryRoom(state, target.roomId);
        assertRoomAvailable(room);
        room.status = "reserved";
        room.currentTeacherId = target.teacherId;
        room.currentTeacherName = target.teacherName;
        room.currentClass = target.reason;
        room.currentPeriod = `${target.startTime}-${target.endTime}`;
        room.updatedAt = nowIso();
      }
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "approved" })
        .eq("id", reservationId);
      if (reservationError) rowError(reservationError.message);
      if (reservation.roomId) {
        const { error: roomError } = await supabase
          .from("rooms")
          .update({
            status: "reserved",
            current_teacher_id: reservation.teacherId,
            current_teacher_name: reservation.teacherName,
            current_class: reservation.reason,
            current_period: `${reservation.startTime}-${reservation.endTime}`,
            updated_at: nowIso(),
          })
          .eq("id", reservation.roomId);
        if (roomError) rowError(roomError.message);
      }
    }

    await addTeacherNotification(
      reservation.teacherId,
      "Reserva aprovada",
      `${reservation.roomName} foi aprovada para ${dateLabelForNotification(reservation.date)}, das ${reservation.startTime} às ${reservation.endTime}.`,
      "reservation_approved",
      { reservationId },
    );
    return getSnapshot(claims);
  }

  if (action === "rejectReservation") {
    requireManager(claims);
    const reservationId = String(payload.reservationId ?? "");
    const reservation = await lookupReservation(reservationId);

    if (!isSupabaseConfigured()) {
      findMemoryReservation(memory(), reservationId).status = "rejected";
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase.from("reservations").update({ status: "rejected" }).eq("id", reservationId);
      if (error) rowError(error.message);
    }

    await addTeacherNotification(
      reservation.teacherId,
      "Reserva recusada",
      `${reservation.roomName} não foi aprovada para ${dateLabelForNotification(reservation.date)}, das ${reservation.startTime} às ${reservation.endTime}.`,
      "reservation_rejected",
      { reservationId },
    );
    return getSnapshot(claims);
  }

  if (action === "updateAvatar") {
    if (claims.role !== "teacher" || !claims.teacherId) rowError("Apenas professores podem alterar foto.");
    const avatarUrl = String(payload.avatarUrl ?? "");

    if (!isSupabaseConfigured()) {
      const teacher = findMemoryTeacher(memory(), claims.teacherId);
      teacher.avatarUrl = avatarUrl;
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("teachers")
        .update({ avatar_url: avatarUrl })
        .eq("id", claims.teacherId);
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  rowError("Ação não reconhecida.");
}
