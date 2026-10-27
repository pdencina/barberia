# Boleta electrónica (SII) en re-booking: guía corta

Con esto, cada venta cobrada puede generar su boleta electrónica y el comprobante que llega al correo del cliente muestra el número de boleta. Todo viene **apagado**: se activa negocio por negocio.

## Antes de empezar (lo hace el dueño, una vez)
1. Inicio de actividades en el SII con un giro que permita emitir boletas.
2. Cuenta con un proveedor autorizado (hoy re-booking usa **OpenFactura / Haulmer**). El proveedor guía la autorización ante el SII y la entrega de folios. Empieza en su ambiente de **pruebas**.
3. Tener a mano: **RUT, razón social, giro, dirección y comuna** del emisor, y la **llave (API key)** que da el proveedor.

## Conectar (5 minutos, lo hace el administrador)
1. **Configuración → Boleta electrónica (SII)**.
2. Completa los datos del emisor y pega la llave. Deja el ambiente en **Pruebas**.
3. Marca **Boleta electrónica activada** y toca **Guardar**. Al recargar, la llave dice "ya cargada" (no se vuelve a mostrar).
4. Haz una venta de prueba en el POS con un cliente con tu correo. En pruebas la boleta **no tiene valor tributario**.
5. Cuando el SII ya autorizó al negocio y hay folios reales: cambia el ambiente a **Producción**, pega la llave de producción (es distinta) y emite una boleta real chica para confirmar.
6. Si quieres que salga sola, marca **Emitir automáticamente al cobrar**. Si el proveedor falla, la venta se cobra igual y se puede reintentar.

## Si un profesional paga su propio impuesto
- **Ficha del profesional → Modalidad de trabajo → Integración SII** (solo administradores; el profesional no puede verla ni cambiarla).
- Elige quién paga:
  - **El negocio asume el impuesto**: sus boletas salen con la cuenta del negocio.
  - **El profesional paga su propio impuesto**: carga su RUT, datos y llave. Sus boletas salen con **su** cuenta. Si su cuenta no está activa, no se emite con la del negocio.
- La tasa puede ser **15,25 %** (boleta de honorarios, retención 2026) o **IVA 19 %**. La retención cambia por ley cada año: hay que actualizarla.
- Con retención de honorarios, la cuenta propia no se puede usar: el negocio es quien le vende al cliente.

## Profesionales por comisión con retención (boleta de honorarios)
re-booking **no** emite esa boleta: la emite el profesional en el SII. Aquí se calcula y se registra:
1. **Configuración → Boletas de honorarios**: elige el mes y mira cuánto debe emitir cada uno.
2. **Copiar aviso** y pégalo en WhatsApp.
3. Cuando entregue su boleta: **Registrar boleta recibida** (folio, fecha, monto).
4. El resumen suma la retención del mes para el contador.
El recibo PDF del profesional (Comisiones → Recibo PDF) muestra el impuesto como información; no cambia el total a pagar.

## Problemas frecuentes
| Mensaje | Qué hacer |
|---|---|
| "Falta aplicar la migración 116…119" | Pablo corre el SQL de esa migración |
| "Falta SECRET_BOX_KEY…" | Pablo crea la variable en Vercel |
| "Faltan datos del emisor…" | Completar los 5 datos y la llave |
| "No se pudo leer la llave…" | Volver a pegar la llave |
| Error del proveedor | Leer el mensaje: folios agotados, emisor no autorizado o RUT mal escrito |

## Lo que todavía no está
Anular una boleta con nota de crédito (por ahora se anula en el panel del proveedor) y el aviso de folios por agotarse.
