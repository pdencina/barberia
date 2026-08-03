"use client";

export function Spinner({ text = "Cargando..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <img src="/oti/gestionando.png" alt="Cargando..." className="w-16 h-16 animate-pulse" />
      <p className="mt-3 text-sm text-brand-gray">{text}</p>
    </div>
  );
}

export function SpinnerInline() {
  return (
    <div className="h-4 w-4 border-2 border-gray-200 border-t-white rounded-full animate-spin" />
  );
}
