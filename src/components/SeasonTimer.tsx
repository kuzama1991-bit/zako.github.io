import { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// CONFIRMED SEASON DATA
// Source: official Blizzard news announcements
// ═══════════════════════════════════════════════════════════════

interface Season {
  id: number;
  name: string;
  // All times in UTC
  startUtc: Date;
  endUtc: Date | null; // null = end not yet confirmed
  regions: { code: string; flag: string; startLabel: string; startUtc?: Date; color: string }[];
}

const SEASONS: Season[] = [
  {
    id: 38,
    name: 'Ethereal Memory',
    // NA: Fri Mar 27 2026 5:00 PM PDT (UTC-7) = Sat Mar 28 00:00 UTC
    startUtc: new Date('2026-03-28T00:00:00Z'),
    // Confirmed ended: Sunday June 21 2026 at 5 PM PDT = Mon Jun 22 00:00 UTC
    endUtc: new Date('2026-06-22T00:00:00Z'),
    regions: [
      { code: 'NA', flag: '🇺🇸', startLabel: 'Fri Mar 27, 2026 — 5:00 PM PDT', startUtc: new Date('2026-03-28T00:00:00Z'), color: '#ff6666' },
      { code: 'EU', flag: '🇪🇺', startLabel: 'Sat Mar 28, 2026 — 01:00 AM CET', startUtc: new Date('2026-03-28T00:00:00Z'), color: '#6699ff' },
      { code: 'KR', flag: '🇰🇷', startLabel: 'Sat Mar 28, 2026 — 09:00 AM KST', startUtc: new Date('2026-03-28T00:00:00Z'), color: '#cc99ff' },
    ],
  },
  {
    id: 39,
    name: 'Shades of the Nephalem',
    // Blizzard: "June 26 at 5 PM PDT/CET/KST" — same local hour, different UTC:
    // NA: Thu Jun 26 5:00 PM PDT (UTC-7) = Fri Jun 27 00:00 UTC
    // EU: Thu Jun 26 5:00 PM CEST (UTC+2 summer) = Thu Jun 26 15:00 UTC
    // KR: Thu Jun 26 5:00 PM KST (UTC+9) = Thu Jun 26 08:00 UTC
    // We use NA start as the canonical startUtc since it's the last to go live.
    startUtc: new Date('2026-06-27T00:00:00Z'), // NA canonical
    endUtc: null, // Not yet confirmed
    regions: [
      { code: 'NA', flag: '🇺🇸', startLabel: 'Thu Jun 26, 2026 — 5:00 PM PDT', startUtc: new Date('2026-06-27T00:00:00Z'), color: '#ff6666' },
      { code: 'EU', flag: '🇪🇺', startLabel: 'Thu Jun 26, 2026 — 5:00 PM CEST', startUtc: new Date('2026-06-26T15:00:00Z'), color: '#6699ff' },
      { code: 'KR', flag: '🇰🇷', startLabel: 'Thu Jun 26, 2026 — 5:00 PM KST', startUtc: new Date('2026-06-26T08:00:00Z'), color: '#cc99ff' },
    ],
  },
];

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const days  = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins  = Math.floor((ms % 3600000)  / 60000);
  const secs  = Math.floor((ms % 60000)    / 1000);
  if (days  > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins  > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface Props {
  seasonId: number;
}

export default function SeasonTimer({ seasonId }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Find requested season; fall back to the latest known one
  const season = SEASONS.find(s => s.id === seasonId) ?? SEASONS[SEASONS.length - 1];

  const nowMs      = now;
  const startMs    = season.startUtc.getTime();
  const endMs      = season.endUtc?.getTime() ?? null;

  // Determine state
  const notStarted = nowMs < startMs;
  const isLive     = !notStarted && (endMs === null || nowMs < endMs);
  const isEnded    = endMs !== null && nowMs >= endMs;

  // Check if we're in a gap before the next season
  const nextSeason = SEASONS.find(s => s.id === seasonId + 1);
  const nextStartMs = nextSeason?.startUtc.getTime() ?? null;
  const betweenSeasons = isEnded && nextSeason != null && nextStartMs !== null && nowMs < nextStartMs;
  const nextCountdown  = betweenSeasons && nextStartMs !== null ? nextStartMs - nowMs : 0;

  // Timers
  const uptime      = isLive ? nowMs - startMs : (isEnded ? (endMs! - startMs) : 0);
  const startCountdown = notStarted ? startMs - nowMs : 0;
  const endCountdown   = isLive && endMs !== null ? endMs - nowMs : 0;

  // Status badge
  let statusLabel = '';
  let statusColor = '';
  let statusBg    = '';
  if (isLive)            { statusLabel = '🟢 Live';          statusColor = '#2ecc71'; statusBg = 'rgba(39,174,96,0.15)';  }
  else if (notStarted)   { statusLabel = '🟡 Coming Soon';   statusColor = '#f1c40f'; statusBg = 'rgba(241,196,15,0.15)'; }
  else if (betweenSeasons){ statusLabel = '🔴 Season Over';  statusColor = '#ff6b6b'; statusBg = 'rgba(231,76,60,0.15)';  }
  else                   { statusLabel = '🔴 Season Ended';  statusColor = '#ff6b6b'; statusBg = 'rgba(231,76,60,0.15)';  }

  return (
    <section className="max-w-[1600px] mx-auto px-6 pb-4">
      <div
        className="d3-card p-5"
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--gold-dark)',
          boxShadow: '0 0 20px rgba(245,197,66,0.06)',
        }}
      >
        {/* ── Title row ── */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} />
            <span className="font-serif-display font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>
              Season {season.id}: {season.name}
            </span>
            <span
              className="text-[10px] font-mono-diablo font-bold px-2 py-0.5 rounded-full"
              style={{ background: statusBg, border: `1px solid ${statusColor}`, color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>

          {/* ── Right-hand timer pills ── */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* LIVE: show uptime */}
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.25)' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: '#27ae60' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#27ae60' }}>Season Uptime</div>
                  <div className="font-mono-diablo font-black text-sm leading-none" style={{ color: '#2ecc71' }}>
                    {formatDuration(uptime)}
                  </div>
                </div>
              </div>
            )}

            {/* LIVE with confirmed end: show countdown to end */}
            {isLive && endMs !== null && endCountdown > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)' }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: '#e74c3c' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#e74c3c' }}>Season Ends In</div>
                  <div className="font-mono-diablo font-black text-sm leading-none" style={{ color: '#ff6b6b' }}>
                    {formatDuration(endCountdown)}
                  </div>
                </div>
              </div>
            )}

            {/* LIVE with no confirmed end */}
            {isLive && endMs === null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(180,180,180,0.06)', border: '1px solid var(--border-muted)' }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>Season Ends</div>
                  <div className="font-mono-diablo text-xs leading-none" style={{ color: 'var(--text-muted)' }}>TBA by Blizzard</div>
                </div>
              </div>
            )}

            {/* NOT STARTED: countdown to start */}
            {notStarted && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(241,196,15,0.08)', border: '1px solid rgba(241,196,15,0.3)' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: '#f1c40f' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#f1c40f' }}>Starts In</div>
                  <div className="font-mono-diablo font-black text-sm leading-none" style={{ color: '#f1c40f' }}>
                    {formatDuration(startCountdown)}
                  </div>
                </div>
              </div>
            )}

            {/* ENDED: show final uptime (frozen) */}
            {isEnded && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(180,180,180,0.06)', border: '1px solid var(--border-muted)' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>Season Duration</div>
                  <div className="font-mono-diablo text-sm leading-none" style={{ color: 'var(--text-secondary)' }}>
                    {formatDuration(uptime)}
                  </div>
                </div>
              </div>
            )}

            {/* ENDED + next season confirmed: countdown to next season */}
            {betweenSeasons && nextCountdown > 0 && nextSeason && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(102,153,255,0.1)', border: '1px solid rgba(102,153,255,0.3)' }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: '#6699ff' }} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#6699ff' }}>
                    Season {nextSeason.id} Starts In
                  </div>
                  <div className="font-mono-diablo font-black text-sm leading-none" style={{ color: '#99bbff' }}>
                    {formatDuration(nextCountdown)}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Regional start times ── */}
        {/* When between seasons, show NEXT season's start times. Otherwise show current season's. */}
        {(() => {
          const displaySeason = betweenSeasons && nextSeason ? nextSeason : season;
          const displayLabel = betweenSeasons && nextSeason
            ? `Season ${nextSeason.id}: ${nextSeason.name} — Regional Start Times`
            : 'Regional Start Times';
          return (
            <>
              <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
                {displayLabel}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {displaySeason.regions.map(r => {
                  const regionStartMs = r.startUtc?.getTime() ?? displaySeason.startUtc.getTime();
                  const regionNotStarted = nowMs < regionStartMs;
                  const regionCountdown = regionNotStarted ? regionStartMs - nowMs : 0;
                  return (
                    <div
                      key={r.code}
                      className="rounded-lg p-3 flex items-center gap-3"
                      style={{
                        background: `${r.color}0d`,
                        border: `1px solid ${r.color}33`,
                      }}
                    >
                      <span className="text-xl">{r.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold font-mono-diablo mb-0.5" style={{ color: r.color }}>{r.code}</div>
                        <div className="text-[11px] font-mono-diablo" style={{ color: 'var(--text-primary)' }}>{r.startLabel}</div>
                        {regionNotStarted && (
                          <div className="text-[11px] font-mono-diablo font-bold mt-0.5" style={{ color: r.color }}>
                            ⏳ {formatDuration(regionCountdown)}
                          </div>
                        )}
                        {!regionNotStarted && (betweenSeasons || notStarted) && (
                          <div className="text-[10px] font-mono-diablo font-bold mt-0.5" style={{ color: '#2ecc71' }}>
                            ✓ Started
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* ── Footer notes ── */}
        {isLive && endMs === null && (
          <div className="mt-2.5 text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
            Season end date not yet announced by Blizzard. This section will update when confirmed.
          </div>
        )}
        {betweenSeasons && nextSeason && (
          <div className="mt-2.5 text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
            Season {season.id} has ended. Season {nextSeason.id}: {nextSeason.name} starts on {formatDate(nextSeason.startUtc)}.
          </div>
        )}
        {isEnded && !betweenSeasons && (
          <div className="mt-2.5 text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
            Season {season.id} ended on {season.endUtc ? formatDate(season.endUtc) : '—'}.
          </div>
        )}
      </div>
    </section>
  );
}
