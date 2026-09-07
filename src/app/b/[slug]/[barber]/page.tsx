import { redirect } from "next/navigation";

// Short personal booking link:
//   re-booking.cl/b/estudiolevels/bastian-ahumada
// -> /booking?tenant=estudiolevels&prof=bastian-ahumada
// The booking page then auto-selects the barber whose booking_slug matches `prof`.
export default function BarberBookingRedirect({ params }: { params: { slug: string; barber: string } }) {
  redirect(`/booking?tenant=${params.slug}&prof=${params.barber}`);
}
