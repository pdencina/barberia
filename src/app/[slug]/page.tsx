// Link corto del negocio:  re-booking.cl/<negocio>   (ej. re-booking.cl/looky-estudio)
// Antes esto consultaba el negocio y REDIRIGIA a /booking?tenant=<negocio>, y la barra de direcciones quedaba con el link largo.
// Ahora se muestra directamente la pagina de reservas y el link limpio se mantiene en la barra (igual que /<negocio>/<profesional>).
export { default } from "@/app/booking/page";
