import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as React from 'react';
import {
  ArrowUp, ArrowDown, RefreshCw, Trophy, Star,
  Zap, Clock, LayoutGrid, ChevronDown,
  Shield, Calculator, Info, Flame, Crown, X, Image as ImageIcon,
  Table as TableIcon, Globe, Users, Target, TrendingUp, User, Crosshair, MessageSquarePlus, ExternalLink,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  type Player, type SortKey,
  fetchLeaderboard, comparePlayers,
  fmtInt, fmtDec,
  xpBetweenLevels, xpToTrillion, estimateDays,
  formatHoursToTime,
  loadParagonTable,
} from './utils/data';
import { LANGUAGES, UI, t, type Lang, type TKey, langLabel, langFlag } from './i18n';
import RiftView from './components/RiftView';
import RiftTop3Showcase from './components/RiftTop3Showcase';
import ChallengeRiftCard from './components/ChallengeRiftCard';
import NextSeasonCard from './components/NextSeasonCard';
import NewsButton from './components/NewsButton';
import HubNav, { type HubTab } from './components/features/HubNav';
import { recordSnapshots, gainSinceMonday } from './utils/snapshots';
import CompareView from './components/features/CompareView';
import ParagonRaceView from './components/features/ParagonRaceView';
import WeeklyRaceView from './components/features/WeeklyRaceView';
import MyProfile, { type BoardJump } from './components/features/MyProfile';
import HelpModal from './components/HelpModal';
import MyRankStrip from './components/MyRankStrip';
import FriendsStrip, { loadFriends, saveFriends } from './components/FriendsStrip';
import WhatsNewModal, { shouldShowWhatsNew, markWhatsNewSeen, APP_VERSION } from './components/WhatsNewModal';
import SessionDigestBanner from './components/SessionDigestBanner';
import { NextUpdateCountdown, LocalClock } from './components/ClockWidgets';
import { getSeasons, fetchGlobalLeaderboard, formatRiftTime, type SoloClass, type Region as ApiRegion } from './utils/blizzardApi';
import { initTheme, applyTheme, type ThemeId } from './utils/theme';
import LoadingScreen from './components/LoadingScreen';
import FeedbackModal from './components/FeedbackModal';
import ProfileSetupModal from './components/ProfileSetupModal';
import ScrollTopContainer from './components/ScrollTopContainer';
import { useModalDismiss } from './hooks/useModalDismiss';
import { openBlizzardProfile } from './utils/blizzardProfile';

declare global {
  interface Window {
    d3electron?: {
      onBackgroundSnapshot: (cb: () => void) => () => void;
      setTrayTooltip: (text: string) => void;
      setSnapshotIntervalHours?: (hours: number) => void;
      saveSeasonExport: (payload: { filename: string; dataUrl: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      getExportsDir: () => Promise<string>;
    };
  }
}

// ════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════

type ViewMode = 'table' | 'grid';
type Region = 'world' | 'eu' | 'us' | 'kr';

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [paragonSheetRows, setParagonSheetRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const s = localStorage.getItem('d3v');
    return s === 'grid' ? 'grid' : 'table';
  });
  const [hubTab, setHubTab] = useState<HubTab | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  // Show changelog once after version bump
  useEffect(() => {
    if (shouldShowWhatsNew()) setShowWhatsNew(true);
  }, []);


  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('d3f') || '[]')); }
    catch { return new Set(); }
  });
  const [showFavs, setShowFavs] = useState(false);
  const [friends, setFriends] = useState<string[]>(() => loadFriends());
  const setFriendsPersist = (names: string[]) => {
    setFriends(names);
    saveFriends(names);
  };
  const [region, setRegion] = useState<Region>('world');
  const [lang, setLang] = useState<Lang>(() => {
    const s = localStorage.getItem('d3lang');
    return (s && UI[s as Lang]) ? s as Lang : 'en';
  });
  const [langOpen, setLangOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [syncMin, setSyncMin] = useState(10);
  const [snapshotHours, setSnapshotHours] = useState<number>(() => {
    const n = Number(localStorage.getItem('d3_snapshot_hours') || '6');
    return [1, 2, 3, 6, 12, 24].includes(n) ? n : 6;
  });
  const [theme, setTheme] = useState<ThemeId>(() => {
    try { return initTheme(); } catch { return 'classic'; }
  });
  const [use24h, setUse24h] = useState(() => {
    const stored = localStorage.getItem('d3_24h');
    return stored !== null ? stored === 'true' : true;
  });
  const [paragonGoal, setParagonGoal] = useState<number>(() => {
    return Number(localStorage.getItem('d3_paragon_goal') || '20000');
  });
  useEffect(() => { localStorage.setItem('d3_paragon_goal', String(paragonGoal)); _paragonGoal = paragonGoal; }, [paragonGoal]);
  // Also set on first render
  _paragonGoal = paragonGoal;

  useEffect(() => {
    localStorage.setItem('d3_snapshot_hours', String(snapshotHours));
    window.d3electron?.setSnapshotIntervalHours?.(snapshotHours);
  }, [snapshotHours]);

  const handleTheme = (id: ThemeId) => {
    applyTheme(id);
    setTheme(id);
  };

  // Rift leaderboard state
  type RiftTab = 'paragon' | 'solo' | 'team2' | 'team3' | 'team4';
  const [riftTab, setRiftTab] = useState<RiftTab>('paragon');

  const [seasonId, setSeasonId] = useState(38);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([38]);
  const [soloClass, setSoloClass] = useState<SoloClass>('wizard');

  // ── Paragon Season Archive ─────────────────────────────────
  // Automatically saves the paragon leaderboard per season.
  // When a new season starts, the previous season's data is
  // preserved so you can look back at old seasons.
  interface SeasonArchive {
    season: number;
    date: string;
    playerCount: number;
    players: Player[];
  }

  const [archives, setArchives] = useState<SeasonArchive[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('d3_paragon_archives') || '[]');
    } catch { return []; }
  });
  const [viewingSeason] = useState<number | null>(null);

  useEffect(() => { localStorage.setItem('d3_paragon_archives', JSON.stringify(archives)); }, [archives]);

  // Auto-save: whenever we have live data and a known season,
  // update (or create) the archive entry for that season.
  useEffect(() => {
    if (players.length === 0 || !seasonId) return;
    setArchives(prev => {
      const existing = prev.find(a => a.season === seasonId);
      const updated: SeasonArchive = {
        season: seasonId,
        date: new Date().toLocaleDateString(),
        playerCount: players.length,
        players: [...players],
      };
      if (existing) {
        return prev.map(a => a.season === seasonId ? updated : a);
      }
      return [...prev, updated].sort((a, b) => b.season - a.season);
    });
  }, [players, seasonId]);

  // Get available paragon seasons (current live + all archived)


  // Use archived data or live data
  const displayPlayers = viewingSeason !== null && viewingSeason !== seasonId
    ? (archives.find(a => a.season === viewingSeason)?.players || players)
    : players;

  // Fetch available seasons from Blizzard so the app follows new seasons automatically.
  // Blizzard API sometimes returns limited results, so we ensure the recent seasons are always in the list.
  useEffect(() => {
    const lookupRegion = region === 'world' ? 'eu' : region;
    getSeasons(lookupRegion)
      .then((result) => {
        if (result.seasons.length > 0) {
          // Merge fetched seasons with a known range to ensure 34-38 are present
          const allSeasons = new Set([...result.seasons, 34, 35, 36, 37, 38]);
          setAvailableSeasons(Array.from(allSeasons).sort((a, b) => b - a));
          
          setSeasonId(result.current || result.seasons[0]);
        }
      })
      .catch(() => {
        setAvailableSeasons([38, 37, 36, 35, 34]);
        setSeasonId(38);
      });
  }, [region]);
  useEffect(() => { localStorage.setItem('d3f', JSON.stringify([...favorites])); }, [favorites]);
  useEffect(() => { localStorage.setItem('d3v', viewMode); }, [viewMode]);


  const [showFeedback, setShowFeedback] = useState(false);
  const [profileTick, setProfileTick] = useState(0);
  const [showProfileSetup, setShowProfileSetup] = useState(() => {
    try {
      if (localStorage.getItem('d3_my_btag')) return false;
      if (localStorage.getItem('d3_profile_setup_later') === '1') return false;
      return true;
    } catch { return false; }
  });


  const jumpToMyRow = useCallback(() => {
    try {
      const btag = localStorage.getItem('d3_my_btag') || '';
      const name = btag.split('#')[0]?.trim();
      if (!name) {
        setShowProfile(true);
        return;
      }
      // Ensure paragon table is visible
      setRiftTab('paragon');
      setShowFavs(false);
      // clear search so row is in the list
      setSearch('');
      setRegion('world');
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-player-row="${CSS.escape(name.toLowerCase())}"]`) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('row-flash');
          setTimeout(() => el.classList.remove('row-flash'), 4500);
        } else {
          setShowProfile(true);
        }
      });
    } catch {
      setShowProfile(true);
    }
  }, []);

  useEffect(() => { localStorage.setItem('d3lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('d3_24h', String(use24h)); }, [use24h]);

  const tr = useCallback((key: TKey) => t(lang, key), [lang]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchLeaderboard();
      setPlayers(data.players);
      setParagonSheetRows(data.sheetRows || data.players.length);
      setLastFetch(Date.now());

      // Record daily snapshots for history tracking
      recordSnapshots(data.players.map(p => ({
        name: p.name,
        paragon: p.paragon,
        xpRate7d: p.xpRate7d,
        paragonInWeek: p.paragonInWeek,
        rank: p.rank,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadParagonTable(); }, [load]);



  // Auto-refresh without re-rendering the whole app every second (was a major CPU drain).
  // Check every 15s; skip while tab/window is hidden to reduce background load.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!lastFetch || loading) return;
      if (Date.now() - lastFetch >= syncMin * 60 * 1000) load();
    }, 15_000);
    return () => clearInterval(id);
  }, [lastFetch, loading, syncMin, load]);

  // Tray / background snapshot: main process pings every 6h (and after 15m)
  useEffect(() => {
    if (!window.d3electron?.onBackgroundSnapshot) return;
    return window.d3electron.onBackgroundSnapshot(() => {
      load();
    });
  }, [load]);

  // Update tray tooltip with weekly gain for "me"
  useEffect(() => {
    if (!window.d3electron?.setTrayTooltip || players.length === 0) return;
    try {
      const btag = localStorage.getItem('d3_my_btag');
      const name = btag ? btag.split('#')[0] : null;
      if (!name) {
        window.d3electron.setTrayTooltip('D3Leaderboard — background');
        return;
      }
      const gain = gainSinceMonday(name);
      const tip = gain != null && gain > 0
        ? `D3Leaderboard — +${gain.toLocaleString()} paragon since Monday`
        : 'D3Leaderboard — background';
      window.d3electron.setTrayTooltip(tip);
    } catch { /* ignore */ }
  }, [players]);

  // Pre-populate the name→battletag cache from ALL solo classes
  // so the Paragon dialog can build correct Blizzard profile URLs.
  // Deferred + skipped while window is hidden to reduce background CPU/network.
  useEffect(() => {
    let cancelled = false;
    const populateBtagCache = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const stored: Record<string, string> = {};
      try {
        Object.assign(stored, JSON.parse(localStorage.getItem('d3_btag_map') || '{}'));
      } catch { /* start fresh */ }

      const lookupRegion = region === 'world' ? 'eu' : region;
      const { fetchGlobalLeaderboard: fetchRift } = await import('./utils/blizzardApi');
      const classes = ['rift-barbarian','rift-crusader','rift-dh','rift-monk','rift-necromancer','rift-wd','rift-wizard'];

      // Sequential (not parallel) to avoid slamming API / CPU when app is open
      for (const cls of classes) {
        if (cancelled || document.hidden) break;
        try {
          const entries = await fetchRift(seasonId, cls, false, lookupRegion);
          entries.forEach(e => {
            e.members.forEach((m: any) => {
              const name = m.battletag.split('#')[0].toLowerCase();
              stored[name] = m.battletag;
            });
          });
        } catch { /* skip on failure */ }
      }

      if (!cancelled) localStorage.setItem('d3_btag_map', JSON.stringify(stored));
    };
    // Delay so first paint + leaderboard load aren't competing
    const t = window.setTimeout(populateBtagCache, 8000);
    return () => { cancelled = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, region]);

  // ── Live rank movement tracking ────────────────────────────
  // Compares current world rank to last-seen ranks (localStorage + session).
  // Positive delta = moved up the board, negative = dropped.
  const RANK_SNAP_KEY = 'd3_rank_snapshot';
  const RANK_MOVE_KEY = 'd3_rank_movements';

  const prevRanksRef = useRef<Map<string, number> | null>(null);
  if (prevRanksRef.current === null) {
    try {
      const raw = JSON.parse(localStorage.getItem(RANK_SNAP_KEY) || '{}');
      prevRanksRef.current = new Map(
        Object.entries(raw).map(([k, v]) => [k, Number(v)] as [string, number])
      );
    } catch {
      prevRanksRef.current = new Map();
    }
  }

  const [rankMovements, setRankMovements] = useState<Map<string, number>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RANK_MOVE_KEY) || '{}');
      return new Map(
        Object.entries(raw)
          .map(([k, v]) => [k, Number(v)] as [string, number])
          .filter(([, v]) => Number.isFinite(v) && v !== 0)
      );
    } catch {
      return new Map();
    }
  });

  useEffect(() => {
    if (players.length === 0) return;
    const prev = prevRanksRef.current ?? new Map<string, number>();
    prevRanksRef.current = prev;
    const hadBaseline = prev.size > 0;
    const newMovements = new Map<string, number>();
    const nextSnap: Record<string, number> = {};

    players.forEach(p => {
      const rank = p.worldRank || p.rank;
      nextSnap[p.name] = rank;
      const oldRank = prev.get(p.name);
      if (hadBaseline && oldRank !== undefined && oldRank !== rank) {
        // positive = climbed (rank number went down)
        newMovements.set(p.name, oldRank - rank);
      }
    });

    players.forEach(p => prev.set(p.name, p.worldRank || p.rank));

    try {
      localStorage.setItem(RANK_SNAP_KEY, JSON.stringify(nextSnap));
    } catch { /* ignore quota */ }

    if (newMovements.size > 0) {
      setRankMovements(prevMap => {
        const merged = new Map(prevMap);
        newMovements.forEach((v, k) => {
          if (v === 0) merged.delete(k);
          else merged.set(k, v);
        });
        try {
          const obj: Record<string, number> = {};
          merged.forEach((v, k) => { obj[k] = v; });
          localStorage.setItem(RANK_MOVE_KEY, JSON.stringify(obj));
        } catch { /* ignore */ }
        return merged;
      });
    } else if (!hadBaseline) {
      try { localStorage.setItem(RANK_MOVE_KEY, '{}'); } catch { /* ignore */ }
    }
  }, [players]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'rank' || key === 'worldRank' || key === 'name' || key === 'region' ? 'asc' : 'desc'); }
  };

  const toggleFav = (name: string) => setFavorites(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const filtered = useMemo(() => {
    let list = displayPlayers;
    if (region !== 'world') list = list.filter(p => p.region === region);
    if (showFavs) list = list.filter(p => favorites.has(p.name));

    // Smart search: name, #rank / #1-50, >9000 / min:9000, region:eu
    if (search.trim()) {
      const raw = search.trim();
      const tokens = raw.split(/\s+/);
      for (const token of tokens) {
        const q = token.toLowerCase();

        // Rank range: #1-50 or rank:1-50
        const rangeMatch = q.match(/^(?:#|rank:)?(\d+)\s*[-–]\s*(\d+)$/) || q.match(/^#(\d+)-(\d+)$/);
        if (rangeMatch) {
          const lo = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
          const hi = Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
          list = list.filter(p => p.rank >= lo && p.rank <= hi);
          continue;
        }

        // Exact rank: #12
        const rankMatch = q.match(/^#(\d+)$/) || q.match(/^rank:(\d+)$/);
        if (rankMatch) {
          const r = Number(rankMatch[1]);
          list = list.filter(p => p.rank === r);
          continue;
        }

        // Min paragon: >9000 or min:9000 or paragon>9000
        const minMatch = q.match(/^(?:>|min:|paragon>|paragon:>=?)(\d+)$/);
        if (minMatch) {
          const min = Number(minMatch[1]);
          list = list.filter(p => p.paragon >= min);
          continue;
        }

        // Max paragon: <5000
        const maxMatch = q.match(/^(?:<|max:|paragon<)(\d+)$/);
        if (maxMatch) {
          const max = Number(maxMatch[1]);
          list = list.filter(p => p.paragon <= max);
          continue;
        }

        // Region: region:eu / region:us / region:kr
        const regionMatch = q.match(/^region:(eu|us|kr|world)$/);
        if (regionMatch) {
          const r = regionMatch[1];
          if (r !== 'world') list = list.filter(p => p.region.toLowerCase() === r);
          continue;
        }

        // Plain name search — prefix only ( "sa" matches Sanctus, not Isa )
        list = list.filter(p => p.name.toLowerCase().startsWith(q));
      }
    }

    const sortedList = [...list].sort((a, b) => {
      if (sortKey === 'timeUntil15kHours') {
        const aHours = getCalculatedValues(a).hoursUntil20k;
        const bHours = getCalculatedValues(b).hoursUntil20k;
        const direction = sortDir === 'asc' ? 1 : -1;
        const aBad = !Number.isFinite(aHours);
        const bBad = !Number.isFinite(bHours);
        if (aBad && bBad) return 0;
        if (aBad) return 1;
        if (bBad) return -1;
        return (aHours - bHours) * direction;
      }
      return comparePlayers(a, b, sortKey, sortDir);
    });

    if (region !== 'world') {
      return sortedList.map((p, index) => ({ ...p, rank: index + 1 }));
    }
    return sortedList;
  }, [displayPlayers, region, showFavs, search, favorites, sortKey, sortDir]);

  const topP = filtered.reduce((m, p) => Math.max(m, p.paragon), 0);
  const lowP = filtered.length ? filtered.reduce((m, p) => Math.min(m, p.paragon), Infinity) : 0;
  const avgP = filtered.length ? Math.round(filtered.reduce((s, p) => s + p.paragon, 0) / filtered.length) : 0;
  const top3 = [...filtered].sort((a, b) => a.rank - b.rank).slice(0, 3);

  // Always count every loaded hero per region (not max rank)
  const regionCounts = useMemo(() => {
    const c = { world: displayPlayers.length, eu: 0, us: 0, kr: 0, other: 0 };
    for (const p of displayPlayers) {
      const r = (p.region || '').toLowerCase();
      if (r === 'eu') c.eu += 1;
      else if (r === 'us') c.us += 1;
      else if (r === 'kr') c.kr += 1;
      else c.other += 1;
    }
    // Prefer full sheet row count for World (includes ranks up to #1000 before exact-dupe collapse)
    if (paragonSheetRows > c.world) c.world = paragonSheetRows;
    return c;
  }, [displayPlayers, paragonSheetRows]);

  const trackedPrimary =
    region === 'eu' ? regionCounts.eu
    : region === 'us' ? regionCounts.us
    : region === 'kr' ? regionCounts.kr
    : regionCounts.world;

  const paragonCardRankLabel = region === 'world' ? tr('worldRank') : `${region.toUpperCase()} ${tr('rank')}`;

  const getRegionRank = (player: Player) => {
    const playerRegion = player.region.toLowerCase();
    const regionRows = displayPlayers
      .filter((p) => p.region.toLowerCase() === playerRegion)
      .sort((a, b) => a.worldRank - b.worldRank || a.name.localeCompare(b.name));
    const index = regionRows.findIndex(
      (p) =>
        p.name === player.name &&
        p.region === player.region &&
        p.mode === player.mode &&
        p.worldRank === player.worldRank,
    );
    return index >= 0 ? index + 1 : player.rank;
  };

  const paragonDialogRankLabel = selectedPlayer
    ? `${selectedPlayer.region.toUpperCase()} ${tr('rank')}`
    : tr('rank');
  const paragonDialogRankValue = selectedPlayer ? getRegionRank(selectedPlayer) : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}>
      {/* ═══ HEADER ═══ */}
      <header className="d3-header-bg px-6 py-5">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', border: '1px solid var(--gold-bright)' }}>
              <Shield className="h-7 w-7" style={{ color: '#0a0908' }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif-display text-2xl lg:text-3xl font-bold" style={{ color: 'var(--gold-bright)' }}>
                  {tr('title')}
                </h1>
                <span
                  className="text-[10px] font-mono-diablo px-2.5 py-1 rounded-full uppercase tracking-widest select-none"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    color: 'var(--gold-bright)',
                    border: '1px solid var(--gold-dark)',
                    boxShadow: '0 0 14px var(--gold-glow)',
                    fontWeight: 800,
                    cursor: 'default',
                  }}
                >
                  v{APP_VERSION}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-start lg:justify-end gap-2 flex-wrap">
            <NextUpdateCountdown lastFetch={lastFetch} syncMin={syncMin} label={tr('nextUpdate')} />
            <LocalClock use24h={use24h} />
            <div className="d3-input flex items-center gap-1.5 text-xs font-mono-diablo font-semibold whitespace-nowrap" style={{ padding: '0.35rem 0.6rem' }}>
              <span className="live-dot h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--green)' }} />
              <span style={{ color: 'var(--green)' }}>{tr('liveReady')}</span>
            </div>
            <HelpModal
              syncMin={syncMin}
              setSyncMin={setSyncMin}
              use24h={use24h}
              setUse24h={setUse24h}
              paragonGoal={paragonGoal}
              setParagonGoal={setParagonGoal}
              snapshotHours={snapshotHours}
              setSnapshotHours={setSnapshotHours}
              theme={theme}
              setTheme={handleTheme}
            />
            <button
              type="button"
              className="d3-btn"
              style={{ padding: '0.35rem 0.6rem' }}
              title="Report bug / Request feature"
              onClick={() => setShowFeedback(true)}
            >
              <MessageSquarePlus className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ STATS ═══ */}
      <div className="max-w-[1600px] mx-auto px-6 py-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-stretch">
          <Stat
            label={tr('totalTracked')}
            icon={<Users className="h-6 w-6" />}
            accent="#6699ff"
            val={
              <div className="flex flex-col min-w-0">
                <span className="font-mono-diablo">{trackedPrimary}</span>
                <span className="text-xs font-normal mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {region === 'world' ? tr('heroes') : `${region.toUpperCase()} ${tr('heroes')}`}
                </span>
              </div>
            }
          />
          <Stat
            label={tr('topParagon')}
            icon={<Crown className="h-6 w-6" />}
            accent="#f5c542"
            val={
              <div className="flex flex-col">
                <span className="font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>{fmtInt(topP)}</span>
                <span className="text-xs font-mono-diablo mt-0.5" style={{ color: 'var(--text-muted)' }}>Low: {fmtInt(lowP === Infinity ? 0 : lowP)}</span>
              </div>
            }
          />
          <Stat
            label={tr('averageParagon')}
            icon={<TrendingUp className="h-6 w-6" />}
            accent="#66ddaa"
            val={<span className="font-mono-diablo">{fmtInt(avgP)}</span>}
          />
          <Stat
            label={tr('goalProgress')}
            icon={<Target className="h-6 w-6" />}
            accent="#ff6666"
            val={<><span className="font-mono-diablo">{paragonGoal.toLocaleString()}</span> <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>{tr('cap')}</span></>}
          />
          <ChallengeRiftCard region={region} />
          <NextSeasonCard />
        </div>
      </div>
      
      <NewsButton />
      {showProfile && (
        <MyProfile
          players={players}
          seasonId={seasonId}
          onClose={() => setShowProfile(false)}
          onJumpToBoard={(jump: BoardJump) => {
            if (jump.tab === 'solo') {
              setRiftTab('solo');
              setSoloClass(jump.soloClass);
            } else if (jump.tab === 'paragon') {
              setRiftTab('paragon');
            } else {
              setRiftTab(jump.tab);
            }
            setShowProfile(false);
          }}
        />
      )}

      {showProfileSetup && (
        <ProfileSetupModal
          onSaved={() => { setShowProfileSetup(false); setProfileTick(t => t + 1); }}
          onLater={() => setShowProfileSetup(false)}
        />
      )}

      {showFeedback && (
        <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
      )}

      {showWhatsNew && (
        <WhatsNewModal
          onClose={() => {
            markWhatsNewSeen();
            setShowWhatsNew(false);
          }}
        />
      )}

      {loading && players.length === 0 && (
        <LoadingScreen fullScreen label={tr('loadingSanctuary')} />
      )}

      <SessionDigestBanner players={players} friends={friends} ready={!loading && players.length > 0} />

      {/* Sticky personal rank strip when My Profile is configured */}
      <MyRankStrip key={profileTick} players={players} seasonId={seasonId} onOpenProfile={() => setShowProfile(true)} tr={tr} />

      <FriendsStrip
        players={players}
        friends={friends}
        onChange={setFriendsPersist}
        onViewPlayer={setSelectedPlayer}
        tr={tr}
      />

      {/* ═══ TOP 3 ═══ */}
      {/* ═══ TOP 3 SHOWCASE ═══ */}
      {riftTab === 'paragon' ? (
        top3.length > 0 && (
          <section className="max-w-[1600px] mx-auto px-6 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif-display text-lg font-bold flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
                <Trophy className="h-5 w-5" /> {tr('top3Showcase')}
              </h2>

            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {top3.map((p, i) => (
                <Top3Card key={`${p.name}-${p.region}-${p.rank}-${i}`} p={p} i={i} fav={favorites.has(p.name)} onToggle={toggleFav}
                  onClick={() => setSelectedPlayer(p)} tr={tr} rankLabel={paragonCardRankLabel} />
              ))}
            </div>
          </section>
        )
      ) : (
        <RiftTop3Showcase
          tab={riftTab as 'solo' | 'team2' | 'team3' | 'team4'}
          season={seasonId}
          regionFilter={region === 'world' ? 'world' : (region as 'eu' | 'us' | 'kr')}
          soloClass={soloClass}
          tr={tr}
        />
      )}

      {/* ═══ v3.5 HUB NAV ═══ */}
      <section className="max-w-[1600px] mx-auto px-6 pb-4">
        <HubNav active={hubTab} onSelect={setHubTab} tr={tr} />
      </section>

      {/* ═══ v3.5 HUB CONTENT ═══ */}
      {hubTab && (
        <section className="max-w-[1600px] mx-auto px-6 pb-6">
          <div className="d3-card p-6" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
            {hubTab === 'compare' && <CompareView players={players} />}
            {hubTab === 'race'    && <ParagonRaceView players={players} />}
            {hubTab === 'weekly'  && <WeeklyRaceView players={players} />}
          </div>
        </section>
      )}

      {/* ═══ CONTROLS ═══ */}
      <section className="max-w-[1600px] mx-auto px-6 pb-5">
        <div className="d3-card flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search name, #1-50, >9000, region:eu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 pr-8 d3-input"
              title="Smart search: name · #12 · #1-50 · >9000 · min:9000 · region:eu"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--border-subtle)]"
                style={{ color: 'var(--text-secondary)' }}
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button onClick={() => setLangOpen(!langOpen)} className="d3-btn">
              <Globe className="h-4 w-4" />
              <span className="mr-1">{langFlag(lang)}</span>
              {langLabel(lang, lang)}
              <ChevronDown className={`h-3 w-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 d3-card min-w-[180px] py-1 shadow-2xl" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code as Lang); setLangOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${lang === l.code ? 'bg-[var(--gold-dark)] text-[#0a0908] font-bold' : 'hover:bg-[var(--border-subtle)] text-[var(--text-primary)]'}`}
                    >
                      <span className="text-base">{langFlag(l.code)}</span>
                      <span>{langLabel(l.code, lang)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Region Selector */}
          <div className="d3-input flex items-stretch p-0.5">
            <RegionBtn active={region === 'world'} onClick={() => setRegion('world')}>🌍 World</RegionBtn>
            <RegionBtn active={region === 'eu'} onClick={() => setRegion('eu')}>🇪🇺 EU</RegionBtn>
            <RegionBtn active={region === 'us'} onClick={() => setRegion('us')}>🇺🇸 US</RegionBtn>
            <RegionBtn active={region === 'kr'} onClick={() => setRegion('kr')}>🇰🇷 KR</RegionBtn>
          </div>

          <button onClick={() => setShowFavs(!showFavs)} className={`d3-btn ${showFavs ? 'd3-btn-primary' : ''}`}>
            <Star className={`h-4 w-4 ${showFavs ? 'fill-current' : ''}`} /> {tr('favorites')} ({favorites.size})
          </button>
          <div className="d3-input flex items-stretch p-0.5" title={viewMode === 'table' ? tr('tableView') : tr('gridView')}>
            <VBtn active={viewMode === 'table'} onClick={() => setViewMode('table')}><TableIcon className="h-4 w-4" /></VBtn>
            <VBtn active={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></VBtn>
          </div>
          <button onClick={load} className="d3-btn d3-btn-primary">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {tr('updateNow')}
          </button>
          <button
            type="button"
            onClick={jumpToMyRow}
            className="d3-btn"
            title="Scroll to your row on the paragon table"
          >
            <Crosshair className="h-4 w-4" /> Where am I?
          </button>
          <button
            onClick={() => setShowProfile(true)}
            className="d3-btn d3-btn-profile"
            title={tr('myProfile')}
          >
            <User className="h-4 w-4" /> {tr('myProfile')}
          </button>
        </div>
      </section>



      {/* ═══ SEASON TIMER ═══ */}


      {/* ═══ RIFT LEADERBOARD TABS ═══ */}
      <section className="max-w-[1600px] mx-auto px-6 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ['paragon', `🏆 ${tr('paragonTab')}`],
            ['solo', `⚔ ${tr('soloTab')}`],
            ['team2', `👥 ${tr('team2Tab')}`],
            ['team3', `👥 ${tr('team3Tab')}`],
            ['team4', `👥 ${tr('team4Tab')}`],
          ] as [RiftTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRiftTab(key)}
              className={`d3-btn ${riftTab === key ? 'd3-btn-primary' : ''}`}
            >
              {label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {riftTab !== 'paragon' && (
              <>
                <span className="text-xs font-mono-diablo font-bold" style={{ color: 'var(--text-secondary)' }}>Season:</span>
                <select
                  className="px-3 py-2 rounded text-xs font-mono-diablo font-bold cursor-pointer outline-none"
                  style={{
                    background: 'var(--bg-card-alt)',
                    color: 'var(--gold-bright)',
                    border: '1px solid var(--border-muted)',
                    colorScheme: 'dark',
                  }}
                  value={seasonId}
                  onChange={e => setSeasonId(Number(e.target.value))}
                >
                  {availableSeasons.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ DATA ═══ */}
      <section className="max-w-[1600px] mx-auto px-6 pb-6">
        {riftTab !== 'paragon' ? (
          <RiftView
            tab={riftTab as 'solo' | 'team2' | 'team3' | 'team4'}
            season={seasonId}
            regionFilter={region === 'world' ? 'world' : (region as 'eu' | 'us' | 'kr')}
            search={search}
            tr={tr}
            soloClass={soloClass}
            setSoloClass={setSoloClass}
            viewMode={viewMode}
          />
        ) : loading && !players.length ? (
          <LoadingScreen label={tr('loadingLeaderboard')} />
        ) : error ? (
          <div className="d3-card p-8 text-center">
            <p style={{ color: 'var(--red)' }}>{error}</p>
            <button onClick={load} className="d3-btn d3-btn-primary mt-4">Retry</button>
          </div>
        ) : (
          <>
            {viewMode === 'table' && <TblView rows={filtered} favs={favorites} sKey={sortKey} sDir={sortDir} onSort={handleSort} onFav={toggleFav} onViewPlayer={setSelectedPlayer} tr={tr} goalLabel={`${(paragonGoal/1000).toFixed(0)}k`} movements={rankMovements} />}
            {viewMode === 'grid' && <GridView rows={filtered} favs={favorites} sKey={sortKey} sDir={sortDir} onSort={handleSort} onFav={toggleFav} onViewPlayer={setSelectedPlayer} tr={tr} goalLabel={`${(paragonGoal/1000).toFixed(0)}k`} movements={rankMovements} />}

            <div className="flex items-center justify-between mt-3 text-xs px-1" style={{ color: 'var(--text-secondary)' }}>
              <span>{tr('showing')} <strong style={{ color: 'var(--gold-bright)' }}>{filtered.length}</strong> {tr('heroes')}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--gold-bright)' }} />{tr('goldContender')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--silver)' }} />{tr('silver')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--bronze)' }} />{tr('bronze')}</span>
              </div>
            </div>
          </>
        )}
        {selectedPlayer && (
          <PlayerDialog
            player={selectedPlayer}
            isFav={favorites.has(selectedPlayer.name)}
            onToggleFav={toggleFav}
            onClose={() => setSelectedPlayer(null)}
            tr={tr}
            rankLabel={paragonDialogRankLabel}
            rankValue={paragonDialogRankValue}
            paragonGoal={paragonGoal}
            seasonId={seasonId}
            regionFilter={region}
          />
        )}
      </section>

      <CalcSection tr={tr} />

      <footer className="border-t py-6 px-6 mt-8" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-base)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="font-serif-display text-sm" style={{ color: 'var(--gold-dark)' }}>⚔ DIABLO 3 LEADERBOARD</div>
          <div className="text-right">
            <div>Community driven live sheet tracking • Syncs direct from published Google Drive</div>
            <div className="mt-0.5 opacity-80">Desktop v{APP_VERSION}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Helper functions
// ════════════════════════════════════════════════════════════

// Module-level variable updated by App — avoids threading paragonGoal through every sub-component
let _paragonGoal = 20000;

function getCalculatedValues(player: Player, goal = _paragonGoal) {
  const pct20k = Math.min((player.paragon / goal) * 100, 100);
  const xpNeededB = xpBetweenLevels(player.paragon, goal);
  const xpNeededTr = xpToTrillion(xpNeededB);
  const hoursUntil20k = xpNeededTr / player.xpRate7d;
  const timeUntil20k = formatHoursToTime(hoursUntil20k);
  return { pct20k, timeUntil20k, hoursUntil20k, goal };
}

// ════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════

function Stat({ label, val, icon, accent }: {
  label: string;
  val: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="d3-card p-4 h-full relative overflow-hidden flex items-center gap-4 group transition-all duration-300 hover:bg-[var(--bg-card)]"
      style={{
        // Subtle radial gradient to fill empty space with a hint of the accent color
        background: `radial-gradient(circle at 90% 10%, ${accent}12 0%, transparent 50%), var(--bg-inset)`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      {icon && (
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{
            background: 'var(--bg-card)',
            color: accent,
            border: `1px solid ${accent}40`,
            boxShadow: `0 0 15px ${accent}20`,
          }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
        <div className="text-2xl lg:text-3xl font-black leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {val}
        </div>
      </div>
    </div>
  );
}

function VBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`d3-btn ${active ? 'd3-btn-primary' : ''}`}
      style={{ padding: '0.35rem 0.55rem' }}
    >
      {children}
    </button>
  );
}

function RegionBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`d3-btn region-btn ${active ? 'd3-btn-primary' : ''}`}
      style={{ padding: '0.35rem 0.65rem' }}
    >
      {children}
    </button>
  );
}

function PlayerRegionBadge({ region }: { region?: string }) {
  const normalized = (region || '').trim().toLowerCase();
  if (!normalized) return null;

  const colors: Record<string, { color: string; bg: string; border: string }> = {
    eu: { color: '#6699ff', bg: 'rgba(30,80,200,0.25)', border: '#3355aa' },
    us: { color: '#ff6666', bg: 'rgba(180,30,30,0.25)', border: '#aa3333' },
    kr: { color: '#cc99ff', bg: 'rgba(200,30,200,0.2)', border: '#883399' },
  };
  const c = colors[normalized] || { color: 'var(--gold-bright)', bg: 'rgba(212,160,23,0.12)', border: 'var(--gold-dark)' };

  return (
    <span
      className="font-mono-diablo text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
    >
      {normalized}
    </span>
  );
}

// ── Top 3 Card ──────────────────────────────────────────────

function Top3Card({ p, i, fav, onToggle, onClick, tr, rankLabel }: {
  p: Player; i: number; fav: boolean; onToggle: (n: string) => void;
  onClick: () => void; tr: (k: TKey) => string; rankLabel: string;
}) {
  const rank = i + 1;
  const { pct20k, timeUntil20k } = getCalculatedValues(p);
  const badge = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : 'rank-3';
  const fill = rank === 1 ? 'progress-fill-gold' : rank === 2 ? 'progress-fill-silver' : 'progress-fill-bronze';
  const placeLabel = rank === 1 ? tr('place1') : rank === 2 ? tr('place2') : tr('place3');
  const pct = Math.min(pct20k, 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="d3-card p-5 relative overflow-hidden cursor-pointer group transition-all duration-300 hover:bg-[var(--bg-card)] hover:border-[var(--gold-dark)]"
      style={{ border: '1px solid var(--border-muted)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-mono-diablo text-sm font-bold px-2.5 py-1 rounded ${badge}`}>#{rank}</span>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>{placeLabel}</div>
            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><Trophy className="h-3 w-3" /> {rankLabel}: {p.rank}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(p.name); }}
          style={{ color: fav ? 'var(--gold-bright)' : 'var(--text-muted)' }}
          title="Favorite"
        >
          <Star className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${fav ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-serif-display text-xl font-bold tracking-wide group-hover:underline truncate" style={{ color: 'var(--gold-bright)' }}>
            {p.name.toUpperCase()}
          </h3>
          <button
            type="button"
            className="p-0.5 rounded opacity-70 hover:opacity-100 shrink-0"
            title="Open Blizzard profile"
            style={{ color: 'var(--gold-bright)' }}
            onClick={(e) => { e.stopPropagation(); openBlizzardProfile(p.name, p.region || 'eu'); }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        <PlayerRegionBadge region={p.region} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('paragon')}</div>
          <div className="font-mono-diablo font-bold text-base" style={{ color: 'var(--gold-bright)' }}>{fmtInt(p.paragon)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('nsParagon')}</div>
          <div className="font-mono-diablo font-bold text-base">{p.nonSeasonParagonRaw || '—'}</div>
        </div>
        <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>{tr('totalXp')}</div>
          <div className="font-mono-diablo font-bold">{p.totalXpRaw || '—'}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span style={{ color: 'var(--text-secondary)' }}>Goal: {(_paragonGoal / 1000).toFixed(0)}k Paragon</span>
          <span className="font-mono-diablo font-bold">{pct20k.toFixed(1)}%</span>
        </div>
        <div className="progress-track h-2"><div className={fill} style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="space-y-1.5 text-xs mb-4">
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Zap className="h-3 w-3" /> {tr('xpRate7d')}</span>
          <span className="font-mono-diablo font-semibold">{p.xpRate7dRaw || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Flame className="h-3 w-3" style={{ color: 'var(--gold-bright)' }} /> {tr('paragonInWeek')}</span>
          <span className="font-mono-diablo font-bold" style={{ color: 'var(--green)' }}>{fmtInt(p.paragonInWeek)}</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Clock className="h-3 w-3" /> Time until {(_paragonGoal/1000).toFixed(0)}k:</span>
          <span className="font-mono-diablo font-semibold">{timeUntil20k}</span>
        </div>
      </div>

      <div className="pt-3 border-t flex justify-between text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5" /> {tr('updated')}</span>
        <span className="font-mono-diablo">{p.updatedAgoRaw || '—'} {tr('ago')}</span>
      </div>
    </div>
  );
}

// ── Table View ──────────────────────────────────────────────

// Column label mappings
const COL_LABELS: Record<string, TKey> = {
  rank: 'rank',
  name: 'name',
  paragon: 'paragon',
  nonSeasonParagon: 'nsParagon',
  totalXp: 'totalXp',
  pctOf15k: 'goalProgress',
  xpRate7d: 'xpRate7d',
  paragonInWeek: 'paragonInWeek',
  timeUntil15kHours: 'timeUntil15k',
  updatedAgoMinutes: 'updated',
};

function TblView({ rows, favs, sKey, sDir, onSort, onFav, onViewPlayer, tr, goalLabel, movements }: {
  rows: Player[]; favs: Set<string>; sKey: SortKey; sDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void; onFav: (n: string) => void;
  onViewPlayer: (p: Player) => void; tr: (k: TKey) => string; goalLabel: string;
  movements: Map<string, number>;
}) {
  const cell = 'px-3 py-3';
  const head = 'px-3 py-3 text-[11px]';
  const text = 'text-sm';
  return (
    <ScrollTopContainer className="d3-card overflow-hidden" style={{ maxHeight: '600px', overflowY: 'auto' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="d3-table-header sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
            <tr>
              <th className={`${head} font-bold tracking-wider uppercase whitespace-nowrap w-10`}>
                <span style={{ color: 'var(--gold-bright)' }}>★</span>
              </th>
              {(['rank', 'name', 'paragon', 'nonSeasonParagon', 'totalXp', 'pctOf15k', 'xpRate7d', 'paragonInWeek', 'timeUntil15kHours', 'updatedAgoMinutes'] as SortKey[]).map(k => (
                <th key={k} onClick={() => onSort(k)}
                  className={`${head} font-bold tracking-wider uppercase whitespace-nowrap cursor-pointer select-none hover:bg-[var(--border-subtle)] transition-colors`}>
                  <span className="inline-flex items-center gap-1" style={{ color: 'var(--gold-bright)' }}>
                    {k === 'timeUntil15kHours' ? `Time until ${goalLabel}:` : tr(COL_LABELS[k] as TKey)}
                    {sKey === k && (sDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, rowIdx) => {
              const { pct20k, timeUntil20k } = getCalculatedValues(p);
              const rc = p.rank <= 3 ? `rank-${p.rank}` : 'rank-default';
              const isFav = favs.has(p.name);
              const move = movements.get(p.name);
              return (
                <tr
                  key={`${p.rank}-${p.name}-${p.region}-${rowIdx}`}
                  data-player-row={p.name.toLowerCase()}
                  className="table-row-hover border-b"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className={`${cell} text-center`}>
                    <button onClick={() => onFav(p.name)} style={{ color: isFav ? 'var(--gold-bright)' : 'var(--text-muted)' }}>
                      <Star className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded ${rc}`}>#{p.rank}</span>
                      {move !== undefined && move !== 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-mono-diablo font-bold px-1.5 py-0.5 rounded"
                          title={move > 0 ? `Climbed ${Math.abs(move)} ranks since last check` : `Dropped ${Math.abs(move)} ranks since last check`}
                          style={{
                            color: move > 0 ? '#66ddaa' : '#ff8888',
                            background: move > 0 ? 'rgba(102,221,170,0.12)' : 'rgba(255,100,100,0.12)',
                            border: `1px solid ${move > 0 ? 'rgba(102,221,170,0.35)' : 'rgba(255,100,100,0.35)'}`,
                          }}
                        >
                          {move > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(move)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${cell} font-serif-display font-bold ${text} tracking-wide whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <PlayerRegionBadge region={p.region} />
                      <span className="cursor-pointer hover:underline" onClick={() => onViewPlayer(p)}>{p.name.toUpperCase()}</span>
                  <button
                    type="button"
                    className="p-0.5 rounded opacity-60 hover:opacity-100"
                    title="Open Blizzard profile"
                    style={{ color: 'var(--gold-bright)' }}
                    onClick={(e) => { e.stopPropagation(); openBlizzardProfile(p.name, p.region || 'eu'); }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                      <button
                        type="button"
                        className="p-0.5 rounded opacity-60 hover:opacity-100"
                        title="Open Blizzard profile"
                        style={{ color: 'var(--gold-bright)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openBlizzardProfile(p.name, p.region || 'eu');
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      {isFav && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--gold-bright)' }} />}
                    </div>
                  </td>
                  <td className={`${cell} font-mono-diablo font-bold ${text}`} style={{ color: 'var(--gold-bright)' }}>{fmtInt(p.paragon)}</td>
                  <td className={`${cell} font-mono-diablo ${text} whitespace-nowrap`}>{p.nonSeasonParagonRaw || '—'}</td>
                  <td className={`${cell} font-mono-diablo ${text} whitespace-nowrap`}>{p.totalXpRaw || '—'}</td>
                  <td className={cell}>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className={`font-mono-diablo font-bold ${text}`} style={{ color: 'var(--gold-bright)' }}>{pct20k.toFixed(1)}%</span>
                      <div className="progress-track w-16 h-1.5"><div className="progress-fill-gold" style={{ width: `${Math.min(pct20k, 100)}%` }} /></div>
                    </div>
                  </td>
                  <td className={`${cell} font-mono-diablo ${text} whitespace-nowrap`}>{p.xpRate7dRaw || '—'}</td>
                  <td className={`${cell} font-mono-diablo font-bold ${text}`} style={{ color: 'var(--green)' }}>{fmtInt(p.paragonInWeek)}</td>
                  <td className={`${cell} font-mono-diablo ${text} whitespace-nowrap`}>{timeUntil20k}</td>
                  <td className={`${cell} font-mono-diablo text-xs whitespace-nowrap`} style={{ color: 'var(--text-muted)' }}>{p.updatedAgoRaw || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ScrollTopContainer>
  );
}

// ── Grid View ───────────────────────────────────────────────

function GridView({ rows, favs, sKey, sDir, onSort, onFav, onViewPlayer, tr, goalLabel, movements }: {
  rows: Player[];
  favs: Set<string>;
  sKey: SortKey;
  sDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  onFav: (n: string) => void;
  onViewPlayer: (p: Player) => void;
  tr: (k: TKey) => string;
  goalLabel: string;
  movements: Map<string, number>;
}) {
  const sortButtonClass = "d3-btn px-3 py-2 text-[11px] uppercase tracking-wider";
  const SortIcon = ({ sortKey }: { sortKey: SortKey }) => (
    sKey === sortKey ? (sDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />) : null
  );

  return (
    <ScrollTopContainer className="d3-card overflow-hidden" style={{ maxHeight: '600px', overflowY: 'auto' }}>
      {/* Card sort controls */}
      <div className="sticky top-0 z-10 d3-table-header border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-secondary)' }}>{tr('sortBy')}</span>
          {([
            ['rank', tr('rank')],
            ['name', tr('name')],
            ['paragon', tr('paragon')],
            ['totalXp', tr('totalXp')],
            ['pctOf15k', tr('goalProgress')],
            ['paragonInWeek', tr('paragonInWeek')],
            ['timeUntil15kHours', `Time until ${goalLabel}:`],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onSort(key)}
              className={`${sortButtonClass} ${sKey === key ? 'd3-btn-primary' : ''}`}
              style={sKey !== key ? { color: 'var(--gold-bright)' } : undefined}
            >
              <span className="inline-flex items-center gap-1">{label}<SortIcon sortKey={key} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {rows.map(p => {
          const { pct20k } = getCalculatedValues(p);
          const move = movements.get(p.name);
          return (
            <div key={`${p.rank}-${p.name}`} className="d3-card p-4 flex flex-col gap-3 hover:border-[var(--gold-dark)] transition-colors" style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded ${p.rank <= 3 ? `rank-${p.rank}` : 'rank-default'}`}>#{p.rank}</span>
                  {move !== undefined && move !== 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-mono-diablo font-bold px-1.5 py-0.5 rounded"
                      title={move > 0 ? `Climbed ${Math.abs(move)} ranks` : `Dropped ${Math.abs(move)} ranks`}
                      style={{
                        color: move > 0 ? '#66ddaa' : '#ff8888',
                        background: move > 0 ? 'rgba(102,221,170,0.12)' : 'rgba(255,100,100,0.12)',
                        border: `1px solid ${move > 0 ? 'rgba(102,221,170,0.35)' : 'rgba(255,100,100,0.35)'}`,
                      }}
                    >
                      {move > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(move)}
                    </span>
                  )}
                </div>
                <button onClick={() => onFav(p.name)} style={{ color: favs.has(p.name) ? 'var(--gold-bright)' : 'var(--text-muted)' }}>
                  <Star className={`h-4 w-4 ${favs.has(p.name) ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <PlayerRegionBadge region={p.region} />
                <h3
                  className="font-serif-display text-lg font-bold truncate cursor-pointer hover:underline"
                  style={{ color: 'var(--gold-bright)' }}
                  onClick={() => onViewPlayer(p)}
                >
                  {p.name.toUpperCase()}
                </h3>
                <button
                  type="button"
                  className="p-0.5 rounded opacity-60 hover:opacity-100 shrink-0"
                  title="Open Blizzard profile"
                  style={{ color: 'var(--gold-bright)' }}
                  onClick={(e) => { e.stopPropagation(); openBlizzardProfile(p.name, p.region || 'eu'); }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Paragon</div>
                  <div className="font-mono-diablo font-bold text-sm">{fmtInt(p.paragon)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--text-secondary)' }}>NS Paragon</div>
                  <div className="font-mono-diablo text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.nonSeasonParagonRaw || '—'}</div>
                </div>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Total XP</div>
                <div className="font-mono-diablo font-bold text-sm">{p.totalXpRaw || '—'}</div>
              </div>

              <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="progress-track h-2 mb-2">
                  <div className="progress-fill-gold" style={{ width: `${Math.min(pct20k, 100)}%` }} />
                </div>
                <div className="flex items-end justify-between text-xs">
                  <span className="font-mono-diablo font-bold" style={{ color: 'var(--text-secondary)' }}>{pct20k.toFixed(1)}% of {(_paragonGoal / 1000).toFixed(0)}k</span>
                  <span className="font-mono-diablo font-bold" style={{ color: 'var(--green)' }}>{fmtInt(p.paragonInWeek)}/week</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollTopContainer>
  );
}



// ═══ Player Dialog Modal ═══
type RiftRankInfo = {
  solo: { rank: number; classLabel: string; score: number; time: string; region: string } | null;
  team2: { rank: number; score: number; time: string; region: string } | null;
  team3: { rank: number; score: number; time: string; region: string } | null;
  team4: { rank: number; score: number; time: string; region: string } | null;
};

const SOLO_CLASS_LB: { id: SoloClass; label: string }[] = [
  { id: 'barbarian', label: 'Barb' },
  { id: 'crusader', label: 'Crus' },
  { id: 'dh', label: 'DH' },
  { id: 'monk', label: 'Monk' },
  { id: 'necromancer', label: 'Necro' },
  { id: 'wd', label: 'WD' },
  { id: 'wizard', label: 'Wiz' },
];

function PlayerDialog({ player, isFav, onToggleFav, onClose, tr, rankLabel, rankValue, paragonGoal, seasonId, regionFilter }: {
  player: Player;
  isFav: boolean;
  onToggleFav: (n: string) => void;
  onClose: () => void;
  tr: (k: TKey) => string;
  rankLabel: string;
  rankValue: number;
  paragonGoal: number;
  seasonId: number;
  regionFilter: Region;
}) {
  const goal = paragonGoal || _paragonGoal;
  const goalLabel = `${(goal / 1000).toFixed(0)}k`;
  const { pct20k, timeUntil20k } = getCalculatedValues(player, goal);
  const pctDisplay = `${pct20k.toFixed(1)}%`;
  const pctNum = pct20k;
  const [copying, setCopying] = useState(false);
  const [riftRanks, setRiftRanks] = useState<RiftRankInfo | null>(null);
  const [riftLoading, setRiftLoading] = useState(false);
  const [resolvedTag, setResolvedTag] = useState<string | null>(player.name.includes('#') ? player.name : null);

  // Look up solo + team ranks on open
  useEffect(() => {
    let cancelled = false;
    const searchName = player.name.toLowerCase();
    const regionArg: ApiRegion | 'world' =
      regionFilter === 'world' ? 'world' : (regionFilter as ApiRegion);

    async function loadRanks() {
      setRiftLoading(true);
      const result: RiftRankInfo = { solo: null, team2: null, team3: null, team4: null };

      const matchPlayer = (entries: Awaited<ReturnType<typeof fetchGlobalLeaderboard>>) =>
        entries.find(e => e.members.some(m => m.battletag.split('#')[0].toLowerCase() === searchName));

      // Solo: check all classes, keep best rank
      await Promise.all(
        SOLO_CLASS_LB.map(async ({ id, label }) => {
          try {
            const type = id === 'dh' ? 'rift-dh' : id === 'wd' ? 'rift-wd' : `rift-${id}`;
            const entries = await fetchGlobalLeaderboard(seasonId, type, false, regionArg);
            const match = matchPlayer(entries);
            if (match && (!result.solo || match.rank < result.solo.rank)) {
              result.solo = {
                rank: match.rank,
                classLabel: label,
                score: match.score,
                time: formatRiftTime(match.time),
                region: match.region,
              };
              const tag = match.members.find(m => m.battletag.split('#')[0].toLowerCase() === searchName)?.battletag;
              if (tag) setResolvedTag(tag);
            }
          } catch { /* skip */ }
        })
      );

      // Team boards
      for (const [key, field] of [
        ['rift-team-2', 'team2'],
        ['rift-team-3', 'team3'],
        ['rift-team-4', 'team4'],
      ] as const) {
        try {
          const entries = await fetchGlobalLeaderboard(seasonId, key, false, regionArg);
          const match = matchPlayer(entries);
          if (match) {
            result[field] = {
              rank: match.rank,
              score: match.score,
              time: formatRiftTime(match.time),
              region: match.region,
            };
          }
        } catch { /* skip */ }
      }

      if (!cancelled) {
        setRiftRanks(result);
        setRiftLoading(false);
      }
    }

    loadRanks();
    return () => { cancelled = true; };
  }, [player.name, seasonId, regionFilter]);

  const copyAsImage = async () => {
    const el = document.getElementById('dialog-content');
    if (!el) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#141210',
        filter: (node) => !node.classList?.contains('no-capture'),
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch (err) {
      console.error('Failed to copy image', err);
    } finally {
      setCopying(false);
    }
  };

  const fmtRiftRank = (r: { rank: number; score: number; time: string; region: string; classLabel?: string } | null) => {
    if (!r) return '—';
    const cls = r.classLabel ? ` ${r.classLabel}` : '';
    return `#${r.rank}${cls} · GR${r.score} · ${r.time}`;
  };

  useModalDismiss(onClose);

  // Prefer full BattleTag from rift match when available
  const resolvedBtag = (() => {
    if (player.name.includes('#')) return player.name;
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        id="dialog-content"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto d3-card p-6 relative"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 40px var(--gold-glow)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', border: '1px solid var(--gold-bright)' }}>
              <Shield className="h-6 w-6" style={{ color: '#0a0908' }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif-display text-2xl font-bold">{player.name.toUpperCase()}</h2>
                <button onClick={() => onToggleFav(player.name)} style={{ color: isFav ? 'var(--gold-bright)' : 'var(--text-muted)' }}>
                  <Star className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  className="d3-btn text-xs"
                  style={{ padding: '0.25rem 0.5rem' }}
                  title="Open Blizzard profile"
                  onClick={() => openBlizzardProfile(resolvedTag || resolvedBtag || player.name, player.region || 'eu')}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Profile
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tr('lastSynced')} <span className="font-mono-diablo" style={{ color: 'var(--text-secondary)' }}>{player.updatedAgoRaw || '—'}</span> {tr('ago')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)] no-capture" style={{ color: 'var(--text-secondary)' }}><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatBox label={rankLabel} value={<span style={{ color: 'var(--gold-bright)' }}>#{rankValue}</span>} />
          <StatBox label={tr('worldRank')} value={<span className="font-mono-diablo">{player.worldRank}</span>} />
          <StatBox label={tr('paragon')} value={<span className="font-mono-diablo font-bold" style={{ color: 'var(--gold-bright)' }}>{fmtInt(player.paragon)}</span>} />
          <StatBox label={tr('nsParagon')} value={<span className="font-mono-diablo font-bold">{player.nonSeasonParagonRaw || '—'}</span>} />
        </div>

        {/* Rift leaderboard ranks */}
        <div className="d3-card p-4 mb-6 relative" style={{ background: 'var(--bg-inset)' }}>
          <h3 className="text-xs uppercase font-bold mb-3 tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--gold-bright)' }} />
            Greater Rift Ranks
            {riftLoading && <RefreshCw className="h-3 w-3 animate-spin" style={{ color: 'var(--gold-bright)' }} />}
          </h3>
          {riftLoading && !riftRanks ? (
            <LoadingScreen compact label={tr('loadingGrRanks')} />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatBox
                  label="Solo"
                  value={
                    riftRanks?.solo ? (
                      <span className="font-mono-diablo text-base">
                        <span style={{ color: 'var(--gold-bright)' }}>#{riftRanks.solo.rank}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{riftRanks.solo.classLabel}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )
                  }
                />
                <StatBox
                  label="2-Player"
                  value={
                    riftRanks?.team2 ? (
                      <span className="font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>#{riftRanks.team2.rank}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )
                  }
                />
                <StatBox
                  label="3-Player"
                  value={
                    riftRanks?.team3 ? (
                      <span className="font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>#{riftRanks.team3.rank}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )
                  }
                />
                <StatBox
                  label="4-Player"
                  value={
                    riftRanks?.team4 ? (
                      <span className="font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>#{riftRanks.team4.rank}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )
                  }
                />
              </div>
              {riftRanks && (riftRanks.solo || riftRanks.team2 || riftRanks.team3 || riftRanks.team4) && (
                <div className="mt-3 text-[10px] font-mono-diablo space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                  {riftRanks.solo && <div>Solo: {fmtRiftRank(riftRanks.solo)} · {riftRanks.solo.region.toUpperCase()}</div>}
                  {riftRanks.team2 && <div>2P: {fmtRiftRank(riftRanks.team2)} · {riftRanks.team2.region.toUpperCase()}</div>}
                  {riftRanks.team3 && <div>3P: {fmtRiftRank(riftRanks.team3)} · {riftRanks.team3.region.toUpperCase()}</div>}
                  {riftRanks.team4 && <div>4P: {fmtRiftRank(riftRanks.team4)} · {riftRanks.team4.region.toUpperCase()}</div>}
                </div>
              )}
            </>
          )}
        </div>

        <h3 className="text-xs uppercase font-bold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>{tr('rawData')}</h3>
        <div className="d3-card p-4 mb-6" style={{ background: 'var(--bg-inset)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <RawRow label={rankLabel + ':'} value={String(rankValue)} />
            <RawRow label={tr('worldRank') + ':'} value={String(player.worldRank)} />
            <RawRow label={tr('name') + ':'} value={player.name} />
            <RawRow label={tr('paragon') + ':'} value={fmtInt(player.paragon)} />
            <RawRow label={tr('nsParagon') + ':'} value={player.nonSeasonParagonRaw || '—'} />
            <RawRow label={tr('totalXp') + ':'} value={player.totalXpRaw || '—'} />
            <RawRow label={`% of ${goalLabel}:`} value={pctDisplay} />
            <RawRow label={tr('xpRate7d')} value={player.xpRate7dRaw || '—'} />
            <RawRow label={tr('paragonInWeek')} value={fmtInt(player.paragonInWeek)} />
            <RawRow label={`Time until ${goalLabel}:`} value={timeUntil20k} />
            <RawRow label={tr('updated')} value={player.updatedAgoRaw || '—'} />
            <RawRow label="Solo rank:" value={riftRanks?.solo ? `#${riftRanks.solo.rank} (${riftRanks.solo.classLabel})` : '—'} />
            <RawRow label="2-Player rank:" value={riftRanks?.team2 ? `#${riftRanks.team2.rank}` : '—'} />
            <RawRow label="3-Player rank:" value={riftRanks?.team3 ? `#${riftRanks.team3.rank}` : '—'} />
            <RawRow label="4-Player rank:" value={riftRanks?.team4 ? `#${riftRanks.team4.rank}` : '—'} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t gap-2 no-capture" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <button onClick={copyAsImage} disabled={copying} className="d3-btn d3-btn-primary text-xs">
              <ImageIcon className={`h-3.5 w-3.5 ${copying ? 'animate-pulse' : ''}`} />
              {copying ? '...' : tr('copyAsImage')}
            </button>
          </div>
          <button onClick={onClose} className="d3-btn d3-btn-primary">{tr('closeWindow')}</button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d3-card p-4 text-center" style={{ background: 'var(--bg-inset)' }}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl lg:text-2xl font-bold">{value}</div>
    </div>
  );
}

function RawRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-mono-diablo font-bold text-right">{value}</span>
    </div>
  );
}

// ── Paragon Calculator ──────────────────────────────────────

function CalcSection({ tr }: { tr: (k: TKey) => string }) {
  const [from, setFrom] = useState(5000);
  const [to, setTo] = useState(8000);
  const [rateT, setRateT] = useState(5);
  const [hoursPerDay, setHoursPerDay] = useState(4);

  const xpB = xpBetweenLevels(from, to);
  const xpTr = xpToTrillion(xpB);
  const totalHours = estimateDays(xpTr, rateT * 1000) * 24;
  const days = hoursPerDay > 0 ? totalHours / hoursPerDay : Infinity;
  const presets = [5, 10, 15, 20, 30];
  const hourPresets = [4, 6, 8, 10, 12];

  return (
    <section className="max-w-[1600px] mx-auto px-6 pb-6">
      <div className="d3-card p-6">
        <h2 className="font-serif-display text-lg font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--gold-bright)' }}>
          <Calculator className="h-5 w-5" /> {tr('paragonCalculator')}
          <span className="text-xs font-sans font-normal ml-2" style={{ color: 'var(--text-secondary)' }}>• {tr('estimateSubtitle')}</span>
        </h2>
        <div className="gold-divider my-4" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="text-xs uppercase font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}><Crown className="h-3.5 w-3.5" /> {tr('paragonRange')}</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div><label className="text-[10px] uppercase font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>{tr('current')}</label><input type="number" value={from} onChange={e => setFrom(Math.max(0, +e.target.value || 0))} className="d3-input w-full" /></div>
              <div><label className="text-[10px] uppercase font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>{tr('goal')}</label><input type="number" value={to} onChange={e => setTo(Math.max(0, +e.target.value || 0))} className="d3-input w-full" /></div>
            </div>
            <h3 className="text-xs uppercase font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}><Zap className="h-3.5 w-3.5" /> {tr('xpSpeed')}</h3>
            <div className="relative mb-3">
              <input type="number" step="0.01" value={rateT} onChange={e => setRateT(Math.max(0, +e.target.value || 0))} className="d3-input w-full pr-28" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-secondary)' }}>{tr('trillionPerHour')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {presets.map(p => (
                <button key={p} onClick={() => setRateT(p)}
                  className={`px-2 py-1 rounded text-xs font-mono-diablo border transition-colors ${rateT === p ? 'd3-btn-primary' : ''}`}
                  style={rateT !== p ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                  {p}T/h
                </button>
              ))}
            </div>
            <h3 className="text-xs uppercase font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}><Clock className="h-3.5 w-3.5" /> {tr('hoursPerDay')}</h3>
            <div className="relative mb-3">
              <input type="number" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(Math.max(0.5, +e.target.value || 0))} className="d3-input w-full pr-20" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-secondary)' }}>h/day</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hourPresets.map(h => (
                <button key={h} onClick={() => setHoursPerDay(h)}
                  className={`px-2 py-1 rounded text-xs font-mono-diablo border transition-colors ${hoursPerDay === h ? 'd3-btn-primary' : ''}`}
                  style={hoursPerDay !== h ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                  {h}h/day
                </button>
              ))}
            </div>
          </div>

          <div className="d3-card p-5 text-center" style={{ background: 'var(--bg-inset)' }}>
            <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{tr('totalXpRequired')}</div>
            <div className="font-mono-diablo font-bold text-3xl mb-1" style={{ color: 'var(--gold-bright)' }}>{fmtDec(xpTr, 1)}</div>
            <div className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{tr('trillionXp')}</div>
            <div className="gold-divider my-4" />
            <div className="text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Clock className="h-3 w-3" /> {tr('estimatedTime')}</div>
            <div className="font-mono-diablo font-bold text-3xl mb-1" style={{ color: 'var(--green)' }}>{isFinite(days) ? fmtDec(days, 1) : '∞'}</div>
            <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{tr('days')}</div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{tr('atSpeed')} <strong style={{ color: 'var(--gold-bright)' }}>{rateT} {tr('trillionXpPerHour')}</strong></div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>at <strong style={{ color: 'var(--gold-bright)' }}>{hoursPerDay}h/day</strong></div>
          </div>

          <div className="d3-card p-5" style={{ background: 'var(--bg-inset)' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}><Info className="h-4 w-4" /> {tr('howItWorks')}</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{tr('calculatorDesc')}</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}><strong>{tr('slow')}</strong></span><span style={{ color: 'var(--text-secondary)' }}>~5T XP/h {tr('casual')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}><strong>{tr('medium')}</strong></span><span style={{ color: 'var(--text-secondary)' }}>~10-15T XP/h {tr('efficient')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}><strong>{tr('fast')}</strong></span><span style={{ color: 'var(--text-secondary)' }}>~20T XP/h {tr('optimized')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}><strong>{tr('topTier')}</strong></span><span style={{ color: 'var(--text-secondary)' }}>~30T+ XP/h {tr('fullGroup')}</span></div>
            </div>
            <div className="gold-divider my-4" />
            <div className="text-xs flex items-start gap-2" style={{ color: 'var(--gold-dark)' }}>
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{tr('tip')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Skeleton ────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="d3-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="d3-table-header">
            <tr>{Array.from({ length: 11 }).map((_, i) => <th key={i} className="px-3 py-3"><div className="h-3 rounded" style={{ background: 'var(--border-subtle)', width: 60 }} /></th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 15 }).map((_, i) => (
              <tr key={i} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {Array.from({ length: 11 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3 rounded animate-pulse" style={{ background: 'var(--border-subtle)', width: 60 + Math.random() * 80 }} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
