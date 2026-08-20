import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Show button after scrolling this many px (default 160) */
  threshold?: number;
}

/**
 * Scrollable wrapper with a floating “back to top” control for leaderboard lists.
 */
export default function ScrollTopContainer({ children, className, style, threshold = 160 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > threshold);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return (
    <div className="relative">
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
      {visible && (
        <button
          type="button"
          className="d3-btn d3-btn-primary absolute bottom-3 right-3 z-20"
          style={{
            padding: '0.5rem 0.7rem',
            boxShadow: '0 4px 18px rgba(0,0,0,0.45), 0 0 12px var(--gold-glow)',
          }}
          title="Back to top"
          aria-label="Back to top"
          onClick={() => ref.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
