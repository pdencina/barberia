# Verificación local del borrador 004

**HECHO — ejecución local de esta tarea:** 20 comprobaciones pasan en PGlite efímero. Dependencia instalada únicamente en `/private/tmp/codex-agente-pglite`, sin modificar dependencias del repositorio. Sin persistencia, red de base, credenciales, Supabase ni producción. Se ejecutó el contenido de `docs/agente/sql/004_registro_envios_informe_borrador.sql:1` dos veces, sobre tablas mínimas ficticias `tenants(id)` y `profiles(id, tenant_id)` y roles locales `anon`, `authenticated`, `service_role BYPASSRLS`.

**HECHO — verificado en ese entorno:**

1. Creación y segunda ejecución sin error.
2. RLS habilitado y cero políticas en catálogo.
3. Sin columnas para HTML, correos, nombres o datos de clientes.
4. SELECT e INSERT rechazados con `42501` para anon y authenticated.
5. Ocho reclamos `INSERT ... ON CONFLICT DO NOTHING RETURNING id` de la misma tupla producen exactamente un id.
6. Aceptación sin instantes obligatorios rechazada; aceptación completa permitida y nuevo reclamo vacío.
7. Cambio de tenant de una fila rechazado; estados fuera del conjunto e intentos negativos rechazados.
8. Perfil de otro tenant rechazado al insertar; otro administrador del mismo negocio/día permitido.
9. Estado incierto persistido y reclamo posterior vacío.

**INFERENCIA — reproducción:** crear una instancia `new PGlite()` en memoria; crear los roles y tablas ficticias indicados, conceder SELECT de perfiles/tenants a service_role, cargar el borrador dos veces con `db.exec`, cambiar de rol para probar privilegios y usar `db.query` para reclamos. Los identificadores de fixtures fueron UUID sintéticos; sin nombres, correos ni datos reales. El test se ejecutó con Node y aserciones estrictas; no se agregó PGlite a `package.json` ni a CI.

**DESCONOCIDO — no probado:** conexiones PostgreSQL independientes verdaderamente simultáneas (PGlite encola operaciones en una instancia), PostgREST/Supabase real, esquema completo desplegado, credenciales/grants reales, entrega o caídas de un proceso con proveedor. La prueba en cola verifica unicidad y resultado de reclamo, no entrega exactamente una vez. La retención sigue DESCONOCIDO (#10); no se agregó TTL ni limpieza. Un despachador futuro debe filtrar tenant, revalidar identidad y hacer conciliación de estados inciertos; aún no existe por esta pieza.

**HECHO — validación del repositorio:** `npx tsc --noEmit` y la prueba existente del informe se ejecutan antes del PR. El borrador no va a `supabase/` ni se aplica a una base externa; Claude revisa y Nico decide su aplicación posterior.
