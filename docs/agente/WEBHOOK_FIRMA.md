BORRADOR — NO EJECUTAR

# T8 — verificador genérico HMAC, sin webhook

**DESCONOCIDO — Meta, consulta 2026-10-26:** https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads devolvió HTTP 429. No se verificaron cabecera exacta, secreto exigido ni proceso específico de Meta. No atribuir esta función genérica a una integración Meta validada; resolver R4 antes de conectar.

**HECHO externo — Node, consulta 2026-10-26:** https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptotimingsafeequala-b describe comparación de bytes en tiempo constante y exige igual longitud. Cita corta: “using a constant-time algorithm”. El documento advierte que eso no garantiza que el código circundante sea seguro en tiempo. Se valida formato/longitud primero; solo la comparación de los digests usa esa primitiva. No se afirma tiempo constante para todas las entradas inválidas.

**HECHO externo — vector público, consulta 2026-10-26:** https://www.rfc-editor.org/rfc/rfc4231#section-4.2 y sección 4.3 publican vectores HMAC-SHA256 usados en la prueba; no son secretos reales.

**INFERENCIA — contrato solicitado:** aceptar prefijo literal `sha256=` y 64 hexadecimales (hex admite mayúsculas/minúsculas; prefijo no); cuerpo crudo string UTF8 o bytes, secreto no vacío recibido como parámetro. No normalizar JSON ni Unicode. Devuelve booleano y no registra entradas. Secreto ausente/formato inválido/error criptográfico: false. Cuerpo vacío puede ser matemáticamente válido con su firma; no autoriza aceptar un evento vacío como solicitud del negocio.

**INFERENCIA — límites:** no resuelve identidad, tenant, replay, tamaño de petición, autorización, retención, claves ni transporte. Un payload firmado puede repetirse. Es una función pura sin ruta, entorno, reloj o red; no conecta nada ni activa procesamiento. El límite de cuerpo operativo sigue por definir; 2 MiB en pruebas es un caso sintético, no un umbral de producto. **HECHO local:** implementación y pruebas en `src/lib/agente/webhook-firma.ts` y `scripts/test-agente-webhook-firma.ts`; revisión de Claude obligatoria antes de merge.
