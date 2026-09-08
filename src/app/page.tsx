import { redirect } from "next/navigation";

// Landing is parked for now. Root goes straight to login so the first thing a user
// sees is the sign-in screen. Re-point this to "/landing" to bring the marketing page
// back (it's untouched, including the animated Oti video).
export default function Home() {
  redirect("/login");
}
