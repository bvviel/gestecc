import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createMemoryState, type MemoryState } from "./demo-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";
import { hashPassword, signSession, verifyPassword } from "./security";
import type {
  AppSnapshot,
  ContractType,
  Notification,
  Reservation,
  Room,
  Schedule,
  SessionClaims,
  Substitution,
  Teacher,
  TeacherRequest,
} from "./types";

type LoginResult =
  | { ok: true; token: string; role: "manager"; name: string; email: string }
  | { ok: true; token: string; role: "teacher"; name: string; email: string; teacherId: string }
  | { ok: false; message: string; status?: "pending" | "rejected" | "invalid" };

type ActionPayload = Record<string, unknown>;

const globalForMemory = globalThis as typeof globalThis & {
  __gesteccMemory?: MemoryState;
};

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
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    discipline: String(row.discipline ?? ""),
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
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    discipline: String(row.discipline),
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
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    teacherName: String(row.teacher_name),
    discipline: String(row.discipline),
    classGroup: String(row.class_group),
    roomId: row.room_id ? String(row.room_id) : null,
    roomName: String(row.room_name),
    weekday: Number(row.weekday),
    periodLabel: String(row.period_label),
    startTime: String(row.start_time).slice(0, 5),
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
  const discipline = String(payload.discipline ?? "").trim();
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
      email,
      contractType,
      status: "pending",
      rejectionReason: null,
      createdAt: nowIso(),
      reviewedAt: null,
    };
    state.requests.unshift(request);
    state.requestSecrets[request.id] = passwordHash;
    state.notifications.unshift({
      id: newId("notification"),
      targetRole: "manager",
      teacherId: null,
      title: "Nova solicitação de cadastro",
      body: `${fullName} solicitou acesso como professor de ${discipline}. E-mail: ${email}. Vínculo: ${contractTypeText(contractType)}.`,
      kind: "teacher_request",
      readAt: null,
      payload: { requestId: request.id },
      createdAt: nowIso(),
    });
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

  const { data, error } = await supabase
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

  if (error) rowError(error.message);
  const request = mapRequest(data as Record<string, unknown>);

  const { error: notificationError } = await supabase.from("notifications").insert({
    target_role: "manager",
    teacher_id: null,
    title: "Nova solicitação de cadastro",
    body: `${fullName} solicitou acesso como professor de ${discipline}. E-mail: ${email}. Vínculo: ${contractTypeText(contractType)}.`,
    kind: "teacher_request",
    payload: { requestId: request.id },
  });

  if (notificationError) rowError(notificationError.message);
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
    state.notifications.unshift({
      id: newId("notification"),
      targetRole: "teacher",
      teacherId: teacher.id,
      title: "Cadastro aprovado",
      body: "Sua solicitação foi aprovada. Você já pode acessar o GESTEC.",
      kind: "request_approved",
      readAt: null,
      payload: null,
      createdAt: nowIso(),
    });
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

  const { data: teacherRow, error: teacherError } = await supabase
    .from("teachers")
    .insert({
      request_id: requestId,
      full_name: requestData.full_name,
      discipline: requestData.discipline,
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

  if (teacherError) rowError(teacherError.message);
  const teacher = mapTeacher(teacherRow as Record<string, unknown>);

  const { error: updateError } = await supabase
    .from("teacher_requests")
    .update({ status: "approved", reviewed_at: nowIso() })
    .eq("id", requestId);
  if (updateError) rowError(updateError.message);

  const { error: notificationError } = await supabase.from("notifications").insert({
    target_role: "teacher",
    teacher_id: teacher.id,
    title: "Cadastro aprovado",
    body: "Sua solicitação foi aprovada. Você já pode acessar o GESTEC.",
    kind: "request_approved",
  });
  if (notificationError) rowError(notificationError.message);
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
  const classGroup = String(payload.classGroup ?? "").trim();
  const periodLabel = String(payload.periodLabel ?? "").trim();
  const discipline = String(payload.discipline ?? fallbackDiscipline).trim();
  const startTime = String(payload.startTime ?? "");
  const endTime = String(payload.endTime ?? "");
  const weekday = Number(payload.weekday ?? 1);

  if (!classGroup || !periodLabel || !discipline || !startTime || !endTime) {
    rowError("Preencha todos os dados do horário.");
  }
  if (weekday < 1 || weekday > 5) rowError("Selecione um dia útil para a aula.");

  return { classGroup, periodLabel, discipline, startTime, endTime, weekday };
}

type ScheduleDetails = ReturnType<typeof validateSchedulePayload>;

function sameScheduleSlot(schedule: Schedule, details: ScheduleDetails) {
  return (
    schedule.weekday === details.weekday &&
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
  if (!supabase) rowError("Supabase nÃ£o configurado.");
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
  schedule.classGroup = details.classGroup;
  schedule.roomId = room.id;
  schedule.roomName = room.name;
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
  if (!supabase) rowError("Supabase nÃ£o configurado.");
  const { error } = await supabase
    .from("schedules")
    .update({
      teacher_id: teacher.id,
      teacher_name: teacher.fullName,
      discipline: details.discipline,
      class_group: details.classGroup,
      room_id: room.id,
      room_name: room.name,
      weekday: details.weekday,
      period_label: details.periodLabel,
      start_time: details.startTime,
      end_time: details.endTime,
    })
    .eq("id", scheduleId);
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
  if (!supabase) rowError("Supabase nÃ£o configurado.");
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

async function sendTeacherPushNotification(
  teacherId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  if (!isSupabaseConfigured() || !pushVapidConfig()) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("teacher_id", teacherId);

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
            data,
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

    if (!isSupabaseConfigured()) {
      memory().notices.unshift({
        id: newId("notice"),
        title,
        body,
        category,
        createdAt: nowIso(),
        expiresAt: payload.expiresAt ? String(payload.expiresAt) : null,
      });
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase.from("notices").insert({
        title,
        body,
        category,
        expires_at: payload.expiresAt || null,
      });
      if (error) rowError(error.message);
    }
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

  if (action === "addSubstitution") {
    requireManager(claims);
    const originalTeacher = await lookupTeacher(String(payload.originalTeacherId ?? ""));
    const substituteTeacher = await lookupTeacher(String(payload.substituteTeacherId ?? ""));
    const room = await lookupRoom(String(payload.roomId ?? ""));
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
        roomName: room.name,
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
        room_name: room.name,
      });
      if (error) rowError(error.message);
    }
    return getSnapshot(claims);
  }

  if (action === "addSchedule") {
    requireManager(claims);
    const teacher = await lookupTeacher(String(payload.teacherId ?? ""));
    const room = await lookupRoom(String(payload.roomId ?? ""));
    const details = validateSchedulePayload(payload, teacher.discipline);
    if (teacher.discipline !== details.discipline) {
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
        classGroup: details.classGroup,
        roomId: room.id,
        roomName: room.name,
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
      const { data, error } = await supabase
        .from("schedules")
        .insert({
          teacher_id: teacher.id,
          teacher_name: teacher.fullName,
          discipline: details.discipline,
          class_group: details.classGroup,
          room_id: room.id,
          room_name: room.name,
          weekday: details.weekday,
          period_label: details.periodLabel,
          start_time: details.startTime,
          end_time: details.endTime,
        })
        .select("id")
        .single();
      if (error) rowError(error.message);
      scheduleId = String((data as Record<string, unknown>).id);
    }
    await addTeacherNotification(
      teacher.id,
      replacedSchedule ? "Aula substituída na grade" : "Nova aula cadastrada",
      `${details.discipline} em ${details.classGroup}, ${weekdaysLabel(details.weekday)}, ${details.periodLabel}, sala ${room.name}.`,
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
    const details = validateSchedulePayload(
      payload,
      teacher.discipline,
    );
    if (teacher.discipline !== details.discipline) {
      rowError(`Selecione um professor aprovado para ${details.discipline}.`);
    }
    const { classGroup, periodLabel, discipline, startTime, endTime, weekday } = details;
    const conflicts = await findScheduleSlotConflicts(details, scheduleId);

    if (!isSupabaseConfigured()) {
      const target = findMemorySchedule(memory(), scheduleId);
      target.teacherId = teacher.id;
      target.teacherName = teacher.fullName;
      target.discipline = discipline;
      target.classGroup = classGroup;
      target.roomId = room.id;
      target.roomName = room.name;
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
          class_group: classGroup,
          room_id: room.id,
          room_name: room.name,
          weekday,
          period_label: periodLabel,
          start_time: startTime,
          end_time: endTime,
        })
        .eq("id", scheduleId);
      if (error) rowError(error.message);
    }
    await deleteScheduleRecords(conflicts.map((schedule) => schedule.id));

    await addTeacherNotification(
      teacher.id,
      "Aula atualizada",
      `${discipline} em ${classGroup}, ${weekdaysLabel(weekday)}, ${periodLabel}, sala ${room.name}.`,
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
    if (claims.role !== "teacher" || !claims.teacherId) {
      rowError("Apenas professores podem ativar notificações em segundo plano.");
    }
    const subscription = subscriptionFromPayload(payload);

    if (!isSupabaseConfigured()) {
      rowError("Configure o Supabase para salvar notificações em segundo plano.");
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) rowError("Supabase não configurado.");
    const { error } = await supabase.from("push_subscriptions").upsert(
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
    if (error) rowError(error.message);

    await addTeacherNotification(
      claims.teacherId,
      "Notificações ativadas",
      "Este navegador receberá avisos quando suas aulas forem cadastradas ou atualizadas.",
      "push_enabled",
      null,
    );
    return getSnapshot(claims);
  }

  if (action === "unsubscribePush") {
    if (claims.role !== "teacher" || !claims.teacherId) {
      rowError("Apenas professores podem desativar notificações em segundo plano.");
    }
    const endpoint = String(payload.endpoint ?? "");
    if (!endpoint) rowError("Inscrição de notificação não encontrada.");

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (!supabase) rowError("Supabase não configurado.");
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("teacher_id", claims.teacherId)
        .eq("endpoint", endpoint);
      if (error) rowError(error.message);
    }

    return getSnapshot(claims);
  }

  if (action === "occupyRoom") {
    if (claims.role !== "teacher" || !claims.teacherId) rowError("Apenas professores podem ocupar sala.");
    const room = await lookupRoom(String(payload.roomId ?? ""));
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
        roomName: room.name,
        date,
        startTime,
        endTime,
        reason,
        status: "pending",
        createdAt: nowIso(),
      });
      await addManagerNotification(
        "Nova reserva pendente",
        `${claims.name} solicitou ${room.name} em ${dateLabelForNotification(date)}, das ${startTime} às ${endTime}.`,
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
          room_name: room.name,
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
        `${claims.name} solicitou ${room.name} em ${dateLabelForNotification(date)}, das ${startTime} às ${endTime}.`,
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

    if (!isSupabaseConfigured()) {
      const state = memory();
      const target = findMemoryReservation(state, reservationId);
      target.status = "approved";
      if (target.roomId) {
        const room = findMemoryRoom(state, target.roomId);
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
