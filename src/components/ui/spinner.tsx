"use client";

export function Spinner({ text = "Cargando..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="mt-3 text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function SpinnerInline() {
  return (
    <div className="h-4 w-4 border-2 border-gray-200 border-t-white rounded-full animate-spin" />
  );
}
