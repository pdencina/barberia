/** @type {import('next').NextConfig} */
const nextConfig = {
  // El agente de WhatsApp lee archivos (malla del curso) desde el disco: hay que incluirlos en la función del webhook.
  experimental: { outputFileTracingIncludes: { "/api/agente/whatsapp/webhook": ["./src/lib/agente/archivos/**/*"] } },
};

module.exports = nextConfig;
