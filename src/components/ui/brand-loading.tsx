export function BrandLoading() {
  return <div role="status" aria-label="Cargando re-booking" className="flex min-h-[60vh] flex-col items-center justify-center gap-5 bg-white">
    {/* El logo oficial conserva su forma; solo se anima la barra inferior. */}
    <img src="/logo-carga-oficial.png" alt="re-booking" width={1080} height={269} className="h-auto w-48 max-w-[65vw]" />
    <div className="h-1 w-16 overflow-hidden rounded-full bg-brand-blue/10"><div className="h-full w-1/2 rounded-full bg-brand-blue motion-safe:animate-pulse" /></div>
    <span className="sr-only">Cargando tu agenda</span>
  </div>;
}
