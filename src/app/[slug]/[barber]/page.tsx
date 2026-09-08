import { redirect } from "next/navigation";

// Shortest personal booking link:
//   re-booking.cl/estudiolevels/javier-garcia
// -> /booking?tenant=estudiolevels&prof=javier-garcia
// The booking page auto-selects the barber whose booking_slug matches `prof` within the
// tenant, then jumps straight to that professional's services. This is the format
// professionals paste into their Instagram bio (mirrors agendalevels.setmore.com/<name>).
export default function BarberBookingShortLink({
  params,
}: {
  params: { slug: string; barber: string };
}) {
  redirect(`/booking?tenant=${params.slug}&prof=${params.barber}`);
}
