"use client";

import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ClipboardList,
  Clock,
  DoorOpen,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Shield,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISCIPLINES, type AppSnapshot, type ClientSession, type Room } from "@/lib/types";

type AuthView = "select" | "manager" | "teacher" | "request";
type PageView = "general" | "manager" | "teacher";
type ManagerTab = "people" | "contracts" | "schedules" | "rooms" | "notices";
type TeacherTab = "overview" | "schedules" | "reservations" | "profile";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; message: string };

const today = () => new Date().toISOString().slice(0, 10);
const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const workWeek = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
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

function roomStatusLabel(status: Room["status"]) {
  if (status === "occupied") return "Em aula";
  if (status === "reserved") return "Reservada";
  return "Livre";
}

function roomStatusClass(status: Room["status"]) {
  if (status === "occupied") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200";
  if (status === "reserved") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200";
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
      "bg-[#e95635] text-white shadow-sm shadow-orange-600/20 hover:bg-[#d84b2d]",
    secondary:
      "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10",
    ghost:
      "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type={type}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
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
        className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#e95635] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:focus:ring-orange-950/40"
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
        className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition focus:border-[#e95635] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-[#14101f] dark:text-white dark:focus:ring-orange-950/40"
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
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#e95635] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:focus:ring-orange-950/40"
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#2b174f] text-white shadow-sm shadow-violet-950/20">
        <BookOpen size={22} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-xl font-black tracking-wide text-[#2b174f] dark:text-white">GESTECC</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#e95635]">
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
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
  const [roomOpen, setRoomOpen] = useState(false);
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
    const occupied = data.rooms.filter((room) => room.status !== "free").length;
    const free = data.rooms.length - occupied;
    return {
      occupied,
      free,
      substitutions: data.substitutions.length,
      notices: data.notices.length,
      activeTeachers: data.teachers.length,
      pendingRequests: data.requests.filter((request) => request.status === "pending").length,
    };
  }, [data]);

  const teacher = useMemo(
    () => data.teachers.find((item) => item.id === session?.teacherId) ?? null,
    [data.teachers, session?.teacherId],
  );

  const freeRooms = data.rooms.filter((room) => room.status === "free");
  const occupiedByMe = data.rooms.find((room) => room.currentTeacherId === session?.teacherId);

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f8fb] text-zinc-950 transition dark:bg-[#080411] dark:text-white">
        <div className="absolute right-5 top-5 z-10">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <section className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex items-center bg-white px-6 py-12 dark:bg-[#120c1d] sm:px-10 lg:px-16">
            <div className="mx-auto w-full max-w-lg">
              <Logo />
              <div className="mt-12">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#e95635]">
                  Organização inteligente
                </p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-[#17102b] dark:text-white sm:text-5xl">
                  Bem-vindo à GestECC para a rotina escolar da ETEC.
                </h1>
                <p className="mt-5 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-300">
                  Gerencie horários, salas, substituições, avisos e solicitações de acesso em um painel rápido, moderno e sempre atualizado.
                </p>
              </div>
              <div className="mt-9 grid gap-4 text-sm text-zinc-600 dark:text-zinc-300">
                {[
                  ["Painel de avisos em tempo real", Bell],
                  ["Status de salas e reservas", DoorOpen],
                  ["Controle de substituições diárias", ClipboardList],
                  ["Aprovação de professores pela gestão", Shield],
                ].map(([label, Icon]) => (
                  <div key={String(label)} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-[#e95635] dark:bg-orange-500/10">
                      <Icon size={17} />
                    </span>
                    <span>{String(label)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center px-6 py-20 sm:px-10">
            <div className="mx-auto w-full max-w-md">
              {authView !== "select" && (
                <button
                  type="button"
                  className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:hover:text-white"
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
                <div>
                  <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Fazer login</p>
                  <h2 className="mt-2 text-3xl font-black">Selecione seu perfil</h2>
                  <div className="mt-8 grid gap-4">
                    <button
                      type="button"
                      onClick={() => setAuthView("teacher")}
                      className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#e95635] hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#e95635] text-white">
                          <GraduationCap size={24} />
                        </span>
                        <span>
                          <span className="block font-black">Sou Professor</span>
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                            Acesse sua grade, reservas e perfil
                          </span>
                        </span>
                      </span>
                      <span className="text-zinc-300 transition group-hover:text-[#e95635]">›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthView("manager")}
                      className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2b174f] hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#2b174f] text-white">
                          <Shield size={23} />
                        </span>
                        <span>
                          <span className="block font-black">Sou Gestor</span>
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                            Gestão completa da escola
                          </span>
                        </span>
                      </span>
                      <span className="text-zinc-300 transition group-hover:text-[#2b174f]">›</span>
                    </button>
                  </div>
                </div>
              )}

              {authView === "teacher" && (
                <form onSubmit={(event) => login(event, "teacher")} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e95635] px-5 py-3 text-sm font-black text-white">
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
                    Não tem conta? <span className="text-[#e95635]">Cadastrar-se</span>
                  </button>
                </form>
              )}

              {authView === "manager" && (
                <form onSubmit={(event) => login(event, "manager")} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#2b174f] px-5 py-3 text-sm font-black text-white">
                    <Shield size={18} /> Gestor
                  </span>
                  <div>
                    <h2 className="text-4xl font-black">Acesso da Gestão</h2>
                    <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
                      Login administrativo único
                    </p>
                  </div>
                  <TextInput label="Usuário" name="username" placeholder="ETECMAS@GESTÃO-GESTEC" required />
                  <PasswordInput label="Senha" name="password" placeholder="••••••••" />
                  <Button type="submit" className="h-14 rounded-xl text-base" disabled={loading}>
                    Acessar como Gestor
                  </Button>
                </form>
              )}

              {authView === "request" && (
                <form onSubmit={requestAccess} className="grid gap-5">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e95635] px-5 py-3 text-sm font-black text-white">
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
                    Já tem conta? <span className="text-[#e95635]">Fazer login</span>
                  </button>
                </form>
              )}

              {message && (
                <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-medium text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200">
                  {message}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-zinc-950 transition dark:bg-[#080411] dark:text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0c0714]/90">
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
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                page === "general"
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-[#2a1843] dark:text-white"
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
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                  page === "manager"
                    ? "bg-[#e95635] text-white shadow-sm"
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
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                  page === "teacher"
                    ? "bg-[#e95635] text-white shadow-sm"
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
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Notificações"
              >
                <Bell size={18} />
                {data.notifications.length > 0 && (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#e95635] ring-2 ring-white dark:ring-[#0c0714]" />
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#171020]">
                  <div className="border-b border-zinc-100 px-4 py-3 dark:border-white/10">
                    <div className="font-black">Notificações</div>
                  </div>
                  <div className="max-h-96 overflow-auto p-2">
                    {data.notifications.length === 0 && (
                      <div className="p-5 text-center text-sm text-zinc-500">Nenhuma notificação</div>
                    )}
                    {data.notifications.map((notification) => {
                      const requestId = String(notification.payload?.requestId ?? "");
                      return (
                        <div key={notification.id} className="rounded-lg p-3 hover:bg-zinc-50 dark:hover:bg-white/5">
                          <div className="text-sm font-black">{notification.title}</div>
                          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{notification.body}</div>
                          <div className="mt-2 text-[11px] text-zinc-400">{dateTimeLabel(notification.createdAt)}</div>
                          {session.role === "manager" && requestId && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                className="h-8 px-3 text-xs"
                                onClick={() => void postAction("approveRequest", { requestId })}
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs"
                                onClick={() => void postAction("rejectRequest", { requestId })}
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
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
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Fechar mensagem">
              <X size={16} />
            </button>
          </div>
        )}

        {data.mode === "memory" && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
            Modo local: conecte as variáveis do Supabase para persistência online.
          </div>
        )}

        {page === "general" && (
          <GeneralDashboard data={data} metrics={metrics} />
        )}

        {page === "manager" && session.role === "manager" && (
          <section className="grid gap-6">
            <div>
              <h1 className="text-3xl font-black">Painel da Gestão</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{fullDateLabel()}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<DoorOpen size={17} />} label="Salas ocupadas" value={metrics.occupied} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10" />
              <StatCard icon={<Check size={17} />} label="Salas livres" value={metrics.free} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
              <StatCard icon={<ClipboardList size={17} />} label="Substituições hoje" value={metrics.substitutions} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10" />
              <StatCard icon={<Bell size={17} />} label="Avisos ativos" value={metrics.notices} tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10" />
            </div>

            <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]">
              {[
                ["people", "Pessoas", Users],
                ["contracts", "Contratos", ClipboardList],
                ["schedules", "Horários", Calendar],
                ["rooms", "Salas", DoorOpen],
                ["notices", "Avisos", Bell],
              ].map(([key, label, Icon]) => (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => setManagerTab(key as ManagerTab)}
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                    managerTab === key
                      ? "bg-zinc-950 text-white dark:bg-[#e95635]"
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
            {managerTab === "contracts" && <ContractsTable teachers={data.teachers} />}
            {managerTab === "schedules" && (
              <SchedulesManager
                data={data}
                scheduleOpen={scheduleOpen}
                setScheduleOpen={setScheduleOpen}
                loading={loading}
                postAction={postAction}
              />
            )}
            {managerTab === "rooms" && <RoomsManager rooms={data.rooms} reservations={data.reservations} />}
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
                    "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition",
                    teacherTab === key
                      ? "bg-white text-zinc-950 shadow-sm dark:bg-[#2a1843] dark:text-white"
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
                freeRooms={freeRooms}
                occupiedByMe={occupiedByMe}
                roomOpen={roomOpen}
                setRoomOpen={setRoomOpen}
                loading={loading}
                postAction={postAction}
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
    </main>
  );
}

function GeneralDashboard({
  data,
  metrics,
}: {
  data: AppSnapshot;
  metrics: {
    occupied: number;
    free: number;
    substitutions: number;
    notices: number;
  };
}) {
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
        <StatCard icon={<DoorOpen size={17} />} label="Salas ocupadas" value={metrics.occupied} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10" />
        <StatCard icon={<Check size={17} />} label="Salas livres" value={metrics.free} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
        <StatCard icon={<ClipboardList size={17} />} label="Substituições hoje" value={metrics.substitutions} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10" />
        <StatCard icon={<Bell size={17} />} label="Avisos ativos" value={metrics.notices} tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">Mural de Avisos</h2>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#e95635] dark:bg-orange-500/10">
              {data.notices.length} ativos
            </span>
          </div>
          <div className="grid max-h-[420px] gap-3 overflow-auto pr-1">
            {data.notices.map((notice) => (
              <article key={notice.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">{notice.title}</h3>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#e95635] dark:bg-white/10">
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

      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-emerald-500" />
          <h2 className="text-base font-black">Status das Salas em Tempo Real</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {data.rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
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

function RoomCard({ room }: { room: Room }) {
  return (
    <article className={cx("min-h-28 rounded-xl border p-4 shadow-sm transition", roomStatusClass(room.status))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-zinc-950 dark:text-white">{room.name}</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{room.floor}</p>
        </div>
        <span className={cx("h-2.5 w-2.5 rounded-full", room.status === "free" ? "bg-emerald-500" : room.status === "occupied" ? "bg-rose-500" : "bg-amber-500")} />
      </div>
      <div className="mt-4 text-xs font-black uppercase tracking-wide">{roomStatusLabel(room.status)}</div>
      {room.currentTeacherName && (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-300">
          {room.currentTeacherName} · {room.currentClass ?? "Sem turma"} · {room.currentPeriod ?? "Agora"}
        </p>
      )}
    </article>
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
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/70 dark:bg-orange-950/20">
          <h2 className="mb-3 font-black text-orange-900 dark:text-orange-100">Solicitações pendentes</h2>
          <div className="grid gap-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex flex-col justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-white/10 sm:flex-row sm:items-center">
                <div>
                  <div className="font-black">{request.fullName}</div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">{request.discipline} · {request.email}</div>
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
        <h2 className="mb-4 font-black">Todos os Professores</h2>
        <ResponsiveTable
          headers={["Professor", "Disciplina", "E-mail", "Status"]}
          rows={data.teachers.map((teacher) => [
            teacher.fullName,
            teacher.discipline,
            teacher.email,
            teacher.contractStatus === "active" ? "Ativo" : teacher.contractStatus,
          ])}
          empty={<EmptyState icon={<Users size={26} />} title="Nenhum professor aprovado" />}
        />
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

function ContractsTable({ teachers }: { teachers: AppSnapshot["teachers"] }) {
  const rows = teachers.map((teacher) => {
    const start = new Date(`${teacher.contractStart}T00:00:00`);
    const end = teacher.contractEnd ? new Date(`${teacher.contractEnd}T00:00:00`) : new Date();
    const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const duration = `${years > 0 ? `${years} ano${years > 1 ? "s" : ""}` : ""}${years && remainingMonths ? " e " : ""}${remainingMonths > 0 ? `${remainingMonths} mês${remainingMonths > 1 ? "es" : ""}` : years ? "" : "0 meses"}`;
    return [
      teacher.fullName,
      teacher.discipline,
      dateLabel(teacher.contractStart),
      teacher.contractEnd ? dateLabel(teacher.contractEnd) : "Indeterminado",
      duration,
      teacher.contractStatus === "active" ? "Ativo" : teacher.contractStatus,
    ];
  });

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <h2 className="mb-4 font-black">Prazos de Contratos</h2>
      <ResponsiveTable
        headers={["Professor", "Disciplina", "Início", "Vencimento", "Tempo", "Status"]}
        rows={rows}
        empty={<EmptyState icon={<ClipboardList size={26} />} title="Nenhum contrato cadastrado" />}
      />
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
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-black">Grade Horária Completa</h2>
        <Button onClick={() => setScheduleOpen(!scheduleOpen)}>
          <Plus size={15} /> Nova Aula
        </Button>
      </div>

      {scheduleOpen && (
        <form
          className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await postAction("addSchedule", {
              teacherId: getFormString(event.currentTarget, "teacherId"),
              weekday: Number(getFormString(event.currentTarget, "weekday")),
              periodLabel: getFormString(event.currentTarget, "periodLabel"),
              startTime: getFormString(event.currentTarget, "startTime"),
              endTime: getFormString(event.currentTarget, "endTime"),
              classGroup: getFormString(event.currentTarget, "classGroup"),
              roomId: getFormString(event.currentTarget, "roomId"),
            });
            if (ok) {
              event.currentTarget.reset();
              setScheduleOpen(false);
            }
          }}
        >
          <SelectInput label="Professor" name="teacherId" defaultValue="" required>
            <option value="" disabled>Selecione</option>
            {data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </SelectInput>
          <SelectInput label="Dia" name="weekday" defaultValue="1" required>
            {workWeek.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </SelectInput>
          <TextInput label="Período" name="periodLabel" placeholder="1º período" required />
          <TextInput label="Início" name="startTime" type="time" required />
          <TextInput label="Término" name="endTime" type="time" required />
          <TextInput label="Turma" name="classGroup" placeholder="Ex: 2º DS" required />
          <SelectInput label="Sala" name="roomId" defaultValue="" required>
            <option value="" disabled>Selecione</option>
            {data.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectInput>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button type="submit" disabled={loading}>Salvar horário</Button>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <ResponsiveTable
        headers={["Dia", "Período", "Professor", "Disciplina", "Turma", "Sala"]}
        rows={data.schedules.map((schedule) => [
          weekdays[schedule.weekday],
          `${schedule.periodLabel} · ${schedule.startTime}-${schedule.endTime}`,
          schedule.teacherName,
          schedule.discipline,
          schedule.classGroup,
          schedule.roomName,
        ])}
        empty={<EmptyState icon={<Calendar size={26} />} title="Nenhuma aula cadastrada" />}
      />
    </section>
  );
}

function RoomsManager({ rooms, reservations }: { rooms: AppSnapshot["rooms"]; reservations: AppSnapshot["reservations"] }) {
  return (
    <div className="grid gap-5">
      <section>
        <h2 className="mb-3 font-black">Salas Livres</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.filter((room) => room.status === "free").map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-black">Salas Reservadas/Ocupadas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.filter((room) => room.status !== "free").map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="mb-4 font-black">Reservas Aprovadas</h2>
        <ResponsiveTable
          headers={["Sala", "Professor", "Data", "Horário", "Motivo"]}
          rows={reservations.map((reservation) => [
            reservation.roomName,
            reservation.teacherName,
            dateLabel(reservation.date),
            `${reservation.startTime}-${reservation.endTime}`,
            reservation.reason ?? "—",
          ])}
          empty={<EmptyState icon={<DoorOpen size={26} />} title="Nenhuma reserva aprovada" />}
        />
      </section>
    </div>
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-black">Gerenciar Avisos</h2>
        <Button onClick={() => setNoticeOpen(!noticeOpen)}>
          <Plus size={15} /> Novo Aviso
        </Button>
      </div>

      {noticeOpen && (
        <form
          className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04]"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await postAction("addNotice", {
              title: getFormString(event.currentTarget, "title"),
              category: getFormString(event.currentTarget, "category"),
              body: getFormString(event.currentTarget, "body"),
              expiresAt: getFormString(event.currentTarget, "expiresAt") || null,
            });
            if (ok) {
              event.currentTarget.reset();
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
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#e95635] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:focus:ring-orange-950/40"
              placeholder="Detalhe o comunicado para todos os usuários."
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>Publicar Aviso</Button>
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {data.notices.map((notice) => (
          <article key={notice.id} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black">{notice.title}</h3>
                <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-bold text-[#e95635] dark:bg-orange-500/10">
                  {notice.category}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notice.body}</p>
              <p className="mt-2 text-xs text-zinc-400">{dateTimeLabel(notice.createdAt)}</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
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
  freeRooms,
  occupiedByMe,
  roomOpen,
  setRoomOpen,
  loading,
  postAction,
}: {
  schedules: AppSnapshot["schedules"];
  freeRooms: Room[];
  occupiedByMe?: Room;
  roomOpen: boolean;
  setRoomOpen: (open: boolean) => void;
  loading: boolean;
  postAction: (action: string, payload?: Record<string, string | number | null | undefined>) => Promise<boolean>;
}) {
  const todaySchedules = schedules.filter((schedule) => schedule.weekday === new Date().getDay());
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="mb-4 font-black">Grade de Horários de Hoje</h2>
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-black">Status de Ocupação</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {occupiedByMe ? `Você está usando ${occupiedByMe.name}.` : "Você não está ocupando nenhuma sala."}
            </p>
          </div>
          {occupiedByMe ? (
            <Button variant="secondary" onClick={() => void postAction("releaseRoom", { roomId: occupiedByMe.id })}>
              Liberar
            </Button>
          ) : (
            <Button onClick={() => setRoomOpen(!roomOpen)}>Ocupar Sala</Button>
          )}
        </div>

        {roomOpen && !occupiedByMe && (
          <form
            className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-white/[0.04]"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await postAction("occupyRoom", {
                roomId: getFormString(event.currentTarget, "roomId"),
                classGroup: getFormString(event.currentTarget, "classGroup"),
                period: getFormString(event.currentTarget, "period"),
              });
              if (ok) {
                event.currentTarget.reset();
                setRoomOpen(false);
              }
            }}
          >
            <SelectInput label="Sala disponível" name="roomId" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {freeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </SelectInput>
            <TextInput label="Turma" name="classGroup" placeholder="Ex: 1º DS" />
            <TextInput label="Período estimado" name="period" placeholder="Ex: 07h00-08h40" />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>Confirmar</Button>
              <Button variant="secondary" onClick={() => setRoomOpen(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function TeacherSchedules({ schedules }: { schedules: AppSnapshot["schedules"] }) {
  const periods = Array.from(new Set(schedules.map((schedule) => `${schedule.periodLabel}|${schedule.startTime}|${schedule.endTime}`)));
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <h2 className="mb-4 font-black">Horários</h2>
      {schedules.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="Nenhum horário cadastrado" />
      ) : (
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
              {periods.map((period) => {
                const [label, start, end] = period.split("|");
                return (
                  <tr key={period}>
                    <td className="rounded-lg bg-zinc-50 p-3 font-bold dark:bg-white/[0.03]">{label}<br /><span className="text-xs font-normal text-zinc-400">{start}-{end}</span></td>
                    {workWeek.map((day) => {
                      const item = schedules.find((schedule) => schedule.weekday === day.value && schedule.periodLabel === label);
                      return (
                        <td key={day.value} className="h-24 rounded-lg border border-zinc-100 p-3 align-top dark:border-white/10">
                          {item ? (
                            <div>
                              <div className="font-black">{item.discipline}</div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.classGroup} · {item.roomName}</div>
                            </div>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <Plus size={15} /> Reservar Sala
        </Button>
      </div>

      {reservationOpen && (
        <form
          className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await postAction("addReservation", {
              roomId: getFormString(event.currentTarget, "roomId"),
              date: getFormString(event.currentTarget, "date"),
              startTime: getFormString(event.currentTarget, "startTime"),
              endTime: getFormString(event.currentTarget, "endTime"),
              reason: getFormString(event.currentTarget, "reason"),
            });
            if (ok) {
              event.currentTarget.reset();
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
            <Button type="submit" disabled={loading}>Confirmar Reserva</Button>
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
          reservation.status === "approved" ? "Aprovada" : reservation.status,
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

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void postAction("updateAvatar", { avatarUrl: String(reader.result ?? "") });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="grid gap-5">
      <h2 className="text-2xl font-black">Meu Perfil</h2>
      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#2b174f] text-2xl font-black text-white shadow-sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Alterar foto"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={name} className="h-full w-full object-cover" />
            ) : (
              initials(name)
            )}
            <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-[#e95635] text-white ring-2 ring-white dark:ring-[#171020]">
              <Upload size={13} />
            </span>
          </button>
          <div>
            <h3 className="text-xl font-black">{name}</h3>
            <p className="mt-1 font-semibold text-[#e95635]">Professor</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
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
