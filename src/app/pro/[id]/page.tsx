import { redirect } from "next/navigation";

// Short, reliable personal booking link: re-booking.cl/pro/<barberId>
// Resolves the barber DIRECTLY by id (see /api/public/barber), so it always opens that
// professional's own services — no tenant-slug matching, no "first available" fallback,
// no landing on the wrong barber.
export default function ProBookingRedirect({ params }: { params: { id: string } }) {
  redirect(`/booking?barberId=${params.id}`);
}
