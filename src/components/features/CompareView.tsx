import { useMemo, useState, useRef } from 'react';
import { X, GitCompare, Image as ImageIcon, User, Users } from 'lucide-react';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';
import { getHistory, gainSinceMonday } from '../../utils/snapshots';
import { toPng } from 'html-to-image';

function PlayerSearch({ label, value, onChange, selected, onSelect, onClear, results }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  selected: Player | null;
  onSelect: (p: Player) => void;
  onClear: () => void;
  results: Player[];
}) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {selected ? (
        <div className="d3-card p-3 flex items-center justify-between" style={{ border: '1px solid var(--gold-dark)' }}>
          <div className="min-w-0">
            <div className="font-serif-display font-bold truncate" style={{ color: 'var(--gold-bright)' }}>{selected.name.toUpperCase()}</div>
            <div className="text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
              Para {fmtInt(selected.paragon)} • #{selected.rank}
            </div>
          </div>
          <button type="button" onClick={onClear} className="p-1 rounded hover:bg-[var(--border-subtle)] shrink-0" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className="d3-input w-full px-3 py-2 pr-9"
            placeholder="Search player..."
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
          />
          {value.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--border-subtle)]"
              style={{ color: 'var(--text-muted)' }}
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 d3-card py-1 mt-1 shadow-xl" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {results.map(p => (
                <button key={p.name} type="button" onClick={() => { onSelect(p); onChange(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-subtle)] transition-colors">
                  <span className="font-serif-display font-bold">{p.name.toUpperCase()}</span>
                  <span className="ml-2 text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>Para {fmtInt(p.paragon)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  players: Player[];
}

const COMPARE_KEY = 'd3_compare_last';
const COLORS = ['#f5c542', '#6699ff', '#66ddaa'];

function loadLastCompare(): { nameA: string; nameB: string; nameC: string } {
  try {
    return { nameA: '', nameB: '', nameC: '', ...JSON.parse(localStorage.getItem(COMPARE_KEY) || '{}') };
  } catch {
    return { nameA: '', nameB: '', nameC: '' };
  }
}

function myPlayer(players: Player[]): Player | null {
  try {
    const btag = localStorage.getItem('d3_my_btag');
    if (!btag) return null;
    const name = btag.split('#')[0].toLowerCase();
    return players.find(p => p.name.toLowerCase() === name) || null;
  } catch {
    return null;
  }
}

function loadFriendNames(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem('d3_friends') || '[]');
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function MiniHistoryGraph({ names }: { names: string[] }) {
  const series = useMemo(() => {
    const unique = [...new Set(names)];
    return unique.map((name, i) => {
      const snaps = getHistory(name);
      const points = snaps.map(s => ({ ts: s.ts, val: s.paragon }));
      return { name, color: COLORS[i] || '#aaa', points };
    }).filter(s => s.points.length >= 2);
  }, [names]);

  if (series.length === 0) {
    return (
      <div className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
        Not enough local history for a graph yet (needs multi-day snapshots).
      </div>
    );
  }

  const W = 720; const H = 220;
  const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 240 }}>
      <rect x={0} y={0} width={W} height={H} fill="var(--bg-inset)" rx={8} />
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const val = minVal + valRange * t;
        const y = toY(val);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left + cW} y2={y} stroke="var(--border-subtle)" strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">{fmtInt(Math.round(val))}</text>
          </g>
        );
      })}
      {series.map(s => {
        const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.ts)} ${toY(p.val)}`).join(' ');
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
            {s.points.map((p, i) => (
              <circle key={i} cx={toX(p.ts)} cy={toY(p.val)} r={3} fill="var(--bg-card)" stroke={s.color} strokeWidth={1.5} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function CompareView({ players }: Props) {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [searchC, setSearchC] = useState('');
  const [friendPickerSlot, setFriendPickerSlot] = useState<'A' | 'B' | 'C' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const [playerA, setPlayerA] = useState<Player | null>(() => {
    const { nameA } = loadLastCompare();
    return nameA ? players.find(p => p.name === nameA) || null : null;
  });
  const [playerB, setPlayerB] = useState<Player | null>(() => {
    const { nameB } = loadLastCompare();
    return nameB ? players.find(p => p.name === nameB) || null : null;
  });
  const [playerC, setPlayerC] = useState<Player | null>(() => {
    const { nameC } = loadLastCompare();
    return nameC ? players.find(p => p.name === nameC) || null : null;
  });

  const persist = (a: Player | null, b: Player | null, c: Player | null) => {
    localStorage.setItem(COMPARE_KEY, JSON.stringify({
      nameA: a?.name || '',
      nameB: b?.name || '',
      nameC: c?.name || '',
    }));
  };

  const takenNames = useMemo(() => {
    const s = new Set<string>();
    if (playerA) s.add(playerA.name.toLowerCase());
    if (playerB) s.add(playerB.name.toLowerCase());
    if (playerC) s.add(playerC.name.toLowerCase());
    return s;
  }, [playerA, playerB, playerC]);

  const me = useMemo(() => myPlayer(players), [players]);
  const meTaken = me ? takenNames.has(me.name.toLowerCase()) : true;

  const selectA = (p: Player | null) => {
    if (p && (playerB?.name === p.name || playerC?.name === p.name)) return;
    setPlayerA(p);
    persist(p, playerB, playerC);
  };
  const selectB = (p: Player | null) => {
    if (p && (playerA?.name === p.name || playerC?.name === p.name)) return;
    setPlayerB(p);
    persist(playerA, p, playerC);
  };
  const selectC = (p: Player | null) => {
    if (p && (playerA?.name === p.name || playerB?.name === p.name)) return;
    setPlayerC(p);
    persist(playerA, playerB, p);
  };

  const filterResults = (q: string, exclude: (Player | null)[]) => {
    if (q.trim().length < 2) return [];
    const blocked = new Set(exclude.filter(Boolean).map(p => p!.name.toLowerCase()));
    return players
      .filter(p => p.name.toLowerCase().startsWith(q.toLowerCase()) && !blocked.has(p.name.toLowerCase()))
      .slice(0, 6);
  };

  const resultsA = useMemo(() => filterResults(searchA, [playerB, playerC]), [searchA, players, playerB, playerC]);
  const resultsB = useMemo(() => filterResults(searchB, [playerA, playerC]), [searchB, players, playerA, playerC]);
  const resultsC = useMemo(() => filterResults(searchC, [playerA, playerB]), [searchC, players, playerA, playerB]);

  // Unique slots only (prevents duplicate cards like the screenshot)
  const selected = useMemo(() => {
    const list: Player[] = [];
    const seen = new Set<string>();
    for (const p of [playerA, playerB, playerC]) {
      if (!p) continue;
      const k = p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(p);
    }
    return list;
  }, [playerA, playerB, playerC]);

  const friendOptions = useMemo(() => {
    const names = loadFriendNames();
    return names
      .map(n => players.find(p => p.name.toLowerCase() === n.toLowerCase()))
      .filter((p): p is Player => !!p && !takenNames.has(p.name.toLowerCase()));
  }, [players, takenNames, friendPickerSlot]);

  const fillMe = (slot: 'A' | 'B' | 'C') => {
    if (!me || meTaken) return;
    if (slot === 'A') selectA(me);
    if (slot === 'B') selectB(me);
    if (slot === 'C') selectC(me);
  };

  const openFriendPicker = (slot: 'A' | 'B' | 'C') => {
    setFriendPickerSlot(slot);
  };

  const pickFriend = (p: Player) => {
    if (!friendPickerSlot) return;
    if (friendPickerSlot === 'A') selectA(p);
    if (friendPickerSlot === 'B') selectB(p);
    if (friendPickerSlot === 'C') selectC(p);
    setFriendPickerSlot(null);
  };

  const StatBar = ({ label, values, higherIsBetter = true }: { label: string; values: number[]; higherIsBetter?: boolean }) => {
    const max = Math.max(...values, 1);
    const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
    return (
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="space-y-1">
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] w-4 font-bold" style={{ color: COLORS[i] }}>{String.fromCharCode(65 + i)}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.max(4, (higherIsBetter ? v / max : ((max - v) / max || 0.05)) * 100)}%`,
                  background: v === best ? COLORS[i] : 'var(--border-muted)',
                }} />
              </div>
              <span className="text-xs font-mono-diablo w-16 text-right" style={{ color: v === best ? COLORS[i] : 'var(--text-secondary)' }}>
                {fmtInt(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const copyImage = async () => {
    if (!cardRef.current) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#12100e' });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (e) {
      console.warn('Copy image failed', e);
      alert('Could not copy image (permission or empty card).');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <GitCompare className="h-6 w-6" style={{ color: 'var(--gold-bright)' }} />
          <div>
            <h2 className="font-serif-display text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>Smart Compare</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Me · pick a friend · search · weekly gain · history</p>
          </div>
        </div>
        {selected.length >= 2 && (
          <button type="button" onClick={copyImage} disabled={copying} className="d3-btn text-xs flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> {copying ? 'Copying…' : 'Copy as image'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {(['A', 'B', 'C'] as const).map(slot => {
          const filled =
            (slot === 'A' && playerA) || (slot === 'B' && playerB) || (slot === 'C' && playerC);
          return (
            <div key={slot} className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Slot {slot}:</span>
              <button
                type="button"
                className="d3-btn text-[10px] px-2 py-1 disabled:opacity-40"
                onClick={() => fillMe(slot)}
                disabled={!me || meTaken || !!filled}
                title={!me ? 'Set BattleTag in My Profile first' : meTaken ? 'Already selected in another slot' : 'Fill with you'}
              >
                <User className="h-3 w-3" /> Me
              </button>
              <button
                type="button"
                className="d3-btn text-[10px] px-2 py-1 disabled:opacity-40"
                onClick={() => openFriendPicker(slot)}
                disabled={!!filled || friendOptions.length === 0}
                title={friendOptions.length === 0 ? 'No friends available (or all already selected)' : 'Pick a friend'}
              >
                <Users className="h-3 w-3" /> Friend…
              </button>
            </div>
          );
        })}
      </div>

      {friendPickerSlot && (
        <div className="d3-card p-3 mb-4" style={{ border: '1px solid var(--gold-dark)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: 'var(--gold-bright)' }}>
              Choose friend for slot {friendPickerSlot}
            </span>
            <button type="button" className="p-1" onClick={() => setFriendPickerSlot(null)} style={{ color: 'var(--text-muted)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {friendOptions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No friends left to pick (add friends in Friends strip, or clear a slot).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {friendOptions.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className="d3-btn text-xs"
                  onClick={() => pickFriend(p)}
                >
                  {p.name.toUpperCase()} · #{p.rank}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap">
        <PlayerSearch label="Player A" value={searchA} onChange={setSearchA} selected={playerA} onSelect={selectA} onClear={() => selectA(null)} results={resultsA} />
        <PlayerSearch label="Player B" value={searchB} onChange={setSearchB} selected={playerB} onSelect={selectB} onClear={() => selectB(null)} results={resultsB} />
        <PlayerSearch label="Player C (optional)" value={searchC} onChange={setSearchC} selected={playerC} onSelect={selectC} onClear={() => selectC(null)} results={resultsC} />
      </div>

      {selected.length >= 2 ? (
        <div ref={cardRef} className="space-y-4 p-2">
          <div className="d3-card p-5" style={{ background: 'var(--bg-inset)' }}>
            <StatBar label="Paragon" values={selected.map(p => p.paragon)} />
            <StatBar label="Paragon / week (sheet)" values={selected.map(p => p.paragonInWeek)} />
            <StatBar label="XP rate 7d (T/h)" values={selected.map(p => p.xpRate7d)} />
            <StatBar label="World rank" values={selected.map(p => p.worldRank)} higherIsBetter={false} />
            <StatBar
              label="Gained since Monday (local snapshots)"
              values={selected.map(p => gainSinceMonday(p.name) ?? 0)}
            />
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))` }}>
            {selected.map((p, idx) => {
              const weekLocal = gainSinceMonday(p.name);
              return (
                <div key={p.name} className="d3-card p-4" style={{ border: `1px solid ${COLORS[idx]}55` }}>
                  <div className="font-serif-display font-bold text-lg mb-2" style={{ color: COLORS[idx] }}>
                    {p.name.toUpperCase()}
                  </div>
                  {[
                    { label: 'Rank', val: `#${p.rank}` },
                    { label: 'Paragon', val: fmtInt(p.paragon) },
                    { label: 'Weekly (sheet)', val: fmtInt(p.paragonInWeek) },
                    { label: 'Since Monday', val: weekLocal != null ? `+${fmtInt(weekLocal)}` : '—' },
                    { label: 'XP rate 7d', val: p.xpRate7dRaw || `${p.xpRate7d}` },
                    { label: 'Region', val: p.region.toUpperCase() },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span className="text-xs font-mono-diablo font-bold">{row.val}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="d3-card p-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gold-bright)' }}>
              Side-by-side history (local snapshots)
            </div>
            <MiniHistoryGraph names={selected.map(p => p.name)} />
            <div className="flex flex-wrap gap-3 mt-2">
              {selected.map((p, i) => (
                <span key={p.name} className="text-[10px] font-bold" style={{ color: COLORS[i] }}>● {p.name.toUpperCase()}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="d3-card p-16 text-center" style={{ background: 'var(--bg-inset)' }}>
          <GitCompare className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--border-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Pick at least two different players (Me, Friend…, or search)
          </p>
        </div>
      )}
    </div>
  );
}
