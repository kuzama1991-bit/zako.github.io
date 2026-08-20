import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/** Isolated clocks so App does not re-render every second (major CPU fix). */

export function NextUpdateCountdown({
  lastFetch,
  syncMin,
  label,
}: {
  lastFetch: number;
  syncMin: number;
  label: string;
}) {
  const [secLeft, setSecLeft] = useState(0);

  useEffect(() => {
    const calc = () => {
      if (!lastFetch) {
        setSecLeft(syncMin * 60);
        return;
      }
      const secSince = Math.floor((Date.now() - lastFetch) / 1000);
      setSecLeft(Math.max(0, syncMin * 60 - secSince));
    };
    calc();
    // 1s is fine here — this component is tiny
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [lastFetch, syncMin]);

  return (
    <div className="d3-input flex items-center gap-1.5 text-xs font-mono-diablo whitespace-nowrap" style={{ padding: '0.35rem 0.6rem' }}>
      <span className="live-dot h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--green)' }} />
      <span className="font-sans" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {Math.floor(secLeft / 60)}:{(secLeft % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export function LocalClock({ use24h }: { use24h: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="d3-input flex items-center gap-1.5 text-xs font-mono-diablo whitespace-nowrap" style={{ padding: '0.35rem 0.55rem' }}>
      <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold-bright)' }} />
      <span className="font-sans" style={{ color: 'var(--text-secondary)' }}>Local</span>
      <span className="font-semibold" style={{ color: 'var(--gold-bright)' }}>
        {new Date(now).toLocaleTimeString('en-US', { hour12: !use24h })}
      </span>
    </div>
  );
}
