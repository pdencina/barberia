# Píxel de Meta en re-booking: guía para Nico

## Qué se mide (todo APAGADO hasta que cargues el número del Píxel)
| Dónde | Evento | Cuándo |
|---|---|---|
| `/landing` y `/suscribirse` | PageView, ViewContent | alguien entra (solo si aceptó cookies) |
| `/landing` | Lead | clic en "Elegir plan" |
| `/landing` | Contact | clic en WhatsApp |
| `/suscribirse` | InitiateCheckout | "Continuar al pago" (también desde el servidor) |
| `/suscripcion/resultado` | Purchase y CompleteRegistration | pago aprobado y cuenta creada |
| Servidor (webhook de pago) | Purchase (CAPI) | cuando se crea el negocio; mismo id que el navegador, Meta la cuenta una sola vez |

Cada alta guarda de qué campaña vino (`utm_campaign`, `fbclid`...) y se ve en **Super Admin → Campañas**.
Correo y teléfono viajan SOLO como huella SHA-256 y SOLO desde el servidor. Nunca datos de salud ni notas.
Las páginas de reserva de cada negocio (`/b/...`) NO llevan este Píxel (sería mezclar clientes de otros negocios). Su origen ya se mide con la migración 112.

## Pasos
1. En Meta, abre **business.facebook.com → Administrador de eventos → Conectar orígenes de datos → Web → Píxel de Meta**. Ponle nombre "re-booking" y crea. Copia el **ID del Píxel** (solo números).
2. En ese Píxel: **Configuración → API de Conversiones → Generar token de acceso**. Guárdalo en tu gestor de claves. **No lo pegues en el chat.**
3. En **Vercel → Settings → Environment Variables**, marca SOLO **Preview** y crea:
   - `NEXT_PUBLIC_META_PIXEL_ID` = ID del Píxel
   - `META_PIXEL_ID` = el mismo ID
   - `META_CAPI_ACCESS_TOKEN` = el token del paso 2
   - `META_CAPI_TEST_CODE` = el código de la pestaña **Probar eventos** (tipo `TEST12345`), solo mientras pruebas
4. Corre la migración `supabase/migrations/149_atribucion_suscripciones.sql` en **rebooking-pruebas** (SQL Editor, pegar, Run; debe salir 1 fila `ad_attribution`). En producción solo con respaldo y tu OK.
5. Redespliega el Preview de la rama `claude/meta-pixel`.
6. Abre el Preview con un link de prueba: `.../landing?utm_source=meta&utm_medium=paid&utm_campaign=prueba-pixel`. Acepta las cookies.
7. En Meta, **Administrador de eventos → Probar eventos**: pega la URL del Preview y revisa que aparezcan PageView y ViewContent. En Chrome, la extensión **Meta Pixel Helper** debe mostrar el Píxel en verde.
8. Entra a `/suscribirse` y llega hasta Mercado Pago: debe aparecer InitiateCheckout (navegador y servidor, con la etiqueta "Deduplicado").
9. Al pagar de prueba: Purchase y CompleteRegistration. Mira **Super Admin → Campañas**: debe salir "prueba-pixel".
10. Cuando todo esté bien: quita `META_CAPI_TEST_CODE` y repite las variables en **Production**.

## Links de anuncios
Usa en Meta Ads → Anuncio → Parámetros de URL: `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&utm_id={{campaign.id}}`

## Para después
- Píxel propio por negocio con evento Schedule en sus reservas (requiere columna en `tenants` y pantalla en Configuración).
- Política de privacidad: mencionar Meta/cookies antes de activar en producción (`/privacidad` sigue tras `NEXT_PUBLIC_LEGAL_PAGES_ENABLED`).
