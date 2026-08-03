export default function POSLoading() {
  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)] animate-pulse">
      {/* Left: Products */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="flex gap-2 mb-4">
          <div className="h-10 w-32 bg-gray-200 rounded-xl" />
          <div className="h-10 w-32 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-10 w-full bg-gray-100 rounded-xl mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="w-9 h-9 bg-gray-100 rounded-xl" />
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
              <div className="h-5 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-50 rounded" />
            </div>
          ))}
        </div>
      </div>
      {/* Right: Cart */}
      <div className="w-full lg:w-[420px] bg-white border-l p-4 space-y-3">
        <div className="h-6 w-20 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 bg-gray-100 rounded-lg" />
          <div className="h-8 bg-gray-100 rounded-lg" />
        </div>
        <div className="flex-1 pt-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto" />
          <div className="h-4 w-24 bg-gray-100 rounded mx-auto mt-3" />
        </div>
      </div>
    </div>
  );
}
