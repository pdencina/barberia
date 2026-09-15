import { redirect } from "next/navigation";

// The approved marketing landing is a self-contained static build (HTML + CSS + JS +
// assets, with the Oti illustrations) that Nico delivered in /public/landing-nuevo/.
// It's served as-is so it looks exactly as approved; we just point /landing at it.
export default function LandingPage() {
  redirect("/landing-nuevo/index.html");
}
