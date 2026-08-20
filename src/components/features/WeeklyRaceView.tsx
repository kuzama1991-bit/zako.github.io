import ScrollTopContainer from '../ScrollTopContainer';
import { useMemo, useState } from 'react';
import { Flag, Trophy, Calendar, RefreshCw, Info } from 'lucide-react';
import { weeklyRaceBoard, startOfWeekMs, type WeeklyRacer } from '../../utils/snapshots';
import { fmtInt, type Player } from '../../utils/data';

interface Props {
  players?: Player[];
}

type Mode = 'local' | 'sheet';

/**
 * Local mode = same as v3.6: paragon delta from local Monday snapshots.
 * Sheet mode = rank by the published Google Sheet "Paragon in a week" column
 * (community tracker metric — not the same as true Monday gain).
 */
export default function WeeklyRaceView({ players = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('local');

  const weekStart = useMemo(() => {
    const d = new Date(startOfWeekMs());
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }, [tick]);

  const localBoard = useMemo(() => {
    const rows = weeklyRaceBoard(50);
    if (!players.length) return rows;
    const byName = new Map(players.map(p => [p.name.toLowerCase(), p]));
    return rows.map(r => {
      const live = byName.get(r.name.toLowerCase());
      if (!live) return r;
      return {
        ...r,
        currentParagon: live.paragon || r.currentParagon,
        currentRank: live.rank || r.currentRank,
        xpRate7d: live.xpRate7d || r.xpRate7d,
      };
    });
  }, [tick, players]);

  const sheetBoard = useMemo((): WeeklyRacer[] => {
    return [...players]
      .filter(p => p.paragonInWeek > 0)
      .sort((a, b) => b.paragonInWeek - a.paragonInWeek || a.rank - b.rank)
      .slice(0, 50)
      .map(p => ({
        name: p.name,
        gain: p.paragonInWeek,
        currentParagon: p.paragon,
        currentRank: p.rank,
        xpRate7d: p.xpRate7d,
      }));
  }, [players, tick]);

  const board = mode === 'local' ? localBoard : sheetBoard;
  const topGain = board[0]?.gain || 0;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Flag className="h-6 w-6" style={{ color: '#66ddaa' }} />
          <div>
            <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>
              Weekly Race
            </h2>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Calendar className="h-3 w-3" />
              {mode === 'local'
                ? `Paragon gained since Monday (${weekStart}) — local snapshots`
                : 'Sheet “Paragon in a week” column (community tracker)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-1 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)' }}>
            <button
              type="button"
              onClick={() => setMode('local')}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors"
              style={{
                background: mode === 'local' ? 'var(--gold-dark)' : 'transparent',
                color: mode === 'local' ? '#0a0908' : 'var(--text-secondary)',
              }}
            >
              Since Monday
            </button>
            <button
              type="button"
              onClick={() => setMode('sheet')}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors"
              style={{
                background: mode === 'sheet' ? 'var(--gold-dark)' : 'transparent',
                color: mode === 'sheet' ? '#0a0908' : 'var(--text-secondary)',
              }}
            >
              Sheet weekly
            </button>
          </div>
          <button onClick={() => setTick(t => t + 1)} className="d3-btn text-xs" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div
        className="d3-card p-3 mb-4 text-xs flex gap-2 items-start"
        style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
      >
        <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--gold-bright)' }} />
        <div>
          {mode === 'local' ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Since Monday (same as v3.6):</strong>{' '}
              Uses your local snapshots only — paragon now minus baseline from Monday (or first snap this week).
              Snapshots save when the board loads and on tray background refresh.
              Needs at least two points in history this week; leave the app in the tray for automatic tracking.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Sheet weekly:</strong>{' '}
              Ranks by the Google Sheet “Paragon in a week” column. That is the community tracker’s metric —
              it is <em>not</em> always the same as true Monday→now gain (values can look larger than current paragon).
            </>
          )}
        </div>
      </div>

      {board.length === 0 ? (
        <div className="d3-card p-12 text-center" style={{ background: 'var(--bg-inset)' }}>
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'local' ? 'Not enough snapshot data yet' : 'No sheet weekly values'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {mode === 'local'
              ? 'Open the app on multiple days this week, or leave it in the tray so snapshots build. Same behavior as v3.6. You can switch to “Sheet weekly” for the community column anytime.'
              : 'Wait for the leaderboard to load.'}
          </p>
        </div>
      ) : (
        <div className="d3-card overflow-hidden">
          <ScrollTopContainer style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="w-full text-left border-collapse">
              <thead className="d3-table-header sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--gold-bright)' }}>#</th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--gold-bright)' }}>Name</th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase text-right" style={{ color: 'var(--gold-bright)' }}>
                    {mode === 'local' ? 'Gained' : 'Sheet weekly'}
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase text-right" style={{ color: 'var(--gold-bright)' }}>Paragon</th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase text-right" style={{ color: 'var(--gold-bright)' }}>Rank</th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--gold-bright)' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r: WeeklyRacer, i: number) => {
                  const pct = topGain > 0 ? (r.gain / topGain) * 100 : 0;
                  const medal = i === 0 ? '#f5c542' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : undefined;
                  return (
                    <tr key={r.name} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 font-mono-diablo text-sm font-bold" style={{ color: medal || 'var(--text-muted)' }}>
                        {i < 3 ? <Trophy className="h-3.5 w-3.5 inline mr-1" style={{ color: medal }} /> : null}
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-serif-display font-bold text-sm">{r.name.toUpperCase()}</td>
                      <td className="px-3 py-2.5 font-mono-diablo text-sm font-bold text-right" style={{ color: '#66ddaa' }}>
                        {mode === 'local' ? '+' : ''}{fmtInt(r.gain)}
                      </td>
                      <td className="px-3 py-2.5 font-mono-diablo text-sm text-right">{fmtInt(r.currentParagon)}</td>
                      <td className="px-3 py-2.5 font-mono-diablo text-sm text-right" style={{ color: 'var(--text-muted)' }}>
                        #{r.currentRank}
                      </td>
                      <td className="px-3 py-2.5 w-40">
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(pct, 2)}%`, background: medal || 'var(--gold-dark)', opacity: 0.9 }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTopContainer>
        </div>
      )}
    </div>
  );
}
