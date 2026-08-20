import { useModalDismiss } from '../hooks/useModalDismiss';
import { X, Sparkles } from 'lucide-react';

export const APP_VERSION = '3.8.0';

export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: '3.8.0',
    date: 'Aug 2026',
    items: [
      'Performance: no more full-app re-render every second; lighter background load',
      'System tray — close minimizes to tray; background snapshots every 6h',
      'Tray tooltip shows +paragon since Monday when profile is set',
      'Session digest banner: what changed since last visit',
      'Smart Compare 2.0: Me/Friend picker, 3-way compare, history graph, copy image',
      'My Profile: Open board jumps to solo/team ladders where you appear',
      'Changelog tab in Settings & Guide',
      'Themes: Classic / Blood / Frost / Nephalem / Ember',
      'Background snapshot interval setting (1–24h) for tray mode',
      'Name search is prefix-only (sa ≠ Isa)',
      'Weekly Race uses sheet weekly values as fallback + tray snapshots',
    ],
  },
  {
    version: '3.7',
    date: 'Aug 2026',
    items: [
      'Friends list — pin up to 10 players under My Rank (separate from favorites)',
      'New app icon and window name: D3Leaderboard(3.7.0)',
    ],
  },
  {
    version: '3.6',
    date: 'Aug 2026',
    items: [
      'Hardcore (HC) toggle on Greater Rift boards — official Blizzard HC ladders',
      'Smart search: #1-50, >9000, region:eu, min paragon filters',
      'Weekly Race board — who gained the most paragon since Monday',
      'What’s New changelog on first launch after update',
    ],
  },
  {
    version: '3.5',
    date: 'Aug 2026',
    items: [
      'Official set leaderboards (set1–set5 / noset) on solo boards',
      'Player dialog: dynamic 10k/15k/20k goal labels',
      'Player dialog: solo + 2/3/4-player rift ranks',
      'Compare players & Paragon Race hub tools',
    ],
  },
];

interface Props {
  onClose: () => void;
}

export default function WhatsNewModal({ onClose }: Props) {
  useModalDismiss(onClose);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg d3-card p-6 relative"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 40px var(--gold-glow)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', border: '1px solid var(--gold-bright)' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: '#0a0908' }} />
            </div>
            <div>
              <h2 className="font-serif-display text-xl font-bold" style={{ color: 'var(--gold-bright)' }}>
                What’s New
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Desktop v{APP_VERSION}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {CHANGELOG.slice(0, 3).map(block => (
            <div key={block.version}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono-diablo font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>
                  v{block.version}
                </span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {block.date}
                </span>
              </div>
              <ul className="space-y-1.5">
                {block.items.map((item, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--gold-dark)' }}>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="d3-btn d3-btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/** Call once on app mount. Returns true if changelog should be shown. */
export function shouldShowWhatsNew(): boolean {
  try {
    const seen = localStorage.getItem('d3_seen_version');
    return seen !== APP_VERSION;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem('d3_seen_version', APP_VERSION);
  } catch { /* ignore */ }
}
