// ============================================================
// Diablo 3 Paragon Leaderboard — Data Layer
// ============================================================
// The Google Sheet has this EXACT CSV header:
//
// Rank,Name,Region,,Mode,Paragon,Non-Season Paragon,Total Xp Tr,% of 15k,,
// Xp Rate 7d Tr/h,Paragon in a Week,Time until 15k,Last Updated At UTC,Updated Ago
//
// Index: 0     1     2      3(blank) 4    5       6                    7            8        9(blank)
//        10                 11                   12               13                    14
//
// Key facts:
//  - Columns 3 and 9 are BLANK spacers
//  - Goal is 15,000 Paragon (not 10k!)
//  - NS Paragon has values like "15,074 (+1,462)" — can exceed 15k
//  - Total Xp is "18,560.09 Tr"
//  - XP Rate is "9.72 Tr/h"
//  - % of 15k is "32.77%"
//  - Paragon in a Week is a plain number
//  - Time until 15k is "5mo 1w" or "—"
// ============================================================

export interface Player {
  rank: number;
  worldRank: number; // Same as rank for this sheet (global ranking)
  name: string;
  region: string;
  mode: string;
  paragon: number;
  nonSeasonParagonRaw: string;   // display text: "15,074 (+1,462)"
  nonSeasonParagon: number;      // numeric for sorting: 15074
  totalXpRaw: string;            // display text: "18,560.09 Tr"
  totalXp: number;               // numeric for sorting: 18560.09
  pctOf15kRaw: string;           // display text: "32.77%"
  pctOf15k: number;              // numeric for sorting: 32.77
  xpRate7dRaw: string;           // display text: "9.72 Tr/h"
  xpRate7d: number;              // numeric for sorting: 9.72
  paragonInWeek: number;
  timeUntil15kRaw: string;       // display text: "5mo 1w" or "—"
  timeUntil15kHours: number;     // numeric hours for sorting (Infinity = "—")
  lastUpdated: string;
  updatedAgoRaw: string;         // display text: "1h 8min"
  updatedAgoMinutes: number;     // numeric minutes for sorting
}

export type SortKey =
  | 'rank' | 'worldRank' | 'name' | 'region' | 'mode' | 'paragon'
  | 'nonSeasonParagon' | 'totalXp' | 'pctOf15k' | 'xpRate7d'
  | 'paragonInWeek' | 'timeUntil15kHours' | 'updatedAgoMinutes';

// ── Number parsing ──────────────────────────────────────────

/** Parse a number from messy text: removes commas, units, and only
 *  considers text before any "(". Returns NaN on failure. */
export function parseNum(raw: string | undefined | null): number {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s || s === '—' || s === '-') return NaN;

  // Only consider text before a parenthesis.
  const paren = s.indexOf('(');
  if (paren !== -1) s = s.slice(0, paren);

  // Strip commas and unit suffixes
  s = s.replace(/,/g, '').replace(/\s*(Tr\/h|Tr|%)\s*/gi, '').trim();

  // Strip trailing dots like "7." → "7"
  if (s.endsWith('.')) s = s.slice(0, -1);

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Convert a duration string like "5mo 1w", "1y 1mo", "131y 1mo", "2h 57min"
 *  or "—" into a comparable number of hours.
 *  Unknown / "—" → Infinity so it sorts last ascending. */
export function parseDurationToHours(raw: string | undefined | null): number {
  if (raw == null) return Infinity;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return Infinity;

  const units: Record<string, number> = {
    y: 365.25 * 24,
    mo: 30.4 * 24,
    w: 7 * 24,
    d: 24,
    h: 1,
    min: 1 / 60,
  };

  let total = 0;
  let matched = false;
  // Order matters: check "mo" / "min" before "m"
  const regex = /(\d+(?:\.\d+)?)\s*(mo|min|y|w|d|h)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(s)) !== null) {
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (units[unit] != null) {
      total += val * units[unit];
      matched = true;
    }
  }
  return matched ? total : Infinity;
}

// ── CSV parser ──────────────────────────────────────────────

/** Minimal CSV parser handling quoted fields with commas inside. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── Main parser ─────────────────────────────────────────────

export function parseLeaderboard(csvText: string): { players: Player[]; sheetRows: number } {
  const table = parseCsv(csvText);
  if (table.length < 2) return [];

  // Find the header row (contains "Rank" & "Paragon").
  let headerIdx = table.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase() === 'rank') &&
    r.some((c) => c.trim().toLowerCase() === 'paragon')
  );
  if (headerIdx === -1) headerIdx = 0;

  // Map header names → column indices
  const headers = table[headerIdx].map((h) => h.trim().toLowerCase());

  const col = (name: string): number => {
    // exact match first
    let idx = headers.indexOf(name);
    if (idx !== -1) return idx;
    // partial match
    idx = headers.findIndex((h) => h.includes(name));
    return idx;
  };

  const iRank        = col('rank');
  const iName        = col('name');
  const iRegion      = col('region');
  const iMode        = col('mode');
  const iParagon     = headers.indexOf('paragon'); // exact match
  const iNS          = col('non-season paragon');
  const iTotalXp     = col('total xp');
  const iPct         = col('% of 15k');
  const iXpRate      = col('xp rate 7d');
  const iParWeek     = col('paragon in a week');
  const iTime        = col('time until 15k');
  const iUpdated     = col('last updated');
  const iAgo         = col('updated ago');

  const dataRows = table.slice(headerIdx + 1);
  // Keep every hero row. Collapse only *identical* sheet copies (same name, region,
  // mode, rank, paragon, XP) — fixes list spam like R3R repeated many times.
  // sheetRows = all valid rank rows before dedupe (matches ranks up to #1000 on the sheet).
  const players: Player[] = [];
  const seenExact = new Set<string>();
  let sheetRows = 0;

  for (const cols of dataRows) {
    const rankStr = cols[iRank]?.trim() ?? '';
    const name    = cols[iName]?.trim() ?? '';
    if (!name && !rankStr) continue; // skip blank rows

    const rank = parseNum(rankStr);
    if (!Number.isFinite(rank)) continue; // skip non-data rows
    sheetRows += 1;

    const paragon = parseNum(cols[iParagon]);

    const nsRaw = (cols[iNS] ?? '').trim();
    const nsNum = parseNum(nsRaw);

    const xpRaw = (cols[iTotalXp] ?? '').trim();
    const xpNum = parseNum(xpRaw);

    const pctRaw = (cols[iPct >= 0 ? iPct : -1] ?? '').trim();

    const rateRaw = (cols[iXpRate] ?? '').trim();
    const rateNum = parseNum(rateRaw);

    const parWeek = parseNum(cols[iParWeek]);

    const timeRaw = (cols[iTime] ?? '').trim() || '—';
    const timeH   = parseDurationToHours(timeRaw);

    const updatedAt = (cols[iUpdated] ?? '').trim();
    const agoRaw    = (cols[iAgo] ?? '').trim();
    const agoMin    = parseDurationToHours(agoRaw) * 60;

    const region = (cols[iRegion] ?? '').trim();
    const mode = (cols[iMode] ?? '').trim();

    const fingerprint = [
      name.toLowerCase(),
      region.toLowerCase(),
      mode.toLowerCase(),
      String(rank),
      String(Number.isFinite(paragon) ? paragon : 0),
      xpRaw,
    ].join('|');
    if (seenExact.has(fingerprint)) continue;
    seenExact.add(fingerprint);

    players.push({
      rank,
      worldRank: rank,
      name,
      region,
      mode,
      paragon: Number.isFinite(paragon) ? paragon : 0,
      nonSeasonParagonRaw: nsRaw,
      nonSeasonParagon: Number.isFinite(nsNum) ? nsNum : 0,
      totalXpRaw: xpRaw,
      totalXp: Number.isFinite(xpNum) ? xpNum : 0,
      pctOf15kRaw: pctRaw,
      pctOf15k: (paragon / 20000) * 100,
      xpRate7dRaw: rateRaw,
      xpRate7d: Number.isFinite(rateNum) ? rateNum : 0,
      paragonInWeek: Number.isFinite(parWeek) ? parWeek : 0,
      timeUntil15kRaw: timeRaw,
      timeUntil15kHours: timeH,
      lastUpdated: updatedAt,
      updatedAgoRaw: agoRaw,
      updatedAgoMinutes: Number.isFinite(agoMin) ? agoMin : Infinity,
    });
  }

  players.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return { players, sheetRows };
}

// ── Fetch ───────────────────────────────────────────────────

export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSn34jVSEI-JxkKGhnGNsCcXpkg0YhOWrHMjVDnjF_it-P8hVk41WdlFTNIIPR5RIJ7wOdEJeapYPNO/pub?output=csv';

export async function fetchLeaderboard(): Promise<{ players: Player[]; sheetRows: number }> {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const text = await res.text();
  return parseLeaderboard(text);
}

// ── Sorting ─────────────────────────────────────────────────

export function comparePlayers(
  a: Player, b: Player, key: SortKey, dir: 'asc' | 'desc'
): number {
  const mult = dir === 'asc' ? 1 : -1;

  // Text columns sort alphabetically
  if (key === 'name' || key === 'region' || key === 'mode') {
    return (a[key] || '').localeCompare(b[key] || '', undefined, { sensitivity: 'base' }) * mult;
  }

  // Numeric columns
  const av = a[key] as number;
  const bv = b[key] as number;

  const aBad = !Number.isFinite(av);
  const bBad = !Number.isFinite(bv);
  if (aBad && bBad) return 0;
  if (aBad) return 1;   // bad values always at bottom
  if (bBad) return -1;

  return (av - bv) * mult;
}

// ── Display helpers ─────────────────────────────────────────

/** Format number with space-separated groups: 10387 → "10 387" */
export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const s = Math.trunc(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Format a decimal with commas: 18560.09 → "18,560.1" */
export function fmtDec(n: number, places = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

// ── XP calculation from dclamage.github.io/paragon.html ─────

const C1 = 166105421028000;
const C2 = 201211626000;
const C3 = 229704000;
const C4 = 102000;

let paragonTable: number[] | null = null;

export async function loadParagonTable(): Promise<void> {
  if (paragonTable) return;
  try {
    const res = await fetch('https://dclamage.github.io/paragontotals.json');
    paragonTable = await res.json();
  } catch {
    paragonTable = [];
  }
}

/** Exact cumulative XP to reach paragon level `n` using the formula from dclamage.github.io */
export function xpForParagon(level: number): number {
  if (level <= 0) return 0;
  
  if (level < 2252 && paragonTable && paragonTable[level]) {
    return paragonTable[level];
  }
  
  const x = level - 2252;
  const xp1 = x + 1;
  const xp2 = x + 2;
  return C1 + C2 * x + C3 * (x * xp1 / 2) + C4 * (x * xp1 * xp2 / 6);
}

export function xpBetweenLevels(from: number, to: number): number {
  if (to <= from) return 0;
  return xpForParagon(to) - xpForParagon(from);
}

export function xpToTrillion(xp: number): number {
  return xp / 1e12;
}

export function estimateDays(xpTr: number, rateBPerH: number): number {
  if (rateBPerH <= 0) return Infinity;
  const xpB = xpTr * 1000;
  const hours = xpB / rateBPerH;
  return hours / 24;
}

/** Format hours into a readable time string like "5mo 1w", "1y 3mo", "3h 20min" */
export function formatHoursToTime(totalHours: number): string {
  if (!Number.isFinite(totalHours) || totalHours < 0) return '—';
  if (totalHours < 1 / 60) return '0min';

  const totalMinutes = totalHours * 60;
  const absMin = Math.abs(totalMinutes);

  const years = Math.floor(absMin / (365.25 * 24 * 60));
  let remaining = absMin - years * 365.25 * 24 * 60;
  const months = Math.floor(remaining / (30.4 * 24 * 60));
  remaining -= months * 30.4 * 24 * 60;
  const weeks = Math.floor(remaining / (7 * 24 * 60));
  remaining -= weeks * 7 * 24 * 60;
  const days = Math.floor(remaining / (24 * 60));
  remaining -= days * 24 * 60;
  const hours = Math.floor(remaining / 60);
  const minutes = Math.floor(remaining - hours * 60);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length === 0) parts.push(`${minutes}min`);

  if (parts.length === 0) return '0min';
  return parts.join(' ');
}
