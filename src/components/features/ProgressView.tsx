import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, X, Plus } from 'lucide-react';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';
import { getHistory, type PlayerSnapshot } from '../../utils/snapshots';

interface Props { players: Player[] }

const PLAYER_COLORS = ['#f5c542', '#6699ff', '#66ddaa', '#ff9f43'];
type GraphMode = 'paragon' | 'daily' | 'weekly' | 'xprate';
type TimeRange = '1w' | '1m' | '3m' | 'all';

interface Series {
  name: string;
  color: string;
  points: { ts: number; val: number }[];
}

// ── SVG Line Graph ──────────────────────────────────────────
function LineGraph({ series, mode }: { series: Series[]; mode: GraphMode }) {
  if (series.length === 0 || series.every(s => s.points.length < 2)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-lg" style={{ background: 'var(--bg-inset)' }}>
        <TrendingUp className="h-10 w-10 mb-3 opacity-20" style={{ color: 'var(--gold-bright)' }} />
        <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Not enough history yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Data is collected daily. Come back tomorrow to see your first graph!
        </p>
      </div>
    );
  }

  const W = 800; const H = 300;
  const PAD = { top: 24, right: 40, bottom: 56, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allPts = series.flatMap(s => s.points);
  const minTs = Math.min(...allPts.map(p => p.ts));
  const maxTs = Math.max(...allPts.map(p => p.ts));
  const minVal = Math.min(...allPts.map(p => p.val));
  const maxVal = Math.max(...allPts.map(p => p.val));
  const tsRange = maxTs - minTs || 1;
  const valRange = maxVal - minVal || 1;

  const toX = (ts: number) => PAD.left + ((ts - minTs) / tsRange) * cW;
  const toY = (val: number) => PAD.top + cH - ((val - minVal) / valRange) * cH;

  // Y grid
  const yLines = 5;
  const yLabels = Array.from({ length: yLines + 1 }, (_, i) => {
    const val = minVal + (valRange * i) / yLines;
    const label = mode === 'paragon' ? fmtInt(Math.round(val))
      : mode === 'xprate' ? `${val.toFixed(1)}T`
      : `+${fmtInt(Math.round(val))}`;
    return { y: toY(val), label };
  });

  // X labels (dates)
  const tickCount = 5;
  const xLabels = Array.from({ length: tickCount }, (_, i) => {
    const ts = minTs + (tsRange * i) / (tickCount - 1);
    return { x: toX(ts), label: new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });

  const modeLabel = mode === 'paragon' ? 'Paragon Progress'
    : mode === 'daily' ? 'Daily Gain'
    : mode === 'weekly' ? 'Weekly Gain'
    : 'XP Rate (T/h)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 320 }}>
      <rect x={0} y={0} width={W} height={H} fill="var(--bg-inset)" rx={8} />
      {/* Title */}
      <text x={W / 2} y={16} textAnchor="middle" fontSize={12} fontWeight="700" fill="var(--text-secondary)">{modeLabel}</text>
      {/* Grid */}
      {yLabels.map((g, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={g.y} x2={PAD.left + cW} y2={g.y} stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={PAD.left - 6} y={g.y + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{g.label}</text>
        </g>
      ))}
      {/* X labels */}
      {xLabels.map((x, i) => (
        <text key={i} x={x.x} y={PAD.top + cH + 18} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{x.label}</text>
      ))}
      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + cH} stroke="var(--border-muted)" strokeWidth={1.5} />
      <line x1={PAD.left} y1={PAD.top + cH} x2={PAD.left + cW} y2={PAD.top + cH} stroke="var(--border-muted)" strokeWidth={1.5} />
      {/* Series */}
      {series.map(s => {
        if (s.points.length < 2) return null;
        const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.ts)} ${toY(p.val)}`).join(' ');
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={4} strokeOpacity={0.12} strokeLinejoin="round" strokeLinecap="round" />
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, i) => (
              <circle key={i} cx={toX(p.ts)} cy={toY(p.val)} r={4} fill="var(--bg-card)" stroke={s.color} strokeWidth={2} />
            ))}
          </g>
        );
      })}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={s.name} transform={`translate(${PAD.left + i * 180}, ${H - 12})`}>
          <circle cx={5} cy={0} r={5} fill={s.color} />
          <text x={14} y={4} fontSize={11} fill={s.color} fontWeight="700">{s.name.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  );
}

function filterByRange(snaps: PlayerSnapshot[], range: TimeRange): PlayerSnapshot[] {
  if (range === 'all') return snaps;
  const days = range === '1w' ? 7 : range === '1m' ? 30 : 90;
  const cutoff = Date.now() - days * 86400000;
  const filtered = snaps.filter(s => s.ts >= cutoff);
  // Always include the oldest snapshot before cutoff as the base point
  if (filtered.length === 0 && snaps.length > 0) return snaps.slice(-1);
  const base = snaps.filter(s => s.ts < cutoff).slice(-1);
  return [...base, ...filtered];
}

function buildSeries(name: string, color: string, mode: GraphMode, range: TimeRange): Series {
  const raw = getHistory(name);
  const snaps = filterByRange(raw, range);
  if (snaps.length < 2) return { name, color, points: [] };

  let points: { ts: number; val: number }[] = [];

  if (mode === 'paragon') {
    points = snaps.map(s => ({ ts: s.ts, val: s.paragon }));
  } else if (mode === 'xprate') {
    points = snaps.map(s => ({ ts: s.ts, val: s.xpRate7d }));
  } else if (mode === 'daily') {
    // Paragon gained per day
    points = snaps.slice(1).map((s, i) => ({
      ts: s.ts,
      val: Math.max(0, s.paragon - snaps[i].paragon),
    }));
  } else if (mode === 'weekly') {
    // Rolling 7-day gain at each snapshot
    points = snaps.map((s, _i) => {
      const weekAgo = s.ts - 7 * 86400000;
      const base = [...snaps].reverse().find(b => b.ts <= weekAgo);
      return { ts: s.ts, val: base ? Math.max(0, s.paragon - base.paragon) : 0 };
    }).filter(p => p.val > 0);
  }

  return { name, color, points };
}

// ── Main ProgressView ────────────────────────────────────────
export default function ProgressView({ players }: Props) {
  const [search, setSearch]           = useState('');
  const [trackedNames, setTrackedNames] = useState<string[]>([]);
  const [graphMode, setGraphMode]     = useState<GraphMode>('paragon');
  const [timeRange, setTimeRange]     = useState<TimeRange>('1m');
  const [selectedSingle, setSelectedSingle] = useState<Player | null>(null);

  const searchResults = useMemo(() =>
    search.trim().length > 1
      ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && !trackedNames.includes(p.name)).slice(0, 6)
      : [], [search, players, trackedNames]);

  const addPlayer = (p: Player) => {
    if (trackedNames.length >= 4 || trackedNames.includes(p.name)) return;
    setTrackedNames(prev => [...prev, p.name]);
    setSearch('');
  };

  const trackedPlayers = useMemo(() =>
    trackedNames.map(n => players.find(p => p.name === n)).filter(Boolean) as Player[],
    [trackedNames, players]);

  const series = useMemo(() =>
    trackedPlayers.map((p, i) => buildSeries(p.name, PLAYER_COLORS[i], graphMode, timeRange)),
    [trackedPlayers, graphMode, timeRange]);

  // Has any player with real history?
  const hasHistory = series.some(s => s.points.length >= 2);

  const distribution = useMemo(() => {
    const buckets: Record<string, number> = {};
    players.forEach(p => {
      const b = Math.floor(p.paragon / 500) * 500;
      buckets[b] = (buckets[b] || 0) + 1;
    });
    return Object.entries(buckets).map(([k, v]) => ({ paragon: Number(k), count: v }))
      .sort((a, b) => b.paragon - a.paragon).slice(0, 20);
  }, [players]);
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  const milestones = [1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6" style={{ color: '#66ddaa' }} />
        <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>Progress Charts</h2>
      </div>

      {/* ── Progress Graph ─────────────────────────────────── */}
      <div className="d3-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
            <TrendingUp className="h-4 w-4" /> Progress Graph
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Graph mode */}
            {([['paragon','👑 Paragon'],['daily','📅 Daily'],['weekly','📆 Weekly'],['xprate','⚡ XP Rate']] as [GraphMode,string][]).map(([m,l]) => (
              <button key={m} onClick={() => setGraphMode(m)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors ${graphMode === m ? 'd3-btn-primary' : ''}`}
                style={graphMode !== m ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                {l}
              </button>
            ))}
            <div className="h-5 w-px mx-1" style={{ background: 'var(--border-muted)' }} />
            {/* Time range */}
            {([['1w','1W'],['1m','1M'],['3m','3M'],['all','All']] as [TimeRange,string][]).map(([r,l]) => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors ${timeRange === r ? 'd3-btn-primary' : ''}`}
                style={timeRange !== r ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Player tags + add */}
        <div className="flex flex-wrap gap-2 mb-4">
          {trackedPlayers.map((p, i) => (
            <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: `${PLAYER_COLORS[i]}22`, border: `1px solid ${PLAYER_COLORS[i]}66`, color: PLAYER_COLORS[i] }}>
              <span className="h-2 w-2 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              {p.name.toUpperCase()}
              <button onClick={() => setTrackedNames(n => n.filter(x => x !== p.name))} className="ml-1 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {trackedPlayers.length < 4 && (
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border"
                style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-inset)' }}>
                <Plus className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                <input className="bg-transparent outline-none text-xs w-28" style={{ color: 'var(--text-primary)' }}
                  placeholder="Add player…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 z-20 d3-card py-1 mt-1 shadow-xl min-w-[200px]" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map(p => (
                    <button key={p.name} onClick={() => addPlayer(p)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-between">
                      <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                      <span className="font-mono-diablo" style={{ color: 'var(--text-muted)' }}>P{fmtInt(p.paragon)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info banner when no history */}
        {trackedPlayers.length > 0 && !hasHistory && (
          <div className="d3-card p-3 mb-4 flex items-start gap-2 text-xs" style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid var(--gold-dark)' }}>
            <span style={{ color: 'var(--gold-bright)' }}>ℹ️</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              History is collected <strong>daily</strong> while the app is running. Players added today will show real graph data starting tomorrow. Until then, the table below shows current snapshot stats.
            </span>
          </div>
        )}

        {/* Graph */}
        {trackedPlayers.length > 0 ? (
          <LineGraph series={series} mode={graphMode} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg" style={{ background: 'var(--bg-inset)' }}>
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" style={{ color: 'var(--gold-bright)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Add up to 4 players to compare</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Type a name in the box above</p>
          </div>
        )}

        {/* Stats table */}
        {trackedPlayers.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="d3-table-header">
                  {['Player','Paragon','Weekly','Daily (est.)','XP Rate','Total XP','Rank'].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase"
                      style={{ color: 'var(--gold-bright)', textAlign: h === 'Player' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trackedPlayers.map((p, i) => (
                  <tr key={p.name} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 font-serif-display font-bold" style={{ color: PLAYER_COLORS[i] }}>
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PLAYER_COLORS[i] }} />
                        {p.name.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono-diablo font-bold" style={{ color: 'var(--gold-bright)' }}>{fmtInt(p.paragon)}</td>
                    <td className="px-3 py-2 text-right font-mono-diablo" style={{ color: '#66ddaa' }}>+{fmtInt(p.paragonInWeek)}</td>
                    <td className="px-3 py-2 text-right font-mono-diablo" style={{ color: '#66ddaa' }}>+{fmtInt(Math.round(p.paragonInWeek / 7))}</td>
                    <td className="px-3 py-2 text-right font-mono-diablo">{p.xpRate7dRaw || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono-diablo">{p.totalXpRaw || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono-diablo">#{p.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Milestone & Distribution ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="d3-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
            <TrendingUp className="h-4 w-4" /> Player Milestone Progress
          </div>
          {selectedSingle ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif-display font-bold text-lg" style={{ color: 'var(--gold-bright)' }}>{selectedSingle.name.toUpperCase()}</span>
                <button onClick={() => setSelectedSingle(null)} className="text-xs d3-btn" style={{ padding: '0.2rem 0.5rem' }}>Change</button>
              </div>
              <div className="space-y-3">
                {milestones.map(m => {
                  const pct = Math.min((selectedSingle.paragon / m) * 100, 100);
                  const done = selectedSingle.paragon >= m;
                  const wks = done ? 0 : selectedSingle.paragonInWeek > 0 ? Math.ceil((m - selectedSingle.paragon) / selectedSingle.paragonInWeek) : Infinity;
                  return (
                    <div key={m}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono-diablo font-bold" style={{ color: done ? '#66ddaa' : 'var(--text-secondary)' }}>
                          {done ? '✓' : '○'} {fmtInt(m)}
                        </span>
                        <span className="font-mono-diablo" style={{ color: done ? '#66ddaa' : 'var(--gold-bright)' }}>
                          {done ? 'Done!' : isFinite(wks) ? `~${wks}w` : '—'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done ? '#66ddaa' : 'var(--gold-bright)', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative">
              <input className="d3-input w-full px-3 py-2 mb-3" placeholder="Search a player..."
                value={search} onChange={e => setSearch(e.target.value)} />
              {searchResults.length > 0 && (
                <div className="absolute top-10 left-0 right-0 z-20 d3-card py-1 shadow-xl" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map(p => (
                    <button key={p.name} onClick={() => { setSelectedSingle(p); setSearch(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-between">
                      <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                      <span className="text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>P{fmtInt(p.paragon)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && (
                <div className="p-8 text-center opacity-50"><p className="text-sm">Search a player to see milestone progress</p></div>
              )}
            </div>
          )}
        </div>

        <div className="d3-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--gold-bright)' }}>
            <BarChart3 className="h-4 w-4 inline mr-1" /> Paragon Distribution
          </div>
          <div className="space-y-1.5">
            {distribution.map(d => (
              <div key={d.paragon} className="flex items-center gap-2">
                <div className="w-20 text-right font-mono-diablo text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtInt(d.paragon)}+</div>
                <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <div className="h-full rounded flex items-center px-1.5 transition-all duration-300"
                    style={{ width: `${(d.count / maxCount) * 100}%`, background: 'var(--gold-dark)', minWidth: 20 }}>
                    <span className="text-[9px] font-mono-diablo font-bold" style={{ color: '#0a0908' }}>{d.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 weekly gainers */}
      <div className="d3-card p-5">
        <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--gold-bright)' }}>🔥 Top 10 Weekly Gainers</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...players].sort((a, b) => b.paragonInWeek - a.paragonInWeek).slice(0, 10).map((p, i) => (
            <div key={p.name} className="d3-card p-3 text-center" style={{ background: 'var(--bg-inset)' }}>
              <div className="text-[10px] font-mono-diablo mb-1" style={{ color: 'var(--text-muted)' }}>#{i + 1}</div>
              <div className="font-serif-display font-bold text-sm truncate mb-1">{p.name.toUpperCase()}</div>
              <div className="font-mono-diablo font-black text-base" style={{ color: '#66ddaa' }}>+{fmtInt(p.paragonInWeek)}</div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>paragon/week</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
