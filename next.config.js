/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enlace pedido: /alumnos-Levels (también funciona en minúsculas).
  async rewrites() {
    return [{ source: "/alumnos-levels", destination: "/alumnos-Levels" }];
  },
};

module.exports = nextConfig;
