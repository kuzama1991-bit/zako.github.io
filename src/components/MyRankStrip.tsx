import { useEffect, useState, useCallback } from 'react';
import { User, Trophy, Swords, RefreshCw } from 'lucide-react';
import type { Player } from '../utils/data';
import { fmtInt } from '../utils/data';
import { fetchGlobalLeaderboard, formatRiftTime, type Region, type SoloClass } from '../utils/blizzardApi';

const SOLO_CLASSES: SoloClass[] = ['barbarian', 'crusader', 'dh', 'monk', 'necromancer', 'wd', 'wizard'];

interface RiftBest {
  label: string;
  rank: number;
  score: number;
  time: string;
}

interface Props {
  players: Player[];
  seasonId: number;
  onOpenProfile: () => void;
  tr?: (key: string) => string;
}

export default function MyRankStrip({ players, seasonId, onOpenProfile, tr }: Props) {
  const label = (en: string, key?: string) => (tr && key ? tr(key) : en);
  const btag = typeof localStorage !== 'undefined' ? localStorage.getItem('d3_my_btag') || '' : '';
  const myRegion = (typeof localStorage !== 'undefined' ? localStorage.getItem('d3_my_region') : null) as Region | null;

  const [riftBest, setRiftBest] = useState<{
    solo: RiftBest | null;
    team2: RiftBest | null;
    team3: RiftBest | null;
    team4: RiftBest | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const nameKey = btag.split('#')[0].toLowerCase();
  const paragonEntry = players.find(p => p.name.toLowerCase() === nameKey) || null;

  const loadRift = useCallback(async () => {
    if (!btag || !nameKey) return;
    setLoading(true);
    const region: Region = myRegion || 'eu';
    const result = { solo: null as RiftBest | null, team2: null as RiftBest | null, team3: null as RiftBest | null, team4: null as RiftBest | null };

    const match = (entries: Awaited<ReturnType<typeof fetchGlobalLeaderboard>>) =>
      entries.find(e => e.members.some(m => m.battletag.split('#')[0].toLowerCase() === nameKey));

    try {
      await Promise.all([
        ...SOLO_CLASSES.map(async cls => {
          try {
            const type = cls === 'dh' ? 'rift-dh' : cls === 'wd' ? 'rift-wd' : `rift-${cls}`;
            const entries = await fetchGlobalLeaderboard(seasonId, type, false, region);
            const m = match(entries);
            if (m && (!result.solo || m.rank < result.solo.rank)) {
              result.solo = {
                label: cls === 'necromancer' ? 'Necro' : cls === 'barbarian' ? 'Barb' : cls.toUpperCase().slice(0, 4),
                rank: m.rank,
                score: m.score,
                time: formatRiftTime(m.time),
              };
            }
          } catch { /* skip */ }
        }),
        (async () => {
          try {
            const entries = await fetchGlobalLeaderboard(seasonId, 'rift-team-2', false, region);
            const m = match(entries);
            if (m) result.team2 = { label: '2P', rank: m.rank, score: m.score, time: formatRiftTime(m.time) };
          } catch { /* skip */ }
        })(),
        (async () => {
          try {
            const entries = await fetchGlobalLeaderboard(seasonId, 'rift-team-3', false, region);
            const m = match(entries);
            if (m) result.team3 = { label: '3P', rank: m.rank, score: m.score, time: formatRiftTime(m.time) };
          } catch { /* skip */ }
        })(),
        (async () => {
          try {
            const entries = await fetchGlobalLeaderboard(seasonId, 'rift-team-4', false, region);
            const m = match(entries);
            if (m) result.team4 = { label: '4P', rank: m.rank, score: m.score, time: formatRiftTime(m.time) };
          } catch { /* skip */ }
        })(),
      ]);
    } finally {
      setRiftBest(result);
      setLoading(false);
    }
  }, [btag, nameKey, myRegion, seasonId]);

  useEffect(() => {
    if (btag) loadRift();
  }, [btag, loadRift]);

  if (!btag) return null;

  const displayName = btag.split('#')[0].toUpperCase();

  const RankChip = ({ label, best }: { label: string; best: RiftBest | null }) => (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono-diablo"
      style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-muted)' }}
      title={best ? `GR${best.score} · ${best.time}` : 'Not on board'}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {loading && !riftBest ? (
        <span style={{ color: 'var(--text-muted)' }}>…</span>
      ) : best ? (
        <span style={{ color: 'var(--gold-bright)' }}>#{best.rank}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  );

  return (
    <div
      className="sticky top-0 z-40"
      style={{
        background: 'var(--bg-deep)',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
          title={label("Open My Profile", "openMyProfile")}
        >
          <div
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))' }}
          >
            <User className="h-3.5 w-3.5" style={{ color: '#0a0908' }} />
          </div>
          <span className="font-serif-display font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>
            {displayName}
          </span>
        </button>

        <div className="h-5 w-px" style={{ background: 'var(--border-muted)' }} />

        <div className="flex items-center gap-1.5 text-xs">
          <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--gold-dark)' }} />
          <span style={{ color: 'var(--text-muted)' }}>{label("Paragon", "paragon")}</span>
          {paragonEntry ? (
            <>
              <span className="font-mono-diablo font-bold" style={{ color: 'var(--gold-bright)' }}>
                #{paragonEntry.worldRank}
              </span>
              <span className="font-mono-diablo" style={{ color: 'var(--text-secondary)' }}>
                · {fmtInt(paragonEntry.paragon)}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </div>

        <div className="h-5 w-px hidden sm:block" style={{ background: 'var(--border-muted)' }} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <Swords className="h-3.5 w-3.5 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
          <RankChip label="Solo" best={riftBest?.solo ?? null} />
          <RankChip label="2P" best={riftBest?.team2 ?? null} />
          <RankChip label="3P" best={riftBest?.team3 ?? null} />
          <RankChip label="4P" best={riftBest?.team4 ?? null} />
        </div>

        {loading && (
          <RefreshCw className="h-3 w-3 animate-spin ml-auto" style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
    </div>
  );
}
