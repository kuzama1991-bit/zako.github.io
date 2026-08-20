import { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { buildDigest, saveSessionSnapshot, type DigestItem } from '../utils/sessionDigest';
import type { Player } from '../utils/data';

interface Props {
  players: Player[];
  friends: string[];
  ready: boolean;
}

function myNameFromStorage(): string | null {
  try {
    const btag = localStorage.getItem('d3_my_btag');
    if (!btag) return null;
    return btag.split('#')[0];
  } catch {
    return null;
  }
}

export default function SessionDigestBanner({ players, friends, ready }: Props) {
  const [items, setItems] = useState<DigestItem[] | null>(null);
  const [prevAt, setPrevAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ready || players.length === 0) return;

    const myName = myNameFromStorage();
    const digest = buildDigest({ players, friends, myName });
    setItems(digest.items);
    setPrevAt(digest.prevAt);

    // Save current session as baseline for next open
    const friendMap: Record<string, { paragon: number; rank: number }> = {};
    friends.forEach(f => {
      const p = players.find(x => x.name.toLowerCase() === f.toLowerCase());
      if (p) friendMap[f.toLowerCase()] = { paragon: p.paragon, rank: p.rank };
    });
    const me = myName ? players.find(p => p.name.toLowerCase() === myName.toLowerCase()) : null;
    const boardTop = digest.items.find(i => i.kind === 'weekly');
    saveSessionSnapshot({
      at: Date.now(),
      myName,
      myParagon: me?.paragon ?? null,
      myRank: me?.rank ?? null,
      friends: friendMap,
      weeklyLeader: boardTop ? (boardTop.text.match(/:\s*([A-Z0-9_]+)/i)?.[1] || null) : null,
      weeklyLeaderGain: null,
    });
  }, [ready, players, friends]);

  if (dismissed || !items || items.length === 0) return null;

  const when = prevAt
    ? new Date(prevAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="max-w-[1600px] mx-auto px-6 pt-3">
      <div
        className="d3-card p-3 flex items-start gap-3"
        style={{ background: 'rgba(102,221,170,0.06)', border: '1px solid rgba(102,221,170,0.35)' }}
      >
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(102,221,170,0.15)' }}
        >
          <Activity className="h-4 w-4" style={{ color: '#66ddaa' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#66ddaa' }}>
            Since last visit{when ? ` · ${when}` : ''}
          </div>
          <ul className="space-y-0.5">
            {items.slice(0, 8).map((it, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {it.text}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-[var(--border-subtle)] shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
