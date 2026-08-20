import { useEffect, useState } from 'react';

interface Props {
  /** Full-screen app bootstrap (first data load) */
  fullScreen?: boolean;
  /** Shorter overlay for cards / sections */
  label?: string;
  /** Compact inline variant for popups */
  compact?: boolean;
}

/** Diablo-style loading panel used for app start + in-app fetches */
export default function LoadingScreen({
  fullScreen = false,
  label = 'Loading…',
  compact = false,
}: Props) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const inner = (
    <div className="flex flex-col items-center justify-center text-center px-6">
      <div
        className="relative mb-4"
        style={{ width: compact ? 48 : 88, height: compact ? 48 : 88 }}
      >
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: '2px solid transparent',
            borderTopColor: 'var(--gold-bright)',
            borderRightColor: 'var(--gold-dark)',
            opacity: 0.9,
          }}
        />
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(245,197,66,0.15) 0%, transparent 70%)',
            border: '1px solid rgba(245,197,66,0.25)',
          }}
        >
          <span
            className="font-serif-display font-bold"
            style={{
              color: 'var(--gold-bright)',
              fontSize: compact ? 14 : 22,
              letterSpacing: '0.06em',
              textShadow: '0 0 12px var(--gold-glow)',
            }}
          >
            D3
          </span>
        </div>
      </div>
      <div
        className="font-serif-display font-bold tracking-widest uppercase"
        style={{
          color: 'var(--gold-bright)',
          fontSize: compact ? 13 : 16,
        }}
      >
        {label}{dots}
      </div>
      {!compact && (
        <div
          className="mt-4 h-0.5 w-40 overflow-hidden rounded-full"
          style={{ background: 'var(--border-subtle)' }}
        >
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--gold-bright), transparent)',
              animation: 'd3-load-slide 1.35s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(212,160,23,0.14) 0%, transparent 55%), var(--bg-deep)',
        }}
      >
        <div
          className="absolute inset-4 pointer-events-none"
          style={{ border: '1px solid rgba(212,160,23,0.2)' }}
        />
        {inner}
        <style>{`
          @keyframes d3-load-slide {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(320%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={compact ? 'py-6' : 'd3-card py-16 flex items-center justify-center'}
      style={compact ? undefined : { background: 'var(--bg-inset)', minHeight: 180 }}
    >
      {inner}
      <style>{`
        @keyframes d3-load-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
