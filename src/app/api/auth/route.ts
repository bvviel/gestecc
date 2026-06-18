import { NextResponse } from "next/server";
import { createTeacherRequest, loginManager, loginTeacher } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mode = String(body.mode ?? "");

    if (mode === "manager") {
      const result = await loginManager(String(body.username ?? ""), String(body.password ?? ""));
      return NextResponse.json(result, { status: result.ok ? 200 : 401 });
    }

    if (mode === "teacher") {
      const result = await loginTeacher(String(body.email ?? ""), String(body.password ?? ""));
      return NextResponse.json(result, { status: result.ok ? 200 : 401 });
    }

    if (mode === "requestAccess") {
      const data = await createTeacherRequest({
        fullName: String(body.fullName ?? ""),
        discipline: String(body.discipline ?? ""),
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
      });
      return NextResponse.json({
        ok: true,
        request: data,
        message: "Solicitação enviada. Aguarde a aprovação da gestão.",
      });
    }

    return NextResponse.json({ ok: false, message: "Modo de autenticação inválido." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
