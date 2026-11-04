# Abono al reservar con Mercado Pago: guía para activarlo en un negocio

Funcionando en Looky Estudio desde el 4 nov. 2026. El cliente paga un abono al agendar y **el dinero llega a la cuenta de Mercado Pago del negocio** (no a la de re-booking). La cita se confirma sola cuando el pago se aprueba.

## Para el negocio (5 minutos)
1. **Configuración › Reservas › «Abono al reservar»**.
2. **Cuenta de Mercado Pago:** si ya tiene la máquina Point conectada (Configuración › Terminal POS), se usa esa cuenta y no hay que hacer nada. Para otra cuenta: Mercado Pago Developers › crear aplicación de **Pagos online** con el producto **Checkout Pro** › Credenciales de producción › copiar el Access Token (`APP_USR-…`) › pegarlo y «Conectar». *(Guardar un token propio necesita `SECRET_BOX_KEY` en el servidor.)*
3. **Cuánto cobrar:** porcentaje del servicio o monto fijo, plazo de cancelación gratis y mensaje al cliente. **Activar** el interruptor.
4. Tocar **«Probar que Mercado Pago acepta cobros»**: debe decir «Todo listo para cobrar abonos».
5. **Probar de verdad:** abrir `www.re-booking.cl/booking?tenant=<link del negocio>` en una ventana de incógnito, reservar y pagar con una tarjeta o cuenta **distinta** a la del negocio (Mercado Pago rechaza que una cuenta se pague a sí misma). Devolver el pago de prueba desde **Abonos**.

Mientras no haya cuenta conectada, el abono **no se exige** y los clientes reservan normal.

## Qué ve el negocio
- **Abonos** (menú Finanzas): recibido, por devolver y devuelto; quién pagó y para qué cita; botón **Devolver** (administrador), con opción de cancelar también la cita.
- Mientras el cliente paga, **su horario queda bloqueado 32 minutos**; si no paga, se libera solo.
- Si alguien paga y el horario ya se ocupó, queda como **«por devolver»** y llega un aviso.

## Si algo falla
| Síntoma | Causa conocida |
|---|---|
| Mercado Pago: «No pudimos procesar tu pago» y la dirección dice `collection_id=null` | La referencia del pago superaba los 256 caracteres (ya corregido: se guarda aparte y se manda un id corto). Si reaparece, revisar `booking_intents` (migración 133). |
| La página de reservas no pide el abono | La lectura `/api/settings/deposit?tenantId=…` debe ser pública y devolver `deposit_ready: true` (abono activado **y** cuenta conectada). |
| Pagó pero no hay cita | Revisar `booking_deposits` (estado `approved` o `needs_refund`); el aviso de Mercado Pago llega a `www.re-booking.cl/api/webhooks/deposit` (con **www**: sin www redirige y Mercado Pago no lo sigue). |
| Pago rechazado en el pago de prueba | Probar con otra cuenta/tarjeta; el motivo exacto queda en `booking_deposits.status` (`rejected:…`). |

## Datos técnicos
- Migraciones: 131 (columnas y `booking_deposits`), 132 (bloqueo de horario en `barber_blocks`), 133 (`booking_intents`).
- API usada: **Preferences (Checkout Pro)**. Mercado Pago la marca «legado» pero no anunció fecha de cierre; Orders es lo nuevo y su cobertura de débito es más limitada. Migrar más adelante, con calma.
