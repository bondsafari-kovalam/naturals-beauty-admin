// Skeleton while the blog list (and other blog pages) load.
export default function BlogLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-10 w-48 rounded bg-line" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 rounded-md border border-line bg-white" />)}
      </div>
      <div className="mt-8 h-10 rounded bg-line/60" />
      <div className="mt-4 rounded-md border border-line bg-white">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <div className="h-12 w-20 rounded bg-lavender" />
            <div className="h-4 flex-1 rounded bg-line" />
            <div className="h-4 w-24 rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  )
}
