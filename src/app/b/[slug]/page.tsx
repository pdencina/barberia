import { redirect } from "next/navigation";

// re-booking.cl/b/estudiolevels → redirects to /booking?tenant=estudiolevels
export default function TenantBookingRedirect({ params }: { params: { slug: string } }) {
  redirect(`/booking?tenant=${params.slug}`);
}
