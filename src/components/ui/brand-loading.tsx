export function BrandLoading() {
  return <div role="status" aria-label="Cargando re-booking" className="flex min-h-[60vh] flex-col items-center justify-center gap-5 bg-brand-light">
    {/* El logo oficial conserva su forma; solo se anima la opacidad. */}
    <img src="/logo-horizontal@2x.png" alt="re-booking" className="h-auto w-40 motion-safe:animate-pulse" />
    <div className="h-1 w-16 overflow-hidden rounded-full bg-brand-blue/10"><div className="h-full w-1/2 rounded-full bg-brand-blue motion-safe:animate-pulse" /></div>
    <span className="sr-only">Cargando tu agenda</span>
  </div>;
}
