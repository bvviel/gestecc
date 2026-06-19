"use client";

import {
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  DoorOpen,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Info,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Pencil,
  Plus,
  School,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISCIPLINES, type AppSnapshot, type ClientSession, type Room, type Schedule } from "@/lib/types";

type AuthView = "select" | "manager" | "teacher" | "request" | "about";
type PageView = "general" | "manager" | "teacher";
type ManagerTab = "people" | "permanent" | "temporary" | "schedules" | "reservations" | "notices";
type TeacherTab = "overview" | "schedules" | "reservations" | "profile";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; message: string };

const today = () => new Date().toISOString().slice(0, 10);
const workWeek = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
];
const periodOptions = [
  { label: "1º período", start: "07:30", end: "08:20" },
  { label: "2º período", start: "08:20", end: "09:10" },
  { label: "3º período", start: "09:10", end: "10:00" },
  { label: "4º período", start: "10:15", end: "11:05" },
  { label: "5º período", start: "11:05", end: "11:55" },
  { label: "6º período", start: "11:55", end: "12:45" },
  { label: "7º período", start: "12:45", end: "13:35" },
].map((period) => ({
  ...period,
  value: `${period.label}|${period.start}|${period.end}`,
}));
const schoolBreak = { label: "Intervalo", start: "10:00", end: "10:15" };
const defaultClassGroups = [
  "1º DS",
  "2º DS",
  "3º DS",
  "1º Administração",
  "2º Administração",
  "3º Administração",
  "1º Marketing",
  "2º Marketing",
  "3º Marketing",
  "1º Informática",
  "2º Informática",
  "3º Informática",
  "1º Química",
  "2º Química",
  "3º Química",
];

const emptyData: AppSnapshot = {
  configured: false,
  mode: "memory",
  now: new Date().toISOString(),
  notices: [],
  rooms: [],
  substitutions: [],
  teachers: [],
  requests: [],
  schedules: [],
  reservations: [],
  notifications: [],
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fullDateLabel(value = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(value);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function contractTypeLabel(value: "permanent" | "temporary") {
  return value === "permanent" ? "Concursado" : "Não concursado";
}

function periodValue(schedule: Pick<Schedule, "periodLabel" | "startTime" | "endTime">) {
  const canonical = periodOptions.find((period) => period.start === schedule.startTime && period.end === schedule.endTime);
  if (canonical) return canonical.value;
  return `${schedule.periodLabel}|${schedule.startTime}|${schedule.endTime}`;
}

function periodFromValue(value: string) {
  const [label = periodOptions[0].label, start = periodOptions[0].start, end = periodOptions[0].end] = value.split("|");
  return { label, start, end };
}

function samePeriod(schedule: Pick<Schedule, "periodLabel" | "startTime" | "endTime">, period: typeof periodOptions[number]) {
  return schedule.periodLabel === period.label || (schedule.startTime === period.start && schedule.endTime === period.end);
}

function getFormString(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "");
}

function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-[#36c486] text-white shadow-sm shadow-emerald-600/20 hover:bg-[#20a76b] hover:shadow-lg hover:shadow-emerald-600/20",
    secondary:
      "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10",
    ghost:
      "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
    danger:
      "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-600/20",
  };

  return (
    <button
      type={type}
      className={cx(
        "inline-flex h-10 transform-gpu items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:focus-visible:ring-emerald-950/40",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function TextInput({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cx("grid gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200", className)}>
      {label}
      <input
        className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition-all duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[#36c486] focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-white/20 dark:focus:ring-emerald-950/40"
        {...props}
      />
    </label>
  );
}

function SelectInput({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cx("grid gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200", className)}>
      {label}
      <select
        className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition-all duration-200 hover:border-zinc-300 focus:border-[#36c486] focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-[#07120d] dark:text-white dark:hover:border-white/20 dark:focus:ring-emerald-950/40"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

function PasswordInput({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
      {label}
      <span className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-base text-zinc-950 outline-none transition-all duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[#36c486] focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-white/20 dark:focus:ring-emerald-950/40"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      aria-label="Alternar tema"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 transform-gpu items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f8a61] text-white shadow-sm shadow-violet-950/20">
        <BookOpen size={22} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-xl font-black tracking-wide text-[#0f8a61] dark:text-white">GESTEC</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#36c486]">
            Programando Sempre
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30">
      <div className={cx("mb-4 grid h-8 w-8 place-items-center rounded-lg", tone)}>{icon}</div>
      <div className="text-2xl font-black text-zinc-950 dark:text-white">{value}</div>
      <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

export function GesteccApp() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [authView, setAuthView] = useState<AuthView>("select");
  const [session, setSession] = useState<ClientSession | null>(null);
  const [data, setData] = useState<AppSnapshot>(emptyData);
  const [page, setPage] = useState<PageView>("general");
  const [managerTab, setManagerTab] = useState<ManagerTab>("people");
  const [teacherTab, setTeacherTab] = useState<TeacherTab>("overview");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setTheme = useCallback((value: "light" | "dark") => {
    setThemeState(value);
    localStorage.setItem("gestecc-theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const savedTheme = localStorage.getItem("gestecc-theme") as "light" | "dark" | null;
      const preferredTheme =
        savedTheme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(preferredTheme);

      const savedSession = localStorage.getItem("gestecc-session");
      if (savedSession) {
        try {
          setSession(JSON.parse(savedSession) as ClientSession);
        } catch {
          localStorage.removeItem("gestecc-session");
        }
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [setTheme]);

  const fetchSnapshot = useCallback(async () => {
    if (!session) return;
    const response = await fetch("/api/app", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const json = (await response.json()) as ApiResponse<AppSnapshot>;
    if (json.ok) {
      setData(json.data);
    } else {
      setMessage(json.message);
      if (response.status === 401) {
        setSession(null);
        localStorage.removeItem("gestecc-session");
      }
    }
  }, [session]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchSnapshot();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      void fetchSnapshot();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [fetchSnapshot, session]);

  const postAction = useCallback(
    async (action: string, payload: Record<string, string | number | null | undefined> = {}) => {
      if (!session) return false;
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch("/api/app", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ action, payload }),
        });
        const json = (await response.json()) as ApiResponse<AppSnapshot>;
        if (!json.ok) {
          setMessage(json.message);
          return false;
        }
        setData(json.data);
        return true;
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  const login = async (event: FormEvent<HTMLFormElement>, mode: "manager" | "teacher") => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = event.currentTarget;
    const payload =
      mode === "manager"
        ? {
            mode,
            username: getFormString(form, "username"),
            password: getFormString(form, "password"),
          }
        : {
            mode,
            email: getFormString(form, "email"),
            password: getFormString(form, "password"),
          };

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as
        | ({ ok: true } & ClientSession)
        | { ok: false; message: string };

      if (!json.ok) {
        setMessage(json.message);
        return;
      }

      const nextSession: ClientSession = {
        token: json.token,
        role: json.role,
        name: json.name,
        email: json.email,
        teacherId: json.teacherId,
      };

      localStorage.setItem("gestecc-session", JSON.stringify(nextSession));
      setSession(nextSession);
      setPage(mode === "manager" ? "manager" : "general");
      setAuthView("select");
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const password = getFormString(form, "password");
    const confirmPassword = getFormString(form, "confirmPassword");
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "requestAccess",
          fullName: getFormString(form, "fullName"),
          discipline: getFormString(form, "discipline"),
          contractType: getFormString(form, "contractType"),
          email: getFormString(form, "email"),
          password,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message: string };
      setMessage(json.message);
      if (json.ok) {
        form.reset();
        setAuthView("teacher");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setSession(null);
    setData(emptyData);
    setPage("general");
    localStorage.removeItem("gestecc-session");
  };

  const metrics = useMemo(() => {
    const todaysSchedules = data.schedules.filter((schedule) => schedule.weekday === new Date().getDay()).length;
    return {
      todaysSchedules,
      substitutions: data.substitutions.length,
      notices: data.notices.length,
      activeTeachers: data.teachers.length,
      permanentTeachers: data.teachers.filter((teacher) => teacher.contractType === "permanent").length,
      temporaryTeachers: data.teachers.filter((teacher) => teacher.contractType === "temporary").length,
      pendingRequests: data.requests.filter((request) => request.status === "pending").length,
      reservations: data.reservations.length,
      pendingReservations: data.reservations.filter((reservation) => reservation.status === "pending").length,
    };
  }, [data]);

  const teacher = useMemo(
    () => data.teachers.find((item) => item.id === session?.teacherId) ?? null,
    [data.teachers, session?.teacherId],
  );

  const freeRooms = data.rooms.filter((room) => room.status === "free");
  const unreadNotifications = data.notifications.filter((notification) => !notification.readAt).length;

  if (!session) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f4f7f5] text-zinc-950 transition dark:bg-[#020806] dark:text-white">
        <header className="relative z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#020806]/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <Logo />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </header>
        <section className="relative z-10 mx-auto grid min-h-[calc(100vh-132px)] max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_0.92fr]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
              <Sparkles size={15} /> Plataforma escolar integrada
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.04] text-[#062016] dark:text-white sm:text-6xl">
              Bem-vindo ao GESTEC
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Um sistema criado por alunos para resolver problemas de organização escolar da ETEC Dra. Maria Augusta Saraiva, reunindo avisos, horários, professores, contratos, substituições e reservas em um só lugar.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                ["Mural de avisos da gestão", Megaphone],
                ["Horários por professor", Calendar],
                ["Contratos organizados", FileText],
                ["Reservas com aprovação", CheckCircle2],
              ].map(([label, Icon]) => (
                <div
                  key={String(label)}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/75 p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-[#36c486] dark:bg-emerald-400/10">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{String(label)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
              {authView !== "select" && (
                <button
                  type="button"
                  className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-500 transition hover:bg-white hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => {
                    setAuthView("select");
                    setMessage(null);
                  }}
                >
                  <ChevronLeft size={18} />
                  Voltar
                </button>
              )}

              {authView === "select" && (
                <div className="rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl shadow-emerald-950/5 transition-all duration-300 dark:border-white/10 dark:bg-[#07120d]/95 dark:shadow-black/30">
                  <Button
                    type="button"
                    variant="secondary"
                    className="mb-5 w-full justify-center rounded-xl"
                    onClick={() => {
                      setAuthView("about");
                      setMessage(null);
                    }}
                  >
                    <Info size={16} /> Quem somos nós?
                  </Button>
                  <div className="mb-5">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#36c486] dark:bg-emerald-500/10">
                      <span className="h-2 w-2 rounded-full bg-[#36c486]" />
                      Fazer login
                    </span>
                    <h2 className="mt-4 text-3xl font-black leading-tight">Acesso ao sistema</h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Escolha seu perfil para continuar no GESTEC.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <button
                      type="button"
                      onClick={() => setAuthView("teacher")}
                      className="group flex transform-gpu items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#36c486] hover:shadow-lg active:translate-y-0 active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#36c486] text-white shadow-lg shadow-emerald-600/20">
                          <GraduationCap size={24} />
                        </span>
                        <span>
                          <span className="block font-black">Sou Professor</span>
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                            Horários, reservas e perfil
                          </span>
                        </span>
                      </span>
                      <span className="text-zinc-300 transition group-hover:translate-x-1 group-hover:text-[#36c486]">›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthView("manager")}
                      className="group flex transform-gpu items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#0f8a61] hover:shadow-lg active:translate-y-0 active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0f8a61] text-white shadow-lg shadow-emerald-600/20">
                          <Shield size={23} />
                        </span>
                        <span>
                          <span className="block font-black">Sou Gestor</span>
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                            Painel administrativo
                          </span>
                        </span>
                      </span>
                      <span className="text-zinc-300 transition group-hover:translate-x-1 group-hover:text-[#0f8a61]">›</span>
                    </button>
                  </div>
                </div>
              )}

              {authView === "about" && (
                <section className="rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-xl shadow-emerald-950/5 dark:border-white/10 dark:bg-[#07120d]/95 dark:shadow-black/30">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#36c486] dark:bg-emerald-500/10">
                    <School size={14} /> Projeto GESTEC
                  </span>
                  <h2 className="mt-5 text-3xl font-black">Quem somos nós?</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    O GESTEC é um sistema de gestão escolar desenvolvido para auxiliar diretores, coordenadores e professores na organização administrativa da escola. Ele centraliza informações importantes e facilita o gerenciamento de salas, professores, contratos e recursos escolares.
                  </p>
                  <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    O projeto foi iniciado por alunos do 1° ano de Desenvolvimento de Sistemas: Gabriel Borsari, Alejandro Schafer, Antônio, Braian, Gabriel Kim e Eloah. Depois de muitas pesquisas, o website foi ajustado para atender melhor a rotina da ETEC Dra. Maria Augusta Saraiva.
                  </p>
                  <Button className="mt-6 w-full rounded-xl" onClick={() => setAuthView("select")}>
                    Voltar para login e cadastro
                  </Button>
                </section>
              )}

              {authView === "teacher" && (
                <form onSubmit={(event) => login(event, "teacher")} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#36c486] px-5 py-3 text-sm font-black text-white">
                    <GraduationCap size={19} /> Professor
                  </span>
                  <div>
                    <h2 className="text-4xl font-black">Bem-vindo de volta</h2>
                    <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
                      Entre com seu e-mail institucional
                    </p>
                  </div>
                  <TextInput label="E-mail institucional" name="email" type="email" placeholder="seu@escola.edu.br" required />
                  <PasswordInput label="Senha" name="password" placeholder="••••••••" />
                  <Button type="submit" className="h-14 rounded-xl text-base" disabled={loading}>
                    Entrar como Professor
                  </Button>
                  <button
                    type="button"
                    className="text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400"
                    onClick={() => {
                      setAuthView("request");
                      setMessage(null);
                    }}
                  >
                    Não tem conta? <span className="text-[#36c486]">Cadastrar-se</span>
                  </button>
                </form>
              )}

              {authView === "manager" && (
                <form onSubmit={(event) => login(event, "manager")} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#0f8a61] px-5 py-3 text-sm font-black text-white">
                    <Shield size={18} /> Gestor
                  </span>
                  <div>
                    <h2 className="text-4xl font-black">Acesso da Gestão</h2>
                    <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
                      Login administrativo único
                    </p>
                  </div>
                  <TextInput label="Usuário" name="username" placeholder="Usuário administrativo" required />
                  <PasswordInput label="Senha" name="password" placeholder="••••••••" />
                  <Button type="submit" className="h-14 rounded-xl text-base" disabled={loading}>
                    Acessar como Gestor
                  </Button>
                </form>
              )}

              {authView === "request" && (
                <form onSubmit={requestAccess} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#36c486] px-5 py-3 text-sm font-black text-white">
                    <GraduationCap size={19} /> Novo Professor
                  </span>
                  <div>
                    <h2 className="text-4xl font-black">Criar conta</h2>
                    <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
                      Preencha seus dados para solicitar acesso
                    </p>
                  </div>
                  <TextInput label="Nome completo" name="fullName" placeholder="Prof. Maria da Silva" required />
                  <SelectInput label="Disciplina principal" name="discipline" defaultValue="" required>
                    <option value="" disabled>
                      Selecione a disciplina
                    </option>
                    {DISCIPLINES.map((discipline) => (
                      <option key={discipline}>{discipline}</option>
                    ))}
                  </SelectInput>
                  <SelectInput label="Tipo de vínculo" name="contractType" defaultValue="" required>
                    <option value="" disabled>
                      Selecione o vínculo
                    </option>
                    <option value="permanent">Concursado</option>
                    <option value="temporary">Não concursado</option>
                  </SelectInput>
                  <TextInput label="E-mail institucional" name="email" type="email" placeholder="seu@escola.edu.br" required />
                  <PasswordInput label="Senha" name="password" placeholder="Mínimo 6 caracteres" />
                  <PasswordInput label="Confirmar senha" name="confirmPassword" placeholder="Repita a senha" />
                  <Button type="submit" className="h-14 rounded-xl text-base" disabled={loading}>
                    Solicitar Cadastro
                  </Button>
                  <button
                    type="button"
                    className="text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400"
                    onClick={() => setAuthView("teacher")}
                  >
                    Já tem conta? <span className="text-[#36c486]">Fazer login</span>
                  </button>
                </form>
              )}

              {message && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {message}
                </div>
              )}
            </div>
        </section>
        <footer className="relative z-10 border-t border-zinc-200/80 bg-white/70 py-4 text-center text-xs font-semibold text-zinc-500 backdrop-blur dark:border-white/10 dark:bg-[#020806]/80 dark:text-zinc-400">
          © 2026 GESTEC — Todos os direitos reservados.
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-zinc-950 transition dark:bg-[#020806] dark:text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#020806]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo compact />
            <div className="hidden sm:block">
              <div className="text-sm font-black">Olá, {session.name.split(" ")[0]}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{fullDateLabel()}</div>
            </div>
          </div>

          <nav className="flex min-w-0 items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setPage("general")}
              className={cx(
                "inline-flex h-9 transform-gpu items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                page === "general"
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-[#123322] dark:text-white"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
              )}
            >
              <LayoutDashboard size={16} />
              <span className="hidden md:inline">Painel Geral</span>
            </button>
            {session.role === "manager" && (
              <button
                type="button"
                onClick={() => setPage("manager")}
                className={cx(
                  "inline-flex h-9 transform-gpu items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                  page === "manager"
                    ? "bg-[#36c486] text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
                )}
              >
                <Shield size={16} />
                <span className="hidden md:inline">Gestão</span>
              </button>
            )}
            {session.role === "teacher" && (
              <button
                type="button"
                onClick={() => setPage("teacher")}
                className={cx(
                  "inline-flex h-9 transform-gpu items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                  page === "teacher"
                    ? "bg-[#36c486] text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
                )}
              >
                <GraduationCap size={16} />
                <span className="hidden md:inline">Professor</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className={cx(
                  "relative inline-flex h-10 w-10 transform-gpu items-center justify-center rounded-full text-zinc-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-100 active:scale-95 dark:text-zinc-300 dark:hover:bg-white/10",
                  notificationsOpen && "bg-emerald-50 text-[#36c486] shadow-sm dark:bg-emerald-400/10",
                  unreadNotifications > 0 && !notificationsOpen && "animate-pulse",
                )}
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Notificações"
              >
                <Bell size={18} />
                {unreadNotifications > 0 && (
                  <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#36c486] px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#020806]">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#07120d] dark:shadow-black/40">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-white/10">
                    <div>
                      <div className="font-black">Notificações</div>
                      <div className="text-xs text-zinc-400">{unreadNotifications} não lida(s)</div>
                    </div>
                    {data.notifications.length > 0 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-[#36c486] transition hover:-translate-y-0.5 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/20"
                        onClick={() => void postAction("markNotificationsRead")}
                      >
                        <CheckCheck size={13} /> Ler todas
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-auto p-2">
                    {data.notifications.length === 0 && (
                      <div className="p-5 text-center text-sm text-zinc-500">Nenhuma notificação</div>
                    )}
                    {data.notifications.map((notification) => {
                      const requestId = String(notification.payload?.requestId ?? "");
                      const reservationId = String(notification.payload?.reservationId ?? "");
                      const signupRequest = requestId
                        ? data.requests.find((request) => request.id === requestId) ?? null
                        : null;
                      const canReviewRequest = signupRequest?.status === "pending";
                      return (
                        <div
                          key={notification.id}
                          className={cx(
                            "cursor-pointer rounded-lg border p-3 transition hover:bg-zinc-50 dark:hover:bg-white/5",
                            notification.readAt
                              ? "border-transparent opacity-75"
                              : "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
                          )}
                          onClick={() => {
                            if (!notification.readAt) {
                              void postAction("markNotificationRead", { notificationId: notification.id });
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black">{notification.title}</div>
                            {!notification.readAt && <span className="h-2 w-2 rounded-full bg-[#36c486]" />}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{notification.body}</div>
                          {signupRequest && (
                            <dl className="mt-3 grid gap-1.5 rounded-xl bg-white/70 p-3 text-[11px] dark:bg-white/5">
                              {[
                                ["Nome", signupRequest.fullName],
                                ["E-mail", signupRequest.email],
                                ["Disciplina", signupRequest.discipline],
                                ["Vínculo", contractTypeLabel(signupRequest.contractType)],
                                ["Enviado em", dateTimeLabel(signupRequest.createdAt)],
                              ].map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-3">
                                  <dt className="text-zinc-400">{label}</dt>
                                  <dd className="text-right font-bold text-zinc-700 dark:text-zinc-200">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          <div className="mt-2 text-[11px] text-zinc-400">
                            {dateTimeLabel(notification.createdAt)} · {notification.readAt ? "Lida" : "Não lida"}
                          </div>
                          {session.role === "manager" && requestId && !signupRequest && (
                            <div className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                              Solicitação já resolvida ou removida.
                            </div>
                          )}
                          {session.role === "manager" && requestId && signupRequest && !canReviewRequest && (
                            <div className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                              Solicitação {signupRequest.status === "approved" ? "aprovada" : "recusada"}.
                            </div>
                          )}
                          {session.role === "manager" && requestId && canReviewRequest && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                className="h-8 px-3 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void (async () => {
                                    if (!notification.readAt) {
                                      await postAction("markNotificationRead", { notificationId: notification.id });
                                    }
                                    await postAction("approveRequest", { requestId });
                                  })();
                                }}
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void (async () => {
                                    if (!notification.readAt) {
                                      await postAction("markNotificationRead", { notificationId: notification.id });
                                    }
                                    await postAction("rejectRequest", { requestId });
                                  })();
                                }}
                              >
                                Recusar
                              </Button>
                            </div>
                          )}
                          {session.role === "manager" && reservationId && notification.kind === "reservation_pending" && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                className="h-8 px-3 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void (async () => {
                                    if (!notification.readAt) {
                                      await postAction("markNotificationRead", { notificationId: notification.id });
                                    }
                                    await postAction("approveReservation", { reservationId });
                                  })();
                                }}
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void (async () => {
                                    if (!notification.readAt) {
                                      await postAction("markNotificationRead", { notificationId: notification.id });
                                    }
                                    await postAction("rejectReservation", { reservationId });
                                  })();
                                }}
                              >
                                Recusar
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button
              type="button"
              className="inline-flex h-10 w-10 transform-gpu items-center justify-center rounded-full text-zinc-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-100 active:scale-95 dark:text-zinc-300 dark:hover:bg-white/10"
              onClick={logout}
              aria-label="Deslogar"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {message && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Fechar mensagem">
              <X size={16} />
            </button>
          </div>
        )}

        {data.mode === "memory" && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            Modo local: conecte as variáveis do Supabase para persistência online.
          </div>
        )}

        {page === "general" && (
          <GeneralDashboard data={data} metrics={metrics} role={session.role} />
        )}

        {page === "manager" && session.role === "manager" && (
          <section className="grid gap-6">
            <div>
              <h1 className="text-3xl font-black">Painel da Gestão</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{fullDateLabel()}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users size={17} />} label="Professores ativos" value={metrics.activeTeachers} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
              <StatCard icon={<CheckCircle2 size={17} />} label="Concursados" value={metrics.permanentTeachers} tone="bg-teal-50 text-teal-600 dark:bg-teal-500/10" />
              <StatCard icon={<FileText size={17} />} label="Não concursados" value={metrics.temporaryTeachers} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10" />
              <StatCard icon={<ClipboardList size={17} />} label="Reservas pendentes" value={metrics.pendingReservations} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10" />
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm dark:bg-white/[0.04]">
              {[
                ["people", "Pessoas", Users],
                ["permanent", "Concursados", CheckCircle2],
                ["temporary", "Não concursados", FileText],
                ["schedules", "Horários", Calendar],
                ["reservations", "Reservas", ClipboardList],
                ["notices", "Avisos", Bell],
              ].map(([key, label, Icon]) => (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => setManagerTab(key as ManagerTab)}
                  className={cx(
                    "inline-flex h-9 transform-gpu items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                    managerTab === key
                      ? "bg-zinc-950 text-white dark:bg-[#36c486]"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10",
                  )}
                >
                  <Icon size={15} />
                  {String(label)}
                </button>
              ))}
            </div>

            {managerTab === "people" && (
              <ManagerPeople
                data={data}
                loading={loading}
                substitutionOpen={substitutionOpen}
                setSubstitutionOpen={setSubstitutionOpen}
                postAction={postAction}
              />
            )}
            {managerTab === "permanent" && (
              <ContractsTable
                teachers={data.teachers.filter((teacher) => teacher.contractType === "permanent")}
                title="Professores concursados"
                subtitle="Vínculos sem prazo de término."
              />
            )}
            {managerTab === "temporary" && (
              <ContractsTable
                teachers={data.teachers.filter((teacher) => teacher.contractType === "temporary")}
                title="Professores não concursados"
                subtitle="Contratos temporários com previsão de 2 anos."
              />
            )}
            {managerTab === "schedules" && (
              <SchedulesManager
                data={data}
                scheduleOpen={scheduleOpen}
                setScheduleOpen={setScheduleOpen}
                loading={loading}
                postAction={postAction}
              />
            )}
            {managerTab === "reservations" && (
              <ManagerReservations
                reservations={data.reservations}
                loading={loading}
                postAction={postAction}
              />
            )}
            {managerTab === "notices" && (
              <NoticesManager
                data={data}
                noticeOpen={noticeOpen}
                setNoticeOpen={setNoticeOpen}
                loading={loading}
                postAction={postAction}
              />
            )}
          </section>
        )}

        {page === "teacher" && session.role === "teacher" && (
          <section className="grid gap-6">
            <div>
              <h1 className="text-3xl font-black">Olá, {session.name.split(" ")[0]}</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{fullDateLabel()}</p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-xl bg-zinc-100 p-2 dark:bg-white/5">
              {[
                ["overview", "Visão Geral", BookOpen],
                ["schedules", "Horários", Calendar],
                ["reservations", "Reservas", ClipboardList],
                ["profile", "Perfil", User],
              ].map(([key, label, Icon]) => (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => setTeacherTab(key as TeacherTab)}
                  className={cx(
                    "inline-flex h-10 transform-gpu items-center gap-2 rounded-lg px-4 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                    teacherTab === key
                      ? "bg-white text-zinc-950 shadow-sm dark:bg-[#123322] dark:text-white"
                      : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
                  )}
                >
                  <Icon size={16} />
                  {String(label)}
                </button>
              ))}
            </div>

            {teacherTab === "overview" && (
              <TeacherOverview
                schedules={data.schedules}
                reservations={data.reservations}
              />
            )}
            {teacherTab === "schedules" && <TeacherSchedules schedules={data.schedules} />}
            {teacherTab === "reservations" && (
              <TeacherReservations
                reservations={data.reservations}
                freeRooms={freeRooms}
                reservationOpen={reservationOpen}
                setReservationOpen={setReservationOpen}
                loading={loading}
                postAction={postAction}
              />
            )}
            {teacherTab === "profile" && (
              <TeacherProfile
                teacher={teacher}
                session={session}
                fileInputRef={fileInputRef}
                postAction={postAction}
              />
            )}
          </section>
        )}
      </div>
      <footer className="border-t border-zinc-200/80 bg-white/70 py-4 text-center text-xs font-semibold text-zinc-500 backdrop-blur dark:border-white/10 dark:bg-[#020806]/80 dark:text-zinc-400">
        © 2026 GESTEC — Todos os direitos reservados.
      </footer>
    </main>
  );
}

function GeneralDashboard({
  data,
  metrics,
  role,
}: {
  data: AppSnapshot;
  metrics: {
    todaysSchedules: number;
    substitutions: number;
    notices: number;
    reservations: number;
  };
  role: "manager" | "teacher";
}) {
  const todaySchedules = data.schedules.filter((schedule) => schedule.weekday === new Date().getDay());
  const todayScheduleRows = todaySchedules.map((schedule) =>
    role === "manager"
      ? [
          `${schedule.periodLabel} · ${schedule.startTime}-${schedule.endTime}`,
          schedule.discipline,
          schedule.teacherName,
          schedule.classGroup,
          schedule.roomName,
        ]
      : [
          `${schedule.periodLabel} · ${schedule.startTime}-${schedule.endTime}`,
          schedule.discipline,
          schedule.classGroup,
          schedule.roomName,
        ],
  );

  return (
    <section className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Painel Geral</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{fullDateLabel()}</p>
        </div>
        <div className="text-xs text-zinc-400">Atualizado às {new Date(data.now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Calendar size={17} />} label="Aulas hoje" value={metrics.todaysSchedules} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
        <StatCard icon={<DoorOpen size={17} />} label={role === "teacher" ? "Salas para hoje" : "Salas com aula hoje"} value={new Set(todaySchedules.map((schedule) => schedule.roomName)).size} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10" />
        <StatCard icon={<ClipboardList size={17} />} label="Substituições hoje" value={metrics.substitutions} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10" />
        <StatCard icon={<Bell size={17} />} label="Avisos ativos" value={metrics.notices} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black">
                <Megaphone size={17} className="text-[#36c486]" /> Mural de Avisos Importantes
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Comunicados oficiais publicados pela gestão.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#36c486] dark:bg-emerald-500/10">
              {data.notices.length} ativos
            </span>
          </div>
          <div className="grid max-h-[420px] gap-3 overflow-auto pr-1">
            {data.notices.map((notice) => (
              <article key={notice.id} className="rounded-2xl border border-zinc-200 border-t-4 border-t-[#36c486] bg-zinc-50 p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md dark:border-white/10 dark:border-t-[#36c486] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">{notice.title}</h3>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#36c486] dark:bg-white/10">
                    {notice.category}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notice.body}</p>
                <p className="mt-3 text-xs text-zinc-400">Válido desde {dateTimeLabel(notice.createdAt)}</p>
              </article>
            ))}
            {data.notices.length === 0 && <EmptyState icon={<Bell size={26} />} title="Nenhum aviso publicado" />}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="mb-4 text-base font-black">Substituições de Hoje</h2>
          <ResponsiveTable
            headers={["Data", "Original", "Substituto", "Disciplina", "Turma", "Sala"]}
            rows={data.substitutions.map((item) => [
              dateLabel(item.date),
              item.originalTeacherName,
              item.substituteTeacherName,
              item.discipline,
              item.classGroup,
              item.roomName,
            ])}
            empty={<EmptyState icon={<ClipboardList size={26} />} title="Nenhuma substituição hoje" />}
          />
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-emerald-500" />
          <h2 className="text-base font-black">{role === "teacher" ? "Salas que você precisa ir hoje" : "Aulas e salas de hoje"}</h2>
        </div>
        <ResponsiveTable
          headers={role === "manager" ? ["Período", "Disciplina", "Professor", "Turma", "Sala"] : ["Período", "Disciplina", "Turma", "Sala"]}
          rows={todayScheduleRows}
          empty={<EmptyState icon={<DoorOpen size={26} />} title="Nenhuma sala programada para hoje" />}
        />
      </section>
    </section>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400 dark:border-white/10">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-white/5">
          {icon}
        </div>
        {title}
      </div>
    </div>
  );
}

function ResponsiveTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="grid gap-3 sm:hidden">
        {rows.map((row, index) => (
          <article
            key={`${row.join("-")}-${index}`}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="grid gap-3">
              {row.map((cell, cellIndex) => (
                <div key={`${cell}-${cellIndex}`} className="grid grid-cols-[0.8fr_1.2fr] gap-3 text-sm">
                  <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">
                    {headers[cellIndex]}
                  </dt>
                  <dd className="min-w-0 text-right font-semibold text-zinc-700 dark:text-zinc-200">
                    {cell || "—"}
                  </dd>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="hidden w-full max-w-full overflow-x-auto sm:block">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-400">
              {headers.map((header) => (
                <th key={header} className="border-b border-zinc-100 px-3 py-3 font-black dark:border-white/10">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.join("-")}-${index}`} className="text-zinc-700 dark:text-zinc-200">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="border-b border-zinc-100 px-3 py-3 dark:border-white/10">
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ManagerPeople({
  data,
  loading,
  substitutionOpen,
  setSubstitutionOpen,
  postAction,
}: {
  data: AppSnapshot;
  loading: boolean;
  substitutionOpen: boolean;
  setSubstitutionOpen: (open: boolean) => void;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  const pendingRequests = data.requests.filter((request) => request.status === "pending");
  return (
    <div className="grid gap-5">
      {pendingRequests.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20">
          <h2 className="mb-3 font-black text-emerald-900 dark:text-emerald-100">Solicitações pendentes</h2>
          <div className="grid gap-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex flex-col justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-white/10 sm:flex-row sm:items-center">
                <div>
                  <div className="font-black">{request.fullName}</div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
                    {request.discipline} · {contractTypeLabel(request.contractType)} · {request.email}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-zinc-400">
                    Enviado em {dateTimeLabel(request.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void postAction("approveRequest", { requestId: request.id })}>Aprovar</Button>
                  <Button variant="secondary" onClick={() => void postAction("rejectRequest", { requestId: request.id })}>Recusar</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black">Todos os Professores</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cadastros aprovados, disciplinas, vínculos e e-mails institucionais.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-[#0f8a61] dark:bg-emerald-400/10 dark:text-emerald-100">
            {data.teachers.length} ativo(s)
          </span>
        </div>
        {data.teachers.length === 0 ? (
          <EmptyState icon={<Users size={26} />} title="Nenhum professor aprovado" />
        ) : (
          <div className="grid gap-3">
            {data.teachers.map((teacher) => (
              <article
                key={teacher.id}
                className="group grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-400/30 dark:hover:bg-white/[0.05] md:grid-cols-[1.2fr_1fr_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0f8a61] text-sm font-black text-white shadow-sm">
                    {teacher.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teacher.avatarUrl} alt={teacher.fullName} className="h-full w-full object-cover" />
                    ) : (
                      initials(teacher.fullName)
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{teacher.fullName}</h3>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{teacher.email}</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Disciplina</div>
                    <div className="font-black">{teacher.discipline || "Sem disciplina"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Vínculo</div>
                    <div className="font-black">{contractTypeLabel(teacher.contractType)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-[#0f8a61] dark:bg-emerald-400/10 dark:text-emerald-100">
                    {teacher.contractStatus === "active" ? "Ativo" : teacher.contractStatus}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-100 bg-white px-3 text-xs font-black text-rose-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md active:scale-95 dark:border-rose-400/20 dark:bg-white/5 dark:text-rose-200 dark:hover:bg-rose-950/30"
                    onClick={() => {
                      if (window.confirm(`Remover a conta de ${teacher.fullName}? Esta ação apaga também horários, reservas e notificações ligadas ao professor.`)) {
                        void postAction("deleteTeacher", { teacherId: teacher.id });
                      }
                    }}
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-black">Substituições de Hoje</h2>
          <Button onClick={() => setSubstitutionOpen(!substitutionOpen)} className="h-9">
            <Plus size={15} /> Adicionar
          </Button>
        </div>

        {substitutionOpen && (
          <form
            className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await postAction("addSubstitution", {
                date: getFormString(event.currentTarget, "date"),
                originalTeacherId: getFormString(event.currentTarget, "originalTeacherId"),
                substituteTeacherId: getFormString(event.currentTarget, "substituteTeacherId"),
                discipline: getFormString(event.currentTarget, "discipline"),
                classGroup: getFormString(event.currentTarget, "classGroup"),
                roomId: getFormString(event.currentTarget, "roomId"),
              });
              if (ok) {
                event.currentTarget.reset();
                setSubstitutionOpen(false);
              }
            }}
          >
            <TextInput label="Data" name="date" type="date" defaultValue={today()} required />
            <SelectInput label="Professor original" name="originalTeacherId" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </SelectInput>
            <SelectInput label="Professor substituto" name="substituteTeacherId" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </SelectInput>
            <SelectInput label="Disciplina" name="discipline" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {DISCIPLINES.map((discipline) => <option key={discipline}>{discipline}</option>)}
            </SelectInput>
            <TextInput label="Turma" name="classGroup" placeholder="Ex: 2º DS" required />
            <SelectInput label="Sala" name="roomId" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {data.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </SelectInput>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit" disabled={loading}>Registrar</Button>
              <Button variant="secondary" onClick={() => setSubstitutionOpen(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        <ResponsiveTable
          headers={["Data", "Original", "Substituto", "Disciplina", "Turma", "Sala"]}
          rows={data.substitutions.map((item) => [
            dateLabel(item.date),
            item.originalTeacherName,
            item.substituteTeacherName,
            item.discipline,
            item.classGroup,
            item.roomName,
          ])}
          empty={<EmptyState icon={<ClipboardList size={26} />} title="Nenhuma substituição registrada hoje" />}
        />
      </section>
    </div>
  );
}

function ContractsTable({
  teachers,
  title = "Prazos de contratos",
  subtitle,
}: {
  teachers: AppSnapshot["teachers"];
  title?: string;
  subtitle?: string;
}) {
  const rows = teachers.map((teacher) => {
    const end = teacher.contractEnd ? new Date(`${teacher.contractEnd}T00:00:00`) : null;
    const monthsRemaining = end
      ? Math.max(0, (end.getFullYear() - new Date().getFullYear()) * 12 + end.getMonth() - new Date().getMonth())
      : null;
    const years = monthsRemaining === null ? 0 : Math.floor(monthsRemaining / 12);
    const remainingMonths = monthsRemaining === null ? 0 : monthsRemaining % 12;
    const remaining = monthsRemaining === null
      ? "Indeterminado"
      : `${years > 0 ? `${years} ano${years > 1 ? "s" : ""}` : ""}${years && remainingMonths ? " e " : ""}${remainingMonths > 0 ? `${remainingMonths} mês${remainingMonths > 1 ? "es" : ""}` : years ? "" : "menos de 1 mês"}`;
    return [
      teacher.fullName,
      teacher.discipline,
      contractTypeLabel(teacher.contractType),
      dateLabel(teacher.contractStart),
      teacher.contractEnd ? dateLabel(teacher.contractEnd) : "Tempo indeterminado",
      teacher.contractType === "temporary" ? `Contrato de 2 anos · ${remaining}` : "Sem prazo de término",
      teacher.contractStatus === "active" ? "Ativo" : teacher.contractStatus,
    ];
  });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4">
        <h2 className="font-black">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <ResponsiveTable
        headers={["Professor", "Disciplina", "Vínculo", "Início", "Vencimento", "Tempo restante", "Status"]}
        rows={rows}
        empty={<EmptyState icon={<ClipboardList size={26} />} title="Nenhum contrato cadastrado" />}
      />
    </section>
  );
}

function reservationStatusLabel(status: AppSnapshot["reservations"][number]["status"]) {
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  return "Pendente";
}

function reservationStatusClass(status: AppSnapshot["reservations"][number]["status"]) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200";
  return "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200";
}

function ManagerReservations({
  reservations,
  loading,
  postAction,
}: {
  reservations: AppSnapshot["reservations"];
  loading: boolean;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  const pending = reservations.filter((reservation) => reservation.status === "pending");
  return (
    <section className="grid gap-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-black">Reservas pendentes</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Solicitações criadas pelos professores e aguardando decisão da gestão.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
            {pending.length} pendente(s)
          </span>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon={<ClipboardList size={26} />} title="Nenhuma reserva pendente" />
        ) : (
          <div className="grid gap-3">
            {pending.map((reservation) => (
              <article
                key={reservation.id}
                className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-amber-400/20 dark:bg-amber-400/10"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">{reservation.roomName}</h3>
                      <span className={cx("rounded-full px-2 py-1 text-[11px] font-black", reservationStatusClass(reservation.status))}>
                        {reservationStatusLabel(reservation.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {reservation.teacherName} · {dateLabel(reservation.date)} · {reservation.startTime}-{reservation.endTime}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {reservation.reason || "Sem motivo informado"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={loading}
                      onClick={() => void postAction("approveReservation", { reservationId: reservation.id })}
                    >
                      <CheckCircle2 size={15} /> Aprovar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={loading}
                      onClick={() => void postAction("rejectReservation", { reservationId: reservation.id })}
                    >
                      Recusar
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="mb-4 font-black">Histórico de reservas</h2>
        <ResponsiveTable
          headers={["Professor", "Sala", "Data", "Horário", "Motivo", "Status"]}
          rows={reservations.map((reservation) => [
            reservation.teacherName,
            reservation.roomName,
            dateLabel(reservation.date),
            `${reservation.startTime}-${reservation.endTime}`,
            reservation.reason ?? "—",
            reservationStatusLabel(reservation.status),
          ])}
          empty={<EmptyState icon={<ClipboardList size={26} />} title="Nenhuma reserva criada" />}
        />
      </section>
    </section>
  );
}

function SchedulesManager({
  data,
  scheduleOpen,
  setScheduleOpen,
  loading,
  postAction,
}: {
  data: AppSnapshot;
  scheduleOpen: boolean;
  setScheduleOpen: (open: boolean) => void;
  loading: boolean;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0].value);
  const [scheduleFilterDiscipline, setScheduleFilterDiscipline] = useState("");
  const [scheduleDay, setScheduleDay] = useState(1);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const editingSchedule = data.schedules.find((schedule) => schedule.id === editingScheduleId) ?? null;
  const daySchedules = useMemo(
    () => data.schedules.filter((schedule) => schedule.weekday === scheduleDay),
    [data.schedules, scheduleDay],
  );
  const scheduleDisciplines = useMemo(
    () => Array.from(new Set(daySchedules.map((schedule) => schedule.discipline))).sort((a, b) => a.localeCompare(b)),
    [daySchedules],
  );
  const activeScheduleFilter = scheduleDisciplines.includes(scheduleFilterDiscipline) ? scheduleFilterDiscipline : "";
  const visibleDaySchedules = activeScheduleFilter
    ? daySchedules.filter((schedule) => schedule.discipline === activeScheduleFilter)
    : daySchedules;
  const classGroups = useMemo(
    () =>
      Array.from(new Set([...defaultClassGroups, ...data.schedules.map((schedule) => schedule.classGroup).filter(Boolean)]))
        .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    [data.schedules],
  );
  const teachersByDiscipline = selectedDiscipline
    ? data.teachers.filter((teacher) => teacher.discipline === selectedDiscipline)
    : data.teachers;
  const selectedPeriodData = periodFromValue(selectedPeriod);
  const periodChoices = periodOptions.some((period) => period.value === selectedPeriod)
    ? periodOptions
    : [
        { label: selectedPeriodData.label, start: selectedPeriodData.start, end: selectedPeriodData.end, value: selectedPeriod },
        ...periodOptions,
      ];

  const openNewSchedule = () => {
    setEditingScheduleId(null);
    setSelectedDiscipline("");
    setSelectedPeriod(periodOptions[0].value);
    setScheduleFilterDiscipline("");
    setScheduleOpen(true);
  };

  const openEditSchedule = (schedule: Schedule) => {
    setEditingScheduleId(schedule.id);
    setSelectedDiscipline(schedule.discipline);
    setSelectedPeriod(periodValue(schedule));
    setScheduleDay(schedule.weekday);
    setScheduleOpen(true);
  };

  const closeForm = () => {
    setEditingScheduleId(null);
    setSelectedDiscipline("");
    setSelectedPeriod(periodOptions[0].value);
    setScheduleOpen(false);
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <div>
          <h2 className="font-black">Grade Horária Completa</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Filtre por disciplina para localizar e editar aulas rapidamente.
          </p>
        </div>
        <label className="grid min-w-56 gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Filtrar disciplina
          <select
            value={activeScheduleFilter}
            onChange={(event) => setScheduleFilterDiscipline(event.currentTarget.value)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition-all duration-200 hover:border-zinc-300 focus:border-[#36c486] focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-[#07120d] dark:text-white dark:hover:border-white/20 dark:focus:ring-emerald-950/40"
          >
            <option value="">Todas</option>
            {scheduleDisciplines.map((discipline) => (
              <option key={discipline} value={discipline}>{discipline}</option>
            ))}
          </select>
        </label>
        <Button onClick={scheduleOpen && !editingSchedule ? closeForm : openNewSchedule}>
          <Plus size={15} /> Nova Aula
        </Button>
      </div>

      {scheduleOpen && (
        <form
          key={editingSchedule?.id ?? "new-schedule"}
          className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const ok = await postAction(editingSchedule ? "updateSchedule" : "addSchedule", {
              scheduleId: editingSchedule?.id,
              discipline: getFormString(form, "discipline"),
              teacherId: getFormString(form, "teacherId"),
              weekday: Number(getFormString(form, "weekday")),
              periodLabel: getFormString(form, "periodLabel"),
              startTime: getFormString(form, "startTime"),
              endTime: getFormString(form, "endTime"),
              classGroup: getFormString(form, "classGroup"),
              roomId: getFormString(form, "roomId"),
            });
            if (ok) {
              form.reset();
              closeForm();
            }
          }}
        >
          <div className="md:col-span-3">
            <h3 className="font-black">{editingSchedule ? "Editar aula" : "Nova aula"}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Escolha a disciplina, o professor, a sala e um dos 7 períodos.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
              <Clock size={14} /> {schoolBreak.label}: {schoolBreak.start}-{schoolBreak.end}
            </div>
          </div>
          <SelectInput
            label="Disciplina da aula"
            name="discipline"
            value={selectedDiscipline}
            onChange={(event) => setSelectedDiscipline(event.currentTarget.value)}
            required
          >
            <option value="" disabled>Selecione</option>
            {DISCIPLINES.map((discipline) => <option key={discipline}>{discipline}</option>)}
          </SelectInput>
          <SelectInput label="Professor" name="teacherId" defaultValue={editingSchedule?.teacherId ?? ""} required>
            <option value="" disabled>Selecione</option>
            {teachersByDiscipline.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName} · {teacher.discipline}
              </option>
            ))}
          </SelectInput>
          <SelectInput label="Dia" name="weekday" defaultValue={String(editingSchedule?.weekday ?? 1)} required>
            {workWeek.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </SelectInput>
          <SelectInput
            label="Período"
            name="periodPreset"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.currentTarget.value)}
            required
          >
            {periodChoices.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label} · {period.start}-{period.end}
              </option>
            ))}
          </SelectInput>
          <input type="hidden" name="periodLabel" value={selectedPeriodData.label} />
          <input type="hidden" name="startTime" value={selectedPeriodData.start} />
          <input type="hidden" name="endTime" value={selectedPeriodData.end} />
          <TextInput label="Turma" name="classGroup" placeholder="Ex: 2º DS" defaultValue={editingSchedule?.classGroup ?? ""} required />
          <SelectInput label="Sala" name="roomId" defaultValue={editingSchedule?.roomId ?? ""} required>
            <option value="" disabled>Selecione</option>
            {data.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectInput>
          {selectedDiscipline && teachersByDiscipline.length === 0 && (
            <p className="self-end rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              Nenhum professor aprovado para esta disciplina.
            </p>
          )}
          <div className="flex items-end gap-2 md:col-span-2">
            <Button type="submit" disabled={loading}>{editingSchedule ? "Salvar alterações" : "Salvar horário"}</Button>
            <Button
              variant="secondary"
              onClick={closeForm}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-white/5">
        {workWeek.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => setScheduleDay(day.value)}
            className={cx(
              "h-9 rounded-xl px-4 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]",
              scheduleDay === day.value
                ? "bg-white text-[#0f8a61] shadow-sm dark:bg-[#123322] dark:text-emerald-100"
                : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
            )}
          >
            {day.label}
          </button>
        ))}
      </div>

      {data.schedules.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="Nenhuma aula cadastrada" />
      ) : daySchedules.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="Nenhuma aula para este dia" />
      ) : activeScheduleFilter && visibleDaySchedules.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="Nenhuma aula encontrada para esse filtro" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/10">
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-white/[0.03]">
                <th className="sticky left-0 z-10 border-b border-zinc-200 bg-zinc-50 px-4 py-3 font-black dark:border-white/10 dark:bg-[#07120d]">
                  Horário
                </th>
                {classGroups.map((classGroup) => (
                  <th key={classGroup} className="border-b border-zinc-200 px-4 py-3 font-black dark:border-white/10">
                    {classGroup}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodOptions.map((period) => (
                <tr key={period.value}>
                  <td className="sticky left-0 z-10 border-b border-zinc-100 bg-white px-4 py-4 align-top font-black dark:border-white/10 dark:bg-[#07120d]">
                    <div>{period.label}</div>
                    <div className="mt-1 text-xs font-semibold text-zinc-400">{period.start}-{period.end}</div>
                  </td>
                  {classGroups.map((classGroup) => {
                    const items = visibleDaySchedules.filter(
                      (schedule) => schedule.classGroup === classGroup && samePeriod(schedule, period),
                    );
                    return (
                      <td key={`${period.value}-${classGroup}`} className="min-w-48 border-b border-zinc-100 p-3 align-top dark:border-white/10">
                        {items.length === 0 ? (
                          <span className="text-zinc-300">—</span>
                        ) : (
                          <div className="grid gap-2">
                            {items.map((schedule) => (
                              <article
                                key={schedule.id}
                                className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-400/20 dark:bg-emerald-400/10"
                              >
                                <div className="font-black text-zinc-900 dark:text-white">{schedule.discipline}</div>
                                <div className="mt-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                  {schedule.teacherName}
                                </div>
                                <div className="mt-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{schedule.roomName}</div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-black text-[#0f8a61] shadow-sm transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-emerald-100"
                                    onClick={() => openEditSchedule(schedule)}
                                  >
                                    <Pencil size={12} /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-black text-rose-600 shadow-sm transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-rose-200"
                                    onClick={() => {
                                      if (window.confirm("Tem certeza que deseja apagar esta aula?")) {
                                        void postAction("deleteSchedule", { scheduleId: schedule.id });
                                      }
                                    }}
                                  >
                                    <Trash2 size={12} /> Apagar
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NoticesManager({
  data,
  noticeOpen,
  setNoticeOpen,
  loading,
  postAction,
}: {
  data: AppSnapshot;
  noticeOpen: boolean;
  setNoticeOpen: (open: boolean) => void;
  loading: boolean;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#36c486] dark:bg-emerald-500/10">
            <Bell size={14} /> Avisos
          </div>
          <h2 className="mt-3 text-xl font-black">Gerenciar Avisos</h2>
        </div>
        <Button onClick={() => setNoticeOpen(!noticeOpen)}>
          <Plus size={15} /> Novo Aviso
        </Button>
      </div>

      {noticeOpen && (
        <form
          className="mb-5 grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/10"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const ok = await postAction("addNotice", {
              title: getFormString(form, "title"),
              category: getFormString(form, "category"),
              body: getFormString(form, "body"),
              expiresAt: getFormString(form, "expiresAt") || null,
            });
            if (ok) {
              form.reset();
              setNoticeOpen(false);
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="Título do aviso" name="title" placeholder="Reunião pedagógica" required />
            <TextInput label="Categoria" name="category" placeholder="Geral" />
            <TextInput label="Expira em" name="expiresAt" type="date" />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Descrição
            <textarea
              name="body"
              rows={4}
              required
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition-all duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[#36c486] focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-white/20 dark:focus:ring-emerald-950/40"
              placeholder="Detalhe o comunicado para todos os usuários."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>Publicar Aviso</Button>
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {data.notices.map((notice) => (
          <article
            key={notice.id}
            className="group flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 border-t-4 border-t-[#36c486] bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-md dark:border-white/10 dark:border-t-[#36c486] dark:bg-white/[0.03] dark:hover:border-emerald-500/30"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black">{notice.title}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-[#36c486] dark:bg-emerald-500/10">
                  {notice.category}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notice.body}</p>
              <p className="mt-2 text-xs text-zinc-400">{dateTimeLabel(notice.createdAt)}</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:text-rose-600 group-hover:text-rose-500 active:scale-95 dark:hover:bg-rose-950/30"
              onClick={() => {
                if (window.confirm("Tem certeza que deseja excluir este aviso?")) {
                  void postAction("deleteNotice", { noticeId: notice.id });
                }
              }}
              aria-label="Excluir aviso"
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
        {data.notices.length === 0 && <EmptyState icon={<Bell size={26} />} title="Nenhum aviso publicado" />}
      </div>
    </section>
  );
}

function TeacherOverview({
  schedules,
  reservations,
}: {
  schedules: AppSnapshot["schedules"];
  reservations: AppSnapshot["reservations"];
}) {
  const todaySchedules = schedules.filter((schedule) => schedule.weekday === new Date().getDay());
  const nextReservations = reservations
    .filter((reservation) => reservation.status !== "rejected")
    .slice(0, 4);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-[#36c486] dark:bg-emerald-400/10">
            <Calendar size={17} />
          </span>
          <div>
            <h2 className="font-black">Aulas de hoje</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Salas e turmas programadas para seu dia.</p>
          </div>
        </div>
        <ResponsiveTable
          headers={["Período", "Disciplina", "Turma", "Sala"]}
          rows={todaySchedules.map((schedule) => [
            `${schedule.periodLabel} · ${schedule.startTime}-${schedule.endTime}`,
            schedule.discipline,
            schedule.classGroup,
            schedule.roomName,
          ])}
          empty={<EmptyState icon={<Clock size={26} />} title="Nenhuma aula agendada hoje" />}
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200">
            <ClipboardList size={17} />
          </span>
          <div>
            <h2 className="font-black">Minhas reservas</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Acompanhamento das solicitações criadas.</p>
          </div>
        </div>
        {nextReservations.length === 0 ? (
          <EmptyState icon={<ClipboardList size={26} />} title="Nenhuma reserva solicitada" />
        ) : (
          <div className="grid gap-3">
            {nextReservations.map((reservation) => (
              <article key={reservation.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{reservation.roomName}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {dateLabel(reservation.date)} · {reservation.startTime}-{reservation.endTime}
                    </p>
                  </div>
                  <span className={cx("rounded-full px-2 py-1 text-[11px] font-black", reservationStatusClass(reservation.status))}>
                    {reservationStatusLabel(reservation.status)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherSchedules({ schedules }: { schedules: AppSnapshot["schedules"] }) {
  const disciplines = Array.from(new Set(schedules.map((schedule) => schedule.discipline))).sort((a, b) => a.localeCompare(b));
  return (
    <section className="grid gap-5">
      <h2 className="text-2xl font-black">Horários por disciplina</h2>
      {schedules.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="Nenhum horário cadastrado" />
      ) : (
        <div className="grid gap-5">
          {disciplines.map((discipline) => {
            const disciplineSchedules = schedules.filter((schedule) => schedule.discipline === discipline);
            return (
              <section key={discipline} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <h3 className="mb-4 font-black">{discipline}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-separate border-spacing-2 text-sm">
                    <thead>
                      <tr>
                        <th className="rounded-lg bg-zinc-100 p-3 text-left dark:bg-white/5">Período</th>
                        {workWeek.map((day) => (
                          <th key={day.value} className="rounded-lg bg-zinc-100 p-3 text-left dark:bg-white/5">{day.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodOptions.map((period) => (
                        <tr key={period.value}>
                          <td className="rounded-lg bg-zinc-50 p-3 font-bold dark:bg-white/[0.03]">
                            {period.label}
                            <br />
                            <span className="text-xs font-normal text-zinc-400">{period.start}-{period.end}</span>
                          </td>
                          {workWeek.map((day) => {
                            const item = disciplineSchedules.find((schedule) => schedule.weekday === day.value && samePeriod(schedule, period));
                            return (
                              <td key={day.value} className="h-24 rounded-lg border border-zinc-100 p-3 align-top dark:border-white/10">
                                {item ? (
                                  <div>
                                    <div className="font-black">{item.classGroup}</div>
                                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.roomName}</div>
                                  </div>
                                ) : (
                                  <span className="text-zinc-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeacherReservations({
  reservations,
  freeRooms,
  reservationOpen,
  setReservationOpen,
  loading,
  postAction,
}: {
  reservations: AppSnapshot["reservations"];
  freeRooms: Room[];
  reservationOpen: boolean;
  setReservationOpen: (open: boolean) => void;
  loading: boolean;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-black">Minhas Reservas</h2>
        <Button onClick={() => setReservationOpen(!reservationOpen)}>
          <Plus size={15} /> Solicitar Reserva
        </Button>
      </div>

      {reservationOpen && (
        <form
          className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const ok = await postAction("addReservation", {
              roomId: getFormString(form, "roomId"),
              date: getFormString(form, "date"),
              startTime: getFormString(form, "startTime"),
              endTime: getFormString(form, "endTime"),
              reason: getFormString(form, "reason"),
            });
            if (ok) {
              form.reset();
              setReservationOpen(false);
            }
          }}
        >
          <SelectInput label="Sala desejada" name="roomId" defaultValue="" required>
            <option value="" disabled>Selecione</option>
            {freeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectInput>
          <TextInput label="Data" name="date" type="date" defaultValue={today()} required />
          <TextInput label="Início" name="startTime" type="time" required />
          <TextInput label="Término" name="endTime" type="time" required />
          <TextInput label="Motivo" name="reason" placeholder="Ex: aula prática" className="md:col-span-2" />
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={loading}>Enviar Solicitação</Button>
            <Button variant="secondary" onClick={() => setReservationOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <ResponsiveTable
        headers={["Sala", "Data", "Horário", "Motivo", "Status"]}
        rows={reservations.map((reservation) => [
          reservation.roomName,
          dateLabel(reservation.date),
          `${reservation.startTime}-${reservation.endTime}`,
          reservation.reason ?? "—",
          reservationStatusLabel(reservation.status),
        ])}
        empty={<EmptyState icon={<ClipboardList size={26} />} title="Sem reservas" />}
      />
    </section>
  );
}

function TeacherProfile({
  teacher,
  session,
  fileInputRef,
  postAction,
}: {
  teacher: AppSnapshot["teachers"][number] | null;
  session: ClientSession;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  const name = teacher?.fullName ?? session.name;
  const avatar = teacher?.avatarUrl;

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const resizeAvatar = (file: File) =>
    new Promise<string>((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Selecione uma imagem."));
        return;
      }

      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxSize = 520;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a foto."));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível ler a imagem."));
      };
      image.src = objectUrl;
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const avatarUrl = await resizeAvatar(file).catch(() => readFileAsDataUrl(file));
      await postAction("updateAvatar", { avatarUrl });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível alterar a foto.");
    }
  };

  return (
    <section className="grid gap-5">
      <h2 className="text-2xl font-black">Meu Perfil</h2>
      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#0f8a61] text-2xl font-black text-white shadow-sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Alterar foto"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={name} className="h-full w-full object-cover" />
            ) : (
              initials(name)
            )}
            <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-[#36c486] text-white ring-2 ring-white dark:ring-[#07120d]">
              <Upload size={13} />
            </span>
          </button>
          <div>
            <h3 className="text-xl font-black">{name}</h3>
            <p className="mt-1 font-semibold text-[#36c486]">Professor</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <dl className="mt-8 grid gap-0 divide-y divide-zinc-100 dark:divide-white/10">
          {[
            ["E-mail", teacher?.email ?? session.email],
            ["Função", "Professor"],
            ["Disciplina", teacher?.discipline ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[1fr_1.4fr] gap-4 py-4">
              <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="text-right font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
