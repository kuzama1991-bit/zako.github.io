// ============================================================
// Blizzard Rift Leaderboard API adapter
// Reads official D3 Game Data API, for example:
// https://eu.api.blizzard.com/data/d3/season/38/leaderboard/rift-barbarian?region=eu
// ============================================================

import { fetchLeaderboard, type Region as ApiRegion } from './blizzardApi';

export type RiftRegion = 'us' | 'eu' | 'kr';

export type SoloClass =
  | 'rift-barbarian'
  | 'rift-crusader'
  | 'rift-demon-hunter'
  | 'rift-monk'
  | 'rift-necromancer'
  | 'rift-witch-doctor'
  | 'rift-wizard';

export type TeamSize = 'rift-team-2' | 'rift-team-3' | 'rift-team-4';
export type RiftType = SoloClass | TeamSize;

export interface RiftRow {
  rank: number;
  names: string[];
  grLevel: number;
  clearTime: string;
  clearTimeMs: number;
  date: string;
  region: RiftRegion;
}

type CellMap = Record<string, any>;

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellValue(cell: any): any {
  if (!cell) return undefined;
  if (cell.string !== undefined) return cell.string;
  if (cell.number !== undefined) return cell.number;
  if (cell.timestamp !== undefined) return cell.timestamp;
  if (cell.date !== undefined) return cell.date;
  if (cell.value !== undefined) return cell.value;
  if (cell.duration !== undefined) return cell.duration;
  return undefined;
}

function cellsToMap(cells: any[] = []): CellMap {
  const map: CellMap = {};
  for (const cell of cells) {
    const id = String(cell?.id ?? cell?.name ?? '').trim();
    if (!id) continue;
    map[id] = cellValue(cell);
    map[normalizeId(id)] = cellValue(cell);
  }
  return map;
}

function pick(map: CellMap, keys: string[]): any {
  for (const key of keys) {
    if (map[key] !== undefined) return map[key];
    const normalized = normalizeId(key);
    if (map[normalized] !== undefined) return map[normalized];
  }
  return undefined;
}

function toNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseTimeMs(value: any): number {
  if (typeof value === 'number') {
    // D3 API usually returns milliseconds; if it is suspiciously small, treat as seconds.
    return value < 10000 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return 0;
  const m = value.match(/(\d+)m/);
  const s = value.match(/([\d.]+)s/);
  const minutes = m ? parseInt(m[1], 10) : 0;
  const seconds = s ? parseFloat(s[1]) : 0;
  return (minutes * 60 + seconds) * 1000;
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}m ${seconds}.${millis.toString().padStart(3, '0')}s`;
}

function formatDate(value: any): string {
  if (!value) return '';
  if (typeof value === 'number') {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }
  return String(value);
}

function findFirstGrLevel(rowMap: CellMap, cells: any[]): number {
  const direct = toNumber(pick(rowMap, ['RiftLevel', 'Level', 'Tier', 'RiftTier', 'GreaterRiftLevel', 'GRLevel']));
  if (direct > 0) return direct;
  for (const cell of cells) {
    const value = toNumber(cellValue(cell));
    const id = normalizeId(String(cell?.id ?? ''));
    if (value >= 1 && value <= 150 && (id.includes('rift') || id.includes('tier') || id.includes('level'))) {
      return value;
    }
  }
  return 0;
}

function parseLeaderboardResponse(data: any, region: RiftRegion): RiftRow[] {
  const rawRows: any[] = data?.row ?? data?.rows ?? data?.ranking ?? [];
  const parsed: RiftRow[] = [];

  rawRows.forEach((raw, index) => {
    // Current D3 API responses may use raw.player[] + raw.data[].
    const rowCells: any[] = raw?.data ?? raw?.values ?? [];
    const rowMap = cellsToMap(rowCells);
    const playerRows: any[] = raw?.player ?? raw?.players ?? raw?.members ?? [];

    let names: string[] = [];
    if (Array.isArray(playerRows) && playerRows.length > 0) {
      names = playerRows
        .map((player) => {
          const pMap = cellsToMap(player?.data ?? player?.values ?? []);
          return String(
            pick(pMap, ['HeroBattleTag', 'BattleTag', 'Battletag', 'PlayerName', 'HeroName', 'Name']) ??
            player?.battletag ??
            player?.name ??
            ''
          ).trim();
        })
        .filter(Boolean);
    }

    if (names.length === 0) {
      const name = String(pick(rowMap, ['HeroBattleTag', 'BattleTag', 'Battletag', 'PlayerName', 'HeroName', 'Name']) ?? '').trim();
      if (name) names = [name];
    }

    const rank = toNumber(pick(rowMap, ['Rank', 'Standing', 'Position'])) || index + 1;
    const grLevel = findFirstGrLevel(rowMap, rowCells);
    const timeValue = pick(rowMap, ['RiftTime', 'Time', 'ClearTime', 'Duration', 'CompletedTime']);
    const clearTimeMs = parseTimeMs(timeValue);
    const clearTime = formatTime(clearTimeMs);
    const dateValue = pick(rowMap, ['Timestamp', 'Date', 'CompletedDate', 'CompletedAt', 'CompletionDate']);
    const date = formatDate(dateValue);

    if (names.length > 0 && grLevel > 0) {
      parsed.push({ rank, names, grLevel, clearTime, clearTimeMs, date, region });
    }
  });

  return parsed;
}

async function fetchRegion(region: RiftRegion, season: number, type: RiftType): Promise<RiftRow[]> {
  const data = await fetchLeaderboard(region as ApiRegion, season, type, false);
  return parseLeaderboardResponse(data, region);
}

export async function fetchRiftLeaderboard(
  season: number,
  type: RiftType,
  regions: RiftRegion[] = ['eu', 'us', 'kr']
): Promise<RiftRow[]> {
  const all = (await Promise.all(
    regions.map(async (r) => {
      try {
        return await fetchRegion(r, season, type);
      } catch {
        return [];
      }
    })
  )).flat();

  all.sort((a, b) => {
    if (b.grLevel !== a.grLevel) return b.grLevel - a.grLevel;
    return a.clearTimeMs - b.clearTimeMs;
  });

  all.forEach((row, idx) => { row.rank = idx + 1; });
  return all;
}

export const SOLO_CLASSES: { id: SoloClass; short: string; label: string; emoji: string }[] = [
  { id: 'rift-barbarian', short: 'Barb', label: 'Barbarian', emoji: '⚔️' },
  { id: 'rift-crusader', short: 'Crus', label: 'Crusader', emoji: '🛡️' },
  { id: 'rift-demon-hunter', short: 'DH', label: 'Demon Hunter', emoji: '🏹' },
  { id: 'rift-monk', short: 'Monk', label: 'Monk', emoji: '👊' },
  { id: 'rift-necromancer', short: 'Necro', label: 'Necromancer', emoji: '💀' },
  { id: 'rift-witch-doctor', short: 'WD', label: 'Witch Doctor', emoji: '🧟' },
  { id: 'rift-wizard', short: 'Wiz', label: 'Wizard', emoji: '🔮' },
];

export const TEAM_TYPES: { id: TeamSize; label: string; emoji: string }[] = [
  { id: 'rift-team-2', label: '2-Player', emoji: '👥' },
  { id: 'rift-team-3', label: '3-Player', emoji: '👥' },
  { id: 'rift-team-4', label: '4-Player', emoji: '👥' },
];