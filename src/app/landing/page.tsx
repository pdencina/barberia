"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function LandingPage() {
  // Intersection observer for scroll animations
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-8 h-8 text-blue-600" viewBox="0 0 32 32" fill="none">
              <path d="M16 4a12 12 0 0 1 12 12h-4a8 8 0 0 0-8-8V4z" fill="currentColor"/>
              <path d="M28 16a12 12 0 0 1-12 12v-4a8 8 0 0 0 8-8h4z" fill="currentColor" opacity="0.7"/>
              <path d="M16 28A12 12 0 0 1 4 16h4a8 8 0 0 0 8 8v4z" fill="currentColor" opacity="0.4"/>
            </svg>
            <span className="text-xl font-bold text-gray-900">re-booking</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funciones" className="hover:text-blue-600 transition-colors">Funciones</a>
            <a href="#precios" className="hover:text-blue-600 transition-colors">Precios</a>
            <a href="#testimonios" className="hover:text-blue-600 transition-colors">Testimonios</a>
            <a href="#contacto" className="hover:text-blue-600 transition-colors">Contacto</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden md:block">
              Iniciar Sesion
            </Link>
            <a href="#contacto" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-600/25 active:scale-95">
              Agenda una demo
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-32 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 mb-8 animate-fade-in-up">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              +700 clientes ya gestionados con re-booking
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] animate-fade-in-up animation-delay-100">
              Gestiona. Reserva.
              <br />
              <span className="text-blue-600">Repite el exito.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
              El sistema de gestion todo en uno para agendar, atender y fidelizar clientes.
              Diseñado para barberias y salones que quieren crecer.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
              <a href="#contacto" className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-all hover:shadow-xl hover:shadow-blue-600/25 hover:-translate-y-0.5 active:scale-95">
                Comenzar gratis
              </a>
              <a href="#funciones" className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-all hover:-translate-y-0.5">
                Ver funcionalidades
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-in-up animation-delay-400">
            {[
              { value: "700+", label: "Clientes gestionados" },
              { value: "$25M", label: "Facturado por mes" },
              { value: "9", label: "Profesionales activos" },
              { value: "99.9%", label: "Uptime garantizado" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-5xl font-bold">Todo lo que necesitas,<br /><span className="text-blue-600">en un solo lugar</span></h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">Modulos integrados que trabajan juntos para que tu negocio funcione sin friccion.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "📅", title: "Agenda inteligente", desc: "Calendario drag & drop con vista por profesional. Crea citas arrastrando, mueve con un click." },
              { icon: "💳", title: "Punto de Venta", desc: "Cobra con tarjeta, efectivo, transferencia o pagos mixtos. Boleta automatica por email." },
              { icon: "📊", title: "Reportes financieros", desc: "Ingresos separados por comision vs arriendo. Utilidad real del salon en tiempo real." },
              { icon: "👥", title: "Ficha del cliente", desc: "Historial completo, fotos de cortes, servicios favoritos, notas internas del equipo." },
              { icon: "🔔", title: "Recordatorios", desc: "Notificaciones automaticas por email 24h antes de cada cita. Reduce no-shows." },
              { icon: "📱", title: "100% Movil", desc: "PWA instalable. Los barberos gestionan su agenda desde el celular como una app nativa." },
              { icon: "🏷️", title: "Cupones y descuentos", desc: "Crea codigos de descuento, autoriza descuentos manuales con PIN de admin." },
              { icon: "⭐", title: "Reviews y ranking", desc: "Cada cliente califica su atencion. Ranking interno de profesionales." },
              { icon: "📦", title: "Inventario", desc: "Control de stock, alertas de bajo inventario, movimientos automaticos al vender." },
            ].map((feat, i) => (
              <div key={feat.title} className="reveal group p-6 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300 hover:-translate-y-1" style={{ transitionDelay: `${i * 50}ms` }}>
                <span className="text-3xl">{feat.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{feat.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase / How it works */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-5xl font-bold">Asi funciona <span className="text-blue-600">re-booking</span></h2>
            <p className="mt-4 text-gray-600">En 3 simples pasos tu negocio esta operando al maximo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Configura tu equipo", desc: "Agrega tus profesionales, define comisiones o arriendo, configura servicios y horarios." },
              { step: "02", title: "Recibe reservas", desc: "Tus clientes agendan online 24/7. El calendario se actualiza en tiempo real para todo el equipo." },
              { step: "03", title: "Cobra y fideliza", desc: "Punto de venta integrado, boleta por email, puntos de fidelidad y recordatorios automaticos." },
            ].map((item, i) => (
              <div key={item.step} className="reveal text-center p-8" style={{ transitionDelay: `${i * 150}ms` }}>
                <div className="w-16 h-16 mx-auto bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-600/25">
                  {item.step}
                </div>
                <h3 className="mt-6 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonial */}
      <section id="testimonios" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-5xl font-bold">Lo que dicen <span className="text-blue-600">nuestros clientes</span></h2>
          </div>

          <div className="max-w-4xl mx-auto reveal">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <svg className="w-10 h-10 text-blue-300 mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
                <p className="text-lg md:text-2xl leading-relaxed font-light">
                  Con re-booking dejamos de perder citas y de anotar en cuadernos. Ahora todo el equipo sabe que tiene agendado,
                  los clientes reciben recordatorio y la caja cuadra sola al final del dia.
                </p>
                <div className="mt-8 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">N</div>
                  <div>
                    <p className="font-bold">Nicolas Levels</p>
                    <p className="text-blue-200 text-sm">CEO EstudioLevels — Puente Alto</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-5xl font-bold">Precios <span className="text-blue-600">transparentes</span></h2>
            <p className="mt-4 text-gray-600">Sin letra chica. Cancela cuando quieras.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="reveal p-8 bg-white rounded-3xl border border-gray-200 hover:border-blue-200 transition-all hover:shadow-lg">
              <h3 className="text-lg font-bold text-gray-900">Starter</h3>
              <p className="text-sm text-gray-500 mt-1">Para negocios que empiezan</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">$49.990</span>
                <span className="text-gray-500">/mes</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Hasta 3 profesionales</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Agenda online</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> POS basico</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Recordatorios email</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> App movil (PWA)</li>
              </ul>
              <a href="#contacto" className="mt-8 block text-center py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Elegir plan
              </a>
            </div>

            {/* Pro - highlighted */}
            <div className="reveal p-8 bg-blue-600 rounded-3xl text-white relative shadow-xl shadow-blue-600/25 scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                MAS POPULAR
              </div>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="text-blue-200 text-sm mt-1">Para barberias establecidas</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">$89.990</span>
                <span className="text-blue-200">/mes</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-blue-100">
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Hasta 10 profesionales</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Todo de Starter</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Comisiones + Arriendo</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> MercadoPago multi-terminal</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Reportes avanzados</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Fidelizacion + Cupones</li>
                <li className="flex items-center gap-2"><span className="text-white">✓</span> Fotos de corte + Galeria</li>
              </ul>
              <a href="#contacto" className="mt-8 block text-center py-3 bg-white text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Elegir plan
              </a>
            </div>

            {/* Enterprise */}
            <div className="reveal p-8 bg-white rounded-3xl border border-gray-200 hover:border-blue-200 transition-all hover:shadow-lg">
              <h3 className="text-lg font-bold text-gray-900">Enterprise</h3>
              <p className="text-sm text-gray-500 mt-1">Multi-sucursal y personalizado</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Profesionales ilimitados</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Multi-sucursal</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> API personalizada</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Soporte dedicado</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> Onboarding completo</li>
                <li className="flex items-center gap-2"><span className="text-blue-600">✓</span> SLA 99.9%</li>
              </ul>
              <a href="#contacto" className="mt-8 block text-center py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Contactar ventas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contacto" className="py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="reveal bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wLTE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold">Agenda tu demo gratuita</h2>
              <p className="mt-4 text-blue-200 text-lg max-w-xl mx-auto">
                En 15 minutos te mostramos como re-booking puede transformar la operacion de tu barberia.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://wa.me/56942666172?text=Hola! Me interesa una demo de re-booking"
                  target="_blank"
                  className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full hover:bg-blue-50 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 inline-flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.63-1.218A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.332-.726-6.033-1.96l-.424-.316-2.745.722.734-2.682-.347-.553A9.963 9.963 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </a>
                <a href="mailto:contacto@rebooking.cl"
                  className="px-8 py-4 bg-transparent text-white font-bold rounded-full border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-2">
                  contacto@rebooking.cl
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 32 32" fill="none">
                <path d="M16 4a12 12 0 0 1 12 12h-4a8 8 0 0 0-8-8V4z" fill="currentColor"/>
                <path d="M28 16a12 12 0 0 1-12 12v-4a8 8 0 0 0 8-8h4z" fill="currentColor" opacity="0.7"/>
                <path d="M16 28A12 12 0 0 1 4 16h4a8 8 0 0 0 8 8v4z" fill="currentColor" opacity="0.4"/>
              </svg>
              <span className="font-bold text-gray-900">re-booking</span>
            </div>
            <p className="text-sm text-gray-500">Organiza tu negocio. Impulsa tus resultados.</p>
            <p className="text-sm text-gray-400">© 2025 re-booking. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
