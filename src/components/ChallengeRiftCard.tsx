import { useEffect, useMemo, useState } from 'react';
import { Zap, Clock } from 'lucide-react';

type Region = 'world' | 'eu' | 'us' | 'kr';

const CR_REF_NUMBER = 465;
const CR_REF_DATE = new Date('2026-05-18T20:00:00Z');
const JINA_READER = 'https://r.jina.ai/http://';

const CLASS_INFO: Record<string, { name: string; emoji: string; color: string }> = {
  barbarian: { name: 'Barbarian', emoji: '⚔️', color: '#c41e3a' },
  crusader: { name: 'Crusader', emoji: '🛡️', color: '#f5c542' },
  demonhunter: { name: 'Demon Hunter', emoji: '🏹', color: '#66ddaa' },
  monk: { name: 'Monk', emoji: '👊', color: '#ff9f43' },
  necromancer: { name: 'Necromancer', emoji: '💀', color: '#9b59b6' },
  witchdoctor: { name: 'Witch Doctor', emoji: '🧟', color: '#27ae60' },
  wizard: { name: 'Wizard', emoji: '🔮', color: '#3498db' },
};

const RESET_TIMES = {
  us: 'Monday 13:00 PST',
  eu: 'Tuesday 04:00 CET',
  kr: 'Tuesday (Local Time)',
} as const;

type RegionReset = {
  code: Exclude<Region, 'world'>;
  label: string;
  resetText: string;
};

const REGION_RESETS: RegionReset[] = [
  { code: 'eu', label: 'EU', resetText: RESET_TIMES.eu },
  { code: 'us', label: 'US', resetText: RESET_TIMES.us },
  { code: 'kr', label: 'KR', resetText: RESET_TIMES.kr },
];

function getCurrentChallengeRiftNumber(): number {
  const diffMs = Date.now() - CR_REF_DATE.getTime();
  return CR_REF_NUMBER + Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function classSlugFromText(text: string): string {
  // Match multiple portrait naming conventions Blizzard has used over the years:
  // Old:      portraits/21/x1_crusader_male.png
  // Seasonal: portraits/21/p6_necro_male.png  (p5_, p6_, etc.)
  // Legacy:   portraits/21/witchdoctor_female.png

  // First try: direct full class name (x1_ prefix or bare)
  const full = text.match(/portraits\/\d+\/(?:x1_)?(barbarian|crusader|demonhunter|monk|necromancer|witchdoctor|wizard)_/i);
  if (full) return full[1].toLowerCase();

  // Second try: seasonal short codes (pN_barb, pN_necro, pN_crus, pN_dh, pN_wd, pN_wiz, pN_monk)
  const short = text.match(/portraits\/\d+\/p\d+_(barb|crus|dh|monk|necro|wd|wiz)_/i);
  if (short) {
    const map: Record<string, string> = {
      barb: 'barbarian', crus: 'crusader', dh: 'demonhunter',
      monk: 'monk', necro: 'necromancer', wd: 'witchdoctor', wiz: 'wizard',
    };
    return map[short[1].toLowerCase()] || '';
  }

  return '';
}

function tierFromText(text: string): number {
  const markdownRow = text.match(/\|\s*1\.\s*\|[\s\S]*?\|\s*(\d+)\s*\|/);
  if (markdownRow) return parseInt(markdownRow[1], 10) || 0;
  const compactRow = text.match(/^\s*1\.\*\*[\s\S]*?\*\*(\d+)\s+\d+m/m);
  if (compactRow) return parseInt(compactRow[1], 10) || 0;
  const htmlTier = text.match(/<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*\d+m/i);
  return htmlTier ? parseInt(htmlTier[1], 10) || 0 : 0;
}

async function fetchChallengeInfo(region: Exclude<Region, 'world'>) {
  const host = `${region}.diablo3.blizzard.com`;
  const url = `https://${host}/en-us/rankings/challenge/current/1`;
  const response = await fetch(JINA_READER + url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Challenge Rift unavailable');
  const text = await response.text();
  const slug = classSlugFromText(text);
  return {
    tier: tierFromText(text),
    className: CLASS_INFO[slug]?.name || 'Unknown',
    classEmoji: CLASS_INFO[slug]?.emoji || '⚡',
    classColor: CLASS_INFO[slug]?.color || '#f5c542',
  };
}

// Challenge Rift reset days (exact UTC hour varies by region & DST — showing reset day only)
const RESET_DAYS: Record<Exclude<Region, 'world'>, string> = {
  us: 'Resets Monday',
  eu: 'Resets Tuesday',
  kr: 'Resets Tuesday',
};

export default function ChallengeRiftCard({ region }: { region: Region }) {
  const effectiveRegion = region === 'world' ? 'us' : region;
  const crNumber = useMemo(() => getCurrentChallengeRiftNumber(), []);
  const userTimezone = useMemo(() => getUserTimezone(), []);
  const [info, setInfo] = useState<{ tier: number; className: string; classEmoji: string; classColor: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChallengeInfo(effectiveRegion)
      .then((result) => { if (!cancelled) setInfo(result); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [effectiveRegion]);

  return (
    <div
      className="d3-card relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(10,9,8,0.95) 0%, rgba(20,18,16,0.98) 100%)',
        border: '1px solid var(--gold-dark)',
        boxShadow: '0 0 30px rgba(245,197,66,0.08), inset 0 0 60px rgba(245,197,66,0.03)',
      }}
    >
      {/* Subtle gold glow accent */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(245,197,66,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-3 min-h-[44px]">
          <div className="flex items-center gap-2">
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                boxShadow: '0 0 15px rgba(245,197,66,0.4)',
              }}
            >
              <Zap className="h-5 w-5" style={{ color: '#0a0908' }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--gold-bright)' }}>
                Challenge Rift
              </div>
              <div className="text-xs font-mono-diablo" style={{ color: 'var(--text-muted)' }}>
                #{crNumber}
              </div>
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-md transition-opacity duration-300 ${region !== 'world' && info?.tier ? 'opacity-100' : 'opacity-0'}`}
            style={{
              background: '#000000',
              border: '1px solid var(--gold-dark)',
              boxShadow: '0 0 10px rgba(245,197,66,0.1)',
            }}
          >
            <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--gold-bright)' }}>
              GR Tier
            </div>
            <div className="text-lg font-black font-mono-diablo leading-none text-center" style={{ color: 'var(--gold-bright)' }}>
              {info?.tier || '—'}
            </div>
          </div>
        </div>

      {/* Class Display */}
      <div
        className="rounded-lg p-4 mb-4 text-center relative overflow-hidden"
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {info ? (
          <>
            <div className="text-4xl mb-2" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}>
              {info.classEmoji}
            </div>
            <div className="text-xl font-bold font-serif-display tracking-wide" style={{ color: 'var(--text-primary)' }}>
              {info.className}
            </div>
          </>
        ) : (
          <div className="text-lg" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        )}
      </div>

      {/* Reset Times Section */}
      <div
        className="rounded-lg p-3"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--gold-bright)' }} />
            <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--gold-bright)' }}>
              Reset Times
            </div>
          </div>
          <div className="text-[10px] font-mono-diablo truncate max-w-[150px]" style={{ color: 'var(--gold-bright)' }} title={userTimezone}>
            {userTimezone}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {REGION_RESETS.map((r) => (
            <div
              key={r.code}
              className="rounded-md p-2 text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(245,197,66,0.08) 0%, rgba(245,197,66,0.02) 100%)',
                border: '1px solid rgba(245,197,66,0.2)',
              }}
            >
              {/* Subtle corner accent */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '20px',
                  height: '20px',
                  background: 'linear-gradient(135deg, transparent 50%, rgba(245,197,66,0.1) 50%)',
                }}
              />
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--gold-bright)' }}>
                {r.label}
              </div>
              <div className="text-[10px] font-mono-diablo font-semibold leading-tight" style={{ color: '#66ddaa' }}>
                {r.resetText}
              </div>
              <div className="text-[9px] font-mono-diablo mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {RESET_DAYS[r.code as Exclude<Region, 'world'>]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
