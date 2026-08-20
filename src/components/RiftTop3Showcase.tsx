import { useEffect, useState, useMemo } from 'react';
import {
  fetchGlobalLeaderboard,
  formatRiftTime,
  type RiftEntry,
  type Region,
  type SoloClass,
} from '../utils/blizzardApi';
import { Trophy, RefreshCw } from 'lucide-react';
import { type TKey } from '../i18n';
import { fmtInt } from '../utils/data';
import RiftPlayerDialog from './RiftPlayerDialog';

type MainTab = 'solo' | 'team2' | 'team3' | 'team4';
type RiftRow = RiftEntry & { region: Region };

interface Props {
  tab: MainTab;
  season: number;
  regionFilter: Region | 'world';
  soloClass: SoloClass;
  tr: (key: TKey) => string;
}

export default function RiftTop3Showcase({ tab, season, regionFilter, soloClass, tr }: Props) {
  const [data, setData] = useState<RiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<RiftRow | null>(null);

  const apiType = useMemo(() => {
    if (tab === 'solo') {
      const cls = soloClass;
      if (cls === 'dh') return 'rift-dh';
      if (cls === 'wd') return 'rift-wd';
      return `rift-${cls}`;
    }
    return `rift-${tab.replace('team', 'team-')}`;
  }, [tab, soloClass]);

  const rankLabel = regionFilter === 'world' 
    ? tr('worldRank') 
    : `${regionFilter.toUpperCase()} ${tr('rank')}`;

  useEffect(() => {
    const loadTop3 = async () => {
      setLoading(true);
      try {
        const entries = await fetchGlobalLeaderboard(season, apiType, false, regionFilter);
        setData(entries.slice(0, 3));
      } catch (error) {
        console.error('Failed to load rift top 3:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTop3();
  }, [tab, season, regionFilter, apiType]);

  return (
    <>
      <section className="max-w-[1600px] mx-auto px-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif-display text-lg font-bold flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
            <Trophy className="h-5 w-5" /> {tr('top3Showcase')}
          </h2>
          {loading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--gold-bright)' }}>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}
        </div>
        {data.length === 0 && !loading ? (
          <div className="d3-card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No data available for this leaderboard yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {data.length > 0 ? data.map((row, i) => (
              <RiftTop3Card key={`${row.region}-${row.rank}-${i}`} row={row} i={i} tr={tr} rankLabel={rankLabel} onClick={() => setSelectedRow(row)} />
            )) : [1, 2, 3].map((n) => (
              <div key={n} className="d3-card p-5 h-[280px] flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-12 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                  <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                </div>
                <div className="h-5 w-40 rounded animate-pulse mb-4" style={{ background: 'var(--border-subtle)' }} />
                <div className="flex-1 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
              </div>
            ))}
          </div>
        )}
      </section>
      {selectedRow && (
        <RiftPlayerDialog row={selectedRow} tab={tab} tr={tr} rankLabel={rankLabel} onClose={() => setSelectedRow(null)} />
      )}
    </>
  );
}

function RiftTop3Card({ row, i, tr, rankLabel, onClick }: {
  row: RiftRow;
  i: number;
  tr: (k: TKey) => string;
  rankLabel: string;
  onClick: () => void;
}) {
  const rank = i + 1;
  const glow = rank === 1 ? 'glow-gold-1' : rank === 2 ? 'glow-gold-2' : 'glow-gold-3';
  const badge = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : 'rank-3';
  const placeLabel = rank === 1 ? tr('place1') : rank === 2 ? tr('place2') : tr('place3');

  const names = row.members.map(m => m.battletag.split('#')[0].toUpperCase());
  const totalParagon = row.members.reduce((max, m) => Math.max(max, m.hero.paragonLevel || 0), 0);

  return (
    <div className={`d3-card p-5 ${glow} relative overflow-hidden flex flex-col h-full`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-mono-diablo text-sm font-bold px-2.5 py-1 rounded ${badge}`}>#{rank}</span>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>{placeLabel}</div>
            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Trophy className="h-3 w-3" /> {rankLabel}: {row.rank}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 mb-4">
        {names.map((name, idx) => (
          <h3
            key={idx}
            className="font-serif-display text-lg font-bold tracking-wide cursor-pointer hover:underline break-words"
            onClick={onClick}
            style={{ color: 'var(--text-primary)' }}
          >
            {name}
          </h3>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('riftGrLevel')}</div>
          <div className="font-mono-diablo font-bold text-base" style={{ color: 'var(--gold-bright)' }}>{row.score}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('riftClearTime')}</div>
          <div className="font-mono-diablo font-bold text-base">{formatRiftTime(row.time)}</div>
        </div>
        <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('paragon')}</div>
          <div className="font-mono-diablo font-bold">{fmtInt(totalParagon)}</div>
        </div>
      </div>

      <div className="pt-3 border-t flex justify-between text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1">{tr('riftRegion')}</span>
        <span className="font-mono-diablo font-bold uppercase px-1.5 py-0.5 rounded" 
          style={{ 
            background: row.region === 'eu' ? 'rgba(30,80,200,0.2)' : row.region === 'us' ? 'rgba(180,30,30,0.2)' : 'rgba(200,30,200,0.15)',
            color: row.region === 'eu' ? '#6699ff' : row.region === 'us' ? '#ff6666' : '#cc99ff'
          }}>
          {row.region}
        </span>
      </div>
    </div>
  );
}
