"use client";

export function Spinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full border-[3px] border-brand-blue/20 border-t-brand-blue animate-spin" />
      {text && <p className="text-sm text-brand-gray">{text}</p>}
    </div>
  );
}

export function SpinnerInline() {
  return (
    <div className="h-4 w-4 border-2 border-gray-200 border-t-brand-blue rounded-full animate-spin" />
  );
}
