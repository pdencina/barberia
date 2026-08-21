"use client";

import { useState, useEffect } from "react";

interface BarberRank {
  id: string;
  name: string;
  avatarUrl: string | null;
  avgRating: number;
  totalReviews: number;
  totalAppointments: number;
  topServices: string[];
  recentReviews: Array<{
    rating: number;
    comment: string | null;
    clientName: string;
    date: string;
  }>;
}

function Stars({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  return (
    <span className={sizeClass}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(rating) ? "text-yellow-400" : "text-gray-600"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function RankingPage() {
  const [barbers, setBarbers] = useState<BarberRank[]>([]);
  const [selected, setSelected] = useState<BarberRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/reviews")
      .then((r) => r.json())
      .then((data) => setBarbers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 py-4 px-6 text-center">
        <img src="/logo-horizontal.png" alt="re-booking" className="h-10 mx-auto" />
        <p className="text-xs text-red-500 uppercase tracking-widest mt-2">Nuestro Equipo</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-2">Ranking de Profesionales</h1>
        <p className="text-gray-400 text-center mb-10">Calificados por nuestros clientes</p>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : (
          <div className="space-y-4">
            {barbers.map((barber, index) => (
              <div
                key={barber.id}
                onClick={() => setSelected(selected?.id === barber.id ? null : barber)}
                className={`rounded-xl border transition-all cursor-pointer ${
                  index === 0 ? "border-yellow-500/50 bg-yellow-500/5" :
                  index === 1 ? "border-gray-400/30 bg-gray-400/5" :
                  index === 2 ? "border-orange-600/30 bg-orange-600/5" :
                  "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                }`}
              >
                <div className="p-5 flex items-center gap-4">
                  {/* Position */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    index === 0 ? "bg-yellow-500 text-black" :
                    index === 1 ? "bg-gray-400 text-black" :
                    index === 2 ? "bg-orange-600 text-white" :
                    "bg-gray-800 text-gray-400"
                  }`}>
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-400">
                    {barber.name.split(" ").map((n) => n[0]).join("")}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-bold text-lg">{barber.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={barber.avgRating} size="sm" />
                      <span className="text-sm text-gray-400">
                        {barber.avgRating > 0 ? barber.avgRating.toFixed(1) : "Sin reviews"}
                      </span>
                      <span className="text-xs text-gray-600">({barber.totalReviews} reviews)</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right hidden md:block">
                    <p className="text-2xl font-bold">{barber.totalAppointments}</p>
                    <p className="text-xs text-gray-500">atenciones</p>
                  </div>
                </div>

                {/* Expanded details */}
                {selected?.id === barber.id && (
                  <div className="border-t border-gray-800 p-5 space-y-4">
                    {/* Top services */}
                    {barber.topServices.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-2">Especialidades</p>
                        <div className="flex flex-wrap gap-2">
                          {barber.topServices.map((s) => (
                            <span key={s} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent reviews */}
                    {barber.recentReviews.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-2">Ultimas Reviews</p>
                        <div className="space-y-2">
                          {barber.recentReviews.map((r, i) => (
                            <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Stars rating={r.rating} size="sm" />
                                <span className="text-xs text-gray-500">{r.clientName}</span>
                              </div>
                              {r.comment && <p className="text-sm text-gray-300">{r.comment}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Book CTA */}
                    <a
                      href="/booking"
                      className="block w-full py-3 bg-red-600 text-white text-center font-bold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Agendar con {barber.name.split(" ")[0]}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
        re-booking · rebooking.cl
      </div>
    </div>
  );
}
