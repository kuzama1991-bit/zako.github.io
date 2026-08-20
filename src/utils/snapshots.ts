// ── Paragon snapshot storage ──────────────────────────────────
// Stores daily snapshots per player so we can build a real
// progress graph over time. Snapshots grow each time the app
// runs, building a picture from the first day of use onwards.

export interface PlayerSnapshot {
  paragon: number;
  xpRate7d: number;      // T/h
  paragonInWeek: number;
  rank: number;
  ts: number;            // unix ms
}

export interface PlayerHistory {
  [name: string]: PlayerSnapshot[];
}

const KEY = 'd3_paragon_history';
const MAX_SNAPSHOTS_PER_PLAYER = 365; // ~1 year of daily data

function load(): PlayerHistory {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function save(data: PlayerHistory) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/** Called each time live data loads. Stores one snapshot per player per day.
 *  Keeps at most MAX_SNAPSHOTS_PER_PLAYER snapshots per player.
 */
export function recordSnapshots(players: { name: string; paragon: number; xpRate7d: number; paragonInWeek: number; rank: number }[]) {
  const now = Date.now();
  const todayKey = new Date().toDateString();   // e.g. "Mon Jun 16 2026"
  const history = load();

  players.forEach(p => {
    const list: PlayerSnapshot[] = history[p.name] || [];

    // Only store once per calendar day
    const lastSnap = list[list.length - 1];
    if (lastSnap && new Date(lastSnap.ts).toDateString() === todayKey) {
      // Update today's entry if paragon changed
      if (lastSnap.paragon !== p.paragon) {
        list[list.length - 1] = { paragon: p.paragon, xpRate7d: p.xpRate7d, paragonInWeek: p.paragonInWeek, rank: p.rank, ts: now };
      }
    } else {
      list.push({ paragon: p.paragon, xpRate7d: p.xpRate7d, paragonInWeek: p.paragonInWeek, rank: p.rank, ts: now });
    }

    // Prune oldest
    if (list.length > MAX_SNAPSHOTS_PER_PLAYER) list.splice(0, list.length - MAX_SNAPSHOTS_PER_PLAYER);
    history[p.name] = list;
  });

  save(history);
}

export function getHistory(name: string): PlayerSnapshot[] {
  return load()[name] || [];
}

export function getAllHistory(): PlayerHistory {
  return load();
}

/** Returns gain for a player over the last N days.
 *  Returns null if not enough data.
 */
export function gainOverDays(name: string, days: number): number | null {
  const snaps = getHistory(name);
  if (snaps.length < 2) return null;
  const now = Date.now();
  const cutoff = now - days * 86400000;
  const oldest = [...snaps].reverse().find(s => s.ts <= cutoff) || snaps[0];
  const latest = snaps[snaps.length - 1];
  if (oldest === latest) return null;
  return latest.paragon - oldest.paragon;
}

/** Returns gain for last 7 days */
export function gainLastWeek(name: string): number | null { return gainOverDays(name, 7); }
/** Returns gain for last 30 days */
export function gainLastMonth(name: string): number | null { return gainOverDays(name, 30); }
/** Returns gain since first recorded snapshot */
export function gainAllTime(name: string): number | null {
  const snaps = getHistory(name);
  if (snaps.length < 2) return null;
  return snaps[snaps.length - 1].paragon - snaps[0].paragon;
}

/** Start of current week (Monday 00:00 local time) as unix ms */
export function startOfWeekMs(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diffToMon = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMon);
  return d.getTime();
}

/** Paragon gain since last Monday (or first snapshot after Monday). null if insufficient data. */
export function gainSinceMonday(name: string): number | null {
  const snaps = getHistory(name);
  if (snaps.length < 1) return null;
  const weekStart = startOfWeekMs();
  const latest = snaps[snaps.length - 1];
  // Prefer the last snapshot at or before Monday; else first snapshot of the week
  let baseline = snaps[0];
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].ts <= weekStart) {
      baseline = snaps[i];
      break;
    }
  }
  // If all snapshots are after Monday, use the earliest this week
  if (baseline.ts > weekStart) {
    const thisWeek = snaps.filter(s => s.ts >= weekStart);
    if (thisWeek.length < 2) return null;
    baseline = thisWeek[0];
  }
  if (latest === baseline) return null;
  return latest.paragon - baseline.paragon;
}

export interface WeeklyRacer {
  name: string;
  gain: number;
  currentParagon: number;
  currentRank: number;
  xpRate7d: number;
}

/** Top paragon gainers since Monday across all tracked history. */
export function weeklyRaceBoard(limit = 50): WeeklyRacer[] {
  const history = getAllHistory();
  const rows: WeeklyRacer[] = [];
  for (const name of Object.keys(history)) {
    const gain = gainSinceMonday(name);
    if (gain === null || gain <= 0) continue;
    const snaps = history[name];
    const latest = snaps[snaps.length - 1];
    rows.push({
      name,
      gain,
      currentParagon: latest.paragon,
      currentRank: latest.rank,
      xpRate7d: latest.xpRate7d,
    });
  }
  rows.sort((a, b) => b.gain - a.gain || b.currentParagon - a.currentParagon);
  return rows.slice(0, limit);
}
