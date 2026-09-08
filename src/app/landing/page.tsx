"use client";

import Link from "next/link";

// Single-screen informational landing.
// The full marketing page (features, video, testimonials, pricing) is intentionally
// parked while re-booking isn't open for public sign-up. This page just states what the
// product is and lets the professionals already using the system log in. Public
// registration is not offered here — interested businesses contact Nico directly.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-light flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Soft brand orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-blue/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      <div className="relative w-full max-w-md text-center">
        {/* Logo */}
        <img src="/logo-horizontal.png" alt="re-booking" className="h-12 w-auto mx-auto mb-8" />

        {/* What it is */}
        <h1 className="text-3xl md:text-4xl font-bold text-brand-dark tracking-tight leading-tight">
          Todo tu negocio.<br />
          <span className="text-brand-blue">Un solo sistema.</span>
        </h1>
        <p className="mt-5 text-brand-gray leading-relaxed">
          re-booking es el software de gestión todo en uno para barberías y salones:
          agenda, punto de venta, clientes, pagos y reportes en un mismo lugar.
        </p>

        {/* Login — for the team already using the system */}
        <div className="mt-10 space-y-3">
          <Link
            href="/login"
            className="block w-full py-3.5 bg-brand-blue text-white font-semibold rounded-full hover:bg-[#0a6b6d] transition-colors shadow-lg shadow-brand-blue/25"
          >
            Iniciar sesión
          </Link>
          <p className="text-xs text-brand-gray">Acceso para profesionales que ya usan re-booking</p>
        </div>

        {/* Contact — for anyone interested (no public sign-up) */}
        <div className="mt-10 pt-8 border-t border-gray-200">
          <p className="text-sm text-brand-gray mb-3">¿Quieres re-booking para tu negocio?</p>
          <a
            href="https://wa.me/56984939625?text=Hola! Me interesa saber mas sobre re-booking"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-brand-dark font-medium rounded-full hover:border-brand-blue hover:text-brand-blue transition-colors"
          >
            <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.63-1.218A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.332-.726-6.033-1.96l-.424-.316-2.745.722.734-2.682-.347-.553A9.963 9.963 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
            +56 9 8493 9625
          </a>
        </div>

        <p className="mt-10 text-[11px] text-brand-gray/50">
          © {new Date().getFullYear()} re-booking. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
