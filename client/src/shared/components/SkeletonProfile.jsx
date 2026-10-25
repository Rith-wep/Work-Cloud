function SkeletonProfile() {
  return (
    <article className="skeleton-shimmer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-9 rounded-lg bg-slate-200" />
        <div className="h-9 rounded-lg bg-slate-200" />
      </div>
      <div className="mt-3 h-20 rounded-xl bg-slate-200" />
    </article>
  );
}

export default SkeletonProfile;
