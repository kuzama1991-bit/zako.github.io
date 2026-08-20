import ScrollTopContainer from './ScrollTopContainer';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  type RiftEntry,
  type Region,
  formatRiftTime,
  type SoloClass,
  CLASS_SETS,
  buildSoloLadderType,
  buildTeamLadderType,
} from '../utils/blizzardApi';
import { type TKey } from '../i18n';
import RiftPlayerDialog from './RiftPlayerDialog';
import LoadingScreen from './LoadingScreen';

type MainTab = 'solo' | 'team2' | 'team3' | 'team4';
type SortField = 'rank' | 'name' | 'grLevel' | 'clearTimeMs' | 'region';
type SortDir = 'asc' | 'desc';
type RiftRow = RiftEntry & { region: Region };

const SOLO_CLASSES = [
  { id: 'barbarian', short: 'Barb', label: 'Barbarian', emoji: '⚔️' },
  { id: 'crusader', short: 'Crus', label: 'Crusader', emoji: '🛡️' },
  { id: 'dh', short: 'DH', label: 'Demon Hunter', emoji: '🏹' },
  { id: 'monk', short: 'Monk', label: 'Monk', emoji: '👊' },
  { id: 'necromancer', short: 'Necro', label: 'Necromancer', emoji: '💀' },
  { id: 'wd', short: 'WD', label: 'Witch Doctor', emoji: '🧟' },
  { id: 'wizard', short: 'Wiz', label: 'Wizard', emoji: '🔮' },
];

const TEAM_LABELS: Record<string, string> = {
  team2: '2-Player',
  team3: '3-Player',
  team4: '4-Player',
};

interface Props {
  tab: MainTab;
  season: number;
  regionFilter: Region | 'world';
  search: string;
  tr: (key: TKey) => string;
  soloClass: SoloClass;
  setSoloClass: (cls: SoloClass) => void;
  viewMode?: 'table' | 'grid';
}

export default function RiftView({ tab, season, regionFilter, search, tr, soloClass, setSoloClass, viewMode = 'table' }: Props) {
  const [data, setData] = useState<RiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedRow, setSelectedRow] = useState<RiftRow | null>(null);
  /** Selected set for solo leaderboards ('all' = overall class board) */
  const [setFilter, setSetFilter] = useState<string>('all');
  /** Softcore vs Hardcore ladder */
  const [hardcore, setHardcore] = useState(false);

  // Live movement tracking — stores previous rank per player key
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [movements, setMovements] = useState<Map<string, number>>(new Map());

  // Reset set filter when class changes
  useEffect(() => {
    setSetFilter('all');
  }, [soloClass]);

  // Rebuild movement map whenever data updates
  useEffect(() => {
    if (data.length === 0) return;
    const prev = prevRanksRef.current;
    const newMoves = new Map<string, number>();

    data.forEach(row => {
      const key = `${row.members[0]?.battletag || ''}-${row.region}`;
      const oldRank = prev.get(key);
      // Only show movement if we have seen this entry before AND rank changed
      if (oldRank !== undefined && oldRank !== row.rank) {
        newMoves.set(key, oldRank - row.rank); // positive = moved up, negative = moved down
      }
    });

    // Update stored ranks AFTER computing movements
    data.forEach(row => {
      const key = `${row.members[0]?.battletag || ''}-${row.region}`;
      prev.set(key, row.rank);
    });

    // Merge into existing movements so indicators stay visible
    if (newMoves.size > 0) {
      setMovements(prev => {
        const merged = new Map(prev);
        newMoves.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }
  }, [data]);

  const rankLabel = regionFilter === 'world' 
    ? tr('worldRank') 
    : `${regionFilter.toUpperCase()} ${tr('rank')}`;

  // Official Blizzard ladder type — overall / set board, softcore or hardcore
  const apiType = useMemo(() => {
    if (tab === 'solo') {
      return buildSoloLadderType(soloClass, setFilter, hardcore);
    }
    const size = tab === 'team2' ? 2 : tab === 'team3' ? 3 : 4;
    return buildTeamLadderType(size as 2 | 3 | 4, hardcore);
  }, [tab, soloClass, setFilter, hardcore]);

  const activeSetLabel = useMemo(() => {
    if (tab !== 'solo' || setFilter === 'all') return null;
    const found = (CLASS_SETS[soloClass] || []).find(s => s.id === setFilter);
    return found?.short || setFilter;
  }, [tab, soloClass, setFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchGlobalLeaderboard(season, apiType, false, regionFilter);

      if (entries.length === 0) {
        setError('No data returned. Blizzard API may be temporarily unavailable or this season has no entries yet.');
        setData([]);
      } else {
        setData(entries);
        setLastUpdated(new Date().toLocaleTimeString());

        // Store name→battletag map so the paragon dialog can build correct profile URLs
        try {
          const stored: Record<string, string> = JSON.parse(localStorage.getItem('d3_btag_map') || '{}');
          entries.forEach(e => {
            e.members.forEach(m => {
              const name = m.battletag.split('#')[0].toLowerCase();
              stored[name] = m.battletag;
            });
          });
          localStorage.setItem('d3_btag_map', JSON.stringify(stored));
        } catch { /* ignore */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [season, apiType, regionFilter, tab]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'clearTimeMs' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />
    ) : null;

  const filtered = useMemo(() => {
    let list = data;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((e) =>
        e.members.some((m) => {
          const name = m.battletag.split('#')[0].toLowerCase();
          return name.startsWith(q) || m.battletag.toLowerCase().startsWith(q);
        })
      );
    }
    return list;
  }, [data, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const mult = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortField) {
        case 'rank': return (a.rank - b.rank) * mult;
        case 'grLevel':
          if (b.score !== a.score) return (b.score - a.score) * mult;
          return (a.time - b.time) * mult;
        case 'clearTimeMs': return (a.time - b.time) * mult;
        case 'name': {
          const nA = a.members[0]?.battletag || '';
          const nB = b.members[0]?.battletag || '';
          return nA.localeCompare(nB) * mult;
        }
        case 'region': return a.region.localeCompare(b.region) * mult;
        default: return 0;
      }
    });
    return list;
  }, [filtered, sortField, sortDir]);

  const availableSets = tab === 'solo' ? (CLASS_SETS[soloClass] || []) : [];

  const thClass = 'px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-[var(--border-subtle)]';

  const formatCompletedDate = (iso?: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="d3-card p-3 mb-4 flex items-center gap-3 flex-wrap">
        {tab === 'solo' && (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{tr('riftClass')}:</span>
              <div className="flex flex-wrap gap-1.5">
                {SOLO_CLASSES.map((c) => {
                  const isActive = soloClass === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSoloClass(c.id as SoloClass)}
                      className={`px-3 py-1.5 rounded text-xs font-mono-diablo font-bold border transition-colors ${isActive ? 'd3-btn-primary' : ''}`}
                      style={!isActive ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--gold-bright)' } : {}}
                    >
                      {c.emoji} {c.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Set selection — fetches official Blizzard set leaderboards */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Set:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSetFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-mono-diablo font-bold border transition-colors ${setFilter === 'all' ? 'd3-btn-primary' : ''}`}
                  style={setFilter !== 'all' ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}
                  title="Overall class leaderboard"
                >
                  All
                </button>
                {availableSets.map((s) => {
                  const isActive = setFilter === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSetFilter(s.id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono-diablo font-bold border transition-colors ${isActive ? 'd3-btn-primary' : ''}`}
                      style={!isActive ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--gold-bright)' } : {}}
                      title={s.label}
                    >
                      {s.short}
                    </button>
                  );
                })}
              </div>
              {activeSetLabel && (
                <span className="text-[11px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                  Showing official {activeSetLabel} leaderboard
                </span>
              )}
            </div>
          </div>
        )}

        {tab !== 'solo' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{tr('riftMode')}:</span>
            <span className="font-mono-diablo font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>
              {TEAM_LABELS[tab]} {tr('riftGreaterRift')}
            </span>
          </div>
        )}

        {/* Softcore / Hardcore toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Mode:</span>
          <div className="flex items-stretch p-0.5 rounded" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-muted)' }}>
            <button
              onClick={() => setHardcore(false)}
              className="px-2.5 py-1 rounded text-xs font-mono-diablo font-bold transition-colors"
              style={{
                background: !hardcore ? 'var(--gold-dark)' : 'transparent',
                color: !hardcore ? '#0a0908' : 'var(--text-secondary)',
              }}
            >
              SC
            </button>
            <button
              onClick={() => setHardcore(true)}
              className="px-2.5 py-1 rounded text-xs font-mono-diablo font-bold transition-colors"
              style={{
                background: hardcore ? '#c44' : 'transparent',
                color: hardcore ? '#fff' : 'var(--text-secondary)',
              }}
              title="Hardcore leaderboard"
            >
              HC
            </button>
          </div>
          {hardcore && (
            <span className="text-[10px] font-mono-diablo font-bold" style={{ color: '#f66' }}>{tr('hardcore')}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-mono-diablo flex items-center gap-1.5" style={{ color: loading ? 'var(--gold-bright)' : 'var(--text-muted)' }}>
              {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
              Updated: {lastUpdated}
            </span>
          )}
          <button onClick={load} disabled={loading} className="d3-btn" style={{ padding: '0.35rem 0.75rem' }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '…' : tr('updateNow')}
          </button>
        </div>
      </div>

      <div className="d3-card overflow-hidden">
        {loading && data.length === 0 ? (
          <LoadingScreen label={tr('loadingBlizzard')} />
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-sm mb-4" style={{ color: 'var(--red)' }}>{error}</div>
            <button onClick={load} className="d3-btn d3-btn-primary">Retry</button>
          </div>
        ) : viewMode === 'grid' ? (
          <ScrollTopContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {sorted.map((row, idx) => {
              const rc = row.rank <= 3 ? `rank-${row.rank}` : 'rank-default';
              const isTeam = row.members.length > 1;
              const moveKey = `${row.members[0]?.battletag || ''}-${row.region}`;
              const move = movements.get(moveKey);
              return (
                <button
                  key={`${row.region}-${row.rank}-${idx}`}
                  type="button"
                  onClick={() => setSelectedRow(row)}
                  className="d3-card p-4 text-left flex flex-col gap-2 transition-all duration-200 hover:border-[var(--gold-dark)]"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded ${rc}`}>#{row.rank}</span>
                      {move !== undefined && move !== 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-diablo font-bold"
                          style={{ color: move > 0 ? '#66ddaa' : '#ff6666' }}>
                          {move > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(move)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono-diablo text-[10px] uppercase px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: row.region === 'eu' ? '#3355aa' : row.region === 'us' ? '#aa3333' : '#883399',
                        color: row.region === 'eu' ? '#6699ff' : row.region === 'us' ? '#ff6666' : '#cc99ff'
                      }}>
                      {row.region}
                    </span>
                  </div>
                  <div className="font-serif-display font-bold text-sm tracking-wide" style={{ color: 'var(--gold-bright)' }}>
                    {row.members.map(m => m.battletag.split('#')[0].toUpperCase()).join(' · ')}
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono-diablo">
                    <span style={{ color: row.score === 150 ? 'var(--gold-bright)' : 'var(--text-primary)' }}>GR {row.score}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatRiftTime(row.time)}</span>
                  </div>
                  <div className="text-[10px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                    {tr('completed')}: {formatCompletedDate(row.completedAt)}
                  </div>
                </button>
              );
            })}
          </ScrollTopContainer>
        ) : (
          <ScrollTopContainer style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="w-full text-left border-collapse">
              <thead className="d3-table-header sticky top-0 z-10">
                <tr>
                  <th className={thClass} onClick={() => handleSort('rank')}>
                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--gold-bright)' }}>{tr('riftRank')} <SortIcon field="rank" /></span>
                  </th>
                  <th className={thClass} onClick={() => handleSort('name')}>
                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--gold-bright)' }}>{tr('riftName')} <SortIcon field="name" /></span>
                  </th>
                  <th className={`${thClass} text-center`} onClick={() => handleSort('grLevel')}>
                    <span className="inline-flex items-center gap-1 justify-center" style={{ color: 'var(--gold-bright)' }}>{tr('riftGrLevel')} <SortIcon field="grLevel" /></span>
                  </th>
                  <th className={`${thClass} text-center`} onClick={() => handleSort('clearTimeMs')}>
                    <span className="inline-flex items-center gap-1 justify-center" style={{ color: 'var(--gold-bright)' }}>{tr('riftClearTime')} <SortIcon field="clearTimeMs" /></span>
                  </th>
                  <th className={`${thClass} text-center`}>
                    <span className="inline-flex items-center gap-1 justify-center" style={{ color: 'var(--gold-bright)' }}>{tr('completed')}</span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('region')}>
                    <span className="inline-flex items-center gap-1 justify-end" style={{ color: 'var(--gold-bright)' }}>{tr('riftRegion')} <SortIcon field="region" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const rc = row.rank <= 3 ? `rank-${row.rank}` : 'rank-default';
                  const isTeam = row.members.length > 1;
                  const moveKey = `${row.members[0]?.battletag || ''}-${row.region}`;
                  const move = movements.get(moveKey);

                  return (
                    <tr key={`${row.region}-${row.rank}-${idx}`} className="table-row-hover border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded ${rc}`}>#{row.rank}</span>
                          {move !== undefined && move !== 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-diablo font-bold"
                              style={{ color: move > 0 ? '#66ddaa' : '#ff6666' }}>
                              {move > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              {Math.abs(move)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          {row.members.map((m, mi) => (
                            <span
                              key={mi}
                              className={`font-serif-display font-bold tracking-wide cursor-pointer hover:underline ${isTeam ? 'text-xs' : 'text-sm'}`}
                              style={{ color: isTeam ? 'var(--text-primary)' : 'inherit' }}
                              onClick={() => setSelectedRow(row)}
                            >
                              {m.battletag.split('#')[0].toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-mono-diablo font-bold text-base" style={{ color: row.score === 150 ? 'var(--gold-bright)' : 'inherit' }}>
                        {row.score}
                      </td>
                      <td className="px-3 py-3 text-center font-mono-diablo text-sm">{formatRiftTime(row.time)}</td>
                      <td className="px-3 py-3 text-center font-mono-diablo text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCompletedDate(row.completedAt)}</td>
                      <td className="px-3 py-3 text-right">
                         <span className="font-mono-diablo text-xs uppercase px-2 py-0.5 rounded border"
                           style={{
                             borderColor: row.region === 'eu' ? '#3355aa' : row.region === 'us' ? '#aa3333' : '#883399',
                             color: row.region === 'eu' ? '#6699ff' : row.region === 'us' ? '#ff6666' : '#cc99ff'
                           }}>
                           {row.region}
                         </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTopContainer>
        )}
      </div>

      {selectedRow && (
        <RiftPlayerDialog row={selectedRow} tab={tab} tr={tr} rankLabel={rankLabel} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
}
