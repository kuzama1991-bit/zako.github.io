import { gainSinceMonday, weeklyRaceBoard } from './snapshots';

const PREV_KEY = 'd3_session_prev';
const DIGEST_SHOWN_KEY = 'd3_digest_shown_at';

export interface SessionSnapshot {
  at: number;
  myName: string | null;
  myParagon: number | null;
  myRank: number | null;
  friends: Record<string, { paragon: number; rank: number }>;
  weeklyLeader: string | null;
  weeklyLeaderGain: number | null;
}

export interface DigestItem {
  kind: 'me' | 'friend' | 'weekly' | 'info';
  text: string;
}

export interface SessionDigest {
  items: DigestItem[];
  prevAt: number | null;
}

function loadPrev(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(PREV_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

export function saveSessionSnapshot(snap: SessionSnapshot): void {
  try {
    localStorage.setItem(PREV_KEY, JSON.stringify(snap));
  } catch { /* ignore */ }
}

export function buildDigest(args: {
  players: { name: string; paragon: number; rank: number }[];
  friends: string[];
  myName: string | null;
}): SessionDigest {
  const prev = loadPrev();
  const items: DigestItem[] = [];

  if (!prev) {
    items.push({ kind: 'info', text: 'First session snapshot saved — open again later to see what changed.' });
    return { items, prevAt: null };
  }

  const byName = new Map(args.players.map(p => [p.name.toLowerCase(), p]));

  if (args.myName) {
    const me = byName.get(args.myName.toLowerCase());
    if (me && prev.myParagon != null) {
      const dP = me.paragon - prev.myParagon;
      const dR = prev.myRank != null ? prev.myRank - me.rank : 0;
      const parts: string[] = [];
      if (dP !== 0) parts.push(`${dP > 0 ? '+' : ''}${dP.toLocaleString()} paragon`);
      if (dR !== 0) parts.push(`${dR > 0 ? '▲' : '▼'}${Math.abs(dR)} rank`);
      if (parts.length) {
        items.push({ kind: 'me', text: `You: ${parts.join(', ')}` });
      } else {
        items.push({ kind: 'me', text: 'You: no change since last visit' });
      }
    }
    const weekGain = gainSinceMonday(args.myName);
    if (weekGain != null && weekGain > 0) {
      items.push({ kind: 'me', text: `Your weekly gain (since Monday): +${weekGain.toLocaleString()}` });
    }
  }

  let friendMoves = 0;
  for (const fname of args.friends) {
    const cur = byName.get(fname.toLowerCase());
    const was = prev.friends[fname.toLowerCase()] || prev.friends[fname];
    if (!cur || !was) continue;
    const dP = cur.paragon - was.paragon;
    const dR = was.rank - cur.rank;
    if (dP !== 0 || dR !== 0) {
      friendMoves += 1;
      const bits: string[] = [];
      if (dP !== 0) bits.push(`${dP > 0 ? '+' : ''}${dP} para`);
      if (dR !== 0) bits.push(`${dR > 0 ? '▲' : '▼'}${Math.abs(dR)} rank`);
      items.push({ kind: 'friend', text: `${fname.toUpperCase()}: ${bits.join(', ')}` });
    }
  }
  if (args.friends.length && friendMoves === 0) {
    items.push({ kind: 'friend', text: 'Friends: no rank/paragon moves since last visit' });
  }

  const board = weeklyRaceBoard(1);
  if (board[0]) {
    const leader = board[0];
    if (prev.weeklyLeader && prev.weeklyLeader !== leader.name) {
      items.push({
        kind: 'weekly',
        text: `New weekly race leader: ${leader.name.toUpperCase()} (+${leader.gain.toLocaleString()})`,
      });
    } else {
      items.push({
        kind: 'weekly',
        text: `Weekly race #1: ${leader.name.toUpperCase()} (+${leader.gain.toLocaleString()})`,
      });
    }
  }

  if (items.length === 0) {
    items.push({ kind: 'info', text: 'Nothing notable changed since last visit.' });
  }

  return { items, prevAt: prev.at };
}

export function shouldShowDigest(): boolean {
  // Show at most once per app open — caller controls mounting once after first load
  return true;
}

export function markDigestShown(): void {
  try {
    localStorage.setItem(DIGEST_SHOWN_KEY, String(Date.now()));
  } catch { /* ignore */ }
}
