// Loading skeletony — animovaný placeholder místo holého spinneru.

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-52 w-full" />
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}
