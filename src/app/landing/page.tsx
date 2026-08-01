"use client";

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";

// Animated section wrapper
function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger container
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 40, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Spotlight effect: track mouse position on feature cards
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const cards = document.querySelectorAll<HTMLElement>(".group");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mouse-x", `${x}%`);
        card.style.setProperty("--mouse-y", `${y}%`);
      });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* Nav */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.svg whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }} className="w-7 h-7 md:w-8 md:h-8 text-blue-600" viewBox="0 0 32 32" fill="none">
              <path d="M16 4a12 12 0 0 1 12 12h-4a8 8 0 0 0-8-8V4z" fill="currentColor"/>
              <path d="M28 16a12 12 0 0 1-12 12v-4a8 8 0 0 0 8-8h4z" fill="currentColor" opacity="0.7"/>
              <path d="M16 28A12 12 0 0 1 4 16h4a8 8 0 0 0 8 8v4z" fill="currentColor" opacity="0.4"/>
            </motion.svg>
            <span className="text-lg md:text-xl font-bold text-gray-900">re-booking</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funciones" className="hover:text-blue-600 transition-colors">Funciones</a>
            <a href="#precios" className="hover:text-blue-600 transition-colors">Precios</a>
            <a href="#testimonios" className="hover:text-blue-600 transition-colors">Testimonios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 hidden md:block">Iniciar Sesion</Link>
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              href="#contacto" className="hidden md:inline-flex px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 shadow-lg shadow-blue-600/25">
              Agenda una demo
            </motion.a>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-700">
              {mobileMenu ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1"
          >
            <a href="#funciones" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-blue-600 font-medium">Funciones</a>
            <a href="#precios" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-blue-600 font-medium">Precios</a>
            <a href="#testimonios" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-blue-600 font-medium">Testimonios</a>
            <a href="#contacto" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-blue-600 font-medium">Contacto</a>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link href="/login" className="block w-full text-center py-3 border border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50">
                Iniciar Sesion
              </Link>
              <a href="#contacto" onClick={() => setMobileMenu(false)} className="block w-full text-center py-3 bg-blue-600 text-white font-semibold rounded-full">
                Agenda una demo
              </a>
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero with parallax */}
      <section ref={heroRef} className="pt-24 pb-16 md:pt-44 md:pb-32 relative min-h-[90vh] md:min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-blue-400/10 rounded-full blur-3xl" />

        {/* Animated floating shapes - hidden on mobile */}
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute top-32 left-[8%] w-20 h-20 bg-gradient-to-br from-blue-200 to-blue-300 rounded-2xl opacity-40" />
        <motion.div animate={{ y: [0, 15, 0], rotate: [0, -8, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute top-48 right-[10%] w-14 h-14 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-50" />
        <motion.div animate={{ y: [0, -12, 0], x: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute bottom-32 left-[12%] w-10 h-10 bg-gradient-to-br from-cyan-200 to-blue-200 rounded-lg opacity-40 rotate-45" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute bottom-40 right-[18%] w-8 h-8 bg-blue-400 rounded-full" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 mb-8">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              +700 clientes ya gestionados con re-booking
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Gestiona. Reserva.
              <br />
              <span className="text-blue-600">
                <TypeAnimation
                  sequence={["Repite el exito.", 3000, "Crece sin limites.", 3000, "Fideliza clientes.", 3000, "Automatiza todo.", 3000]}
                  wrapper="span"
                  speed={40}
                  repeat={Infinity}
                />
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-4 md:mt-6 text-base md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed px-2">
              El sistema de gestion todo en uno para agendar, atender y fidelizar clientes.
              Diseñado para barberias y salones que quieren crecer.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
              className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <motion.a whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(37,99,235,0.3)" }} whileTap={{ scale: 0.95 }}
                href="#contacto" className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-full transition-colors hover:bg-blue-700">
                Comenzar gratis
              </motion.a>
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                href="#funciones" className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-blue-300 hover:text-blue-600">
                Ver funcionalidades
              </motion.a>
            </motion.div>
          </div>

          {/* Animated counter stats */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: "700+", label: "Clientes gestionados" },
              { value: "$25M", label: "Facturado por mes" },
              { value: "9", label: "Profesionales activos" },
              { value: "99.9%", label: "Uptime garantizado" },
            ].map((stat, i) => (
              <motion.div key={stat.label} whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}
                className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-100">
                <p className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features - staggered cards with hover interactions */}
      <section id="funciones" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-5xl font-bold">Todo lo que necesitas,<br /><span className="text-blue-600">en un solo lugar</span></h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">Modulos integrados que trabajan juntos para que tu negocio funcione sin friccion.</p>
          </AnimatedSection>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { icon: "📅", title: "Agenda inteligente", desc: "Calendario drag & drop con vista por profesional. Crea citas arrastrando, mueve con un click.", gradient: "from-blue-500 to-blue-600", glow: "shadow-blue-500/40" },
              { icon: "💳", title: "Punto de Venta", desc: "Cobra con tarjeta, efectivo, transferencia o pagos mixtos. Boleta automatica por email.", gradient: "from-violet-500 to-purple-600", glow: "shadow-purple-500/40" },
              { icon: "📊", title: "Reportes financieros", desc: "Ingresos separados por comision vs arriendo. Utilidad real del salon en tiempo real.", gradient: "from-emerald-500 to-green-600", glow: "shadow-green-500/40" },
              { icon: "👥", title: "Ficha del cliente", desc: "Historial completo, fotos de cortes, servicios favoritos, notas internas del equipo.", gradient: "from-orange-500 to-amber-600", glow: "shadow-orange-500/40" },
              { icon: "🔔", title: "Recordatorios", desc: "Notificaciones automaticas por email 24h antes de cada cita. Reduce no-shows.", gradient: "from-rose-500 to-pink-600", glow: "shadow-pink-500/40" },
              { icon: "📱", title: "100% Movil", desc: "PWA instalable. Los barberos gestionan su agenda desde el celular como una app nativa.", gradient: "from-cyan-500 to-teal-600", glow: "shadow-teal-500/40" },
              { icon: "🏷️", title: "Cupones y descuentos", desc: "Crea codigos de descuento, autoriza descuentos manuales con PIN de admin.", gradient: "from-yellow-500 to-orange-600", glow: "shadow-yellow-500/40" },
              { icon: "⭐", title: "Reviews y ranking", desc: "Cada cliente califica su atencion. Ranking interno de profesionales.", gradient: "from-indigo-500 to-blue-600", glow: "shadow-indigo-500/40" },
              { icon: "📦", title: "Inventario", desc: "Control de stock, alertas de bajo inventario, movimientos automaticos al vender.", gradient: "from-slate-500 to-gray-700", glow: "shadow-gray-500/40" },
            ].map((feat) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                whileHover={{ y: -12, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative p-[1px] rounded-2xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 hover:from-blue-400 hover:via-blue-200 hover:to-purple-400 transition-all duration-500 cursor-default"
              >
                {/* Inner card */}
                <div className="relative p-6 bg-white rounded-[15px] h-full overflow-hidden">
                  {/* Spotlight effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(600px_circle_at_var(--mouse-x,50%)_var(--mouse-y,0%),rgba(37,99,235,0.06),transparent_40%)]" />

                  <div className="relative">
                    {/* Icon with glow */}
                    <motion.div whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.15 }} transition={{ duration: 0.5 }}
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center text-2xl shadow-xl ${feat.glow} group-hover:shadow-2xl transition-shadow duration-300`}>
                      {feat.icon}
                    </motion.div>

                    <h3 className="mt-5 text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">{feat.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed group-hover:text-gray-600 transition-colors">{feat.desc}</p>

                    {/* Animated arrow */}
                    <div className="mt-4 flex items-center gap-1 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-8px] group-hover:translate-x-0 transition-all duration-300">
                      Explorar
                      <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works - with animated connecting line */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 7, repeat: Infinity }} className="absolute top-20 left-10 w-24 h-24 bg-blue-100 rounded-full opacity-30" />
        <motion.div animate={{ y: [0, 15, 0], x: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity }} className="absolute bottom-20 right-14 w-16 h-16 bg-indigo-100 rounded-full opacity-40" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <AnimatedSection className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-3">Proceso</p>
            <h2 className="text-3xl md:text-5xl font-bold">En <span className="text-blue-600">3 pasos</span> estas operando</h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[2px]">
              <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 origin-left" />
            </div>

            {[
              { icon: "⚡", title: "Configura tu equipo", desc: "Agrega profesionales, define comisiones o arriendo, configura servicios y horarios." },
              { icon: "🚀", title: "Recibe reservas", desc: "Clientes agendan 24/7. El calendario se actualiza en tiempo real para todo el equipo." },
              { icon: "💰", title: "Cobra y fideliza", desc: "POS integrado, boleta por email, puntos de fidelidad y recordatorios automaticos." },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 0.2} className="text-center p-8">
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }}
                  className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl flex items-center justify-center text-3xl shadow-xl shadow-blue-600/30 relative z-10">
                  {item.icon}
                </motion.div>
                <h3 className="mt-8 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">{item.desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="testimonios" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold">Lo que dicen <span className="text-blue-600">nuestros clientes</span></h2>
          </AnimatedSection>

          <AnimatedSection className="max-w-4xl mx-auto" delay={0.2}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.08, 0.05] }} transition={{ duration: 5, repeat: Infinity }}
                className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <motion.svg initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                  className="w-10 h-10 text-blue-300 mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </motion.svg>
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
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold">Precios <span className="text-blue-600">transparentes</span></h2>
            <p className="mt-4 text-gray-600">Sin letra chica. Cancela cuando quieras.</p>
          </AnimatedSection>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }} className="p-8 bg-white rounded-3xl border border-gray-200 hover:border-blue-200 transition-colors hover:shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Starter</h3>
              <p className="text-sm text-gray-500 mt-1">Para negocios que empiezan</p>
              <div className="mt-6"><span className="text-4xl font-bold">$49.990</span><span className="text-gray-500">/mes</span></div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {["Hasta 3 profesionales", "Agenda online", "POS basico", "Recordatorios email", "App movil (PWA)"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-blue-600 font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-8 block text-center py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Elegir plan
              </motion.a>
            </motion.div>

            {/* Pro */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }}
              className="p-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl text-white relative shadow-2xl shadow-blue-600/30 md:scale-105">
              <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow-lg">
                MAS POPULAR
              </motion.div>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="text-blue-200 text-sm mt-1">Para barberias establecidas</p>
              <div className="mt-6"><span className="text-4xl font-bold">$89.990</span><span className="text-blue-200">/mes</span></div>
              <ul className="mt-6 space-y-3 text-sm text-blue-100">
                {["Hasta 10 profesionales", "Todo de Starter", "Comisiones + Arriendo", "MercadoPago multi-terminal", "Reportes avanzados", "Fidelizacion + Cupones", "Fotos de corte"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-white font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-8 block text-center py-3 bg-white text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Elegir plan
              </motion.a>
            </motion.div>

            {/* Enterprise */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }} className="p-8 bg-white rounded-3xl border border-gray-200 hover:border-blue-200 transition-colors hover:shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Enterprise</h3>
              <p className="text-sm text-gray-500 mt-1">Multi-sucursal y personalizado</p>
              <div className="mt-6"><span className="text-4xl font-bold">Custom</span></div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {["Profesionales ilimitados", "Multi-sucursal", "API personalizada", "Soporte dedicado", "Onboarding completo", "SLA 99.9%"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-blue-600 font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-8 block text-center py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors">
                Contactar ventas
              </motion.a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section id="contacto" className="py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedSection>
            <motion.div whileHover={{ scale: 1.01 }}
              className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -right-20 w-60 h-60 border border-white/10 rounded-full" />
              <motion.div animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-10 -left-10 w-40 h-40 border border-white/10 rounded-full" />
              <div className="relative">
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="text-2xl md:text-3xl lg:text-5xl font-bold">Agenda tu demo gratuita</motion.h2>
                <p className="mt-4 text-blue-200 text-lg max-w-xl mx-auto">
                  En 15 minutos te mostramos como re-booking puede transformar tu barberia.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.a whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }} whileTap={{ scale: 0.95 }}
                    href="https://wa.me/56942666172?text=Hola! Me interesa una demo de re-booking" target="_blank"
                    className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full inline-flex items-center justify-center gap-2 shadow-xl">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.63-1.218A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.332-.726-6.033-1.96l-.424-.316-2.745.722.734-2.682-.347-.553A9.963 9.963 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    WhatsApp
                  </motion.a>
                  <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    href="mailto:contacto@rebooking.cl"
                    className="px-8 py-4 text-white font-bold rounded-full border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all inline-flex items-center justify-center">
                    contacto@rebooking.cl
                  </motion.a>
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
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
