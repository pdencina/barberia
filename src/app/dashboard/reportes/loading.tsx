export default function ReportesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 bg-gray-100 rounded-lg" />
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="h-9 w-9 bg-gray-100 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-7 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-64" />
        ))}
      </div>
    </div>
  );
}
