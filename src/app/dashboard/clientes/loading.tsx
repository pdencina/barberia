export default function ClientesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
          <div className="h-9 w-20 bg-gray-100 rounded-lg" />
          <div className="h-9 w-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-4 border-b border-gray-50 grid grid-cols-4 gap-4">
          {["Nombre", "Email", "Telefono", "Notas"].map((h) => (
            <div key={h} className="h-4 w-16 bg-gray-100 rounded" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 grid grid-cols-4 gap-4">
            <div className="h-4 w-28 bg-gray-100 rounded" />
            <div className="h-4 w-36 bg-gray-50 rounded" />
            <div className="h-4 w-24 bg-gray-50 rounded" />
            <div className="h-4 w-4 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
