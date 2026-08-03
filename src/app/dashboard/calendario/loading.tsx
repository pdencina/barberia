export default function CalendarioLoading() {
  return (
    <div className="p-4 md:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-36 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-100 rounded-lg" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
          <div className="h-9 w-9 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="flex border-b border-gray-100 p-3 gap-4">
          <div className="w-14" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-1 h-5 bg-gray-100 rounded" />
          ))}
        </div>
        {/* Time grid */}
        <div className="flex">
          <div className="w-14 space-y-[48px] pt-4 px-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 w-10 bg-gray-100 rounded" />
            ))}
          </div>
          <div className="flex-1 grid grid-cols-5 gap-px bg-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white min-h-[400px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
