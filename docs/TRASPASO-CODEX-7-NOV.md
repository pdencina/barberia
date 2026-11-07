# Traspaso a Codex — estado al 7 nov. 2026 (leer ANTES de tocar nada)

Nico se quedó sin tokens de Claude y sigue con Codex hasta que se le restablezcan. Este archivo dice **qué está hecho, cómo se trabaja y qué sigue**, para no repetir trabajo.
Las reglas de trabajo están en `AGENTS.md` sección 16 (mandan sobre las secciones 0, 4, 5 y 15 donde se contradicen).
**Al terminar cada tarea, agrega 3 líneas al final de este archivo (sección "Bitácora") y súbelo en tu mismo PR.** Así Claude retoma sin repetir.

## 1. Cómo trabajamos (resumen; el detalle está en AGENTS.md §16)
1. `git fetch origin`, mira `git log origin/main` y las ramas abiertas (lista abajo) para no duplicar.
2. **Un tema = una rama = un worktree** desde `origin/main` (`git worktree add -b codex/<tema> <carpeta> origin/main`). No trabajes dentro de `~/barberia` (otras sesiones le cambian la rama).
3. Commits chicos, `npx tsc --noEmit` limpio y los scripts de prueba del tema (`npx tsx scripts/test-*.ts`). No se corre `next build` salvo que el cambio importe código de servidor en un componente de pantalla.
4. `git push origin codex/<tema>` (nunca a `main`). **No abras el PR**: entrégale a Nico el enlace `https://github.com/pdencina/barberia/pull/new/<rama>`. Nico crea y mergea. Si hay varios PR, en orden de merge.
5. Migraciones: archivo `supabase/migrations/NNN_nombre.sql` (la siguiente libre es la **147**), aditiva y re-ejecutable (`IF NOT EXISTS`), con consulta de verificación al final. Se aplica en **pruebas** y luego en **producción** (ver §16.5). El código tolera que falte la migración.
6. Al hablar con Nico: español, informal, corto, pasos numerados y detallados ("qué pego, dónde, qué debe salir"), honesto con lo que se probó y lo que no. Nunca pedir ni imprimir llaves, tokens ni claves.

## 2. Proyectos de Supabase (los dos están en la misma organización)
| Nombre | ref | Uso |
|---|---|---|
| **EstudioLevels** | `ulucmbuvupulwplsrcnx` | **PRODUCCIÓN** (negocios reales: Estudio Levels, Fluye salón, Looky Estudio, Espacio Integral, Sauco Studio, Basti Barber, Demo, nicol). |
| **rebooking Base** | `ucwrdmwtlesayjxmlbve` | **PRUEBAS**. El `.env.local` de Nico apunta aquí. Hay cuentas de prueba por plan (Lite, Basic, Starter, Pro) creadas con `provisionTenant`; sus claves están en un archivo local que NO va a git (`vista-previa/`). Pídeselas a Nico o crea otras. |
Nunca imprimir el contenido de `.env*`. Para saber a cuál base apunta el entorno local, compara solo el ref, sin mostrar la URL completa.

## 3. Lo que se hizo (todo mergeado a `main`, PR #333 a #346)
**Planes y bloqueos (lo más importante)**
- Precios (neto + IVA 19% aparte): Lite **$1.000 total IVA incl., pago único** (neto 840, plan `lite`), Basic $12.990, Starter $26.990 (+$5.000 por profesional extra, incluye 2), Pro $42.990 (+$6.000 extra, incluye 4, 6 profesionales = $49.990), Enterprise **$249.990**.
- **Una sola tabla** de qué incluye cada plan: `src/lib/plan-access.ts` (`REGLAS` = pantallas y rutas API que bloquea el servidor; `CAPACIDADES` = qué se muestra dentro de las pantallas). Se aplica en `src/middleware.ts` (pantallas del Dashboard y `/api/*`), en el menú (`src/components/layout/sidebar.tsx`), en la barra inferior del celular (`src/lib/mobile-tabs.ts`) y en cada pantalla con `planPermite(plan, "capacidad")`. **Para cambiar qué incluye un plan: editar `plan-access.ts`, actualizar `plan_limits` en la base, el landing (tarjetas y tabla en `public/landing-nuevo/index.html`) y su prueba `scripts/test-plan-access.ts`. Nunca solo una de las partes.**
- Reparto actual: **Basic** = agenda, dashboard simple, clientes (importa Excel), billetera/gastos personales, servicios, horarios/vacaciones/días de anticipación, barra inferior; **sin** ventas, Standby, mensajes masivos, cupones, fichas, reportes avanzados, equipo. **Starter** suma Punto de Venta, Standby, mensajes masivos, cupones, fichas, Finanzas, Cierre mensual, Reseñas, Mapa de demanda, Ocupación, accesos de equipo, "Personalizar". **Pro** suma caja, inventario, insumos, fidelización, facturas, comisiones/arriendo, abonos/pagos/boletas SII, sucursales, agente de WhatsApp, publicidad.
- **Lite** (solo una persona): Calendario, Clientes básico (nombre/celular/correo; ficha borrosa), Mi Billetera + Gastos personales, Profesionales (sin "Nuevo miembro"), Servicios simples (nombre, descripción, precio, duración), Configuración reducida (negocio, horario, barra inferior, apariencia, privacidad; el resto aparece gris sin candado), Oti. Botón WhatsApp de la ficha: **20 usos al mes** (`/api/clients/whatsapp-click`), Email bloqueado. Reglas en `src/lib/plan-lite.ts`. Se cobra una sola vez por Mercado Pago (Checkout Pro) y no vence (`LITE_PERIODO_DIAS`).
- **Límites** en el servidor: profesionales (`src/lib/seats.ts`: cuentan profesionales activos **y el administrador que atiende clientes**), sucursales (`src/lib/branch-limit.ts`, `tenants.max_branches`; solo el super admin lo sube), clientes (`src/lib/client-limit.ts`: Lite 100, Basic 500, Starter 1.000, Pro 5.000; no bloquea reservas que hace el propio cliente por el link). Recepción y administradores extra: desde Starter.
- Cupos de mensajes (landing): Basic 60/60, Starter 150/150, Pro 350/350 (WhatsApp/correo), ya en `plan_limits`. **Los topes de mensajes no bloquean hasta el 1 dic. 2026** (`FECHA_INICIO_TOPE` en `src/lib/message-quota.ts`); el tope de 20 de Lite sí rige desde ya.
- Se eliminó el **código de invitación** (la API responde 410). "Bajar a Lite" desde otro plan está bloqueado. La lista de espera ahora descuenta del cupo.
- `/api/plans` ahora es dinámico (antes quedaba congelado hasta el siguiente despliegue).

**Producto y pantallas**
- Dashboard compacto (encabezado en una línea, tarjetas del mismo alto, sucursal + "+ Nota" en una fila), tarjeta **Visitas por cliente** (mensual; mes en curso vs mes anterior al mismo día), selector de sucursal en el Dashboard.
- **Ocupación** (Negocio › Ocupación; `src/lib/ocupacion.ts`): horas disponibles vs con cita, por modalidad (comisión/arriendo), con gráficos; si menos del 70% de las citas se cierran muestra la guía del proceso correcto en vez de números engañosos.
- **Mapa de demanda**: opción "Ver en gráficos" y ahora mide el **tiempo ocupado** por cada cita (una cita larga cuenta en todas las horas que dura), no solo la hora de inicio.
- **Clientes**: separación cargados vs nacidos en re-booking (`clients.imported_at`, migración 143), columnas veces/ticket/asistencia/gastado ordenables.
- Correos de cita: teléfono y logo **del negocio de la cita** (antes había un número fijo de Levels), fecha correcta en el correo del abono, plazo configurable para cancelar o modificar desde el correo (`tenants.client_change_hours`, migración 144; se respeta al cancelar). Cancelar desde el correo lleva a reagendar en el negocio correcto.
- **Super admin "Entrar" a un negocio**: el navegador manda `x-tenant-id` y las rutas que leían "el negocio de la sesión" usan `getCallerForView()` (`src/lib/supabase/server.ts`, `src/lib/ver-como.ts`). Rutas nuevas que lean el negocio de la sesión deben usar `getCallerForView()` o el patrón `resolveTenantForRequest(?tenantId)`.
- Landing: tarjetas de Basic/Starter/Pro con las listas nuevas, Lite como quinta tarjeta destacada, Enterprise $249.990.

**Migraciones de esta tanda (todas ya aplicadas en producción y en pruebas):** 143 `clientes_cargados`, 144 `plazo_cambios_cliente`, 145 `avisos_por_defecto`, 146 `plan_lite`. La 108 (barra inferior) ya estaba en producción.
Cambios de datos hechos con OK de Nico: 2.138 clientes de Levels marcados como "cargados"; 102 citas de Levels con venta pasadas a "completada"; centro de avisos encendido en todos los negocios; `plan_limits` (cupos 60/150/350 y máximos de clientes).

## 4. Pendiente / decisiones abiertas (no las tomes tú: pregúntale a Nico)
1. **Fluye salón**: 89 citas de octubre y 49 de noviembre siguen "agendadas" (casi no cierran el flujo). Propuesta: pasar a "completada" las que tienen venta el mismo día (como en Levels). **Necesita el "sí" de Nico** (modifica datos reales).
2. **Suposiciones sobre planes** que Nico debe confirmar: abonos/pagos/boletas SII en **Pro**; Finanzas, Cierre mensual y Reseñas desde **Starter**; agente de WhatsApp y Publicidad desde **Pro**; Exportar clientes desde **Starter**.
3. Hacer una **compra de prueba** real de Lite, Basic y Starter por `/suscribirse` (Mercado Pago no deja pagar con el mismo correo de la cuenta que cobra) y revisar que el monto sea el correcto.
4. Las **rutas de Configuración** (`/api/settings/*`) solo se esconden en pantalla; no tienen bloqueo por plan en el servidor (riesgo bajo, pero es un hueco).
5. Pantallas nuevas **no probadas en celular**. Oti (`src/lib/oti/catalogo.ts`) puede mandar a pantallas que un plan no incluye (el middleware lo redirige al plan).
6. Levels (enterprise) tiene `max_branches = 1` pero 2 sucursales: Nico administra sus bloqueos él mismo.
7. Sigue pendiente lo de `CLAUDE.md` §7 (seguridad de rutas `mercadopago*`/`tuu*`, `pos/checkout` confía en totales del navegador, actualizar Next 14.1.3) y las claves de Mercado Pago a rotar (Pablo).
8. Ramas abiertas de **otras sesiones** (no son tuyas; no las toques ni las mezcles sin preguntar): `claude/campanas-enviadas`, `claude/ci-mas-rapido-archivo`, `claude/contexto-mas-largo`, `claude/empresas-base-stock`, `claude/ia-guiada`, `claude/informe-cada-2-4-semanas`, `claude/landing-sin-instalacion`, `claude/landing-vista-previa`, `claude/pos-servicios-rectangulares`, `claude/prueba-acceso`, `claude/sql-*`.

## 5. Bitácora (agrega al final, 3 líneas por tarea)
- 2026-11-07 · Claude: traspaso creado. Todo lo anterior está mergeado hasta el PR #346.
- 2026-11-07 · Codex · Listo para revisión en `codex/mi-agenda-resumen`: resumen diario, primera visita al negocio y proyección por porcentaje; encabezado reducido a saludo + fecha, acciones como iconos, resumen de menor altura y selector solo admin; tarjetas turquesa con primera visita verificada, bloqueo en una línea y avance por hora de Chile sin cambiar estados; iconos genéricos de calendario.
- Verificado: 21 pruebas de cálculo/historial/API + 6 de acceso/encabezado + 10 de reloj/tarjetas/bloqueos; TypeScript limpio. Preview local con componentes reales y datos ficticios en puerto 4318.
- Nico aprobó el diseño y pidió subirlo; pendiente crear/mergear PR por Nico. Ingreso en celular real y datos reales no probados. Logo durante carga/redirección del profesional; sin SQL ni cambios de producción.

- 2026-11-07 · Codex · `codex/agenda-total-admin`: Nico pidió total del día sin descuentos en su agenda de administrador en comisión; profesionales conservan proyección por porcentaje.
- El rol se obtiene del perfil seleccionado en servidor, no de quien mira la pantalla; se muestra «Total del día · Sin descuentos». Sin SQL ni cambios de comisiones/cobros.
- Pruebas simuladas de total admin, datos faltantes, profesional y arriendo; pendiente crear/mergear PR por Nico y comprobar datos reales en pantalla.

- 2026-11-07 · Codex · `codex/logo-carga-oficial`: pantalla de carga del panel usa el PNG exacto que Nico adjuntó («Logo RE-BOOKING Texto Hori 01.png»), sin reinterpretación ni recorte.
- Logo en fondo blanco y proporción original; se anima solo la barra. No cambia otros logos, splash nativo, permisos ni datos; sin migraciones.
- Verificado SHA-256 contra el adjunto, pruebas de acceso y TypeScript; pendiente merge de Nico y verificación del arranque en app instalada.

- 2026-11-07 · Codex · `codex/agenda-admin-modalidad`: corrige total oculto en admin de Levels; la excepción del administrador ya no depende de work_mode.
- Total de servicios agendados del administrador en cualquier modalidad; profesionales conservan su regla. No modifica configuración, porcentajes, pagos ni base de datos.
- Verificación: 27 pruebas simuladas de resumen y TypeScript; sin SQL. Pendiente merge por Nico y comprobación del monto real en su sesión.

- 2026-11-07 · Codex · `codex/agenda-arriendo-ventas`: todos los profesionales rental proyectan suma completa de servicios, como administradores; comisión conserva porcentaje.
- Etiqueta «Cliente nuevo» más visible junto al nombre; tarjeta «Total esperado» grande y «Total de ventas actual» pequeño: ingresos completados del profesional en el día de Chile, incluye abonos aplicados, excluye ajustes manuales; refresca cada minuto y al volver.
- Sin SQL ni cambios a pagos; pruebas simuladas y TypeScript; falta validar datos reales y pantalla en celular tras merge de Nico.
- 2026-11-07 · Codex · `codex/deslizar-actualizar`: gesto compartido de arrastrar y soltar desde arriba en pantallas de consulta del panel; indicador turquesa y limpieza del cache de lectura antes de recargar la URL actual.
- Excluye POS/Standby/terminal, configuración y fichas de edición; bloquea con formularios modificados, modales y gestos en rejilla/citas. Conserva sesión y URL; filtros locales se reinician al recargar.
- Verificado: 26 pruebas simuladas, TypeScript y demostración de touchstart/move/end en navegador local con datos ficticios. Sin SQL; falta dispositivo real/WebView y merge por Nico.

- 2026-11-07 · Codex · `codex/reagendar-con-abono`: el enlace del correo permite cambiar fecha/hora de la misma cita, con plazo del negocio, profesional/servicios originales y abono intacto; no crea cobros.
- Verificado con 30 pruebas simuladas nuevas (ruta y disponibilidad), 3 de preferencias y TypeScript; sin SQL ni datos reales. No probado en celular ni con Supabase.
- Pendiente merge por Nico; los demás puntos del informe de Looky siguen separados: contabilidad de abonos en borrador `codex/abonos-contabilidad`, recuperación manual, alertas de ventas, extras y abonos futuros. La comprobación de cupos previa no incorpora un bloqueo transaccional entre distintas citas simultáneas.

- 2026-11-07 · Codex · `codex/temas-rosa-monocromo`: agrega Rosa, Blanco y negro y Negro con blanco a Configuración y Mi perfil; conserva Claro/Oscuro y preferencias existentes. Tarjetas oscuras y logo oficial blanco en el invertido, aprobado por Nico.
- Verificado: 23 pruebas de catálogo/permisos/guardado, 24 parejas de contraste, TypeScript y 168 lecturas de texto en componentes reales con datos ficticios (56 por paleta, contraste >=4.5). No se probaron todas las pantallas ni dispositivos físicos.
- Migración 148 amplía la restricción de temas personales sin cambiar filas. No aplicada: entorno sin conector Supabase; ejecutar en Editor SQL de rebooking Base y después EstudioLevels, verificar los cinco nombres. Nico crea/mergea PR; sin despliegue ni datos reales.

- 2026-11-07 · Codex · Conflicto de `codex/temas-rosa-monocromo` con PR #356 resuelto conservando ambas entradas. El fetch configurado solo trae agente/whatsapp: traer main explícitamente con `git fetch origin main:refs/remotes/origin/main`.
- Migración 148 aplicada por Editor SQL en rebooking Base y EstudioLevels, verificada con profiles_theme_check y sus cinco valores. Pruebas carecía de profiles.theme: 148 ahora crea theme en profiles/tenants si falta; no modifica preferencias existentes.
- Revalidado TypeScript y 23 pruebas de temas; respuesta controlada también si falta la columna. Sin UPDATE/DELETE de negocios, sin merge a main ni despliegue; Nico crea y mergea el PR.

- 2026-11-07 · Codex · `codex/logo-rosa`: logo oficial horizontal, icono y carga en rosado únicamente cuando se elige Rosa.
- Cambio de CSS aislado; las demás paletas conservan sus logos. Sin SQL ni cambios de datos.
- TypeScript verificado; pendiente merge por Nico y comprobación en la app instalada.

- 2026-11-07 · Codex · `codex/escala-rosa`: variedad tonal en Rosa: títulos intensos, acentos medios, resumen pastel y fondos de tarjetas al 7%/12%, con texto sólido.
- Se conservan fondo blanco y logo rosado; ninguna otra paleta cambia. Sin SQL ni cambios de datos.
- Verificación de contraste y TypeScript; falta revisión en app instalada. Nico crea/mergea PR.
