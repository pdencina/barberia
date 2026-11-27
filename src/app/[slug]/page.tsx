// Link corto del negocio:  re-booking.cl/<negocio>   (ej. re-booking.cl/looky-estudio)
// Antes esto consultaba el negocio y REDIRIGIA a /booking?tenant=<negocio>, y la barra de direcciones quedaba con el link largo.
// Ahora se muestra directamente la pagina de reservas y el link limpio se mantiene en la barra (igual que /<negocio>/<profesional>).
// Con un cupón en el link (?cupon=X, como el de los correos de promoción) se abre la página de la promoción, con sus criterios
// ya puestos; ?normal=1 mantiene la reserva de siempre.
import { redirect } from "next/navigation";
import BookingPage from "@/app/booking/page";

export default function Page({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const cupon = typeof searchParams.cupon === "string" ? searchParams.cupon : "";
  if (cupon && !searchParams.normal) redirect(`/${encodeURIComponent(params.slug)}/promocion?cupon=${encodeURIComponent(cupon)}`);
  return <BookingPage />;
}
