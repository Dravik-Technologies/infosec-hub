export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="sc-loading-shell">
        <div className="sc-loading-orbit">
          <div className="sc-loading-ring" />
          <div className="sc-loading-core" />
        </div>
        <div className="text-center">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-scorva-accent mb-2">
            Scorva
          </div>
          <span className="text-sm text-scorva-muted">{text}</span>
        </div>
      </div>
    </div>
  );
}
