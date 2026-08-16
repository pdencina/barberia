"use client";

interface OtiMascotProps {
  size?: "sm" | "md" | "lg" | "xl";
  message?: string;
  variant?: "default" | "face" | "avatar";
  className?: string;
  animate?: boolean;
}

const sizeMap = {
  sm: { img: "w-10 h-10", text: "text-xs" },
  md: { img: "w-16 h-16", text: "text-sm" },
  lg: { img: "w-24 h-24", text: "text-sm" },
  xl: { img: "w-32 h-32", text: "text-base" },
};

const srcMap = {
  default: "/oti/oti-web-160.png",
  face: "/oti/oti-face-128.png",
  avatar: "/oti/oti-avatar-400.png",
};

export function OtiMascot({ size = "md", message, variant = "default", className = "", animate = true }: OtiMascotProps) {
  const { img, text } = sizeMap[size];
  const src = srcMap[variant];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img
        src={src}
        alt="Oti"
        className={`${img} drop-shadow-md ${animate ? "animate-bounce-slow" : ""}`}
      />
      {message && (
        <p className={`${text} text-brand-gray text-center max-w-xs`}>{message}</p>
      )}
    </div>
  );
}

export function OtiEmpty({ message = "No hay datos todavia", className = "" }: { message?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <img src="/oti/oti-face-128.png" alt="Oti" className="w-20 h-20 opacity-60 mb-3" />
      <p className="text-sm text-brand-gray">{message}</p>
    </div>
  );
}

export function OtiLoading({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <img src="/oti/oti-web-160.png" alt="Oti" className="w-14 h-14 animate-pulse mb-3" />
      <p className="text-xs text-brand-gray">{message}</p>
    </div>
  );
}
