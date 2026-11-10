import { NextResponse } from "next/server";
import { cookieAlumnos } from "@/lib/alumnos";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieAlumnos.name, "", { path: "/", maxAge: 0 });
  return res;
}
