/** Official Diablo 3 career profile URL (BattleTag with # → -). */
export function blizzardProfileUrl(battletag: string, region: string): string {
  const r = (region || 'eu').toLowerCase();
  const host = r === 'us' || r === 'kr' ? r : 'eu';
  const slug = battletag.trim().replace('#', '-');
  return `https://${host}.diablo3.blizzard.com/en-us/profile/${encodeURIComponent(slug)}/`;
}

/** Open Blizzard profile in a new window/tab. */
export function openBlizzardProfile(battletag: string, region: string) {
  if (!battletag?.trim()) return;
  window.open(blizzardProfileUrl(battletag, region), '_blank', 'noopener,noreferrer');
}
