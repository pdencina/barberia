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
| 2 | **¿La Etapa 1 incluye despacho y rutas?** | No: stock, clientes y pedidos primero |
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
