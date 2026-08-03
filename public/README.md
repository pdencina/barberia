# re-booking — Brand Kit

Color principal: **Teal** `#0D4E4D`
Tipografía del wordmark: **Poppins Medium**

## Contenido del paquete

- `logo-horizontal.svg` / `logo-horizontal@2x.png` — logo completo (ícono + texto), fondo transparente
- `logo-horizontal-white.svg` / `logo-horizontal-white@2x.png` — versión blanca, para fondos oscuros/teal
- `icon-master.svg` — ícono solo (color), vectorial, escalable a cualquier tamaño
- `icon-white.svg` / `icon-white-512.png` — ícono solo en blanco
- `icon-maskable.svg` / `maskable-icon-512.png` — ícono con fondo sólido y zona segura (Android/PWA)
- `favicon.ico` — multi-resolución (16/32/48px)
- `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`
- `icon-{16..512}x{16..512}.png` — set completo de tamaños sueltos
- `og-image.png` (1200x630) — imagen para redes sociales / WhatsApp / meta tags
- `site.webmanifest` — manifest PWA listo para usar

## Cómo instalarlo en tu sitio (Next.js / HTML)

1. Copia estos archivos a tu carpeta `public/`.
2. Agrega esto en el `<head>` (o en `app/layout.tsx` con el objeto `metadata` si usas Next.js App Router):

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0D4E4D">

<!-- Open Graph / WhatsApp / redes sociales -->
<meta property="og:image" content="https://tu-dominio.cl/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

### Next.js App Router (alternativa recomendada)
Next.js detecta automáticamente estos nombres si los pones en `app/`:
- `app/favicon.ico`
- `app/icon.png` (usa `icon-512x512.png`, renómbralo a `icon.png`)
- `app/apple-icon.png` (usa `apple-touch-icon.png`, renómbralo)

No necesitas los `<link>` manuales si usas esta convención.

## Notas
- El ícono es 100% vectorial (SVG), así que puedes escalarlo a cualquier tamaño sin perder calidad — úsalo para imprimir tarjetas, merchandising, etc.
- Si necesitas el isotipo en otro color (ej. para fondo de otro tono), dime el HEX y te genero la variante.
