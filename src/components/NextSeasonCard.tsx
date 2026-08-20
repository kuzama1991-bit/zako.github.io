import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HOW TO UPDATE WHEN A NEW SEASON IS ANNOUNCED:
//
// 1. Add a new object to the SEASONS array below.
// 2. Set the correct startUtc times for each region.
// 3. Set confirmed: true once Blizzard officially announces it.
// 4. If the theme is not yet known, set name to 'TBA' and
//    confirmed to false.
//
// The card handles everything automatically after that:
//   - While season hasn't started: shows countdown per region
//   - Once all regions live:       shows live uptime counting up
//   - Once the NEXT season entry is added: old one becomes history
//
// EXAMPLE for adding Season 40:
// {
//   id: 40,
//   name: 'TBA',            // ← update when Blizzard announces
//   theme: 'TBA',           // ← update when Blizzard announces
//   confirmed: false,        // ← set true when officially confirmed
//   regions: [
//     { code: 'KR', flag: '🇰🇷', label: 'Date TBA', startUtc: new Date('2026-XX-XXT08:00:00Z'), color: '#cc99ff' },
//     { code: 'EU', flag: '🇪🇺', label: 'Date TBA', startUtc: new Date('2026-XX-XXT15:00:00Z'), color: '#6699ff' },
//     { code: 'NA', flag: '🇺🇸', label: 'Date TBA', startUtc: new Date('2026-XX-XXT00:00:00Z'), color: '#ff6666' },
//   ],
// },
// ═══════════════════════════════════════════════════════════════

interface Season {
  id: number;
  name: string;
  theme: string;
  confirmed: boolean;
  regions: {
    code: string;
    flag: string;
    label: string;
    startUtc: Date;
    color: string;
  }[];
}

const SEASONS: Season[] = [
  // ── Season 39 ──────────────────────────────────────────────
  {
    id: 39,
    name: 'Shades of the Nephalem',
    theme: 'Harness the power of the Shades of the Nephalem — first debuted in Season 22.',
    confirmed: true,
    regions: [
      { code: 'KR', flag: '🇰🇷', label: 'Thu Jun 26 — 5:00 PM KST', startUtc: new Date('2026-06-26T08:00:00Z'), color: '#cc99ff' },
      { code: 'EU', flag: '🇪🇺', label: 'Thu Jun 26 — 5:00 PM CEST', startUtc: new Date('2026-06-26T15:00:00Z'), color: '#6699ff' },
      { code: 'US', flag: '🇺🇸', label: 'Thu Jun 26 — 5:00 PM PDT', startUtc: new Date('2026-06-27T00:00:00Z'), color: '#ff6666' },
    ],
  },
  // ── Season 40 — add details here when announced ────────────
  // (uncomment and fill in when Blizzard announces Season 40)
  // {
  //   id: 40,
  //   name: 'TBA',
  //   theme: 'TBA',
  //   confirmed: false,
  //   regions: [
  //     { code: 'KR', flag: '🇰🇷', label: 'Date TBA', startUtc: new Date('2026-XX-XXT08:00:00Z'), color: '#cc99ff' },
  //     { code: 'EU', flag: '🇪🇺', label: 'Date TBA', startUtc: new Date('2026-XX-XXT15:00:00Z'), color: '#6699ff' },
  //     { code: 'NA', flag: '🇺🇸', label: 'Date TBA', startUtc: new Date('2026-XX-XXT00:00:00Z'), color: '#ff6666' },
  //   ],
  // },
];

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const days  = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins  = Math.floor((ms % 3600000)  / 60000);
  const secs  = Math.floor((ms % 60000)    / 1000);
  if (days  > 0) return `${days}d ${hours}h ${mins}m ${secs}s`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins  > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function NextSeasonCard() {
  const [now, setNow] = useState(Date.now());

  // Tick every second so the uptime/countdown is always accurate
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Find the most relevant season to show:
  // - The latest season that has at least one region started (current/live)
  // - Or the earliest upcoming season if none have started yet
  const activeSeason = (() => {
    // Sort newest first
    const sorted = [...SEASONS].sort((a, b) => b.id - a.id);

    // Find newest season that has at least started in one region
    const liveOrPartial = sorted.find(s =>
      s.regions.some(r => now >= r.startUtc.getTime())
    );
    if (liveOrPartial) {
      const allLive = liveOrPartial.regions.every(r => now >= r.startUtc.getTime());
      return { season: liveOrPartial, allLive };
    }

    // Otherwise next upcoming (smallest id not yet started)
    const upcoming = [...SEASONS]
      .sort((a, b) => a.id - b.id)
      .find(s => s.regions.every(r => now < r.startUtc.getTime()));
    if (upcoming) return { season: upcoming, allLive: false };

    return null;
  })();

  if (!activeSeason) return null;

  const { season, allLive } = activeSeason;
  const partiallyLive = !allLive && season.regions.some(r => now >= r.startUtc.getTime());

  const cardBg    = allLive ? 'rgba(39,174,96,0.08)'    : 'rgba(102,99,255,0.08)';
  const cardBorder = allLive ? 'rgba(39,174,96,0.35)'   : 'rgba(102,99,255,0.35)';
  const cardGlow   = allLive ? 'rgba(39,174,96,0.08)'   : 'rgba(102,99,255,0.08)';
  const glowColor  = allLive ? 'rgba(39,174,96,0.15)'   : 'rgba(102,99,255,0.18)';
  const iconBg     = allLive ? 'linear-gradient(135deg, #1a6b3b, #27ae60)' : 'linear-gradient(135deg, #3d3b8e, #6663ff)';
  const iconGlow   = allLive ? 'rgba(39,174,96,0.5)'    : 'rgba(102,99,255,0.5)';
  const accentColor = allLive ? '#2ecc71' : '#9d9bff';
  const nameColor   = allLive ? '#7eeaab' : '#c4c3ff';
  const dividerColor = allLive ? 'rgba(39,174,96,0.2)' : 'rgba(102,99,255,0.2)';

  const statusLabel = allLive
    ? '🟢 Season Live'
    : partiallyLive
      ? '🟡 Starting...'
      : season.confirmed
        ? 'Next Season'
        : '🔜 Upcoming';

  return (
    <div
      className="d3-card p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${cardBg} 0%, rgba(10,9,8,0.95) 60%)`,
        border: `1px solid ${cardBorder}`,
        boxShadow: `0 0 30px ${cardGlow}`,
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: '-40%', right: '-10%',
        width: '160px', height: '160px',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2 mb-3">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={{ background: iconBg, boxShadow: `0 0 12px ${iconGlow}` }}
        >
          <Sparkles style={{ color: '#fff', width: 18, height: 18 }} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accentColor }}>
            {statusLabel}
          </div>
          <div className="text-xs font-mono-diablo font-bold leading-tight" style={{ color: 'var(--text-muted)' }}>
            Season {season.id}
          </div>
        </div>
      </div>

      {/* Season name */}
      <div className="relative z-10 font-serif-display font-bold text-base leading-tight mb-1" style={{ color: nameColor }}>
        {season.name}
      </div>

      {/* Theme */}
      <div className="relative z-10 text-[10px] leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
        {season.theme}
      </div>

      {/* Bottom section */}
      <div className="relative z-10 pt-3" style={{ borderTop: `1px solid ${dividerColor}` }}>

        {/* FULLY LIVE: per-region uptime */}
        {allLive && (
          <>
            <div className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: 'rgba(39,174,96,0.7)' }}>
              Season Uptime
            </div>
            <div className="flex flex-col gap-1.5">
              {season.regions.map(r => {
                const regionUptime = now - r.startUtc.getTime();
                return (
                  <div key={r.code} className="flex items-center gap-3">
                    <span className="font-mono-diablo font-black text-base leading-none w-6 shrink-0" style={{ color: r.color }}>
                      {r.code}
                    </span>
                    <span className="font-mono-diablo font-black text-base leading-none" style={{ color: '#2ecc71' }}>
                      {formatDuration(regionUptime)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* NOT YET FULLY LIVE: per-region countdown */}
        {!allLive && (
          <>
            <div className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: 'rgba(102,99,255,0.7)' }}>
              {partiallyLive ? 'Region Status' : 'Starts In'}
            </div>
            <div className="flex flex-col gap-1.5">
              {season.regions.map(r => {
                const diff    = r.startUtc.getTime() - now;
                const started = diff <= 0;
                return (
                  <div key={r.code} className="flex items-center gap-3">
                    <span className="font-mono-diablo font-black text-base leading-none w-6 shrink-0" style={{ color: r.color }}>
                      {r.code}
                    </span>
                    <span className="font-mono-diablo font-black text-base leading-none"
                      style={{ color: started ? '#2ecc71' : r.color }}>
                      {started ? '✓ Live' : formatDuration(diff)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
