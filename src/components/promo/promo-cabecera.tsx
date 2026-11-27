// Parte de arriba de la página de promoción (imagen, título, descripción y detalles). La usan el link público y la vista previa
// del editor, para que lo que se revisa sea lo mismo que ve el cliente.
export function PromoCabecera({ imagen, titulo, descripcion, detalles, codigo }: {
  imagen: string | null; titulo: string; descripcion: string | null; detalles: Array<{ etiqueta: string; valor: string }>; codigo: string;
}) {
  return (
    <section className="text-center">
      {imagen && <img src={imagen} alt={titulo} className="w-full rounded-2xl" />}
      <h1 className="mt-5 text-3xl font-extrabold uppercase leading-tight">{titulo}</h1>
      {descripcion && <p className="mt-2 whitespace-pre-line text-sm font-light text-promo-tinta/75">{descripcion}</p>}
      {detalles.length > 0 && (
        <ul className="mt-4 divide-y divide-promo-tinta/10 rounded-2xl border border-promo-tinta/15 bg-promo-tinta/5">
          {detalles.map((x) => <li key={x.etiqueta} className="px-4 py-2.5 text-sm"><span className="font-light text-promo-tinta/65">{x.etiqueta}: </span><b className="font-bold">{x.valor}</b></li>)}
        </ul>
      )}
      <p className="mt-3 text-sm font-light text-promo-tinta/75">Tu cupón <b className="font-mono font-bold text-promo-tinta">{codigo || "TU-CUPÓN"}</b> ya está puesto.</p>
    </section>
  );
}
