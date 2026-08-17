import Link from "next/link";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white p-6 md:p-12 max-w-3xl mx-auto">
      <Link href="/landing" className="text-brand-blue text-sm hover:underline">← Volver</Link>
      <h1 className="text-2xl font-bold text-brand-dark mt-6 mb-4">Terminos y Condiciones</h1>
      <p className="text-sm text-brand-gray mb-6">Ultima actualizacion: Agosto 2026</p>

      <div className="prose prose-sm text-gray-700 space-y-4">
        <h2 className="text-lg font-bold">1. Aceptacion de los Terminos</h2>
        <p>Al acceder y utilizar la plataforma re-booking, aceptas cumplir con estos terminos y condiciones de uso. Si no estas de acuerdo con alguno de estos terminos, no utilices el servicio.</p>

        <h2 className="text-lg font-bold">2. Descripcion del Servicio</h2>
        <p>re-booking es una plataforma de gestion de negocios que permite la administracion de citas, clientes, pagos, inventario y equipo de trabajo. El servicio se ofrece bajo diferentes planes con distintas funcionalidades.</p>

        <h2 className="text-lg font-bold">3. Registro y Cuenta</h2>
        <p>Para utilizar el servicio debes crear una cuenta proporcionando informacion veraz y actualizada. Eres responsable de mantener la confidencialidad de tu contrasena y de todas las actividades que ocurran bajo tu cuenta.</p>

        <h2 className="text-lg font-bold">4. Planes y Pagos</h2>
        <p>El servicio ofrece un periodo de prueba gratuito de 14 dias. Al finalizar el periodo de prueba, deberas seleccionar un plan pago para continuar utilizando el servicio. Los precios pueden ser modificados con previo aviso de 30 dias.</p>

        <h2 className="text-lg font-bold">5. Privacidad y Datos</h2>
        <p>Nos comprometemos a proteger la privacidad de tus datos y los de tus clientes. Los datos almacenados en la plataforma son de tu propiedad y puedes solicitar su exportacion o eliminacion en cualquier momento.</p>

        <h2 className="text-lg font-bold">6. Uso Aceptable</h2>
        <p>Te comprometes a utilizar el servicio de manera legal y etica. Esta prohibido el uso del servicio para actividades ilegales, distribucion de malware, o cualquier actividad que perjudique a otros usuarios.</p>

        <h2 className="text-lg font-bold">7. Disponibilidad del Servicio</h2>
        <p>Nos esforzamos por mantener el servicio disponible 24/7, pero no garantizamos una disponibilidad ininterrumpida. Realizamos mantenimiento programado con previo aviso cuando es posible.</p>

        <h2 className="text-lg font-bold">8. Cancelacion</h2>
        <p>Puedes cancelar tu suscripcion en cualquier momento. Al cancelar, tendras acceso hasta el final del periodo ya pagado. Los datos se mantienen por 30 dias despues de la cancelacion, luego son eliminados permanentemente.</p>

        <h2 className="text-lg font-bold">9. Contacto</h2>
        <p>Para cualquier consulta sobre estos terminos, contactanos a traves de nuestros canales oficiales.</p>
      </div>
    </div>
  );
}
