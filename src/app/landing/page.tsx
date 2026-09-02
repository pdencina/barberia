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
            <img src="/logo-horizontal.png" alt="re-booking" className="h-8 w-auto" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funciones" className="hover:text-brand-blue transition-colors">Funciones</a>
            <a href="#precios" className="hover:text-brand-blue transition-colors">Precios</a>
            <a href="#testimonios" className="hover:text-brand-blue transition-colors">Testimonios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-brand-blue hidden md:block">Iniciar Sesion</Link>
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              href="/signup" className="hidden md:inline-flex px-5 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-full hover:bg-[#0a6b6d] shadow-lg shadow-brand-blue/25">
              Registra tu negocio
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
            <a href="#funciones" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-brand-blue font-medium">Funciones</a>
            <a href="#precios" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-brand-blue font-medium">Precios</a>
            <a href="#testimonios" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-brand-blue font-medium">Testimonios</a>
            <a href="#contacto" onClick={() => setMobileMenu(false)} className="block py-3 text-gray-700 hover:text-brand-blue font-medium">Contacto</a>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link href="/login" className="block w-full text-center py-3 border border-brand-blue text-brand-blue font-semibold rounded-full hover:bg-brand-blue/5">
                Iniciar Sesion
              </Link>
              <a href="/signup" onClick={() => setMobileMenu(false)} className="block w-full text-center py-3 bg-brand-blue text-white font-semibold rounded-full">
                Registra tu negocio
              </a>
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero with parallax */}
      <section ref={heroRef} className="pt-24 pb-16 md:pt-44 md:pb-32 relative min-h-[90vh] md:min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 to-white pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-brand-blue/10 rounded-full blur-3xl" />

        {/* Animated floating shapes - hidden on mobile */}
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute top-32 left-[8%] w-20 h-20 bg-gradient-to-br from-brand-blue/5 to-brand-blue/5 rounded-2xl opacity-40" />
        <motion.div animate={{ y: [0, 15, 0], rotate: [0, -8, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute top-48 right-[10%] w-14 h-14 bg-gradient-to-br from-brand-blue/10 to-brand-blue/20 rounded-full opacity-50" />
        <motion.div animate={{ y: [0, -12, 0], x: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute bottom-32 left-[12%] w-10 h-10 bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 rounded-lg opacity-40 rotate-45" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block absolute bottom-40 right-[18%] w-8 h-8 bg-brand-blue/30 rounded-full" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-blue/5 border border-brand-blue/20 rounded-full text-sm text-brand-blue mb-8">
              <span className="w-2 h-2 bg-brand-blue rounded-full animate-pulse" />
              +700 clientes ya gestionados con re-booking
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Todo tu negocio.
              <br />
              <span className="text-brand-blue">
                <TypeAnimation
                  sequence={["Un solo sistema.", 3000, "Repite el exito.", 3000, "Crece sin limites.", 3000, "Fideliza clientes.", 3000]}
                  wrapper="span"
                  speed={40}
                  repeat={Infinity}
                />
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-4 md:mt-6 text-base md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed px-2">
              El software de gestion todo en uno para agendar, atender, fidelizar
              y hacer crecer tu negocio.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
              className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <motion.a whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(37,99,235,0.3)" }} whileTap={{ scale: 0.95 }}
                href="/signup" className="px-8 py-4 bg-brand-blue text-white font-semibold rounded-full transition-colors hover:bg-[#0a6b6d]">
                Comenzar gratis
              </motion.a>
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                href="#funciones" className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-brand-blue hover:text-brand-blue">
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
                className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-brand-blue/20">
                <p className="text-2xl md:text-3xl font-bold text-brand-blue">{stat.value}</p>
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
            <p className="text-brand-blue font-semibold text-sm uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-5xl font-bold">Todo lo que necesitas,<br /><span className="text-brand-blue">en un solo lugar</span></h2>
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
              { icon: "📅", title: "Agenda inteligente", desc: "Calendario drag & drop con vista por profesional. Crea citas arrastrando, mueve con un click.", gradient: "from-[#0F8B8D] to-[#0a6b6d]", glow: "shadow-[#0F8B8D]/40" },
              { icon: "💳", title: "Punto de Venta", desc: "Cobra con tarjeta, efectivo, transferencia o pagos mixtos. Boleta automatica por email.", gradient: "from-violet-500 to-purple-600", glow: "shadow-purple-500/40" },
              { icon: "📊", title: "Reportes financieros", desc: "Ingresos separados por comision vs arriendo. Utilidad real del salon en tiempo real.", gradient: "from-emerald-500 to-green-600", glow: "shadow-green-500/40" },
              { icon: "👥", title: "Ficha del cliente", desc: "Historial completo, fotos de trabajos, servicios favoritos, notas internas del equipo.", gradient: "from-orange-500 to-amber-600", glow: "shadow-orange-500/40" },
              { icon: "🔔", title: "Recordatorios", desc: "Notificaciones automaticas por email 24h antes de cada cita. Reduce no-shows.", gradient: "from-rose-500 to-pink-600", glow: "shadow-pink-500/40" },
              { icon: "📱", title: "100% Movil", desc: "PWA instalable. Los profesionales gestionan su agenda desde el celular como una app nativa.", gradient: "from-cyan-500 to-teal-600", glow: "shadow-teal-500/40" },
              { icon: "🏷️", title: "Cupones y descuentos", desc: "Crea codigos de descuento, autoriza descuentos manuales con PIN de admin.", gradient: "from-yellow-500 to-orange-600", glow: "shadow-yellow-500/40" },
              { icon: "⭐", title: "Reviews y ranking", desc: "Cada cliente califica su atencion. Ranking interno de profesionales.", gradient: "from-[#0F8B8D] to-[#2EC4B6]", glow: "shadow-[#0F8B8D]/40" },
              { icon: "📦", title: "Inventario", desc: "Control de stock, alertas de bajo inventario, movimientos automaticos al vender.", gradient: "from-slate-500 to-gray-700", glow: "shadow-gray-500/40" },
            ].map((feat) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                whileHover={{ y: -12, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative p-[1px] rounded-2xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 hover:from-[#0F8B8D] hover:via-[#2EC4B6] hover:to-[#0F8B8D] transition-all duration-500 cursor-default"
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

                    <h3 className="mt-5 text-lg font-bold text-gray-900 group-hover:text-brand-blue transition-colors duration-300">{feat.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed group-hover:text-gray-600 transition-colors">{feat.desc}</p>

                    {/* Animated arrow */}
                    <div className="mt-4 flex items-center gap-1 text-brand-blue text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-8px] group-hover:translate-x-0 transition-all duration-300">
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
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 7, repeat: Infinity }} className="absolute top-20 left-10 w-24 h-24 bg-brand-blue/5 rounded-full opacity-30" />
        <motion.div animate={{ y: [0, 15, 0], x: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity }} className="absolute bottom-20 right-14 w-16 h-16 bg-brand-blue/10 rounded-full opacity-40" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <AnimatedSection className="text-center mb-16">
            <p className="text-brand-blue font-semibold text-sm uppercase tracking-wider mb-3">Proceso</p>
            <h2 className="text-3xl md:text-5xl font-bold">En <span className="text-brand-blue">3 pasos</span> estas operando</h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[2px]">
              <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-brand-blue/20 via-brand-blue/10 to-brand-blue/20 origin-left" />
            </div>

            {[
              { icon: "⚡", title: "Configura tu equipo", desc: "Agrega profesionales, define comisiones o arriendo, configura servicios y horarios." },
              { icon: "🚀", title: "Recibe reservas", desc: "Clientes agendan 24/7. El calendario se actualiza en tiempo real para todo el equipo." },
              { icon: "💰", title: "Cobra y fideliza", desc: "POS integrado, boleta por email, puntos de fidelidad y recordatorios automaticos." },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 0.2} className="text-center p-8">
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }}
                  className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-blue to-[#0a6b6d] text-white rounded-3xl flex items-center justify-center text-3xl shadow-xl shadow-brand-blue/30 relative z-10">
                  {item.icon}
                </motion.div>
                <h3 className="mt-8 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">{item.desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods Section */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection className="text-center mb-12">
            <p className="text-brand-blue font-semibold text-sm uppercase tracking-wider mb-3">Medios de pago</p>
            <h2 className="text-3xl md:text-4xl font-bold text-brand-dark">Cobra como quieras,<br /><span className="text-brand-blue">todo integrado</span></h2>
          </AnimatedSection>

          {/* MP Integration highlight */}
          <AnimatedSection delay={0.1}>
            <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm mb-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-[#00B1EA]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-[#00B1EA]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.6 10.2c0-4.4-3.6-6-7.2-6h-7.8c-.6 0-1.2.6-1.2 1.2l-3 16.2c0 .6.4 1 .8 1h4.2l1-6.6v.4c0-.6.6-1.2 1.2-1.2h2.6c5 0 8.8-2 10-7.8-.2-.2 0 .2 0 0 .2-1.4.2-2.4-.6-3.2z"/>
                  </svg>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-bold text-brand-dark">Integración directa con MercadoPago Point</h3>
                  <p className="text-sm text-brand-gray mt-1">Cobra desde el sistema y la máquina se activa sola. Sin doble digitación, sin errores.</p>
                </div>
                <div className="px-4 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-full">CONECTADO</div>
              </div>
            </div>
          </AnimatedSection>

          {/* Payment methods grid */}
          <AnimatedSection delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { name: "Débito", icon: "💳", desc: "Tarjeta débito" },
                { name: "Crédito", icon: "💳", desc: "Visa / Mastercard" },
                { name: "Efectivo", icon: "💵", desc: "Pago en caja" },
                { name: "Transferencia", icon: "🏦", desc: "Banco a banco" },
                { name: "MercadoPago", icon: "📱", desc: "Point Smart" },
                { name: "Mixto", icon: "🔀", desc: "Combina métodos" },
              ].map((m) => (
                <div key={m.name} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md hover:border-brand-blue/30 transition-all">
                  <span className="text-2xl">{m.icon}</span>
                  <p className="text-sm font-bold text-brand-dark mt-2">{m.name}</p>
                  <p className="text-[10px] text-brand-gray mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Trust logos */}
          <AnimatedSection delay={0.3} className="mt-8 text-center">
            <p className="text-xs text-brand-gray mb-4">Compatible con los principales medios de pago de Chile</p>
            <div className="flex items-center justify-center gap-6 opacity-50 grayscale">
              <span className="text-2xl font-bold text-gray-400">VISA</span>
              <span className="text-2xl font-bold text-gray-400">MC</span>
              <span className="text-lg font-bold text-gray-400">Amex</span>
              <span className="text-lg font-bold text-gray-400">MercadoPago</span>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection className="text-center mb-12">
            <p className="text-brand-blue font-semibold text-sm uppercase tracking-wider mb-3">Mira como funciona</p>
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark">Todo lo que necesitas saber<br /><span className="text-brand-blue">en menos de un minuto</span></h2>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="relative rounded-3xl overflow-hidden bg-brand-dark shadow-2xl aspect-video">
              {/* Oti animado. object-contain (no object-cover) para que se vea COMPLETO
                  sin recortarle la cabeza/cuerpo; el fondo oscuro rellena las bandas.
                  Autoplay silenciado + loop para que parezca una animacion viva;
                  playsInline evita que iOS lo abra en pantalla completa. */}
              <video
                className="w-full h-full object-contain"
                autoPlay
                muted
                loop
                playsInline
                controls
                poster="/oti/oti-og-1200x630.png"
              >
                <source src="/video_oti/oti-animado.mp4" type="video/mp4" />
              </video>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-3 gap-6 mt-8">
            {[
              { icon: "⚡", text: "Configura en 5 minutos" },
              { icon: "📱", text: "Funciona en cualquier dispositivo" },
              { icon: "🔒", text: "Datos seguros en la nube" },
            ].map((item) => (
              <div key={item.text} className="text-center">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-xs text-brand-gray mt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="testimonios" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold">Lo que dicen <span className="text-brand-blue">nuestros clientes</span></h2>
          </AnimatedSection>

          <AnimatedSection className="max-w-4xl mx-auto" delay={0.2}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-brand-blue to-[#0a6b6d] rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.08, 0.05] }} transition={{ duration: 5, repeat: Infinity }}
                className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <motion.svg initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                  className="w-10 h-10 text-[#2EC4B6]/80 mb-4" fill="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-[#2EC4B6] text-sm">CEO, cliente re-booking</p>
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
            <h2 className="text-3xl md:text-5xl font-bold">Precios <span className="text-brand-blue">transparentes</span></h2>
            <p className="mt-4 text-gray-600">Sin letra chica. Cancela cuando quieras.</p>
          </AnimatedSection>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {/* Basic */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }} className="p-6 bg-white rounded-3xl border border-gray-200 hover:border-brand-blue/30 transition-colors hover:shadow-lg">
              <h3 className="text-lg font-bold text-brand-dark">Basic</h3>
              <p className="text-xs text-brand-gray mt-1">1 usuario</p>
              <div className="mt-4"><span className="text-3xl font-bold">$8.900</span><span className="text-brand-gray text-sm">/mes</span></div>
              <ul className="mt-5 space-y-2 text-xs text-brand-gray">
                {["Agenda online", "100 WhatsApp/mes", "100 emails marketing", "Reportes basicos", "Informes IA semanales"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-brand-blue font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-6 block text-center py-2.5 border-2 border-brand-blue text-brand-blue font-semibold rounded-full hover:bg-brand-blue/5 transition-colors text-sm">
                Elegir plan
              </motion.a>
            </motion.div>

            {/* Starter */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }} className="p-6 bg-white rounded-3xl border border-gray-200 hover:border-brand-blue/30 transition-colors hover:shadow-lg">
              <h3 className="text-lg font-bold text-brand-dark">Starter</h3>
              <p className="text-xs text-brand-gray mt-1">Hasta 3 usuarios</p>
              <div className="mt-4"><span className="text-3xl font-bold">$29.990</span><span className="text-brand-gray text-sm">/mes</span></div>
              <ul className="mt-5 space-y-2 text-xs text-brand-gray">
                {["Todo de Basic", "Login por profesional", "400 WhatsApp/mes", "500 emails marketing", "Reportes avanzados", "Mensajes masivos", "Fichas del cliente", "Cupones", "POS + Caja", "Fidelizacion"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-brand-blue font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-6 block text-center py-2.5 border-2 border-brand-blue text-brand-blue font-semibold rounded-full hover:bg-brand-blue/5 transition-colors text-sm">
                Elegir plan
              </motion.a>
            </motion.div>

            {/* Pro - highlighted */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }}
              className="p-6 bg-gradient-to-br from-[#0F8B8D] to-[#0a6b6d] rounded-3xl text-white relative shadow-2xl shadow-[#0F8B8D]/30 md:scale-105">
              <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#2EC4B6] text-white text-xs font-bold rounded-full shadow-lg">
                MAS ELEGIDO
              </motion.div>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="text-white/70 text-xs mt-1">Hasta 8 usuarios</p>
              <div className="mt-4"><span className="text-3xl font-bold">$49.990</span><span className="text-white/70 text-sm">/mes</span></div>
              <ul className="mt-5 space-y-2 text-xs text-white/80">
                {["Todo de Starter", "1.000 WhatsApp/mes", "2.000 emails marketing", "Personalizacion colores", "Comisiones + Arriendo", "Facturas", "Inventario", "MercadoPago", "Sucursales: +USD 30/mes"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-[#2EC4B6] font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-6 block text-center py-2.5 bg-white text-[#0F8B8D] font-semibold rounded-full hover:bg-white/90 transition-colors text-sm">
                Elegir plan
              </motion.a>
            </motion.div>

            {/* Enterprise */}
            <motion.div variants={fadeUp} whileHover={{ y: -8 }} className="p-6 bg-white rounded-3xl border border-gray-200 hover:border-brand-blue/30 transition-colors hover:shadow-lg">
              <h3 className="text-lg font-bold text-brand-dark">Enterprise</h3>
              <p className="text-xs text-brand-gray mt-1">Usuarios ilimitados</p>
              <div className="mt-4"><span className="text-3xl font-bold">$189.990</span><span className="text-brand-gray text-sm">/mes</span></div>
              <ul className="mt-5 space-y-2 text-xs text-brand-gray">
                {["Profesionales ilimitados", "Multi-sucursal", "API personalizada", "Soporte dedicado", "Onboarding completo", "SLA 99.9%", "Account Manager", "Modulos a medida", "Backups prioritarios"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-brand-blue font-bold">✓</span> {f}</li>
                ))}
              </ul>
              <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="#contacto"
                className="mt-6 block text-center py-2.5 border-2 border-brand-blue text-brand-blue font-semibold rounded-full hover:bg-brand-blue/5 transition-colors text-sm">
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
              className="bg-gradient-to-br from-brand-blue via-[#0a7a7c] to-[#0F8B8D] rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -right-20 w-60 h-60 border border-white/10 rounded-full" />
              <motion.div animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-10 -left-10 w-40 h-40 border border-white/10 rounded-full" />
              <div className="relative">
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="text-2xl md:text-3xl lg:text-5xl font-bold">Agenda tu demo gratuita</motion.h2>
                <p className="mt-4 text-[#2EC4B6] text-lg max-w-xl mx-auto">
                  En 15 minutos te mostramos como re-booking puede transformar tu negocio.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.a whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }} whileTap={{ scale: 0.95 }}
                    href="https://wa.me/56942666172?text=Hola! Me interesa una demo de re-booking" target="_blank"
                    className="px-8 py-4 bg-white text-brand-blue font-bold rounded-full inline-flex items-center justify-center gap-2 shadow-xl">
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
              <img src="/logo-horizontal.png" alt="re-booking" className="h-6 w-auto" />
            </div>
            <p className="text-sm text-gray-500">Organiza tu negocio. Impulsa tus resultados.</p>
            <p className="text-sm text-gray-400">© 2025 re-booking. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
