"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// QR para seguir desde el celular. Se genera en el equipo (sin servicios externos). Fondo blanco: los lectores lo piden.
export function Qr({ valor, tamano = 360 }: { valor: string; tamano?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(valor, { margin: 2, width: tamano * 2, errorCorrectionLevel: "M" }).then((u) => { if (vivo) setSrc(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [valor, tamano]);
  if (!src) return <div style={{ width: tamano, height: tamano }} className="rounded-3xl bg-[#EFE9DF]" />;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="Código QR" style={{ width: tamano, height: tamano }} className="rounded-3xl border border-[#E3DDD2] bg-white" />;
}
