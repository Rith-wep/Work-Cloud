const pulse = "skeleton-shimmer rounded-lg bg-slate-200/80";

export function SkeletonBlock({ className = "h-4 w-full" }) {
  return <div aria-hidden="true" className={`${pulse} ${className}`} />;
}

function CardSkeleton({ profile = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <SkeletonBlock className={`${profile ? "h-16 w-16" : "h-12 w-12"} shrink-0 rounded-xl`} />
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-3 w-full" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-20 rounded-full" />
      </div>
    </article>
  );
}

export function ListSkeleton({ count = 4, showHeader = false }) {
  return (
    <div role="status" aria-label="Loading content" className="space-y-3" aria-busy="true">
      {showHeader ? <SkeletonBlock className="mb-5 h-8 w-48" /> : null}
      {Array.from({ length: count }, (_, index) => <CardSkeleton key={index} />)}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="space-y-4" aria-busy="true">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-3"><SkeletonBlock className="h-7 w-1/2" /><SkeletonBlock className="h-4 w-2/3" /></div>
        </div>
      </article>
      <CardSkeleton profile />
      <CardSkeleton profile />
      <span className="sr-only">Loading profile</span>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading details" className="space-y-4" aria-busy="true">
      <SkeletonBlock className="h-5 w-28" />
      <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-8 w-2/3" /><SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-28 w-full" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-5/6" />
      </article>
      <span className="sr-only">Loading details</span>
    </div>
  );
}

export function FormSkeleton({ fields = 6 }) {
  return (
    <div role="status" aria-label="Loading form" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-busy="true">
      {Array.from({ length: fields }, (_, index) => <div key={index} className="space-y-2"><SkeletonBlock className="h-3 w-28" /><SkeletonBlock className="h-11 w-full" /></div>)}
      <SkeletonBlock className="h-11 w-36" /><span className="sr-only">Loading form</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} aria-hidden="true" className="border-t border-slate-100">
      {Array.from({ length: columns }, (_, column) => <td key={column} className="px-4 py-3"><SkeletonBlock className="h-4 w-full" /></td>)}
    </tr>
  ));
}

export function AppBootSkeleton() {
  return (
    <div role="status" aria-label="Loading application" className="min-h-screen bg-slate-50" aria-busy="true">
      <div className="h-16 border-b border-slate-200 bg-white px-4 py-3"><SkeletonBlock className="h-10 w-36" /></div>
      <main className="mx-auto max-w-7xl space-y-4 p-4"><SkeletonBlock className="h-10 w-64" /><ListSkeleton count={4} /></main>
    </div>
  );
}

export default ListSkeleton;
