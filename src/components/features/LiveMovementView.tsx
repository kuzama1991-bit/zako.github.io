import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';

interface Movement {
  name: string;
  region: string;
  oldRank: number;
  newRank: number;
  oldParagon: number;
  newParagon: number;
  paragonGain: number;
  rankChange: number;
  timestamp: number;
}

interface Props {
  players: Player[];
}

export default function LiveMovementView({ players }: Props) {
  const prevRef = useRef<Map<string, { rank: number; paragon: number }>>(new Map());
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');

  useEffect(() => {
    if (players.length === 0) return;
    const prev = prevRef.current;
    const newMoves: Movement[] = [];

    players.forEach(p => {
      const old = prev.get(p.name);
      if (old) {
        const paragonGain = p.paragon - old.paragon;
        const rankChange = old.rank - p.rank; // positive = moved up
        if (paragonGain !== 0 || rankChange !== 0) {
          newMoves.push({
            name: p.name,
            region: p.region,
            oldRank: old.rank,
            newRank: p.rank,
            oldParagon: old.paragon,
            newParagon: p.paragon,
            paragonGain,
            rankChange,
            timestamp: Date.now(),
          });
        }
      }
      prev.set(p.name, { rank: p.rank, paragon: p.paragon });
    });

    if (newMoves.length > 0) {
      setMovements(prev => [...newMoves, ...prev].slice(0, 100));
    }
  }, [players]);

  const filtered = useMemo(() => {
    if (filter === 'up') return movements.filter(m => m.rankChange > 0);
    if (filter === 'down') return movements.filter(m => m.rankChange < 0);
    return movements;
  }, [movements, filter]);

  // Live stats from current data
  const stats = useMemo(() => {
    const active = players.filter(p => p.paragonInWeek > 0);
    const total = players.reduce((s, p) => s + p.paragonInWeek, 0);
    return {
      active: active.length,
      avgWeekly: active.length ? Math.round(total / active.length) : 0,
      topGainer: [...players].sort((a, b) => b.paragonInWeek - a.paragonInWeek)[0] || null,
    };
  }, [players]);

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-6 w-6" style={{ color: '#66ddaa' }} />
        <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>Live Movement</h2>
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded font-mono-diablo" style={{ background: 'rgba(46,204,113,0.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.3)' }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#2ecc71' }} />
          Live
        </span>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="d3-card p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Active This Week</div>
          <div className="text-2xl font-black font-mono-diablo" style={{ color: '#66ddaa' }}>{stats.active}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>players with gains</div>
        </div>
        <div className="d3-card p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Avg Weekly Gain</div>
          <div className="text-2xl font-black font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>{fmtInt(stats.avgWeekly)}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>paragon/week</div>
        </div>
        <div className="d3-card p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Top Gainer</div>
          <div className="font-serif-display font-bold text-sm truncate" style={{ color: '#ff9f43' }}>{stats.topGainer?.name?.toUpperCase() || '—'}</div>
          <div className="text-[10px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>+{fmtInt(stats.topGainer?.paragonInWeek || 0)}/week</div>
        </div>
      </div>

      {/* Filters */}
      <div className="d3-card p-2 flex gap-2 mb-4">
        {(['all', 'up', 'down'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-xs font-mono-diablo font-bold uppercase tracking-wider transition-colors ${filter === f ? 'd3-btn-primary' : ''}`}
            style={filter !== f ? { background: 'var(--bg-card-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' } : {}}>
            {f === 'all' ? '📊 All' : f === 'up' ? '🟢 Gainers' : '🔴 Fallers'}
          </button>
        ))}
        <span className="ml-auto text-xs font-mono-diablo self-center" style={{ color: 'var(--text-muted)' }}>
          Detected on each data refresh
        </span>
      </div>

      {/* Movement list */}
      {movements.length === 0 ? (
        <div className="d3-card p-16 text-center" style={{ background: 'var(--bg-inset)' }}>
          <Activity className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--border-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Movement will appear here when players change rank after the next data refresh.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Auto-syncs every {/* syncMin */} minutes</p>
        </div>
      ) : (
        <div className="d3-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="d3-table-header">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--gold-bright)' }}>Player</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-wider uppercase text-center" style={{ color: 'var(--gold-bright)' }}>Rank Change</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-wider uppercase text-right" style={{ color: 'var(--gold-bright)' }}>Paragon Gain</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-wider uppercase text-right" style={{ color: 'var(--gold-bright)' }}>New Rank</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={`${m.name}-${m.timestamp}-${i}`} className="table-row-hover border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    <span className="font-serif-display font-bold">{m.name.toUpperCase()}</span>
                    <span className="ml-2 text-xs font-mono-diablo uppercase" style={{ color: m.region === 'eu' ? '#6699ff' : m.region === 'us' ? '#ff6666' : '#cc99ff' }}>{m.region}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1 font-mono-diablo font-bold"
                      style={{ color: m.rankChange > 0 ? '#66ddaa' : m.rankChange < 0 ? '#ff6666' : 'var(--text-muted)' }}>
                      {m.rankChange > 0 ? <ArrowUp className="h-4 w-4" /> : m.rankChange < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      {Math.abs(m.rankChange)} spots
                    </div>
                    <div className="text-[9px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>#{m.oldRank} → #{m.newRank}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-diablo font-bold"
                    style={{ color: m.paragonGain > 0 ? '#66ddaa' : m.paragonGain < 0 ? '#ff6666' : 'var(--text-muted)' }}>
                    {m.paragonGain > 0 ? '+' : ''}{fmtInt(m.paragonGain)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>#{m.newRank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
