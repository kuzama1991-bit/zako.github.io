import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { X, User, Trophy, Swords, TrendingUp, Shield, RefreshCw, ExternalLink, Trash2, Edit3, Star } from 'lucide-react';
import LoadingScreen from '../LoadingScreen';
import type { Player } from '../../utils/data';
import { fmtInt } from '../../utils/data';
import { fetchGlobalLeaderboard, formatRiftTime, type Region, type SoloClass } from '../../utils/blizzardApi';

// ── Constants ─────────────────────────────────────────────────
const SOLO_CLASSES: { id: SoloClass; label: string; emoji: string }[] = [
  { id: 'barbarian',   label: 'Barbarian',   emoji: '⚔️' },
  { id: 'crusader',    label: 'Crusader',    emoji: '🛡️' },
  { id: 'dh',          label: 'Demon Hunter',emoji: '🏹' },
  { id: 'monk',        label: 'Monk',        emoji: '👊' },
  { id: 'necromancer', label: 'Necromancer', emoji: '💀' },
  { id: 'wd',          label: 'Witch Doctor',emoji: '🧟' },
  { id: 'wizard',      label: 'Wizard',      emoji: '🔮' },
];

const TEAM_TYPES = [
  { key: 'rift-team-2', label: '2-Player', emoji: '👥' },
  { key: 'rift-team-3', label: '3-Player', emoji: '👥' },
  { key: 'rift-team-4', label: '4-Player', emoji: '👥' },
];

interface RiftMemberInfo {
  name: string;
  heroClass: string;
}

interface RiftResult {
  apiType: string;
  label: string;
  emoji: string;
  rank: number;
  score: number;
  time: string;
  region: string;
  members: RiftMemberInfo[];
}

export type BoardJump =
  | { tab: 'paragon' }
  | { tab: 'solo'; soloClass: SoloClass }
  | { tab: 'team2' | 'team3' | 'team4' };

interface Props {
  players: Player[];
  seasonId: number;
  onClose: () => void;
  /** Jump to a rift/paragon board where this player appears */
  onJumpToBoard?: (jump: BoardJump) => void;
}

// Build the same Blizzard profile URL used by rift leaderboards: region.diablo3.../profile/Name-Code/
function blizzardProfileUrl(btag: string, region: string): string {
  return `https://${region}.diablo3.blizzard.com/en-us/profile/${encodeURIComponent(btag.replace('#', '-'))}/`;
}

function jumpFromApiType(apiType: string): BoardJump {
  if (apiType.includes('team-2') || apiType.endsWith('team2')) return { tab: 'team2' };
  if (apiType.includes('team-3') || apiType.endsWith('team3')) return { tab: 'team3' };
  if (apiType.includes('team-4') || apiType.endsWith('team4')) return { tab: 'team4' };
  const cls = apiType.replace(/^rift-/, '').replace(/^hardcore-/, '') as SoloClass;
  const allowed: SoloClass[] = ['barbarian', 'crusader', 'dh', 'monk', 'necromancer', 'wd', 'wizard'];
  if (allowed.includes(cls)) return { tab: 'solo', soloClass: cls };
  return { tab: 'solo', soloClass: 'wizard' };
}

export default function MyProfile({ players, seasonId, onClose, onJumpToBoard }: Props) {
  useModalDismiss(onClose);
  // ── Saved state ───────────────────────────────────────────────
  const [btag, setBtag]       = useState(() => localStorage.getItem('d3_my_btag') || '');
  const [region, setRegion]   = useState<Region>(() => (localStorage.getItem('d3_my_region') as Region) || 'eu');
  const [editing, setEditing] = useState(!localStorage.getItem('d3_my_btag'));
  const [input, setInput]     = useState(() => localStorage.getItem('d3_my_btag') || '');
  const [inputRegion, setInputRegion] = useState<Region>(() => (localStorage.getItem('d3_my_region') as Region) || 'eu');

  const saveProfile = () => {
    const clean = input.trim();
    if (!clean) return;
    setBtag(clean);
    setRegion(inputRegion);
    localStorage.setItem('d3_my_btag', clean);
    localStorage.setItem('d3_my_region', inputRegion);
    setEditing(false);
  };

  const removeProfile = () => {
    setBtag('');
    setInput('');
    localStorage.removeItem('d3_my_btag');
    localStorage.removeItem('d3_my_region');
    setEditing(true);
    setRiftResults([]);
  };

  // ── Paragon leaderboard match ─────────────────────────────────
  const paragonEntry = useMemo(() => {
    if (!btag) return null;
    const name = btag.split('#')[0].toLowerCase();
    return players.find(p => p.name.toLowerCase() === name) || null;
  }, [btag, players]);

  const paragon = paragonEntry?.paragon || 0;
  const milestones = [1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000];
  const displayName = btag ? btag.split('#')[0].toUpperCase() : '';

  // ── Rift rank search (auto-triggered) ────────────────────────
  const [riftResults, setRiftResults] = useState<RiftResult[]>([]);
  const [riftLoading, setRiftLoading] = useState(false);
  const [riftLoaded, setRiftLoaded]   = useState(false);

  const searchRiftRanks = useCallback(async (currentBtag: string, currentRegion: Region) => {
    if (!currentBtag) return;
    const searchName = currentBtag.split('#')[0].toLowerCase();
    setRiftLoading(true);
    setRiftResults([]);

    const results: RiftResult[] = [];
    const soloTypes = SOLO_CLASSES.map(c => ({ key: `rift-${c.id}`, label: c.label, emoji: c.emoji }));
    const all = [...soloTypes, ...TEAM_TYPES];

    await Promise.all(all.map(async ({ key, label, emoji }) => {
      try {
        const entries = await fetchGlobalLeaderboard(seasonId, key, false, currentRegion);
        const match = entries.find(e =>
          e.members.some(m => m.battletag.split('#')[0].toLowerCase() === searchName)
        );
        if (match) {
          results.push({
            apiType: key,
            label,
            emoji,
            rank: match.rank,
            score: match.score,
            time: formatRiftTime(match.time),
            region: match.region,
            members: match.members.map(m => ({
              name: m.battletag.split('#')[0].toUpperCase(),
              heroClass: m.hero.class || '',
            })),
          });
        }
      } catch { /* skip */ }
    }));

    results.sort((a, b) => a.rank - b.rank);
    setRiftResults(results);
    setRiftLoading(false);
    setRiftLoaded(true);
  }, [seasonId]);

  // Auto-trigger when btag/region is set and not editing
  useEffect(() => {
    if (btag && !editing) {
      searchRiftRanks(btag, region);
    }
  }, [btag, region, editing, searchRiftRanks]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto d3-card relative" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 50px rgba(245,197,66,0.12)' }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--gold-dark),var(--gold))', boxShadow: '0 0 15px rgba(245,197,66,0.4)' }}>
              <User className="h-5 w-5" style={{ color: '#0a0908' }} />
            </div>
            <div>
              <div className="font-serif-display font-bold text-xl" style={{ color: 'var(--gold-bright)' }}>
                {displayName || 'My Profile'}
              </div>
              {btag && !editing && (
                <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{btag} • {region.toUpperCase()}</span>
                  <button onClick={() => { setInput(btag); setInputRegion(region); setEditing(true); }}
                    className="flex items-center gap-0.5 hover:opacity-100 opacity-60 transition-opacity" style={{ color: 'var(--gold-bright)' }}>
                    <Edit3 className="h-3 w-3" /> Change
                  </button>
                  <button onClick={removeProfile}
                    className="flex items-center gap-0.5 hover:opacity-100 opacity-60 transition-opacity" style={{ color: '#ff6666' }}>
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              )}
              {!btag && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Set your BattleTag to get started</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {btag && !editing && (
              <a href={blizzardProfileUrl(btag, region)} target="_blank" rel="noopener noreferrer"
                className="d3-btn text-xs flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Blizzard Profile
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded hover:bg-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── BattleTag input (only when editing) ─────────────── */}
          {editing && (
            <div className="d3-card p-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--gold-dark)' }}>
              <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--gold-bright)' }}>
                {btag ? '✏️ Change BattleTag' : '⚙️ Enter Your BattleTag'}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  className="d3-input flex-1 px-3 py-2 min-w-[180px]"
                  placeholder="YourName#1234"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveProfile()}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  {(['eu', 'us', 'kr'] as Region[]).map(r => (
                    <button key={r} onClick={() => setInputRegion(r)}
                      className={`px-3 py-2 rounded text-xs font-mono-diablo font-bold border transition-colors ${inputRegion === r ? 'd3-btn-primary' : ''}`}
                      style={inputRegion !== r ? { borderColor: 'var(--border-muted)', background: 'var(--bg-inset)', color: 'var(--text-secondary)' } : {}}>
                      {r === 'eu' ? '🇪🇺' : r === 'us' ? '🇺🇸' : '🇰🇷'} {r.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={saveProfile} className="d3-btn d3-btn-primary px-4 py-2 text-xs">Save</button>
                  {btag && <button onClick={() => setEditing(false)} className="d3-btn text-xs px-3">Cancel</button>}
                </div>
              </div>
            </div>
          )}

          {/* ── Profile content (only when btag is set and not editing) ── */}
          {btag && !editing && (
            <>
              {/* Paragon stats */}
              {paragonEntry ? (
                <>
                  {/* Key stats grid */}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
                      <Trophy className="h-4 w-4" /> Paragon Leaderboard — Season {seasonId}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: 'World Rank', val: `#${paragonEntry.worldRank}`, color: 'var(--gold-bright)', icon: <Trophy className="h-4 w-4" /> },
                        { label: 'Paragon',    val: fmtInt(paragonEntry.paragon),  color: 'var(--gold-bright)', icon: <Star className="h-4 w-4" /> },
                        { label: 'Weekly Gain',val: `+${fmtInt(paragonEntry.paragonInWeek)}`, color: '#66ddaa', icon: <TrendingUp className="h-4 w-4" /> },
                        { label: 'Region',     val: paragonEntry.region.toUpperCase(), color: '#6699ff', icon: <Shield className="h-4 w-4" /> },
                      ].map(s => (
                        <div key={s.label} className="d3-card p-3 text-center" style={{ background: 'var(--bg-inset)' }}>
                          <div className="flex justify-center mb-1" style={{ color: s.color, opacity: 0.7 }}>{s.icon}</div>
                          <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                          <div className="font-mono-diablo font-black text-xl leading-none" style={{ color: s.color }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Secondary stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Total XP',       val: paragonEntry.totalXpRaw || '—' },
                        { label: 'XP Rate (7d)',   val: paragonEntry.xpRate7dRaw || '—' },
                        { label: 'NS Paragon',     val: paragonEntry.nonSeasonParagonRaw || '—' },
                        { label: 'Last Updated',   val: paragonEntry.updatedAgoRaw ? `${paragonEntry.updatedAgoRaw} ago` : '—' },
                      ].map(s => (
                        <div key={s.label} className="d3-card p-3" style={{ background: 'var(--bg-inset)' }}>
                          <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                          <div className="font-mono-diablo font-bold text-sm">{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestone progress */}
                  <div className="d3-card p-4" style={{ background: 'var(--bg-inset)' }}>
                    <div className="text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
                      <TrendingUp className="h-4 w-4" /> Milestone Progress
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      {milestones.map(m => {
                        const pct = Math.min((paragon / m) * 100, 100);
                        const done = paragon >= m;
                        const weeksLeft = done ? 0
                          : paragonEntry.paragonInWeek > 0
                            ? Math.ceil((m - paragon) / paragonEntry.paragonInWeek)
                            : null;
                        return (
                          <div key={m}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-mono-diablo font-bold" style={{ color: done ? '#66ddaa' : 'var(--text-secondary)' }}>
                                {done ? '✓' : '○'} {fmtInt(m)} Paragon
                              </span>
                              <span className="font-mono-diablo" style={{ color: done ? '#66ddaa' : 'var(--gold-bright)' }}>
                                {done ? 'Done!' : weeksLeft !== null ? `~${weeksLeft}w` : '—'}
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                              <div className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: done ? '#66ddaa' : 'var(--gold-bright)', transition: 'width 0.5s' }} />
                            </div>
                            <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="d3-card p-5 text-center" style={{ background: 'var(--bg-inset)' }}>
                  <User className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    "{btag.split('#')[0]}" not found in top 1000 Paragon leaderboard
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Player must be in the top 1000 of the current season.
                  </p>
                </div>
              )}

              {/* Greater Rift Rankings — auto-loaded */}
              <div className="d3-card p-4" style={{ background: 'var(--bg-inset)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2" style={{ color: 'var(--gold-bright)' }}>
                    <Swords className="h-4 w-4" /> Greater Rift Rankings — Season {seasonId}
                  </div>
                  <button onClick={() => searchRiftRanks(btag, region)} disabled={riftLoading}
                    className="d3-btn text-xs flex items-center gap-1.5" style={{ padding: '0.3rem 0.7rem' }}>
                    <RefreshCw className={`h-3.5 w-3.5 ${riftLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {riftLoading && (
                  <LoadingScreen compact label="Searching GR leaderboards" />
                )}

                {!riftLoading && riftLoaded && riftResults.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Not found in any top 1000 Rift leaderboard for this season/region.
                    </p>
                  </div>
                )}

                {!riftLoading && riftResults.length > 0 && (
                  <>
                    {/* Solo results — show ALL classes found */}
                    {riftResults.filter(r => !r.apiType.includes('team')).length > 0 && (
                      <div className="mb-4">
                        <div className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Solo</div>
                        <div className="space-y-2">
                          {riftResults.filter(r => !r.apiType.includes('team')).map((r, i) => (
                            <RiftRow
                              key={i}
                              r={r}
                              btag={btag}
                              onJump={onJumpToBoard ? () => {
                                onJumpToBoard(jumpFromApiType(r.apiType));
                                onClose();
                              } : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team results */}
                    {riftResults.filter(r => r.apiType.includes('team')).length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Team</div>
                        <div className="space-y-2">
                          {riftResults.filter(r => r.apiType.includes('team')).map((r, i) => (
                            <RiftRow
                              key={i}
                              r={r}
                              btag={btag}
                              onJump={onJumpToBoard ? () => {
                                onJumpToBoard(jumpFromApiType(r.apiType));
                                onClose();
                              } : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {!btag && (
            <div className="d3-card p-10 text-center" style={{ background: 'var(--bg-inset)' }}>
              <Shield className="h-14 w-14 mx-auto mb-4 opacity-20" />
              <p className="text-base font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Enter your BattleTag above</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                e.g. <span className="font-mono-diablo" style={{ color: 'var(--gold-bright)' }}>Draxlin#1930</span> — then click Save
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Class formatting ──────────────────────────────────────────
const CLASS_EMOJI: Record<string, string> = {
  barbarian: '⚔️', crusader: '🛡️', 'demon-hunter': '🏹',
  monk: '👊', necromancer: '💀', 'witch-doctor': '🧟', wizard: '🔮',
};

function formatClass(cls: string): string {
  if (!cls) return '';
  const emoji = CLASS_EMOJI[cls.toLowerCase()] || '';
  const name = cls.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return emoji ? `${emoji} ${name}` : name;
}

// ── Rift row component ─────────────────────────────────────────
function RiftRow({ r, btag, onJump }: { r: RiftResult; btag: string; onJump?: () => void }) {
  const region = r.region || 'eu';
  const isTeam = r.members.length > 1;
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded group"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`font-mono-diablo text-xs font-bold px-2 py-0.5 rounded shrink-0 ${r.rank <= 3 ? `rank-${r.rank}` : 'rank-default'}`}>
          #{r.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
            <span>{r.emoji}</span>
            <span>{r.label}</span>
          </div>
          {isTeam && (
            <div className="flex flex-col mt-0.5">
              {r.members.map((m, i) => (
                <div key={i} className="text-[9px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-bold">{m.name}</span>
                  {m.heroClass && <span style={{ color: 'var(--text-secondary)' }}>— {formatClass(m.heroClass)}</span>}
                </div>
              ))}
            </div>
          )}
          {!isTeam && r.members[0]?.heroClass && (
            <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
              {formatClass(r.members[0].heroClass)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className="font-mono-diablo font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>GR {r.score}</div>
          <div className="text-[10px] font-mono-diablo" style={{ color: 'var(--text-muted)' }}>{r.time} • {r.region.toUpperCase()}</div>
        </div>
        {onJump && (
          <button
            type="button"
            onClick={onJump}
            className="d3-btn text-[10px] px-2 py-1"
            title="Open this leaderboard"
          >
            Open board
          </button>
        )}
        <a
          href={`https://${region}.diablo3.blizzard.com/en-us/profile/${encodeURIComponent(btag.replace('#', '-'))}/`}
          target="_blank" rel="noopener noreferrer"
          title="View Blizzard profile"
          className="opacity-30 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--gold-bright)' }} />
        </a>
      </div>
    </div>
  );
}
