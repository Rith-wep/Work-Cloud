function SkeletonCard() {
  return (
    <article className="skeleton-shimmer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-2.5 w-24 rounded bg-slate-200" />
          </div>
        </div>
      </div>
      <div className="space-y-2 px-4 pb-3 pt-3">
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-5/6 rounded bg-slate-200" />
        <div className="h-3 w-32 rounded bg-slate-200" />
      </div>
      <div className="h-44 border-y border-slate-100 bg-slate-200" />
      <div className="grid grid-cols-3 gap-1 px-2 py-2">
        <div className="h-10 rounded-lg bg-slate-200" />
        <div className="h-10 rounded-lg bg-slate-200" />
        <div className="h-10 rounded-lg bg-slate-200" />
      </div>
      <div className="px-3 pb-3 pt-2">
        <div className="h-10 rounded-full bg-slate-200" />
      </div>
    </article>
  );
}

export default SkeletonCard;
