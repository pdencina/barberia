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
  RefreshCw,
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
  { icon: Smartphone, title: "Vista Profesional", desc: "Cada profesional ve su agenda del dia, bloquea horarios y gestiona citas." },
  { icon: Zap, title: "Boletas por Email", desc: "Envia la boleta directamente al cliente despues de cada atencion." },
  { icon: Shield, title: "Multi-rol", desc: "Accesos diferenciados para admin, recepcionista y profesional." },
];

const plans = [
  {
    name: "Starter",
    price: "49.990",
    period: "/mes",
    desc: "Para negocios que empiezan a digitalizarse",
    features: [
      "Agenda online (booking publico)",
      "Hasta 3 profesionales",
      "Base de clientes",
      "Recordatorios por email",
      "Punto de Venta basico",
      "Soporte por email",
    ],
    cta: "Comenzar Gratis",
    popular: false,
  },
  {
    name: "Pro",
    price: "89.990",
    period: "/mes",
    desc: "Para negocios establecidos que quieren crecer",
    features: [
      "Todo de Starter +",
      "Profesionales ilimitados",
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
      "Comisiones por profesional",
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
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="border-b border-gray-100 py-4 px-6 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">re-booking</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-blue-600 transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Precios</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contacto</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-600 hover:text-blue-600 hidden sm:block">
              Ingresar
            </a>
            <a href="#contact" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              Agenda una demo
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-gray-900">
            Gestiona. Reserva.
            <br />
            <span className="text-blue-600">Repite el exito.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            El sistema de gestion todo en uno para agendar, atender y fidelizar clientes.
            Hecho para barberias, salones y clinicas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#contact" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-blue-600/20">
              Comenzar gratis
            </a>
            <a href="#features" className="px-8 py-4 border border-gray-200 text-gray-600 font-medium rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors text-lg">
              Ver funcionalidades
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-6">14 dias gratis · Sin tarjeta de credito · Cancela cuando quieras</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 py-10 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">700+</p>
            <p className="text-sm text-gray-500 mt-1">Clientes gestionados</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-600">24/7</p>
            <p className="text-sm text-gray-500 mt-1">Reservas online</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-600">-70%</p>
            <p className="text-sm text-gray-500 mt-1">Menos no-shows</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-600">+35%</p>
            <p className="text-sm text-gray-500 mt-1">Retencion de clientes</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-gray-500 text-lg">Reemplaza Setmore, AgendaPro y las planillas de Excel</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all bg-white">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Asi de simple funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Cliente reserva", desc: "Desde tu web o link, elige servicio, profesional y hora" },
              { step: "2", title: "Recordatorio", desc: "24h antes recibe email y WhatsApp automatico" },
              { step: "3", title: "Atencion", desc: "La cita aparece en recepcion y en la agenda del profesional" },
              { step: "4", title: "Cobro + Boleta", desc: "Cobras en el POS y envias boleta al instante" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold mb-2 text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
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
            <p className="text-gray-500 text-lg">Elige el plan que se adapte a tu negocio</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 ${
                  plan.popular
                    ? "border-blue-600 relative shadow-xl shadow-blue-600/10"
                    : "border-gray-100"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    Mas Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                      : "border-2 border-gray-200 text-gray-700 hover:border-blue-600 hover:text-blue-600"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            Todos los planes incluyen 14 dias de prueba gratis. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl text-gray-700 italic mb-6">
            "Antes usabamos Setmore y pagabamos $480.000 al año. Con re-booking tenemos mas funcionalidades, 
            soporte local y nuestros datos son nuestros. Los clientes agendan mas facil y los no-shows bajaron un 70%."
          </p>
          <div>
            <p className="font-bold text-gray-900">EstudioLevels</p>
            <p className="text-sm text-gray-500">Barberia Premium · Puente Alto · 700+ clientes</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Listo para organizar tu negocio?</h2>
          <p className="text-gray-500 mb-8">
            Deja tu email y te contactamos para configurar tu cuenta en menos de 24 horas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@negocio.com"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center shadow-lg shadow-blue-600/20">
              Empezar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">Sin spam. Solo te contactamos una vez.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-gray-900">re-booking</span>
          </div>
          <p className="text-sm text-gray-400">
            2024 re-booking. Hecho en Chile.
          </p>
        </div>
      </footer>
    </div>
  );
}
