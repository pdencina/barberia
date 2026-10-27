# Verificación local del borrador 004

## Corrección de Claude — 27 oct. 2026, PR #124

**HECHO — cambio del borrador:** las dos claves del registro usan `ON DELETE CASCADE`, hacia negocio y perfil (`docs/agente/sql/004_registro_envios_informe_borrador.sql:10-11`), como las preferencias del 003 (`docs/agente/sql/003_preferencias_informe_borrador.sql:13-14`). Se conserva el borrador; no hay TTL ni limpieza. **DESCONOCIDO:** retención temporal, sigue en pregunta 10 para Nico.

**HECHO — prueba ejecutada:** 41 comprobaciones pasan con PGlite 0.5.12 en memoria. Se cargaron los archivos **completos**, primero 003 y luego 004, se repitieron ambos y se volvieron a cargar tras los borrados. Sin cambios a 003 ni dependencias del repositorio, sin Supabase/producción, credenciales o red de base. Las tablas base ficticias fueron `tenants(id)` y `profiles(id, tenant_id, role, active)`; roles locales anon/authenticated/service_role. `profiles.tenant_id` no tiene FK en este fixture para aislar el efecto de las claves nuevas; no representa el esquema completo de la aplicación.

**HECHO — regresión y borrados comprobados:**

1. En otra instancia efímera con el 004 anterior, sin las dos cascadas, borrar el perfil o el negocio con envíos registrados falla con `23503`. Se reprodujo el hallazgo antes de verificar la corrección.
2. En la instancia corregida se crean preferencias mediante 003 para tres administradores ficticios de dos negocios y registros de distintas fechas/estados mediante 004. El catálogo confirma `confdeltype = 'c'` en ambas FK del registro.
3. **Borrar el perfil con dos envíos registrados no falla y borra sus filas** de envíos y preferencias. El otro perfil del mismo negocio conserva su registro.
4. **Borrar el negocio con envíos registrados no falla y borra sus filas** de envíos y preferencias. El otro negocio conserva su registro. Se verifica la cascada directa hacia negocio aun con perfiles restantes en el fixture mínimo.
5. Continúan pasando RLS activo y cero políticas en ambas tablas; SELECT/INSERT rechazados para anon/authenticated; ocho reclamos en cola obtienen un solo id; estados e intentos inválidos rechazados; identidad inmutable; perfil/tenant incompatibles rechazados; aceptado e incierto no vuelven a reclamarse.

**INFERENCIA — reproducción:** instancia PGlite en memoria con esas tablas/roles ficticios; cargar los textos completos con `db.exec`, insertar preferencias y envíos sintéticos, ejecutar `DELETE FROM profiles WHERE id = <perfil>` y `DELETE FROM tenants WHERE id = <negocio>` y comprobar conteos cero por perfil/tenant, preservando el negocio y perfil de control. No borrar primero los registros para hacer pasar la prueba. La instancia de regresión usa el mismo 004 retirando únicamente las dos cláusulas CASCADE, y verifica ambos errores antes de cerrarse.

**DESCONOCIDO — límites:** no se ejecutó el flujo HTTP de “Eliminar mi cuenta” ni el borrado real de negocio; tampoco el esquema completo con sus otras FK, auth.users, PostgREST, Supabase o conexiones independientes simultáneas. Esto verifica que **003/004** no bloquean esos DELETE en el modelo reducido, no todos los pasos de la aplicación. `CREATE TABLE IF NOT EXISTS` no cambia las FK de una tabla 004 antigua ya creada: no se probó ni se incluye una actualización de esa tabla existente. Aplicación/actualización en una base externa queda para Claude/Nico. Pieza 4 sin iniciar; sin correos reales.

## Verificación anterior del 004 aislado

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
