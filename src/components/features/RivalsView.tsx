import { useMemo, useState } from 'react';
import { Swords, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';
import { gainOverDays } from '../../utils/snapshots';

interface Props {
  players: Player[];
  favorites: Set<string>;
}

type GainPeriod = 'day' | 'week' | 'month';

const PERIOD_DAYS: Record<GainPeriod, number> = { day: 1, week: 7, month: 30 };

export default function RivalsView({ players, favorites }: Props) {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<GainPeriod>('week');
  const [rivals, setRivals] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('d3_rivals') || '[]'); }
    catch { return []; }
  });

  const saveRivals = (list: string[]) => {
    setRivals(list);
    localStorage.setItem('d3_rivals', JSON.stringify(list));
  };

  const addRival = (name: string) => {
    if (!rivals.includes(name) && rivals.length < 10) {
      saveRivals([...rivals, name]);
    }
    setSearch('');
  };

  const removeRival = (name: string) => saveRivals(rivals.filter(r => r !== name));

  const searchResults = useMemo(() =>
    search.trim().length > 1
      ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && !rivals.includes(p.name)).slice(0, 6)
      : [], [search, players, rivals]);

  const rivalData = useMemo(() =>
    rivals.map(name => players.find(p => p.name === name)).filter(Boolean) as Player[],
    [rivals, players]);

  const myPlayers = useMemo(() =>
    players.filter(p => favorites.has(p.name)),
    [players, favorites]);

  const myBest = myPlayers.length > 0 ? myPlayers.reduce((a, b) => a.paragon > b.paragon ? a : b) : null;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Swords className="h-6 w-6" style={{ color: '#ff6666' }} />
        <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>Rival Tracker</h2>
        <span className="text-xs px-2 py-1 rounded font-mono-diablo" style={{ background: 'rgba(255,102,102,0.15)', color: '#ff6666', border: '1px solid rgba(255,102,102,0.3)' }}>
          Track up to 10 rivals
        </span>
      </div>

      {/* My status */}
      {myBest && (
        <div className="d3-card p-4 mb-6" style={{ background: 'rgba(245,197,66,0.05)', border: '1px solid var(--gold-dark)' }}>
          <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--gold-bright)' }}>⭐ Your Best (Favorited)</div>
          <div className="flex items-center gap-4">
            <span className="font-serif-display font-bold text-lg" style={{ color: 'var(--gold-bright)' }}>{myBest.name.toUpperCase()}</span>
            <span className="font-mono-diablo font-bold" style={{ color: 'var(--text-primary)' }}>Paragon {fmtInt(myBest.paragon)}</span>
            <span className="font-mono-diablo text-sm" style={{ color: 'var(--text-muted)' }}>Rank #{myBest.rank}</span>
          </div>
        </div>
      )}

      {/* Add rival */}
      <div className="d3-card p-4 mb-6">
        <div className="text-xs font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Add a Rival</div>
        <div className="relative">
          <input
            className="d3-input w-full px-3 py-2"
            placeholder="Search player to add as rival..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={rivals.length >= 10}
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 d3-card py-1 mt-1 shadow-xl" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {searchResults.map(p => (
                <button key={p.name} onClick={() => addRival(p.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-between">
                  <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                  <span className="text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>#{p.rank} • P{fmtInt(p.paragon)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Period toggle */}
      {rivalData.length > 0 && (
        <div className="d3-card p-2 flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Show gain for:</span>
          {(['day','week','month'] as GainPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${period === p ? 'd3-btn-primary' : ''}`}
              style={period !== p ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
              {p === 'day' ? '📅 Today' : p === 'week' ? '📆 Last 7d' : '📅 Last 30d'}
            </button>
          ))}
        </div>
      )}

      {/* Rivals list */}
      {rivalData.length === 0 ? (
        <div className="d3-card p-16 text-center" style={{ background: 'var(--bg-inset)' }}>
          <Swords className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--border-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No rivals tracked yet. Add players above to start tracking them.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rivalData
            .sort((a, b) => a.rank - b.rank)
            .map(rival => {
              const myRef = myBest;
              const diff = myRef ? rival.paragon - myRef.paragon : null;
              const days = PERIOD_DAYS[period];
              const rivalGain = gainOverDays(rival.name, days);
              const myGain   = myRef ? gainOverDays(myRef.name, days) : null;
              const gainLabel = period === 'day' ? 'today' : period === 'week' ? 'last 7d' : 'last 30d';
              return (
                <div key={rival.name} className="d3-card p-4 flex items-center gap-4"
                  style={{ border: '1px solid rgba(255,102,102,0.2)', background: 'rgba(255,102,102,0.03)' }}>
                  <div className="font-mono-diablo text-sm font-bold w-12" style={{ color: rival.rank <= 3 ? 'var(--gold-bright)' : 'var(--text-secondary)' }}>
                    #{rival.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-serif-display font-bold" style={{ color: '#ff9999' }}>{rival.name.toUpperCase()}</div>
                    <div className="text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                      Paragon {fmtInt(rival.paragon)} • {rival.region.toUpperCase()}
                    </div>
                    {/* Period gain */}
                    <div className="text-[10px] font-mono-diablo mt-0.5 flex items-center gap-1.5">
                      {rivalGain !== null ? (
                        <span style={{ color: '#66ddaa' }}>+{fmtInt(rivalGain)} {gainLabel}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No history yet — gains appear after tracking starts</span>
                      )}
                      {myRef && myGain !== null && rivalGain !== null && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          vs you: {rivalGain - myGain > 0 ? '+' : ''}{fmtInt(rivalGain - myGain)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* vs my player (paragon diff) */}
                  {myRef && diff !== null && (
                    <div className="text-center px-4">
                      <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--text-muted)' }}>vs {myRef.name.split('-')[0]}</div>
                      <div className="flex items-center gap-1 justify-center">
                        {diff > 0
                          ? <TrendingUp className="h-3.5 w-3.5" style={{ color: '#ff6666' }} />
                          : diff < 0
                            ? <TrendingDown className="h-3.5 w-3.5" style={{ color: '#66ddaa' }} />
                            : <Minus className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                        }
                        <span className="font-mono-diablo font-bold text-sm"
                          style={{ color: diff > 0 ? '#ff6666' : diff < 0 ? '#66ddaa' : 'var(--text-muted)' }}>
                          {diff > 0 ? '+' : ''}{fmtInt(diff)}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono-diablo mt-0.5" style={{ color: 'var(--text-muted)' }}>paragon gap</div>
                    </div>
                  )}

                  <button onClick={() => removeRival(rival.name)} className="p-1.5 rounded hover:bg-[var(--border-subtle)]" style={{ color: 'var(--text-muted)' }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
