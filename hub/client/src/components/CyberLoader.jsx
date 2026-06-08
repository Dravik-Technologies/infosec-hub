export function CyberLoader({ message = 'NOW LOADING...' }) {
  return (
    <div className="fixed inset-0 bg-scorva-bg flex items-center justify-center z-50 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 cyber-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-60" />

      {/* Animated glow blobs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-scorva-accent/8 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-indigo-500/4 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '0.5s' }} />

      {/* Main loader container */}
      <div className="relative z-10 text-center">
        {/* Cyber loader */}
        <div className="cyber-loader mx-auto mb-8">
          <div className="cyber-scanner" />
        </div>

        {/* Loading text */}
        <div className="space-y-3">
          <h1 className="text-4xl font-black font-mono tracking-widest uppercase text-glow-strong">
            {message}
          </h1>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1 h-8">
            <div className="w-2 h-2 rounded-full bg-scorva-accent animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-scorva-accent animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-scorva-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>

          {/* Tactical info */}
          <div className="mt-8 space-y-2 text-xs font-mono text-scorva-muted uppercase tracking-widest">
            <p>Initializing secure session...</p>
            <p>Verifying authentication credentials...</p>
            <p className="text-scorva-accent">STATUS: ACTIVE</p>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent via-scorva-accent to-transparent" />
      </div>
    </div>
  );
}
