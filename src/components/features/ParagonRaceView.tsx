import { useMemo, useState } from 'react';
import { Flag, X, Trophy } from 'lucide-react';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';

interface Props {
  players: Player[];
}

export default function ParagonRaceView({ players }: Props) {
  const [search, setSearch] = useState('');
  const [racers, setRacers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('d3_race') || '[]'); } catch { return []; }
  });
  const [goal, setGoal] = useState<number>(20000);
  const [customGoal, setCustomGoal] = useState('');

  const saveRacers = (list: string[]) => {
    setRacers(list);
    localStorage.setItem('d3_race', JSON.stringify(list));
  };

  const searchResults = useMemo(() =>
    search.trim().length > 1
      ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && !racers.includes(p.name)).slice(0, 6)
      : [], [search, players, racers]);

  const racerData = useMemo(() =>
    racers.map(n => players.find(p => p.name === n)).filter(Boolean) as Player[],
    [racers, players]);

  const sorted = useMemo(() =>
    [...racerData].sort((a, b) => b.paragon - a.paragon),
    [racerData]);

  const leader = sorted[0];

  const GOAL_PRESETS = [5000, 10000, 15000, 20000];

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Flag className="h-6 w-6" style={{ color: '#ff9f43' }} />
        <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>Paragon Race</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Setup panel */}
        <div className="d3-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--gold-bright)' }}>Race Setup</div>

          {/* Goal picker */}
          <div className="mb-4">
            <div className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Race Goal (Paragon)</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {GOAL_PRESETS.map(g => (
                <button key={g} onClick={() => setGoal(g)}
                  className={`px-2.5 py-1 rounded text-xs font-mono-diablo font-bold border transition-colors ${goal === g ? 'd3-btn-primary' : ''}`}
                  style={goal !== g ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                  {(g / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="d3-input flex-1 px-2 py-1.5 text-xs" placeholder="Custom..."
                value={customGoal} onChange={e => setCustomGoal(e.target.value)} />
              <button className="d3-btn d3-btn-primary text-xs" style={{ padding: '0.25rem 0.6rem' }}
                onClick={() => { const v = parseInt(customGoal); if (v > 0) { setGoal(v); setCustomGoal(''); } }}>
                Set
              </button>
            </div>
          </div>

          {/* Add racer */}
          <div className="mb-4">
            <div className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Add Racer (max 8)</div>
            <div className="relative">
              <input className="d3-input w-full px-2 py-1.5 text-xs" placeholder="Search player..."
                value={search} onChange={e => setSearch(e.target.value)} disabled={racers.length >= 8} />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 d3-card py-1 mt-1 shadow-xl" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {searchResults.map(p => (
                    <button key={p.name} onClick={() => { saveRacers([...racers, p.name]); setSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-between">
                      <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                      <span className="font-mono-diablo" style={{ color: 'var(--text-muted)' }}>P{fmtInt(p.paragon)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Racers list */}
          <div className="space-y-1.5">
            {racers.map(name => (
              <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: 'var(--bg-inset)' }}>
                <span className="text-xs font-serif-display font-bold">{name.toUpperCase()}</span>
                <button onClick={() => saveRacers(racers.filter(r => r !== name))} className="p-0.5" style={{ color: 'var(--text-muted)' }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Race track */}
        <div className="lg:col-span-2 d3-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--gold-bright)' }}>
              🏁 Race to {fmtInt(goal)} Paragon
            </div>
            {leader && <div className="text-xs font-mono-diablo" style={{ color: '#ff9f43' }}>Leader: {leader.name.toUpperCase()}</div>}
          </div>

          {sorted.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Add players to start the race!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((p, i) => {
                const pct = Math.min((p.paragon / goal) * 100, 100);
                const finished = p.paragon >= goal;
                const weeksLeft = !finished && p.paragonInWeek > 0
                  ? Math.ceil((goal - p.paragon) / p.paragonInWeek)
                  : null;
                const gapToLeader = leader && p.name !== leader.name ? leader.paragon - p.paragon : 0;

                const colors = ['#f5c542', '#aaaaaa', '#cd7f32', '#6699ff', '#66ddaa', '#ff6666', '#cc99ff', '#ff9f43'];
                const color = colors[i % colors.length];

                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-diablo text-sm font-bold w-6" style={{ color }}>#{i + 1}</span>
                        {i === 0 && <Trophy className="h-3.5 w-3.5" style={{ color: '#f5c542' }} />}
                        <span className="font-serif-display font-bold text-sm">{p.name.toUpperCase()}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono-diablo font-bold text-sm" style={{ color: finished ? '#66ddaa' : color }}>
                          {fmtInt(p.paragon)} / {fmtInt(goal)}
                        </span>
                        <div className="text-[9px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                          {finished ? '✓ Finished!' : weeksLeft !== null ? `~${weeksLeft}w left` : '—'}
                          {gapToLeader > 0 && <span> • -{fmtInt(gapToLeader)} behind</span>}
                        </div>
                      </div>
                    </div>
                    <div className="h-6 rounded-full overflow-hidden relative" style={{ background: 'var(--border-subtle)' }}>
                      <div className="h-full rounded-full transition-all duration-700 flex items-center px-3"
                        style={{ width: `${Math.max(pct, 2)}%`, background: finished ? '#66ddaa' : color, opacity: 0.85 }}>
                        <span className="text-[10px] font-mono-diablo font-bold" style={{ color: '#0a0908', whiteSpace: 'nowrap' }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                        Goal: {fmtInt(goal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
