# re-booking — Landing page

## Archivos
- `Landing re-booking.dc.html` — la landing completa (HTML + CSS inline + JS).
- `support.js` — runtime necesario para renderizar el archivo. Debe estar junto al HTML.
- `assets/` — imágenes (logo, Oti, Mercado Pago).

## Cómo verlo
Servir la carpeta con cualquier servidor estático y abrir el HTML:

    npx serve .

(Abrir el archivo con doble clic también funciona en la mayoría de los navegadores.)

## Integración
Todo el markup vive entre las etiquetas `<x-dc>` y `</x-dc>`, y la lógica en el
`<script data-dc-script>` del final. Los estilos están inline en cada elemento;
las `@keyframes`, fuentes y resets están en el bloque `<helmet><style>` al inicio.

Para portarlo al sitio definitivo:
1. Copiar `assets/` al proyecto y ajustar las rutas `assets/...` si cambian.
2. Mover el contenido del `<helmet><style>` a la hoja de estilos global (o a un
   `<style>` en el `<head>`), incluidos los `<link>` de Google Fonts.
3. Trasladar el markup a componentes del framework que usen. Los estilos inline se
   copian tal cual; los atributos `style-hover` corresponden a `:hover`.
4. La lógica del `<script data-dc-script>` contiene los observers de scroll
   (revelados, contadores, barras) y los estados de UI (FAQ, selector mensual/anual).

## Pendientes para el desarrollador
- Conectar los CTA de planes con la pasarela de pago (Mercado Pago).
- Reemplazar las métricas de prueba social por datos reales.
- Definir URLs reales del footer (términos, privacidad, login, redes).
