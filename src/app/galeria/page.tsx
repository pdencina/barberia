"use client";

import { useState, useEffect } from "react";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  barber: { name: string } | null;
  service: { name: string } | null;
}

interface Barber { id: string; name: string; }

export default function GaleriaPublicaPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/gallery").then((r) => r.json()),
      fetch("/api/public/barbers").then((r) => r.json()),
    ]).then(([imgs, barbs]) => {
      setImages(Array.isArray(imgs) ? imgs : []);
      setBarbers(Array.isArray(barbs) ? barbs : []);
      setLoading(false);
    });
  }, []);

  const filtered = filter
    ? images.filter((img: any) => img.barber_id === filter)
    : images;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 py-4 px-6 text-center">
        <img src="/logo.png" alt="EstudioLevels" className="h-10 mx-auto" />
        <p className="text-xs text-red-500 uppercase tracking-widest mt-2">Galeria</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-2">Nuestros Trabajos</h1>
        <p className="text-gray-400 text-center mb-8">Mira el nivel de nuestro equipo</p>

        {/* Filter by barber */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setFilter("")}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              !filter ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Todos
          </button>
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setFilter(b.id)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                filter === b.id ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {b.name.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Gallery */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Sin fotos disponibles</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((img) => (
              <button
                key={img.id}
                onClick={() => setLightbox(img)}
                className="relative aspect-square rounded-lg overflow-hidden group"
              >
                <img src={img.image_url} alt={img.caption || ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div>
                    <p className="text-white text-sm font-medium">{img.barber?.name}</p>
                    {img.caption && <p className="text-gray-300 text-xs">{img.caption}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <a href="/booking" className="inline-block px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors">
            Agendar Hora
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.caption || ""} className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            <div className="mt-3 text-center">
              {lightbox.barber && <p className="text-white font-medium">{lightbox.barber.name}</p>}
              {lightbox.caption && <p className="text-gray-400 text-sm">{lightbox.caption}</p>}
              {lightbox.service && <p className="text-gray-500 text-xs">{lightbox.service.name}</p>}
            </div>
            <button onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
        EstudioLevels · Puente Alto · estudiolevels.com
      </div>
    </div>
  );
}
