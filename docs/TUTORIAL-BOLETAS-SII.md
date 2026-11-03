# Tutorial: boleta electrónica (SII) en re-booking

Cada negocio usa **su propia cuenta** con un proveedor autorizado por el SII (hoy: OpenFactura de Haulmer). re-booking solo le pasa los datos de la venta; el proveedor firma, pide el folio y envía al SII.

> Estado: el código está listo (rama `claude/boletas-sii-por-negocio`), apagado por defecto y **sin probar contra el sandbox del proveedor**. La pantalla de Configuración y el botón en el POS aún no existen (ver "Falta construir").

## Parte 1: lo que hace el dueño del negocio (una vez)

1. **Inicio de actividades** en el SII con un giro que permita boletas (barbería, peluquería, etc.). Si ya emite boletas en papel o con otro sistema, ya lo tiene.
2. **Certificado digital** (firma electrónica) del representante, si el proveedor lo pide. Lo vende E-Sign, Acepta, Certinet, entre otros.
3. **Crear cuenta en OpenFactura** (openfactura.cl, de Haulmer). Empezar en el ambiente de **pruebas (sandbox)**.
4. **Postular como emisor de boletas electrónicas** en el SII. El proveedor lo guía: pasa el set de pruebas en el ambiente de certificación y el SII autoriza. Es el paso que más demora (días a semanas).
5. **Obtener los folios** (CAF) de boletas 39. En OpenFactura se piden desde su panel.
6. Copiar la **API key** del panel del proveedor. Es una clave: no se manda por WhatsApp ni correo, se pega solo en re-booking (paso 3 de la Parte 3).
7. Anotar los **datos del emisor tal como figuran en el SII**: RUT, razón social, giro, dirección y comuna.

## Parte 2: lo que hace Pablo (una vez en toda la plataforma)

1. Generar la clave de cifrado. En su Terminal:
   ```bash
   openssl rand -base64 32
   ```
   Debe imprimir una línea de 44 caracteres.
2. En Vercel → Settings → Environment Variables, crear `SECRET_BOX_KEY` con ese valor (Production y Preview). **Respaldar la clave en un gestor de claves**: si se pierde, hay que volver a pegar la API key de cada negocio.
3. Correr en Supabase (primero `rebooking-pruebas`, después producción, con respaldo) el archivo `supabase/migrations/116_sii_por_negocio.sql`. Al final correr la consulta de verificación que trae: debe devolver `0` filas y 2 columnas.
4. Desplegar el código.

## Parte 3: configurar un negocio

1. Entrar como administrador del negocio → Configuración → Boleta electrónica *(pantalla pendiente; mientras tanto se puede guardar con `PUT /api/sii-config`)*.
2. Pegar los datos del emisor (Parte 1, paso 7) y la API key.
3. Dejar el ambiente en **Pruebas (sandbox)**. Activar "Boleta electrónica" y dejar "Emitir automáticamente" apagado.
4. Hacer una venta de prueba en el POS y emitir su boleta. Debe devolver un folio. En sandbox **no tiene valor tributario**.
5. Revisar en el panel del proveedor que la boleta aparezca y que monto, IVA y detalle coincidan.
6. Cuando el SII ya autorizó al negocio y tiene folios reales: cambiar el ambiente a **Producción**, pegar la API key de producción (es distinta de la de pruebas) y emitir una boleta real chica para confirmar.
7. Solo entonces, si se desea, activar "Emitir automáticamente".

## Reglas importantes

- Una venta, una boleta. Si ya se emitió, la ruta responde 409.
- Si el proveedor falla, **la venta no se bloquea**: queda sin boleta y se puede reintentar.
- Anular una boleta en el SII se hace con **nota de crédito** (tipo 61); todavía no está construido. Mientras tanto se anula desde el panel del proveedor.
- Clientes sin RUT: la boleta sale con el RUT genérico 66666666-6 (permitido para boletas).
- El IVA se calcula al 19 % desde el total con IVA incluido (`IVA_RATE` en `src/lib/sii.ts`).

## Falta construir (en este orden)

1. Pantalla de Configuración (formulario + botón "Probar conexión").
2. Botón "Emitir boleta" en el POS y en el detalle de venta; opción automática al cobrar.
3. Nota de crédito para anular; aviso de folios por agotarse.
4. Contrastar el payload con el sandbox real (campos del emisor, formato del PDF, código de pago). Ajustar `src/lib/sii.ts` según lo que responda.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| "Falta aplicar la migración 116" | Pablo corre el SQL 116 |
| "Falta SECRET_BOX_KEY…" | Pablo crea la variable en Vercel (Parte 2) |
| "Faltan datos del emisor…" | Completar los 5 datos en la configuración |
| "No se pudo leer la llave…" | Volver a pegar la API key (cambió `SECRET_BOX_KEY`) |
| Error del proveedor | Leer el mensaje: suele ser folios agotados, emisor no autorizado o RUT mal escrito |

## Parte 4: profesionales por comisión con retención (boleta de honorarios)

La boleta de honorarios **no** la emite re-booking ni el proveedor de boletas: la emite el profesional en el SII con su clave tributaria. re-booking calcula, avisa y registra.

1. Administrador → ficha del profesional → Modalidad de trabajo → **Integración SII**: encender y elegir "Boleta de honorarios, retención 15,25 %". Con retención, la boleta al cliente sale con la cuenta del negocio (no se puede usar la cuenta propia del profesional).
2. Configuración → **Boletas de honorarios**: elegir el mes. Cada profesional muestra cuánto debe emitir, la retención y lo que recibe.
3. **Copiar aviso** y pegarlo en WhatsApp al profesional.
4. Cuando el profesional entregue su boleta: **Registrar boleta recibida** (folio, fecha, monto). Si el monto no coincide con lo esperado queda como "Monto distinto".
5. El resumen del mes suma la retención (esperada y según boletas recibidas) para que el contador la declare. Requiere la migración 119.
