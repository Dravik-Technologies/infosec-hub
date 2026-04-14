export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-scorva-muted">
        <div className="w-5 h-5 border-2 border-scorva-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}
