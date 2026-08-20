import ScrollTopContainer from './ScrollTopContainer';
import { useEffect, useState, useMemo } from 'react';
import { Star } from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  type RiftEntry,
  type Region,
  formatRiftTime,
  CLASS_SHORT,
} from '../utils/blizzardApi';
import { fmtInt } from '../utils/data';

type ClassFilter = 'all' | 'barbarian' | 'crusader' | 'demon-hunter' | 'monk' | 'necromancer' | 'witch-doctor' | 'wizard';

interface Props {
  tab: 'solo' | 'team2' | 'team3' | 'team4';
  seasonId: number;
  isEra: boolean;
  hardcore: boolean;
  regionFilter: Region | 'world';
  search: string;
}

const CLASS_LIST: { id: ClassFilter; short: string; full: string }[] = [
  { id: 'all', short: 'All', full: 'All Classes' },
  { id: 'barbarian', short: 'Barb', full: 'Barbarian' },
  { id: 'crusader', short: 'Crus', full: 'Crusader' },
  { id: 'demon-hunter', short: 'DH', full: 'Demon Hunter' },
  { id: 'monk', short: 'Monk', full: 'Monk' },
  { id: 'necromancer', short: 'Necro', full: 'Necromancer' },
  { id: 'witch-doctor', short: 'WD', full: 'Witch Doctor' },
  { id: 'wizard', short: 'Wiz', full: 'Wizard' },
];

function getLeaderboardType(tab: 'solo' | 'team2' | 'team3' | 'team4', hardcore: boolean): string {
  if (tab === 'solo') return hardcore ? 'rift-hardcore-all' : 'rift-all';
  if (tab === 'team2') return hardcore ? 'rift-hardcore-team-2' : 'rift-team-2';
  if (tab === 'team3') return hardcore ? 'rift-hardcore-team-3' : 'rift-team-3';
  return hardcore ? 'rift-hardcore-team-4' : 'rift-team-4';
}

export default function RiftLeaderboard({ tab, seasonId, isEra, hardcore, regionFilter, search }: Props) {
  const [data, setData] = useState<(RiftEntry & { region: Region })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [lastFetch, setLastFetch] = useState<number>(0);

  const lbType = getLeaderboardType(tab, hardcore);

  // For solo tab, we need to try each class if 'all' is selected
  const effectiveTypes: string[] = useMemo(() => {
    if (tab !== 'solo') return [lbType];
    if (classFilter === 'all') {
      const prefix = hardcore ? 'rift-hardcore-' : 'rift-';
      return [
        `${prefix}barbarian`, `${prefix}crusader`, `${prefix}demon-hunter`, `${prefix}monk`,
        `${prefix}necromancer`, `${prefix}witch-doctor`, `${prefix}wizard`,
      ];
    }
    const prefix = hardcore ? 'rift-hardcore-' : 'rift-';
    return [`${prefix}${classFilter}`];
  }, [tab, classFilter, hardcore, lbType]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all: (RiftEntry & { region: Region })[] = [];
      for (const type of effectiveTypes) {
        try {
          const entries = await fetchGlobalLeaderboard(seasonId, type, isEra, regionFilter);
          all.push(...entries);
        } catch {
          // try next type
        }
      }
      if (all.length === 0) {
        setError('No data. API may be unavailable or season has no entries yet.');
      } else {
        // Sort globally: score desc, time asc
        all.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.time - b.time;
        });
        all.forEach((e, i) => { e.rank = i + 1; });
        setData(all);
        setLastFetch(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [seasonId, isEra, hardcore, regionFilter, effectiveTypes.join(',')]);

  const filtered = useMemo(() => {
    let list = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.members.some((m) => m.battletag.toLowerCase().includes(q))
      );
    }
    return list.slice(0, 500); // Cap display
  }, [data, search]);

  const secondsSince = lastFetch ? Math.floor((Date.now() - lastFetch) / 1000) : 0;

  return (
    <div className="d3-card overflow-hidden">
      {/* Solo class filter */}
      {tab === 'solo' && (
        <div className="d3-table-header px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-secondary)' }}>Class</span>
            {CLASS_LIST.map((c) => (
              <button
                key={c.id}
                onClick={() => setClassFilter(c.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono-diablo border transition-colors ${
                  classFilter === c.id ? 'd3-btn-primary' : ''
                }`}
                style={classFilter !== c.id ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}
              >
                {c.short}
              </button>
            ))}
            {lastFetch > 0 && (
              <span className="ml-auto text-[11px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                Updated {Math.floor(secondsSince / 60)}:{(secondsSince % 60).toString().padStart(2, '0')} ago
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center">
          <div className="font-serif-display text-lg mb-2" style={{ color: 'var(--gold-bright)' }}>Loading {hardcore ? 'Hardcore ' : ''}{tab === 'solo' ? 'Solo' : `${tab.replace('team', '')}-Player`} Rift Leaderboard...</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Fetching from Blizzard API (EU / US / KR)</div>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <div style={{ color: 'var(--red)' }}>{error}</div>
          <button onClick={load} className="d3-btn d3-btn-primary mt-4">Retry</button>
          <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Blizzard API may be rate-limited or temporarily down.
          </div>
        </div>
      ) : (
        <>
          <ScrollTopContainer className="overflow-x-auto" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="w-full text-left">
              <thead className="d3-table-header">
                <tr>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap w-10">
                    <span style={{ color: 'var(--gold-bright)' }}>★</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap">
                    <span style={{ color: 'var(--gold-bright)' }}>Rank</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap">
                    <span style={{ color: 'var(--gold-bright)' }}>Player(s)</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap text-center">
                    <span style={{ color: 'var(--gold-bright)' }}>GR Level</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap text-center">
                    <span style={{ color: 'var(--gold-bright)' }}>Clear Time</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap">
                    <span style={{ color: 'var(--gold-bright)' }}>Class(es)</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap text-right">
                    <span style={{ color: 'var(--gold-bright)' }}>Paragon</span>
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap text-right">
                    <span style={{ color: 'var(--gold-bright)' }}>Region</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isTop3 = e.rank <= 3;
                  const rankClass = isTop3 ? `rank-${e.rank}` : 'rank-default';
                  const names = e.members.map((m) => m.battletag.split('#')[0].toUpperCase()).join(' + ');
                  const classes = [...new Set(e.members.map((m) => CLASS_SHORT[m.hero.class] || m.hero.class))].join(', ');
                  const totalParagon = e.members.reduce((s, m) => Math.max(s, m.hero.paragonLevel), 0);

                  return (
                    <tr key={`${e.rank}-${names}`} className="table-row-hover border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--text-muted)' }}>
                        <Star className="h-3 w-3" />
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded ${rankClass}`}>#{e.rank}</span>
                      </td>
                      <td className="px-3 py-3 font-serif-display font-bold text-sm tracking-wide whitespace-nowrap">
                        {names}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-mono-diablo font-bold" style={{ color: 'var(--gold-bright)' }}>{e.score}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono-diablo text-sm">{formatRiftTime(e.time)}</td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{classes}</td>
                      <td className="px-3 py-3 text-right font-mono-diablo text-sm">{fmtInt(totalParagon)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono-diablo text-xs uppercase" style={{ color: 'var(--text-muted)' }}>{e.region}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTopContainer>
          <div className="px-3 py-2 text-[10px] border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            Showing top {filtered.length} of {data.length} entries from {tab === 'solo' && classFilter === 'all' ? 'all classes' : classFilter} • {hardcore ? 'Hardcore' : 'Normal'} • {isEra ? 'Era (Non-Season)' : `Season ${seasonId}`}
          </div>
        </>
      )}
    </div>
  );
}
