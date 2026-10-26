import { NextResponse } from "next/server";

// SECURITY: /api/cron/reminders aceptaba llamadas SIN clave cuando CRON_SECRET no estaba configurado en produccion, y
// /api/cron/post-service no verificaba nada: cualquiera con la direccion podia dispararlos (y enviar correos a clientes).
// Vercel manda solo "Authorization: Bearer <CRON_SECRET>" cuando la variable existe en el proyecto.
//   - Con CRON_SECRET: se exige el encabezado exacto; si no coincide, 401.
//   - Sin CRON_SECRET en produccion: se rechaza con 503 (falla cerrado) y se avisa en el log; NO se ejecuta la tarea.
//   - Sin CRON_SECRET fuera de produccion (tu Mac): se deja pasar, para poder probar a mano.
export function verifyCron(req: Request, env: { CRON_SECRET?: string; NODE_ENV?: string } = process.env): NextResponse | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      console.error("[cron-auth] CRON_SECRET no esta configurado en produccion: se rechaza la tarea programada.");
      return NextResponse.json({ error: "Cron no configurado" }, { status: 503 });
    }
    return null;
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
