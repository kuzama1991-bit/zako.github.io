// ============================================================
// Blizzard D3 API Client
// Uses corsproxy.io to bypass browser CORS restrictions
// (Works natively in Electron without proxy)
// ============================================================

const CLIENT_ID = '2644fe6fef0e4763a5c74bed577a74f1';
const CLIENT_SECRET = 'sKmkyOjAbnY1t2O7DDXBdUqNRY3wrjq1';

const CORS_PROXY = 'https://corsproxy.io/?';
const OAUTH_URL = 'https://oauth.battle.net/token';
const API_BASE = {
  eu: 'https://eu.api.blizzard.com',
  us: 'https://us.api.blizzard.com',
  kr: 'https://kr.api.blizzard.com',
  tw: 'https://tw.api.blizzard.com',
};

const D3_WEB_BASE: Record<string, string> = {
  eu: 'https://eu.diablo3.blizzard.com',
  us: 'https://us.diablo3.blizzard.com',
  kr: 'https://kr.diablo3.blizzard.com',
  tw: 'https://tw.diablo3.blizzard.com',
};

export type Region = 'eu' | 'us' | 'kr' | 'tw';

export type SoloClass =
  | 'barbarian'
  | 'crusader'
  | 'dh'
  | 'monk'
  | 'necromancer'
  | 'wd'
  | 'wizard';

export interface RiftMember {
  battletag: string;
  hero: {
    id: number;
    name: string;
    class: string;
    paragonLevel: number;
    hardcore: boolean;
  };
}

export interface RiftEntry {
  rank: number;
  score: number; // GR level cleared
  time: number; // ms
  members: RiftMember[];
  completedAt?: string;
}

export interface LeaderboardResponse {
  tier: number;
  ranking: RiftEntry[];
}

function extractCellValue(cell: any): any {
  if (!cell) return undefined;
  if (cell.number !== undefined) return cell.number;
  if (cell.timestamp !== undefined) return cell.timestamp;
  if (cell.string !== undefined) return cell.string;
  if (cell.value !== undefined) return cell.value;
  return undefined;
}

// Returns the rift clear time already normalized to MILLISECONDS.
// The Blizzard D3 API stores `RiftTime` in milliseconds (e.g. 64233 = 1m 4.233s),
// while some other fields use seconds. We track the unit by field name.
function extractRiftTime(row: any, rowData: any[]): number {
  // Direct numeric properties (already ms in Blizzard's responses)
  if (typeof row.time === 'number' && row.time > 0) return row.time;
  if (typeof row.riftTime === 'number' && row.riftTime > 0) return row.riftTime;
  if (typeof row.duration === 'number' && row.duration > 0) return row.duration;

  // Fields that store the value in MILLISECONDS
  const msIds = ['RiftTime', 'Time', 'ClearTime', 'Duration', 'CompletionTime', 'ElapsedTime', 'TimeSpent'];
  // Fields that store the value in SECONDS
  const secIds = ['ClearTimeSeconds', 'RiftDurationSeconds', 'TimeSpentSeconds'];

  for (const id of msIds) {
    const cell = rowData.find((d: any) => String(d.id).toLowerCase() === id.toLowerCase());
    const value = extractCellValue(cell);
    if (typeof value === 'number' && value > 0) return value; // already ms
  }

  for (const id of secIds) {
    const cell = rowData.find((d: any) => String(d.id).toLowerCase() === id.toLowerCase());
    const value = extractCellValue(cell);
    if (typeof value === 'number' && value > 0) return value * 1000; // seconds → ms
  }

  // Fallback: any numeric field whose id looks time-related (assume ms).
  const timeLike = rowData.find((d: any) => {
    const id = String(d.id || '').toLowerCase();
    const value = extractCellValue(d);
    return typeof value === 'number' && value > 0 &&
      (id.includes('time') || id.includes('duration') || id.includes('elapsed'));
  });
  if (timeLike) {
    const id = String(timeLike.id || '').toLowerCase();
    const value = extractCellValue(timeLike);
    return id.includes('second') ? value * 1000 : value;
  }

  return 0;
}

// Sanity-check an already-millisecond value. No GR clear exceeds 30 minutes.
function normalizeRiftTimeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const rounded = Math.round(ms);
  if (rounded > 1800000) return 0; // not a valid rift time
  return rounded;
}

// Cache token in memory (per session)
let cachedToken: { token: string; expiresAt: number } | null = null;

function getBaseUrl(region: Region): string {
  return API_BASE[region];
}

// Try direct fetch first, fall back to CORS proxy
async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Try direct first
  try {
    const resp = await fetch(url, options);
    if (resp.ok) return resp;
  } catch {
    // Direct failed, try proxy
  }
  // Try with CORS proxy
  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const resp = await fetch(proxyUrl, options);
    if (resp.ok) return resp;
    throw new Error(`Proxy returned ${resp.status}`);
  } catch (e) {
    throw new Error(`Failed to reach Blizzard API: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}

async function getToken(): Promise<string> {
  // Return cached if still valid (with 5min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token;
  }

  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const resp = await safeFetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await resp.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
  };
  return cachedToken.token;
}

export async function getSeasons(region: Region): Promise<{ current: number; seasons: number[] }> {
  const token = await getToken();
  const base = `${getBaseUrl(region)}/data/d3/season/`;

  // Blizzard's D3 endpoints accept Bearer auth. Some examples also include
  // ?region=eu. Try that first, then fall back to access_token query style.
  let resp: Response;
  try {
    resp = await safeFetch(`${base}?region=${region}&locale=en_US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    resp = await safeFetch(`${base}?access_token=${token}&locale=en_US`);
  }
  const data = await resp.json();

  const current =
    data.current ??
    data.current_season ??
    data.currentSeason ??
    data.season?.find?.((s: any) => s.current)?.id ??
    0;

  const seasonArray = data.seasons ?? data.season ?? [];
  const seasons: number[] = [current, ...seasonArray.map((s: any) => s.id ?? s.season ?? s)]
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

  return {
    current: current || 0,
    seasons: [...new Set(seasons)].filter((x): x is number => typeof x === 'number').sort((a, b) => b - a),
  };
}

export async function getEras(region: Region): Promise<{ current: number; eras: number[] }> {
  const token = await getToken();
  const url = `${getBaseUrl(region)}/data/d3/era/?access_token=${token}`;
  const resp = await safeFetch(url);
  const data = await resp.json();
  const eras: number[] = data.current ? [data.current, ...(data.era || []).map((s: any) => s.id)] : [];
  return {
    current: data.current || 0,
    eras: [...new Set(eras)].filter((x): x is number => typeof x === 'number').sort((a, b) => b - a),
  };
}

export interface LeaderboardType {
  id: string;
  label: string;
  hero_class_string?: string;
  team_size?: number;
  hardcore?: boolean;
}

export async function getSeasonLeaderboardList(region: Region, seasonId: number): Promise<LeaderboardType[]> {
  const token = await getToken();
  const url = `${getBaseUrl(region)}/data/d3/season/${seasonId}?region=${region}&locale=en_US&access_token=${token}`;
  const resp = await safeFetch(url);
  const data = await resp.json();
  if (!data.leaderboard) return [];
  return (data.leaderboard || []).map((lb: any) => ({
    id: lb.ladder?.href?.split('/').pop() || '',
    hero_class_string: lb.hero_class_string,
    team_size: lb.team_size,
    hardcore: lb.hardcore,
    label: lb.hero_class_string || lb.ladder?.href?.split('/').pop() || '',
  }));
}

export async function fetchLeaderboard(
  region: Region,
  seasonId: number,
  type: string,
  isEra: boolean = false
): Promise<any> {
  const token = await getToken();
  const path = isEra ? 'era' : 'season';
  const base = `${getBaseUrl(region)}/data/d3/${path}/${seasonId}/leaderboard/${type}`;

  // Try Bearer auth with region param first
  try {
    const resp = await safeFetch(`${base}?region=${region}&locale=en_US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch {
    // Fallback to access_token query style
    const resp = await safeFetch(`${base}?access_token=${token}&region=${region}&locale=en_US`);
    return await resp.json();
  }
}

// Fetch rift leaderboard from all 3 regions and merge into global view
export async function fetchGlobalLeaderboard(
  seasonId: number,
  type: string,
  isEra: boolean = false,
  filterRegion?: Region | 'world'
): Promise<(RiftEntry & { region: Region })[]> {
  const regions: Region[] =
    filterRegion === 'world' || !filterRegion ? ['eu', 'us', 'kr'] : [filterRegion];

  const allEntries: (RiftEntry & { region: Region })[] = [];

  await Promise.all(
    regions.map(async (region) => {
      try {
        const data = await fetchLeaderboard(region, seasonId, type, isEra);
        const rawRows = data?.row || data?.ranking || [];

        rawRows.forEach((row: any, index: number) => {
          const rowData = row.data || [];
          const players = row.player || row.members || [];
          const findVal = (id: string) => rowData.find((d: any) => d.id === id);
          const rawTime = extractRiftTime(row, rowData);

          const entry: RiftEntry = {
            rank: row.rank || index + 1,
            score: row.score || findVal('RiftLevel')?.number || findVal('RiftTier')?.number || 0,
            time: normalizeRiftTimeMs(rawTime),
            members: players.map((p: any) => {
              const pData = p.data || [];
              const findP = (id: string) => pData.find((d: any) => d.id === id);
              return {
                battletag: findP('HeroBattleTag')?.string || p.battletag || '',
                hero: {
                  id: p.id || 0,
                  name: p.name || '',
                  class: findP('HeroClass')?.string || p.class || '',
                  paragonLevel: findP('ParagonLevel')?.number || p.paragonLevel || 0,
                  hardcore: p.hardcore || false,
                }
              };
            }),
            completedAt: (() => {
              // Blizzard uses several field names depending on the leaderboard type.
              const candidates = ['CompletedAt', 'CompletedTime', 'CompletedTimestamp', 'CompletionTime', 'CompletedOn'];
              for (const id of candidates) {
                const cell = findVal(id);
                if (!cell) continue;
                const ts = cell.timestamp ?? cell.number ?? cell.value;
                if (typeof ts === 'number' && ts > 0) {
                  // Blizzard timestamps are in seconds; if it's already in ms (> ~year 2000 in ms), keep as is
                  const ms = ts > 1e12 ? ts : ts * 1000;
                  return new Date(ms).toISOString();
                }
                if (typeof ts === 'string' && ts) return ts;
              }
              return undefined;
            })()
          };

          if (entry.members.length > 0 && entry.time > 0 && entry.score > 0) {
            allEntries.push({ ...entry, region });
          }
        });
      } catch (e) {
        console.error(`Fetch error for ${region}:`, e);
      }
    })
  );

  // Remove exact duplicate team clears first.
  const exactTeamMap = new Map<string, RiftEntry & { region: Region }>();
  allEntries.forEach((e) => {
    const memberKey = e.members.map((m) => m.battletag).sort().join('|');
    const key = `${e.score}-${e.time}-${memberKey}`;
    if (!exactTeamMap.has(key)) exactTeamMap.set(key, e);
  });
  const uniqueTeamEntries = Array.from(exactTeamMap.values());

  // Solo leaderboards: each player appears once anyway, just sort + rank.
  if (type.startsWith('rift-') && !type.startsWith('rift-team-')) {
    uniqueTeamEntries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.time !== b.time) return a.time - b.time;
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : Infinity;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : Infinity;
      return dateA - dateB;
    });

    let currentRank = 1;
    for (let i = 0; i < uniqueTeamEntries.length; i++) {
      const current = uniqueTeamEntries[i];
      const prev = uniqueTeamEntries[i - 1];
      if (prev && current.score === prev.score && current.time === prev.time) {
        current.rank = prev.rank;
      } else {
        current.rank = currentRank;
      }
      currentRank++;
    }
    return uniqueTeamEntries;
  }

  // Team leaderboards (2P/3P/4P): Blizzard ranks TEAMS, not players.
  // Keep one row per team clear, matching blizzard.com exactly.
  uniqueTeamEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.time !== b.time) return a.time - b.time;
    const dateA = a.completedAt ? new Date(a.completedAt).getTime() : Infinity;
    const dateB = b.completedAt ? new Date(b.completedAt).getTime() : Infinity;
    return dateA - dateB;
  });

  let currentRank = 1;
  for (let i = 0; i < uniqueTeamEntries.length; i++) {
    const current = uniqueTeamEntries[i];
    const prev = uniqueTeamEntries[i - 1];
    if (prev && current.score === prev.score && current.time === prev.time) {
      current.rank = prev.rank;
    } else {
      current.rank = currentRank;
    }
    currentRank++;
  }

  return uniqueTeamEntries;
}

// Format class name
export const CLASS_NAMES: Record<string, string> = {
  barbarian: 'Barbarian',
  crusader: 'Crusader',
  dh: 'Demon Hunter',
  monk: 'Monk',
  necromancer: 'Necromancer',
  wd: 'Witch Doctor',
  wizard: 'Wizard',
};

export const CLASS_SHORT: Record<string, string> = {
  barbarian: 'Barb',
  crusader: 'Crus',
  dh: 'DH',
  monk: 'Monk',
  necromancer: 'Necro',
  wd: 'WD',
  wizard: 'Wiz',
};

// Parse Blizzard time into a formatted string "2m 1.700s".
// Values are normalized to ms by normalizeRiftTimeMs, which handles unit detection
// and sanity-checks against the 30-minute maximum for any GR clear.
export function formatRiftTime(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'number' || value <= 0) return '—';

  const totalMs = normalizeRiftTimeMs(value);
  if (totalMs <= 0) return '—';

  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}s`;
}

// ============================================================
// Set-specific leaderboard scraping from Blizzard D3 website
// The Blizzard API doesn't expose per-set leaderboards, but the
// D3 website has them at:
//   https://{region}.diablo3.blizzard.com/en-us/rankings/season/{id}/rift-{class}
// The set dropdown on the page filters differently per class.
// We scrape HTML and parse out the table rows.
// ============================================================

function parseTimeStringToMs(timeStr: string): number {
  // Parse "5m 20.516s" format
  const match = timeStr.match(/(\d+)m\s+(\d+)\.(\d+)s/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
    return minutes * 60000 + seconds * 1000 + millis;
  }
  return 0;
}

export async function fetchWebLeaderboard(
  region: Region,
  seasonId: number,
  leaderboardId: string
): Promise<(RiftEntry & { region: Region })[]> {
  const base = D3_WEB_BASE[region] || D3_WEB_BASE.us;
  const url = `${base}/en-us/rankings/season/${seasonId}/${leaderboardId}`;

  const resp = await safeFetch(url);
  const html = await resp.text();

  const entries: (RiftEntry & { region: Region })[] = [];

  // Parse table rows: <tr> containing <td data-raw="N">, player name, score, time, date
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];

    // Extract rank from data-raw
    const rankMatch = trContent.match(/data-raw="(\d+)"/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // Extract player name from the anchor tag
    const nameMatch = trContent.match(/<a[^>]*>[\s\S]*?<img[^>]*>\s*\n?\s*([^<]+)/);
    const playerName = nameMatch ? nameMatch[1].trim() : 'Unknown';

    // Extract all plain <td> content
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]*>/g, '').trim());
    }

    // tds[0]=rank, tds[1]=player (with img), tds[2]=GR level, tds[3]=time, tds[4]=date
    if (tds.length < 4) continue;

    const score = parseInt(tds[2], 10);
    const timeStr = tds[3];
    const timeMs = parseTimeStringToMs(timeStr);

    if (score > 0 && timeMs > 0) {
      entries.push({
        rank,
        score,
        time: timeMs,
        members: [{
          battletag: playerName,
          hero: {
            id: 0,
            name: playerName,
            class: '',
            paragonLevel: 0,
            hardcore: false,
          }
        }],
        completedAt: tds[4] || undefined,
        region,
      });
    }
  }

  return entries;
}

// ============================================================
// Hero profile fetching to determine equipped set
// ============================================================

export interface HeroItems {
  shoulders?: { name: string };
  torso?: { name: string };
  legs?: { name: string };
  head?: { name: string };
  hands?: { name: string };
  feet?: { name: string };
  bracers?: { name: string };
  waist?: { name: string };
}

export async function fetchHeroProfile(
  region: Region,
  battletag: string,
  heroId: number
): Promise<HeroItems | null> {
  const token = await getToken();
  const encodedTag = encodeURIComponent(battletag.replace('#', '-'));
  const url = `${getBaseUrl(region)}/d3/profile/${encodedTag}/hero/${heroId}?locale=en_US&access_token=${token}`;

  try {
    const resp = await safeFetch(url);
    const data = await resp.json();

    const items = data.items || {};
    return {
      shoulders: items.shoulders,
      torso: items.torso,
      legs: items.legs,
      head: items.head,
      hands: items.hands,
      feet: items.feet,
      bracers: items.bracers,
      waist: items.waist,
    };
  } catch (e) {
    console.error('Failed to fetch hero profile:', e);
    return null;
  }
}

// Determine which set a hero is wearing based on item names
export function detectSetFromItems(items: HeroItems | null): string | null {
  if (!items) return null;

  const allNames = Object.values(items)
    .map(i => i?.name?.toLowerCase() || '')
    .join(' ');

  // Barbarian
  if (allNames.includes('raekor')) return 'raekor';
  if (allNames.includes('immortal king') || allNames.includes('immortal')) return 'ik';
  if (allNames.includes('might of the earth') || allNames.includes('earth')) return 'earth';
  if (allNames.includes('wrath of the wastes') || allNames.includes('wastes')) return 'wastes';
  if (allNames.includes('horde of the ninety') || allNames.includes('savages')) return 'savages';

  // Crusader
  if (allNames.includes('akkhan')) return 'akkhan';
  if (allNames.includes('roland')) return 'roland';
  if (allNames.includes('seeker of the light')) return 'seeker';
  if (allNames.includes('invoker')) return 'invoker';
  if (allNames.includes('aegis of valor') || allNames.includes('valor')) return 'valor';

  // Demon Hunter
  if (allNames.includes('marauder')) return 'marauder';
  if (allNames.includes('natalya')) return 'natalya';
  if (allNames.includes("shadow's mantle") || allNames.includes('shadow')) return 'shadow';
  if (allNames.includes('unhallowed')) return 'ue';
  if (allNames.includes('gears of dreadlands') || allNames.includes('god')) return 'god';

  // Monk
  if (allNames.includes('inna')) return 'inna';
  if (allNames.includes('sunwuko') || allNames.includes('monkey')) return 'sunwuko';
  if (allNames.includes('uliana')) return 'uliana';
  if (allNames.includes('raiment of a thousand')) return 'raiment';
  if (allNames.includes('patterns of justice') || allNames.includes('justice')) return 'justice';

  // Necromancer
  if (allNames.includes('rathma')) return 'rathma';
  if (allNames.includes('trang')) return 'trangoul';
  if (allNames.includes('inarius')) return 'inarius';
  if (allNames.includes('pestilence')) return 'pestilence';
  if (allNames.includes('masquerade')) return 'masquerade';

  // Witch Doctor
  if (allNames.includes('zunimassa')) return 'zunimassa';
  if (allNames.includes('arachyr')) return 'arachyr';
  if (allNames.includes('helltooth')) return 'helltooth';
  if (allNames.includes('jade')) return 'jade';
  if (allNames.includes('mundunugu')) return 'mundunugu';

  // Wizard
  if (allNames.includes('tal rasha')) return 'talrasha';
  if (allNames.includes('delsere') || allNames.includes('dmo')) return 'dmo';
  if (allNames.includes('vyr')) return 'vyr';
  if (allNames.includes('firebird')) return 'firebird';
  if (allNames.includes('typhon')) return 'typhon';

  // Legacy of Nightmares / LoD (detect by the ring)
  if (allNames.includes('legacy of nightmares') || allNames.includes('lod')) return 'lod';

  return null;
}

/**
 * Official Blizzard set leaderboards (since Season 23).
 * Ladder IDs: rift-{classSlug}-set1…set5 / noset
 * Note: overall class boards use "dh" / "wd", but set boards use
 * "demonhunter" / "witchdoctor".
 */
export type SetLadderId = 'set1' | 'set2' | 'set3' | 'set4' | 'set5' | 'noset';

/** Class slug used in set-specific ladder IDs */
export function setLadderClassSlug(cls: SoloClass): string {
  if (cls === 'dh') return 'demonhunter';
  if (cls === 'wd') return 'witchdoctor';
  return cls;
}

/** Overall class ladder slug (matches existing app usage) */
export function overallLadderClassSlug(cls: SoloClass): string {
  if (cls === 'dh') return 'dh';
  if (cls === 'wd') return 'wd';
  return cls;
}

/**
 * Build the Blizzard leaderboard type string for a solo class + optional set.
 * setFilter "all" → overall class board; otherwise set1…set5 / noset.
 * hardcore → rift-hardcore-* ladder (official Blizzard HC boards).
 */
export function buildSoloLadderType(
  cls: SoloClass,
  setFilter: string = 'all',
  hardcore: boolean = false
): string {
  const prefix = hardcore ? 'rift-hardcore' : 'rift';
  if (!setFilter || setFilter === 'all') {
    return `${prefix}-${overallLadderClassSlug(cls)}`;
  }
  return `${prefix}-${setLadderClassSlug(cls)}-${setFilter}`;
}

/** Team ladder type: rift-team-N or rift-hardcore-team-N */
export function buildTeamLadderType(
  teamSize: 2 | 3 | 4,
  hardcore: boolean = false
): string {
  return hardcore ? `rift-hardcore-team-${teamSize}` : `rift-team-${teamSize}`;
}

/** Human-readable labels for set ladder IDs (short UI labels) */
export const SET_LABELS: Record<string, string> = {
  set1: 'Set 1',
  set2: 'Set 2',
  set3: 'Set 3',
  set4: 'Set 4',
  set5: 'Set 5',
  noset: 'No Set',
  // Profile-detection aliases (player dialog / legacy)
  raekor: 'Raekor',
  ik: 'Immortal King',
  earth: 'Might of the Earth',
  wastes: 'Wrath of the Wastes',
  savages: 'H90',
  akkhan: 'Akkhan',
  roland: 'Roland',
  seeker: 'Seeker',
  invoker: 'Invoker',
  valor: 'Aegis of Valor',
  marauder: 'Marauder',
  natalya: 'Natalya',
  shadow: "Shadow's Mantle",
  ue: 'UE',
  god: 'GoD',
  inna: 'Inna',
  sunwuko: 'Sunwuko',
  uliana: 'Uliana',
  raiment: 'Raiment',
  justice: 'PoJ',
  rathma: 'Rathma',
  trangoul: "Trag'Oul",
  inarius: 'Inarius',
  pestilence: 'Pestilence',
  masquerade: 'Masquerade',
  zunimassa: 'Zunimassa',
  arachyr: 'Arachyr',
  helltooth: 'Helltooth',
  jade: 'Jade',
  mundunugu: 'Mundunugu',
  talrasha: 'Tal Rasha',
  dmo: 'DMO',
  vyr: 'Vyr',
  firebird: 'Firebird',
  typhon: 'Typhon',
  lod: 'No Set',
};

/**
 * Official set options per class.
 * `id` is the Blizzard ladder suffix (set1…set5 / noset).
 * Labels taken from live API leaderboard titles (Season 39).
 */
export const CLASS_SETS: Record<SoloClass, { id: SetLadderId; label: string; short: string }[]> = {
  barbarian: [
    { id: 'set1', label: "The Legacy of Raekor", short: 'Raekor' },
    { id: 'set2', label: 'Might of the Earth', short: 'MOTE' },
    { id: 'set3', label: 'Wrath of the Wastes', short: 'Wastes' },
    { id: 'set4', label: "Immortal King's Call", short: 'IK' },
    { id: 'set5', label: 'Horde of the Ninety Savages', short: 'H90' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  crusader: [
    { id: 'set1', label: 'Armor of Akkhan', short: 'Akkhan' },
    { id: 'set2', label: 'Thorns of the Invoker', short: 'Invoker' },
    { id: 'set3', label: "Roland's Legacy", short: 'Roland' },
    { id: 'set4', label: 'Seeker of the Light', short: 'Seeker' },
    { id: 'set5', label: 'Aegis of Valor', short: 'AoV' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  dh: [
    { id: 'set1', label: 'Embodiment of the Marauder', short: 'Marauder' },
    { id: 'set2', label: "The Shadow's Mantle", short: 'Shadow' },
    { id: 'set3', label: 'Unhallowed Essence', short: 'UE' },
    { id: 'set4', label: "Natalya's Vengeance", short: 'Natalya' },
    { id: 'set5', label: 'Gears of Dreadlands', short: 'GoD' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  monk: [
    { id: 'set1', label: 'Raiment of a Thousand Storms', short: 'Raiment' },
    { id: 'set2', label: "Monkey King's Garb", short: 'Sunwuko' },
    { id: 'set3', label: "Uliana's Stratagem", short: 'Uliana' },
    { id: 'set4', label: "Inna's Mantra", short: 'Inna' },
    { id: 'set5', label: 'Patterns of Justice', short: 'PoJ' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  necromancer: [
    { id: 'set1', label: 'Bones of Rathma', short: 'Rathma' },
    { id: 'set2', label: "Trag'Oul's Avatar", short: "Trag'Oul" },
    { id: 'set3', label: 'Grace of Inarius', short: 'Inarius' },
    { id: 'set4', label: "Pestilence Master's Shroud", short: 'Pestilence' },
    { id: 'set5', label: 'Masquerade of the Burning Carnival', short: 'Masquerade' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  wd: [
    { id: 'set1', label: 'Raiment of the Jade Harvester', short: 'Jade' },
    { id: 'set2', label: 'Helltooth Harness', short: 'Helltooth' },
    { id: 'set3', label: "Zunimassa's Haunt", short: 'Zunimassa' },
    { id: 'set4', label: 'Spirit of Arachyr', short: 'Arachyr' },
    { id: 'set5', label: "Mundunugu's Regalia", short: 'Mundunugu' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
  wizard: [
    { id: 'set1', label: "Firebird's Finery", short: 'Firebird' },
    { id: 'set2', label: "Vyr's Amazing Arcana", short: 'Vyr' },
    { id: 'set3', label: "Delsere's Magnum Opus", short: 'DMO' },
    { id: 'set4', label: "Tal Rasha's Elements", short: 'Tal Rasha' },
    { id: 'set5', label: "The Typhon's Veil", short: 'Typhon' },
    { id: 'noset', label: 'No Six Piece Set', short: 'No Set' },
  ],
};

// ============================================================
// Hero detail (build) fetching for Challenge Rift / player builds
// Endpoint: /d3/profile/{account}/hero/{heroId}
// account = battletag with dash, e.g. "Draxlin-1930"
// Returns active/passive skills and equipped items.
// ============================================================

export interface HeroSkill {
  name: string;
  icon?: string;
  rune?: string;
}

export interface HeroItem {
  slot: string;
  name: string;
  icon?: string;
}

export interface HeroDetail {
  name: string;
  className: string;
  paragonLevel: number;
  activeSkills: HeroSkill[];
  passiveSkills: HeroSkill[];
  items: HeroItem[];
}

const SLOT_LABELS: Record<string, string> = {
  head: 'Head',
  neck: 'Amulet',
  shoulders: 'Shoulders',
  torso: 'Chest',
  waist: 'Belt',
  hands: 'Gloves',
  bracers: 'Bracers',
  legs: 'Pants',
  feet: 'Boots',
  leftFinger: 'Ring 1',
  rightFinger: 'Ring 2',
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
};

export async function fetchHeroDetail(
  region: Region,
  account: string,
  heroId: string | number
): Promise<HeroDetail> {
  const token = await getToken();
  // account battletags use '-' in URLs already (e.g. Draxlin-1930)
  const acct = encodeURIComponent(account);
  const base = `${getBaseUrl(region)}/d3/profile/${acct}/hero/${heroId}`;

  let data: any;
  try {
    const resp = await safeFetch(`${base}?region=${region}&locale=en_US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    data = await resp.json();
  } catch {
    const resp = await safeFetch(`${base}?access_token=${token}&region=${region}&locale=en_US`);
    data = await resp.json();
  }

  const activeSkills: HeroSkill[] = (data?.skills?.active || [])
    .filter((s: any) => s?.skill)
    .map((s: any) => ({
      name: s.skill?.name || 'Unknown',
      icon: s.skill?.icon,
      rune: s.rune?.name,
    }));

  const passiveSkills: HeroSkill[] = (data?.skills?.passive || [])
    .filter((s: any) => s?.skill)
    .map((s: any) => ({
      name: s.skill?.name || 'Unknown',
      icon: s.skill?.icon,
    }));

  const items: HeroItem[] = [];
  if (data?.items) {
    for (const [slot, item] of Object.entries<any>(data.items)) {
      if (!item) continue;
      items.push({
        slot: SLOT_LABELS[slot] || slot,
        name: item.name || '',
        icon: item.icon,
      });
    }
  }

  return {
    name: data?.name || account.split('-')[0],
    className: data?.class || '',
    paragonLevel: data?.paragonLevel || 0,
    activeSkills,
    passiveSkills,
    items,
  };
}
