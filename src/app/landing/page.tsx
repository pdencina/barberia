"use client";

import { useState } from "react";
import {
  Calendar,
  ShoppingCart,
  Users,
  BarChart3,
  Bell,
  Tablet,
  Package,
  CreditCard,
  Heart,
  CheckCircle2,
  ArrowRight,
  Scissors,
  Zap,
  Shield,
  Smartphone,
} from "lucide-react";

const features = [
  { icon: Calendar, title: "Agenda Online 24/7", desc: "Tus clientes agendan desde el celular. Sin llamadas, sin esperas." },
  { icon: ShoppingCart, title: "Punto de Venta", desc: "Cobra servicios y productos con precios editables y multiples metodos de pago." },
  { icon: Bell, title: "Recordatorios Automaticos", desc: "Email y WhatsApp 24h antes de cada cita. Reduce no-shows en un 70%." },
  { icon: Heart, title: "Retencion de Clientes", desc: "Detecta clientes inactivos y notificalos con cupones por WhatsApp o email." },
  { icon: Tablet, title: "TV Recepcion", desc: "Vista en tiempo real de citas del dia. Ideal para tablet o pantalla en tu local." },
  { icon: Users, title: "Base de Clientes", desc: "CRM completo: historial de visitas, contacto, preferencias." },
  { icon: Package, title: "Inventario", desc: "Control de stock, alertas de reposicion, entradas y salidas por barbero." },
  { icon: BarChart3, title: "Reportes & Cierre", desc: "Cierre mensual con desglose por barbero, servicio y metodo de pago." },
  { icon: CreditCard, title: "Cupones & Descuentos", desc: "Crea cupones con % o monto fijo, con usos maximos y fecha limite." },
  { icon: Smartphone, title: "Vista Barbero", desc: "Cada barbero ve su agenda del dia, bloquea horarios y gestiona citas." },
  { icon: Zap, title: "Boletas por Email", desc: "Envia la boleta directamente al cliente despues de cada atencion." },
  { icon: Shield, title: "Multi-rol", desc: "Accesos diferenciados para admin, recepcionista y barbero." },
];

const plans = [
  {
    name: "Starter",
    price: "49.990",
    period: "/mes",
    desc: "Para barberias que empiezan a digitalizarse",
    features: [
      "Agenda online (booking publico)",
      "Hasta 3 barberos",
      "Base de clientes",
      "Recordatorios por email",
      "Punto de Venta basico",
      "Soporte por email",
    ],
    cta: "Empezar Gratis",
    popular: false,
  },
  {
    name: "Pro",
    price: "89.990",
    period: "/mes",
    desc: "Para barberias establecidas que quieren crecer",
    features: [
      "Todo de Starter +",
      "Barberos ilimitados",
      "Recordatorios WhatsApp",
      "Retencion de clientes",
      "Cupones y descuentos",
      "Inventario completo",
      "Cierre mensual",
      "Vista TV recepcion",
      "Boletas por email",
      "Soporte prioritario",
    ],
    cta: "Comenzar Prueba",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "149.990",
    period: "/mes",
    desc: "Para cadenas y multi-sucursal",
    features: [
      "Todo de Pro +",
      "Multi-sucursal",
      "Reportes consolidados",
      "API personalizada",
      "Comisiones por barbero",
      "Integracion con pagos",
      "Dominio personalizado",
      "Onboarding dedicado",
      "Soporte telefonico",
    ],
    cta: "Contactar Ventas",
    popular: false,
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-red-500" />
            <span className="text-xl font-bold">BarberOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#contact" className="hover:text-white transition-colors">Contacto</a>
          </div>
          <a href="/login" className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
            Ingresar
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-red-600/10 border border-red-600/30 rounded-full text-red-400 text-sm mb-6">
            El software #1 para barberias en Chile
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Gestiona tu barberia.
            <br />
            <span className="text-red-500">Sin friccion.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Agenda online, punto de venta, recordatorios automaticos, retencion de clientes
            y reportes — todo en un solo lugar. Hecho para barberias chilenas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#pricing" className="px-8 py-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-lg">
              Ver Planes
            </a>
            <a href="/booking" className="px-8 py-4 border border-gray-700 text-gray-300 font-medium rounded-lg hover:border-red-500 hover:text-white transition-colors text-lg">
              Ver Demo →
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-6">14 dias gratis. Sin tarjeta de credito.</p>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-gray-800 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-center">
          <div>
            <p className="text-3xl font-bold">700+</p>
            <p className="text-sm text-gray-500">Clientes gestionados</p>
          </div>
          <div>
            <p className="text-3xl font-bold">9</p>
            <p className="text-sm text-gray-500">Barberos activos</p>
          </div>
          <div>
            <p className="text-3xl font-bold">24/7</p>
            <p className="text-sm text-gray-500">Booking online</p>
          </div>
          <div>
            <p className="text-3xl font-bold">-70%</p>
            <p className="text-sm text-gray-500">No-shows con recordatorios</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas</h2>
            <p className="text-gray-400 text-lg">Reemplaza Setmore, AgendaPro y planillas de Excel</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-800 hover:border-red-500/50 transition-colors bg-gray-900/50">
                <f.icon className="h-8 w-8 text-red-500 mb-4" />
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Asi funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Cliente agenda", desc: "Desde tu web o link de booking, elige servicio, barbero y hora" },
              { step: "2", title: "Recordatorio", desc: "24h antes recibe email y WhatsApp automatico" },
              { step: "3", title: "Atencion", desc: "La cita aparece en la TV de recepcion y agenda del barbero" },
              { step: "4", title: "Cobro + Boleta", desc: "Cobras en el POS y envias boleta por email al instante" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes simples, sin letra chica</h2>
            <p className="text-gray-400 text-lg">Elige el plan que se adapte a tu barberia</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 border ${
                  plan.popular
                    ? "border-red-500 bg-red-500/5 relative"
                    : "border-gray-800 bg-gray-900/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 text-white text-xs font-bold rounded-full uppercase">
                    Mas Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                    plan.popular
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "border border-gray-700 text-gray-300 hover:border-red-500 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-8">
            Todos los planes incluyen 14 dias de prueba gratis. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-20 px-6 bg-gray-900/50 border-t border-gray-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Listo para digitalizar tu barberia?</h2>
          <p className="text-gray-400 mb-8">
            Deja tu email y te contactamos para configurar tu cuenta en menos de 24 horas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@barberia.com"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
            />
            <button className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 justify-center">
              Empezar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-4">Sin spam. Solo te contactamos una vez.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-red-500" />
            <span className="font-bold">BarberOS</span>
            <span className="text-gray-500 text-sm ml-2">by EstudioLevels</span>
          </div>
          <p className="text-sm text-gray-500">
            2024 BarberOS. Hecho en Chile para barberias latinas.
          </p>
        </div>
      </footer>
    </div>
  );
}
