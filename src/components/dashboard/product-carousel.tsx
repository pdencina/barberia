"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CarouselItem {
  id: string;
  primary: string;
  secondary: string;
  tone?: "danger" | "warning" | "success" | "neutral";
}

interface ProductCarouselProps {
  title: string;
  icon: React.ReactNode;
  items: CarouselItem[];
  emptyMessage: string;
  loading?: boolean;
}

const TONE_CLASSES: Record<NonNullable<CarouselItem["tone"]>, string> = {
  danger: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-600",
  success: "bg-emerald-50 text-emerald-600",
  neutral: "bg-brand-light text-brand-gray",
};

const ITEMS_PER_PAGE = 3;
const AUTOPLAY_MS = 4500;

// Punto (Nico, 25-sep): tarjetas tipo carrusel para el Dashboard — stock bajo y
// productos mas vendidos — 3 productos por vista, avanzan solas (pausan al pasar el
// mouse) y con puntos de navegacion. Maximo 9 productos por carrusel (3 vistas).
export function ProductCarousel({ title, icon, items, emptyMessage, loading }: ProductCarouselProps) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPage(0);
  }, [items.length]);

  useEffect(() => {
    if (paused || pageCount <= 1) return;
    timerRef.current = setInterval(() => {
      setPage((p) => (p + 1) % pageCount);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, pageCount]);

  const pages = Array.from({ length: pageCount }, (_, i) => items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE));

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-500 hover:border-brand-blue/20 hover:shadow-lg hover:shadow-brand-blue/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-brand-blue">{icon}</span>
          <h3 className="font-bold text-brand-dark text-sm">{title}</h3>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ver pagina ${i + 1}`}
                onClick={() => setPage(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === page ? "w-4 bg-brand-blue" : "w-1.5 bg-gray-200 hover:bg-gray-300"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[104px] flex items-center justify-center text-sm text-brand-gray">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="h-[104px] flex items-center justify-center text-sm text-brand-gray text-center px-4">{emptyMessage}</div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {pages.map((pageItems, pageIdx) => (
              <div key={pageIdx} className="w-full flex-shrink-0 grid grid-cols-3 gap-3">
                {pageItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-100 bg-brand-light/40 p-3 flex flex-col gap-1.5 min-h-[92px]"
                  >
                    <p className="text-xs font-semibold text-brand-dark leading-tight line-clamp-2">{item.primary}</p>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-auto",
                        TONE_CLASSES[item.tone || "neutral"]
                      )}
                    >
                      {item.secondary}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
