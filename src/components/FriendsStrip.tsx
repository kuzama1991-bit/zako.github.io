import { useMemo, useState } from 'react';
import { Users, X, Plus } from 'lucide-react';
import type { Player } from '../utils/data';
import { fmtInt } from '../utils/data';
import type { TKey } from '../i18n';

export const MAX_FRIENDS = 10;
const STORAGE_KEY = 'd3_friends';

export function loadFriends(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(arr) ? arr.map(String).slice(0, MAX_FRIENDS) : [];
  } catch {
    return [];
  }
}

export function saveFriends(names: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names.slice(0, MAX_FRIENDS)));
}

interface Props {
  players: Player[];
  friends: string[];
  onChange: (names: string[]) => void;
  onViewPlayer: (p: Player) => void;
  tr?: (key: TKey) => string;
}

/** Clean full-width friends row — no strip border; framed panel when adding. */
export default function FriendsStrip({ players, friends, onChange, onViewPlayer, tr }: Props) {
  const t = (key: TKey, fallback: string) => (tr ? tr(key) : fallback);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const friendPlayers = useMemo(() => {
    return friends.map(name => {
      const p = players.find(x => x.name.toLowerCase() === name.toLowerCase());
      return { name, player: p || null };
    });
  }, [friends, players]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set<string>();
    const hits: Player[] = [];
    for (const p of players) {
      const key = p.name.toLowerCase();
      if (seen.has(key)) continue;
      if (!key.includes(q)) continue;
      if (friends.some(f => f.toLowerCase() === key)) continue;
      seen.add(key);
      hits.push(p);
      if (hits.length >= 8) break;
    }
    return hits;
  }, [query, players, friends]);

  const addFriend = (name: string) => {
    if (friends.length >= MAX_FRIENDS) return;
    if (friends.some(f => f.toLowerCase() === name.toLowerCase())) return;
    onChange([...friends, name]);
    setQuery('');
    setAdding(false);
  };

  const removeFriend = (name: string) => {
    onChange(friends.filter(f => f.toLowerCase() !== name.toLowerCase()));
  };

  return (
    <div className="w-full">
      <div className="max-w-[1600px] mx-auto px-6 py-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          <Users className="h-3.5 w-3.5" style={{ color: 'var(--gold-bright)' }} />
          <span style={{ color: 'var(--gold-bright)' }}>{t('friends', 'Friends')}</span>
          <span className="font-mono-diablo font-normal normal-case tracking-normal">{friends.length}/{MAX_FRIENDS}</span>
        </div>

        {friendPlayers.length === 0 && !adding && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('friendsEmpty', 'Pin up to 10 players — separate from favorites')}
          </span>
        )}

        {friendPlayers.map(({ name, player }) => (
          <div key={name} className="group inline-flex items-center gap-1 text-[11px]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 min-w-0 hover:underline"
              onClick={() => player && onViewPlayer(player)}
              disabled={!player}
              title={player ? t('friendsOpenCard', 'Open player card') : t('friendsNotListed', 'Not on current leaderboard')}
              style={{ color: player ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <span className="font-serif-display font-bold truncate max-w-[140px]">{name.toUpperCase()}</span>
              {player ? (
                <span className="font-mono-diablo shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--gold-bright)' }}>#{player.worldRank}</span>
                  {' · '}P{fmtInt(player.paragon)}
                </span>
              ) : (
                <span className="font-mono-diablo" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => removeFriend(name)}
              className="p-0.5 rounded opacity-40 group-hover:opacity-100 hover:bg-[var(--border-subtle)]"
              style={{ color: 'var(--text-muted)' }}
              title={t('friendsRemove', 'Remove friend')}
            >
              <X className="h-3 w-3" />
            </button>
            <span style={{ color: 'var(--border-muted)' }} className="mx-0.5">·</span>
          </div>
        ))}

        {friends.length < MAX_FRIENDS && (
          <button
            type="button"
            onClick={() => setAdding(a => !a)}
            className="d3-btn text-[11px]"
            style={{ padding: '0.2rem 0.55rem' }}
          >
            <Plus className="h-3 w-3" />
            {t('friendsAdd', 'Add')}
          </button>
        )}
      </div>

      {adding && (
        <div className="max-w-[1600px] mx-auto px-6 pb-3">
          <div
            className="relative max-w-md rounded-md p-3"
            style={{
              border: '1px solid var(--gold-dark)',
              boxShadow: '0 0 0 1px rgba(245,197,66,0.12), 0 0 18px rgba(245,197,66,0.08)',
              background: 'var(--bg-card)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold-bright)' }}>
                {t('friendsAdd', 'Add')} {t('friends', 'Friends')}
              </span>
              <button
                type="button"
                onClick={() => { setAdding(false); setQuery(''); }}
                className="p-0.5 rounded hover:bg-[var(--border-subtle)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              autoFocus
              className="d3-input w-full px-3 py-1.5 text-xs"
              placeholder={t('friendsSearch', 'Search player name…')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setQuery('');
                }
              }}
            />
            {searchHits.length > 0 && (
              <div
                className="mt-2 max-h-40 overflow-y-auto rounded"
                style={{ border: '1px solid var(--border-muted)', background: 'var(--bg-inset)' }}
              >
                {searchHits.map(p => (
                  <button
                    key={`${p.name}-${p.region}-${p.rank}`}
                    type="button"
                    onClick={() => addFriend(p.name)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--border-subtle)] flex justify-between gap-2"
                  >
                    <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                    <span className="font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                      #{p.worldRank} · P{fmtInt(p.paragon)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {query.trim() && searchHits.length === 0 && (
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                {t('friendsNoMatch', 'No matches on leaderboard')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
