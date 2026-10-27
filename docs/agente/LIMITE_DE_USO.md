BORRADOR — NO EJECUTAR

# T9 — evaluación pura de uso y repetición

**HECHO local:** `evaluarLimiteDeUso` recibe tenant, hashes de contacto/mensaje, historial, ahora y tres reglas explícitas (`src/lib/agente/limite-de-uso.ts:1-18`). Cuenta por tenant/contacto, por tenant completo y por mensaje repetido del mismo contacto (`:39-46`); no devuelve esas referencias, solo motivos/conteos (`:20-24`, `:47-51`). No lee red, base, entorno o reloj ni modifica historial.

**INFERENCIA — contrato técnico:** ventanas `(ahora - ventanaMs, ahora]`; cada máximo es la cantidad admitida incluyendo el mensaje candidato, que aún no está en historial. Si ya hay `max` eventos, el siguiente se bloquea. Máximo cero bloquea; ventana debe ser entera positiva. Sin valores por defecto. Eventos futuros quedan fuera; historial mal formado bloquea toda la evaluación en vez de aparentar cupo libre. Hashes hex de 64 caracteres se comparan sin distinguir mayúsculas; tenant se compara exactamente.

**INFERENCIA — responsabilidades futuras del llamador:** aportar historial entrante completo para todas las ventanas y todos los contactos del tenant, previamente deduplicado y autorizado. La función no puede detectar historial incompleto, identidad falsa o un hash construido sobre texto equivocado. Hash no significa anonimización ni prueba de identidad. No enviar texto original/teléfonos/RUT a esta interfaz.

**INFERENCIA — límites:** dos evaluaciones simultáneas pueden aprobar sobre el mismo historial: no hay reserva atómica, almacenamiento, bloqueo persistente, reintento, alerta o integración de cuota. No confundir esta evaluación con el cupo comercial existente (`src/lib/message-quota.ts:113-145`). Todos los números de las pruebas son fixtures; cantidad, ventanas y duración de bloqueo de producto siguen en pregunta 12 de sección 11. Retener suficiente historial también requiere decisión de plazo y mecanismo, no se decide aquí.

**HECHO — verificación:** 80 comprobaciones sintéticas del script `scripts/test-agente-limite-de-uso.ts:1-65` pasan: bordes, tenant/contacto ajenos, futuro, ceros, inválidos, orden, inmutabilidad y 2.000 eventos. **DESCONOCIDO:** efectividad en una ruta real; no conectado ni probado contra proveedor. T9 espera revisión de Claude y no se mergea autónomamente.
