# Re-booking Empresas — propuesta por etapas (29 oct. 2026)

**Estado:** PROPUESTA para decidir. No hay código escrito. Lidera Claude; decide Nico.
**Origen:** reunión con el dueño de Nishman Chile (28 oct.). Dos necesidades: (1) alianza comercial (catálogo Nishman/Falcons para salones, promociones, referidos) y (2) un sistema para gestionar su propia empresa.
Marcas: **HECHO** = verificado en el código · **INFERENCIA** = deducción mía · **DECISIÓN** = la toma Nico.

---

## 1. Lo que ya existe (verificado)

| Tema | Cómo está hoy | Archivo |
|---|---|---|
| Unidad de aislamiento | **Negocio = `tenants`**; toda tabla de datos lleva `tenant_id`. Las rutas API usan la llave de servicio (se saltan RLS) y **cada ruta valida sesión y negocio** | `src/lib/supabase/server.ts` (`getCurrentUserRoleAndTenant`, `resolveTenantForRequest`, `requireRole`) |
| Roles | Un solo rol por usuario en `profiles.role`: `super_admin`, `admin`, `barber`, `receptionist`, `client` | `src/lib/permissions.ts`, migración 001 |
| Login y entrada | Un solo `/login` que lleva a `/dashboard`; un negocio suspendido solo puede usar facturación | `src/app/login`, `src/middleware.ts` |
| Alta de negocios | Alta automática tras el pago, con plan y límites | `src/lib/tenant-provisioning.ts`, `subscription-webhook.ts` |
| Cobro | Suscripción de Mercado Pago **por negocio y por profesional** | `src/lib/subscription-pricing.ts` |
| Inventario | `products` con **un solo stock por producto**, `inventory_movements`, categorías, `suppliers` (solo nombre y celular), `supply_requests` (solicitudes de insumos por correo/WhatsApp) | migraciones 001, 016, 092 |
| Clientes | `clients` = **personas que se atienden en citas** (no compradores comerciales); importador de clientes | `src/lib/client-import.ts` |
| Ventas | POS y caja para consumidor final, boletas SII | `src/app/dashboard/pos`, `boletas` |
| Otros reutilizables | Avisos al equipo (`notify`), informes por correo, Oti (catálogo por rol), soporte, cron con clave, referidos | `src/lib/notify.ts`, `src/lib/oti` |

**HECHO — lo que NO existe:** bodegas, pedidos a clientes, clientes comerciales, vendedores y carteras, picking/despacho/rutas, relación entre dos negocios distintos, permisos por responsabilidad dentro de un negocio, login ni panel aparte.

## 2. Arquitectura propuesta (tres ejes separados)

**INFERENCIA — recomendación:** separar tres cosas que hoy están mezcladas, tal como pediste.

1. **Tipo de empresa** — columna nueva `tenants.kind` (`salon` por defecto = todo lo de hoy; `company` = empresa/distribuidora). Se reutiliza `tenants` para aprovechar aislamiento, alta, suspensión y cobro. Los salones no cambian.
2. **Rol del usuario** — para empresas, tabla `company_members (tenant_id, user_id, role_key)` con roles por responsabilidad (dueño, administrador, vendedor, bodega, despacho, reparto, finanzas). Cada rol se traduce a **capacidades** definidas en el servidor (ej.: `pedidos.ver_todos`, `pedidos.ver_propios`, `stock.mover`). `profiles.role` solo marcaría "usuario de empresa" (un valor nuevo, aditivo) y **no** da permisos por sí solo.
3. **Relación comercial** — tabla `commercial_relations (empresa, socio, tipo, condiciones, estado)`. Tipos: `cliente_comercial` (un salón o un negocio que compra), `revendedor`, `proveedor`. Los permisos de un socio salen de **su relación**, no de su rol: un revendedor solo ve su lista de precios y sus pedidos.

**Login aparte (decisión tuya, respetada):**
- `/empresa/login` → `/empresa` (panel propio con su menú, diseño y rutas); `/socios/login` → `/socios` (proveedores y revendedores).
- Comparten componentes (tablas, formularios, avisos), no el menú ni las pantallas del salón.
- **El login es solo comodidad.** El servidor valida en cada ruta: sesión + tipo de empresa + pertenencia + capacidad. Un usuario de salón que escriba `/empresa` es rechazado, y viceversa. Se prueba con scripts "sin sesión" y "cruzado", como las rutas actuales.
- Los negocios actuales conservan su acceso y su experiencia sin cambios.

**Aislamiento de datos:** toda tabla nueva lleva `tenant_id` de la empresa + RLS activado sin políticas (solo servidor) + guard en cada ruta. Un vendedor ve solo los clientes de su cartera; un revendedor solo lo suyo; ningún usuario ve datos de otra empresa.

**Stock correcto:** los movimientos de stock se hacen con una función de base de datos atómica (nunca "leer, sumar, escribir" desde la API), para que dos pedidos simultáneos no vendan el mismo producto.

## 3. Qué se reutiliza y qué se construye

| Reutilizar tal cual | Adaptar | Construir nuevo |
|---|---|---|
| Autenticación, alta de tenant, suspensión | Cobro: modelo de suscripción para empresas (no por profesional) | Bodegas y stock por bodega |
| Guards de servidor y estilo de pruebas | Inventario: pasar de un stock a stock por bodega | Clientes comerciales y su historial |
| Componentes de interfaz, avisos, informes por correo | Importador de clientes → importador de catálogo y clientes comerciales | Pedidos, estados y recompras |
| Referidos | Oti: catálogo de ayuda del panel de empresa | Vendedores y carteras |
| Boletas/facturas SII (si se decide emitir) | | Preparación, despacho y rutas |
| | | Organigrama y permisos por responsabilidad |
| | | Acceso de socios (revendedores/proveedores) |

## 4. Etapas

**Etapa 0 — Acuerdos (esta semana, sin código).** Cerrar las decisiones de la sección 6 y recibir de Nishman una **muestra anonimizada** de su planilla (productos, bodegas, clientes, vendedores). Actualizar `AGENTS.md` (hecho en este PR) y crear la rama base `empresas/base`.

**Etapa 1 — Núcleo de empresa (acotada).** Objetivo: Nishman puede entrar a su panel y operar stock y pedidos básicos.
- Empresa tipo `company`, login y panel `/empresa`, usuarios con 3 roles (dueño, vendedor, bodega).
- Productos y **stock por bodega** con movimientos (entrada, salida, ajuste, traspaso). Importación desde Excel.
- Clientes comerciales: alta, ficha, historial de pedidos.
- Pedidos: crear y cambiar de estado (borrador → confirmado → preparado → despachado → entregado). Sin pagos en línea, sin rutas, sin emitir facturas.
- Todo apagado por defecto y activable solo para la empresa de Nishman.

**Etapa 2 — Ventas y operación.**
- Vendedores y cartera asignada (cada uno ve solo la suya); recompras (aviso cuando un cliente no compra hace X días, con la lógica de Retención ya existente).
- Preparación de pedidos (lista de picking) y despacho; rutas simples (agrupar por comuna y ordenar a mano).
- **Puente con la alianza:** un salón de re-booking aparece como **cliente comercial** de Nishman y puede pedir desde su propio panel ("Catálogo de socios"), con promociones. Aquí se conectan tus dos necesidades.

**Etapa 3 — Socios.** `/socios` para revendedores y proveedores, con el modelo que elijas (sección 6, punto 4); listas de precio por socio; referidos acordados.

**Etapa 4 — Madurez.** Facturación electrónica de la empresa, rutas optimizadas y app de reparto, reportes de venta, otras empresas además de Nishman.

## 5. Permisos (borrador para la Etapa 1)

| Capacidad | Dueño | Vendedor | Bodega | Socio (revendedor) |
|---|---|---|---|---|
| Ver todos los pedidos / clientes | Sí | Solo su cartera | Solo pedidos a preparar | Solo los suyos |
| Crear pedido | Sí | Sí (a su cartera) | No | Sí (a su empresa, con su lista) |
| Mover stock | Sí | No | Sí | No |
| Ver costos y márgenes | Sí | No | No | No |
| Gestionar usuarios y permisos | Sí | No | No | No |
| Ver cifras de venta totales | Sí | Solo las suyas | No | No |

## 6. Decisiones pendientes (para Nico)

| # | Decisión | Recomendación |
|---|---|---|
| 1 | **Cómo paga Nishman**: suscripción mensual fija, por usuarios o por pedidos | Fija por empresa + usuarios extra; revisar tras ver su tamaño |
| 2 | **¿La Etapa 1 incluye despacho y rutas?** | Actualizado (sección 10): el registro de salida en despacho sí entra, porque sin él el stock no cuadra. Las rutas no |
| 3 | **Precios**: una lista única, o precios distintos por cliente y por tipo (mayorista/revendedor) | Lista única + descuento por cliente en Etapa 1; listas por socio en Etapa 3 |
| 4 | **Revendedores**: compra para reventa, venta por comisión, abastecimiento o mezcla | Empezar solo con "compra para reventa" (es un cliente comercial con precio mayorista); la comisión añade liquidaciones y se deja para después |
| 5 | **Alianza**: ¿los salones compran el catálogo Nishman desde re-booking? ¿re-booking cobra comisión o referido por pedido? ¿exclusividad? | Reunión para fijar condiciones por escrito antes de la Etapa 2 |
| 6 | **Datos de Nishman**: cuántas bodegas, productos, clientes, vendedores; formato actual (Excel, otro sistema) | Pedir una muestra anonimizada (Etapa 0) |
| 7 | **Facturación**: ¿Nishman sigue facturando con su sistema actual y re-booking solo registra? | Sí en Etapa 1 (sin emitir documentos tributarios) |
| 8 | **Marca y dirección**: nombre del producto ("re-booking Empresas") y dominio (`/empresa` o subdominio) | `/empresa` primero; subdominio cuando haya más empresas |
| 9 | **Datos personales (Ley 21.719)**: contrato de encargo con Nishman por los datos de sus clientes | Redactarlo antes de cargar datos reales |
| 10 | **Confidencialidad entre empresas** que compiten (precios y catálogos) | Cláusula en el acuerdo; el sistema ya las aísla por diseño |
| 11 | **Plazo y quién implementa/da soporte** | Piloto con Nishman 4–6 semanas desde la muestra de datos (estimación mía, sin verificar) |

## 7. Riesgos

- **Es un segundo producto**, no una pantalla extra: requiere foco. Por eso la Etapa 1 es corta y apagada por defecto.
- **Mezclar salones y empresas** puede romper lo que ya funciona: `tenants.kind` con `salon` por defecto y pruebas de regresión de rutas existentes.
- **Valor nuevo en `profiles.role`** (`ALTER TYPE … ADD VALUE`) no se puede revertir fácil: lo revisamos con cuidado antes de aplicarlo en producción.
- **Stock con concurrencia**: se resuelve con funciones de base de datos, no con la API.
- **Datos reales de Nishman** antes de tener contrato de datos y respaldo: no se cargan.

## 8. Cómo colabora Codex (según la autorización del 29 oct.)

Sección 15 de `AGENTS.md`: Codex escribe en ramas `codex/*` con ficha de tarea, abre PRs hacia `empresas/base` (nunca `main`), prueba solo con datos simulados y no mergea, despliega ni toca secretos, producción ni cobros reales. Claude decide el diseño final y revisa. Primeras tareas sugeridas para Codex (con ficha, tras tu OK): (a) análisis de la planilla de ejemplo de Nishman y propuesta de modelo de datos; (b) borrador SQL de bodegas y movimientos con sus pruebas; (c) lista de casos de prueba "sin sesión" y "cruzado" para las rutas de empresa.

## 9. Avance de la Etapa 1 (3 nov. 2026)

**HECHO, solo en `rebooking-pruebas`:** migración 125 (`tenants.kind`, `company_members`, bodegas, catálogo, stock por bodega, movimientos y `company_stock_move`) y `scripts/test-empresas-stock.ts` (solo datos simulados). Empresas simuladas: `empresa-sim-a` y `empresa-sim-b`.
**Diseño:** catálogo en `company_products`, no en `products` (ahí el SKU es único en toda la base y la política es abierta). La API solo lee stock y movimientos: escribir pasa siempre por `company_stock_move`. No se agregó ningún valor a `profiles.role`.
**Falta en la Etapa 1:** login y panel `/empresa`, capacidades en el servidor, rutas API, importación, clientes comerciales y pedidos. `delete_tenant_cascade` no conoce las tablas `company_*`: borrar una empresa con datos falla (a propósito por ahora; a un salón no le afecta).

## 10. Lo que pidió Felipe en sus audios (28 oct. 2026)

**Fuente:** 6 audios de Felipe, transcritos en el Mac con reconocimiento de voz automático y revisados por encima. Esta sección manda sobre las etapas de la sección 4 donde se contradigan.

| # | Lo que pide | Qué había en la propuesta | Qué cambia |
|---|---|---|---|
| 1 | **Stock que cuadre.** Es lo que más le urge. Pasa en los dos sentidos: el sistema muestra productos que no están y dice que no hay productos que sí están. Lo nota a mitad de mes y al despachar | Stock por bodega con movimientos | Se agregan toma de inventario, stock reservado y salida registrada en despacho |
| 2 | **Reporte semanal por vendedor:** de su cartera (ej.: 200 clientes), cuántos gestionó, a cuántos les vendió y cuántos quedaron sin atender | Carteras en Etapa 2, sin reporte | Se adelanta y se agrega el registro de gestiones |
| 3 | **Llamado mensual obligatorio:** el sistema le pone al vendedor el cliente que toca y no lo deja pasar a otro hasta resolverlo | No estaba | Nuevo: cola de gestión obligatoria |
| 4 | **Portal de distribuidores:** entran con clave, ven stock en línea y hacen su pedido; al vendedor le llega el comprobante | `/socios` en Etapa 3 | Se adelanta, pero solo cuando el stock ya cuadre |
| 5 | **Mensajes programados por WhatsApp:** flyers, eventos, invitaciones y recordatorios de reponer | No estaba | Nuevo: campañas sobre el código de `src/lib/agente` |

**INFERENCIA — por qué no cuadra hoy:** no se sabe todavía. Felipe describe el síntoma, no la causa. Un sistema nuevo no lo arregla por sí solo: si alguien saca un producto sin registrarlo, el saldo vuelve a descuadrarse. Por eso importa más el proceso de bodega que la pantalla.

### Nuevo orden (aprobado por Nico el 3 nov. 2026)

1. **Etapa 1 — Stock confiable:** panel, roles, catálogo, importación desde Excel, toma de inventario (contar, comparar y ajustar con motivo), pedidos que reservan stock al confirmarse y salida que lo descuenta al despachar. Se muestra físico, reservado y disponible.
2. **Etapa 2 — Vendedores:** cartera por vendedor, registro de gestiones con resultado, cola obligatoria y reporte semanal a Felipe (reutiliza informes por correo y cron).
3. **Etapa 3 — Distribuidores:** portal con clave, stock disponible, pedido propio y comprobante al vendedor.
4. **Etapa 4 — WhatsApp:** campañas programadas a clientes con permiso. Requiere el número de la empresa, plantillas aprobadas por Meta y darse de baja (`agent_contact_optouts` ya existe). El envío real sigue bloqueado hasta que Nico lo apruebe.
5. **Después:** rutas, facturación y puente con salones (lo que antes era Etapa 2 y 4).

**Cola obligatoria (recomendación):** cada gestión exige un resultado: vendió, no contestó, volver a llamar en una fecha, o sin interés. "No contestó" vuelve a la cola sin bloquear el resto del día. Saltarse un cliente exige motivo y aparece en el reporte. El dueño puede destrabar a un vendedor. Un cliente que llama para pedir nunca queda bloqueado.
**Límite honesto:** sin telefonía integrada, el sistema no puede comprobar que el llamado ocurrió; solo registra lo que anota el vendedor. El reporte, cruzado con las ventas, ayuda a detectar lo anotado sin hacer.

**Base técnica:** la migración 125 sirve tal cual. Lo nuevo se suma en migraciones aparte (reservas, tomas de inventario, cartera, gestiones). Mostrar stock a distribuidores antes de que cuadre empeoraría el problema, por eso va después.

### Preguntas para Felipe

1. ¿Qué sistema usan hoy para el stock? ¿re-booking lo reemplaza o conviven? (Con dos sistemas el descuadre empeora.)
2. ¿Quién puede sacar productos de bodega hoy y cómo queda registrado? ¿Cuántas bodegas y productos son?
3. Cuando un cliente no contesta, ¿cuántos intentos y cada cuántos días antes de pasarlo a otro estado?
4. ¿El distribuidor ve la cantidad exacta o solo "disponible / agotado"? ¿Ve precios propios?
5. ¿Los clientes aceptaron recibir publicidad por WhatsApp? ¿Tienen un número de WhatsApp Business para la empresa?

### Avance de la Etapa 1 (3 nov. 2026)

**HECHO, solo en `rebooking-pruebas` y sin pantallas:** migración 126 (clientes comerciales, pedidos y stock reservado) y 127 (toma de inventario), con `scripts/test-empresas-pedidos.ts`.
**Reglas:** confirmar reserva; despachar descuenta físico y reserva; cancelar libera. Salidas y traspasos solo usan lo disponible. El conteo físico manda aunque quede bajo lo reservado: ese pedido no se despacha hasta resolver el faltante. Al cerrar un conteo se aplica solo la diferencia, para no pisar lo vendido mientras se contaba.
**Falta en la Etapa 1:** capacidades por rol, rutas API, login y panel `/empresa`, importación desde Excel. Devoluciones de lo ya despachado: sin definir.

**HECHO, en pruebas y local (3 nov. 2026):** login `/empresa/login`, panel `/empresa` (stock, pedidos, conteos, productos, clientes), rutas `/api/empresa/*` y capacidades por rol en `src/lib/empresas/`. Apagado en producción: solo se activa con `EMPRESAS_ENABLED=1` (encendido en Preview y local).
**Decisiones técnicas:** el permiso sale de `company_members`, nunca de `profiles.role` (los usuarios de empresa llevan `client`, sin valores nuevos). Bodega cuenta a ciegas y el dueño cierra; los ajustes directos son del dueño. El vendedor ve todos los clientes y solo sus pedidos hasta que exista la cartera (Etapa 2).
**Datos de demo:** `npx tsx scripts/empresas-demo.ts` (solo pruebas, pide la clave en la Terminal).
**Falta en la Etapa 1:** importación desde Excel (espera formato de Felipe) y gestión de usuarios desde el panel.

## 11. Etapas 1 a 4 construidas (10 nov. 2026)

**HECHO, probado en `rebooking-pruebas` y local** (`scripts/test-empresas-etapas.ts` 111/111, `scripts/test-empresas-logica.ts`, `test-empresas-rutas` y `test-empresas-capacidades` sin regresiones). Migraciones **158** (configuración, cartera, gestiones, reporte), **159** (portal) y **160** (campañas), juntas en `entrega-produccion/SQL-EMPRESAS-ETAPAS.sql`. Todo lo que sale hacia afuera viene **apagado** por empresa.

| Etapa | Qué hay | Dónde |
|---|---|---|
| 1 | Importar productos (con stock inicial) y clientes desde Excel/CSV, con revisión antes de guardar; nunca borra ni deja en blanco. Equipo: crear cuentas, cambiar rol, desactivar, cambiar contraseña; siempre queda un dueño | `/empresa/importar`, `/empresa/equipo`, `src/lib/empresas/import.ts` |
| 2 | Cartera por vendedor; cola obligatoria (solo se anota el cliente que toca; saltar exige motivo; el dueño destraba); reporte semanal en pantalla y por correo los lunes (si se activa) | `/empresa/cartera`, `/empresa/reporte`, `src/lib/empresas/cartera.ts`, cron `empresas-reporte-semanal` |
| 3 | Portal de distribuidores con su propia cuenta: catálogo con disponibilidad (o cantidad exacta), pedido en borrador y comprobante por correo a su vendedor (o a los dueños) | `/socios`, `/empresa/config`, `src/lib/empresas/partner.ts` |
| 4 | Campañas programadas por WhatsApp a clientes con permiso, respetando bajas, una vez por persona. **Envío real bloqueado**: sin `EMPRESAS_WHATSAPP_SEND=1` todo queda "simulado" | `/empresa/campanas`, cron `empresas-campanas`, `src/lib/empresas/campanas.ts` |

**Decisiones tomadas por defecto (las preguntas a Felipe siguen abiertas; todo se cambia en Configuración):** llamar a cada cliente cada 30 días; "no contestó" reintenta a los 2 días, hasta 3 veces; el distribuidor ve solo "disponible/agotado" y precios de lista; el vendedor ve su cartera más los clientes sin vendedor (para que un cliente que llama nunca quede bloqueado); un pedido cuenta como "vendió".

**Pendiente:** precios propios por distribuidor; variables en las plantillas de WhatsApp (hoy van sin variables); número de WhatsApp Business de la empresa y plantillas aprobadas por Meta; devoluciones de lo despachado; si un pedido del portal falla al guardar sus productos, el borrador vacío no se cancela solo (el distribuidor no es miembro).

## 12. Respuestas de Felipe (10 nov. 2026) y cambios

| # | Respuesta | Qué se hizo |
|---|---|---|
| 1 | Hoy usan **Bsale**; el cambio será progresivo | El importador reconoce las exportaciones de Bsale (Producto + Variante, SKU, Precio Venta Bruto, Sucursal, Razón Social...). **Riesgo:** mientras convivan los dos sistemas, el stock no va a cuadrar en ninguno. Recomendación: elegir un día de corte, hacer una toma de inventario y desde ese día registrar las salidas solo en re-booking. Una sincronización con la API de Bsale es posible, pero queda para después |
| 2 | Sacan productos el encargado de bodega y cualquier administrador | Ya era así: roles Bodega y Dueño (administrador) mueven stock; el vendedor no |
| 3 | La insistencia queda a criterio del vendedor | "No contestó" pide cuándo reintentar (mañana, 2 días, una semana, un mes u otra fecha). Si no elige, se usa lo de Configuración. La cola sigue siendo obligatoria |
| 4 | Distribuidor ve solo "disponible". Precios por tramos: público, Mayorista 1 (1-2 MM, -5%), 2 (2-3 MM, -7%), 3 (3-5 MM, -9%), 4 (6-10 MM, -10%) | Migración **161**: tramos de precio por empresa (Configuración), tramo asignado a cada cliente, y sugerencia según las compras despachadas del mes anterior. El precio con descuento se calcula en el servidor y se guarda en el pedido (portal y vendedor) |
| 5 | Los clientes aceptan ofertas por WhatsApp; la empresa y cada vendedor tienen número | Importar con columna "Acepta WhatsApp" marca el permiso. Botón "WhatsApp" en la cola y en Clientes: abre el chat desde el teléfono del propio vendedor. Las campañas automáticas salen del número de la empresa |

**Preguntas nuevas para Felipe:**
1. ¿Qué tramo corresponde entre $5 y $6 millones, y sobre $10 millones?
2. Los millones de los tramos, ¿son compras **del mes** (eso se asumió), del año, o el monto de **cada pedido**?
3. ¿El tramo lo decide él a mano (así quedó, con sugerencia) o debe cambiar solo cada mes?
4. ¿Los precios de Bsale están con o sin IVA? re-booking usa el precio de lista tal cual se cargue.

**Ojo con los números de los vendedores:** un número conectado a la API de WhatsApp (para envíos automáticos) deja de funcionar en la app normal de WhatsApp. Por eso los envíos automáticos van solo desde el número de la empresa, y los vendedores usan el botón que abre su propio WhatsApp.
