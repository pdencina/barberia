"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { applyColorTheme, clearColorTheme, isAppTheme, isDarkTheme } from "@/lib/themes";

export default function ReviewPage() {
  const params = useParams();
  const appointmentId = params.id as string;
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Si el negocio activó "colores para tus clientes", esta página usa su tema; si no, se ve como siempre (oscura con rojo).
  const [themed, setThemed] = useState(false);
  const [oscuro, setOscuro] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/public/review-info?id=${encodeURIComponent(appointmentId)}`).then((r) => r.json()).then((d) => {
      if (!vivo) return;
      if (d?.business_name) setBusinessName(d.business_name);
      if (isAppTheme(d?.color_theme)) { applyColorTheme(document.documentElement, d.color_theme); setThemed(true); setOscuro(isDarkTheme(d.color_theme)); }
    }).catch(() => {});
    return () => { vivo = false; clearColorTheme(document.documentElement); };
  }, [appointmentId]);
  const c = themed
    ? { page: "bg-brand-light text-brand-dark", muted: "text-brand-gray", star0: "text-gray-300", input: "border-gray-200 bg-white text-brand-dark placeholder:text-gray-400 focus:border-brand-blue", btn: "bg-brand-blue text-white hover:opacity-90", link: "text-brand-blue" }
    : { page: "bg-gray-950 text-white", muted: "text-gray-400", star0: "text-gray-700", input: "border-gray-700 bg-gray-900 text-white placeholder:text-gray-600 focus:border-red-500", btn: "bg-red-600 text-white hover:bg-red-700", link: "text-red-500" };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Selecciona una calificacion");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/public/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, rating, comment }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(data.error || "Error al enviar. Intenta de nuevo.");
    }
  };

  return (
    <div className={`min-h-screen ${c.page} flex items-center justify-center p-6`}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={oscuro ? "/logo-horizontal-white.png" : "/logo-horizontal.png"} alt="re-booking" className="h-10 mx-auto mb-4" />
          {themed && businessName && <p className={`text-sm font-semibold ${c.muted}`}>{businessName}</p>}
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3">Gracias por tu review!</h1>
            <p className={`${c.muted} mb-6`}>Tu opinion nos ayuda a mejorar.</p>
            <a href="/ranking" className={`${c.link} hover:underline text-sm`}>
              Ver ranking de profesionales →
            </a>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-center mb-2">Como estuvo tu experiencia?</h1>
            <p className={`${c.muted} text-center mb-8`}>Califica tu atencion</p>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-4xl transition-transform hover:scale-110"
                >
                  <span className={
                    star <= (hoverRating || rating)
                      ? "text-yellow-400"
                      : c.star0
                  }>
                    ★
                  </span>
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className={`text-center text-sm ${c.muted} mb-6`}>
                {rating === 5 && "Excelente!"}
                {rating === 4 && "Muy bueno!"}
                {rating === 3 && "Bueno"}
                {rating === 2 && "Regular"}
                {rating === 1 && "Malo"}
              </p>
            )}

            {/* Comment */}
            <div className="mb-6">
              <label className={`text-sm ${c.muted} mb-2 block`}>Comentario (opcional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Cuentanos sobre tu experiencia..."
                rows={3}
                className={`w-full rounded-lg border ${c.input} px-4 py-3 focus:outline-none`}
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className={`w-full py-4 ${c.btn} font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
            >
              {submitting ? "Enviando..." : "Enviar Calificacion"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
