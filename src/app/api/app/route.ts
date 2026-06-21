import { NextResponse } from "next/server";
import { getSnapshot, performAction } from "@/lib/store";
import { tokenFromHeader, verifySession } from "@/lib/security";

function sessionFromRequest(request: Request) {
  return verifySession(tokenFromHeader(request.headers.get("authorization")));
}

export async function GET(request: Request) {
  try {
    const claims = sessionFromRequest(request);
    if (!claims) {
      return NextResponse.json({ ok: false, message: "Sessão inválida." }, { status: 401 });
    }

    return NextResponse.json({ ok: true, data: await getSnapshot(claims) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const claims = sessionFromRequest(request);
    if (!claims) {
      return NextResponse.json({ ok: false, message: "Sessão inválida." }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: string;
      payload?: Record<string, unknown>;
    };

    const data = await performAction(claims, String(body.action ?? ""), body.payload ?? {});
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
