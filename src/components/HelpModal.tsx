import { useModalDismiss } from '../hooks/useModalDismiss';
import { useState } from 'react';
import {
  X, Star, RefreshCw, Globe, Trophy, Clock,
  Search, LayoutGrid, List, Table as TableIcon, Calculator,
  Zap, Image as ImageIcon, History, Users, Swords, Shield,
  ChevronRight, Settings, Sparkles
} from 'lucide-react';
import { APP_VERSION, CHANGELOG } from './WhatsNewModal';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  items: { icon?: React.ReactNode; label: string; desc: string }[];
}

const SECTIONS: Section[] = [
  {
    id: 'settings',
    icon: <Settings className="h-5 w-5" />,
    title: 'Settings',
    items: [],
  },
  {
    id: 'changelog',
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Changelog',
    items: [],
  },
  {
    id: 'header',
    icon: <Clock className="h-5 w-5" />,
    title: 'Header Controls',
    items: [
      { icon: <RefreshCw className="h-4 w-4" />, label: 'Auto-Sync', desc: 'How often the Paragon board auto-refreshes (5 / 10 / 15 / 30 min). Change this under Settings.' },
      { icon: <Clock className="h-4 w-4" />, label: 'Next Update', desc: 'Countdown until the next automatic Paragon refresh.' },
      { icon: <Clock className="h-4 w-4" />, label: 'Local Time', desc: 'Your local clock. 12h / 24h format is set under Settings.' },
      { icon: <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />, label: 'Live Ready', desc: 'Green badge when the app is ready to fetch data.' },
      { label: 'Language', desc: 'Globe button — switch UI language. Preference is saved on this PC.' },
      { label: 'Settings', desc: 'Gear button — Auto-Sync, clock format, Paragon goal, background snapshot interval, and theme.' },
      { label: 'My Profile', desc: 'Set your BattleTag, view GR ranks, and jump to boards where you appear.' },
    ],
  },
  {
    id: 'stats',
    icon: <Users className="h-5 w-5" />,
    title: 'Stat Cards',
    items: [
      { icon: <Users className="h-4 w-4" />, label: 'Total Tracked', desc: 'Total number of heroes currently visible based on your active filters (region, favorites, search).' },
      { icon: <Trophy className="h-4 w-4" />, label: 'Top Paragon', desc: 'The highest Paragon level among all tracked players in the current view.' },
      { icon: <span className="text-xs">~</span>, label: 'Average Paragon', desc: 'The average Paragon level across all currently visible tracked players.' },
      { icon: <span className="text-xs">🎯</span>, label: 'Goal Progress', desc: 'Shows the Paragon cap of 20,000. Gives context for how far players are from the theoretical maximum.' },
      { icon: <Zap className="h-4 w-4" />, label: 'Challenge Rift', desc: 'Current Challenge Rift number and class, plus fixed reset times for EU, US, and KR (no live countdown).' },
    ],
  },
  {
    id: 'leaderboards',
    icon: <Trophy className="h-5 w-5" />,
    title: 'Leaderboard Tabs',
    items: [
      { icon: <Trophy className="h-4 w-4" />, label: 'Paragon Tab', desc: 'Community Paragon board from Google Sheets. Region filter, smart search, sorting, favorites, table/card layout.' },
      { icon: <Swords className="h-4 w-4" />, label: 'Solo Tab', desc: 'Official Blizzard solo GR ladder. Pick class, Softcore/Hardcore, and optional Set (set1–set5 / noset). Table or card layout.' },
      { icon: <Users className="h-4 w-4" />, label: '2/3/4-Player Tabs', desc: 'Official Blizzard team GR ladders. SC/HC and season selector. Same table/card layout toggle as Paragon.' },
      { icon: <History className="h-4 w-4" />, label: 'Season Selector', desc: 'On Solo/Team tabs, switch seasons for historical ladder data.' },
    ],
  },
  {
    id: 'hub',
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Hub tools',
    items: [
      { label: 'Compare', desc: 'Compare up to 3 players. Me / Friend picker, weekly gain, XP rate, history graph, copy as image.' },
      { label: 'Paragon Race', desc: 'Race toward a paragon goal with estimated time.' },
      { label: 'Weekly Race', desc: 'Since Monday (local snapshots) or Sheet weekly column. Tray snapshots keep Monday tracking accurate.' },
      { label: 'My Profile', desc: 'BattleTag, GR ranks, and Open board buttons that jump straight to the Solo/team ladder where you appear.' },
    ],
  },
  {
    id: 'region',
    icon: <Globe className="h-5 w-5" />,
    title: 'Region Filter',
    items: [
      { label: '🌍 World', desc: 'Shows all players combined from EU, US and KR regions in a single global ranking.' },
      { label: '🇪🇺 EU', desc: 'Filters to European server players only. Re-ranks them from #1 within EU.' },
      { label: '🇺🇸 US', desc: 'Filters to Americas/US server players only. Re-ranks them from #1 within US.' },
      { label: '🇰🇷 KR', desc: 'Filters to Korea/Asia server players only. Re-ranks them from #1 within KR.' },
    ],
  },
  {
    id: 'controls',
    icon: <Shield className="h-5 w-5" />,
    title: 'Controls & Sorting',
    items: [
      { icon: <Search className="h-4 w-4" />, label: 'Search Box', desc: 'Prefix name search (sa ≠ Isa). Also #12, #1-50, >9000, region:eu. Clear with ✕.' },
      { icon: <Star className="h-4 w-4" />, label: 'Favorites', desc: 'Star players and filter to favorites only. Saved locally.' },
      { icon: <Users className="h-4 w-4" />, label: 'Friends strip', desc: 'Pin up to 10 friends under My Rank (separate from favorites).' },
      { icon: <TableIcon className="h-4 w-4" />, label: 'Table / Card layout', desc: 'Toggle works on Paragon AND Solo / 2–4 player boards. Choice is remembered.' },
      { icon: <RefreshCw className="h-4 w-4" />, label: 'Update Now', desc: 'Manual Paragon refresh without waiting for auto-sync.' },
      { label: 'Rank movement', desc: 'Green ↑ / red ↓ next to rank shows how many places a player moved since the last check (saved between sessions).' },
    ],
  },
  {
    id: 'players',
    icon: <Users className="h-5 w-5" />,
    title: 'Player Details',
    items: [
      { label: 'Click Player Name', desc: 'In the Paragon tab, click any player name to open their detailed stats window, including XP progression, rates, time to 20k estimate and raw data.' },
      { icon: <ImageIcon className="h-4 w-4" />, label: 'Copy as Image', desc: 'Inside the player detail popup, click "Copy as Image" to copy a screenshot of that player\'s stats card to your clipboard. Paste it anywhere (Discord, Twitter, etc.).' },
      { label: 'World Rank vs Region Rank', desc: 'Each player shows their World Rank (global position) and their Region Rank (position within their own server).' },
    ],
  },
  {
    id: 'archive',
    icon: <History className="h-5 w-5" />,
    title: 'Season Archive (Paragon)',
    items: [
      { label: 'Automatic Saving', desc: 'The app automatically saves the Paragon leaderboard for each season every time it fetches data. You never need to do anything manually.' },
      { label: 'Season Dropdown', desc: 'On the Paragon tab, a "Paragon Season" dropdown appears once you have data from more than one season. Select any past season to view that archived leaderboard.' },
      { label: 'Viewing Archive', desc: 'When viewing a past season, a gold banner appears at the top showing which season you are looking at and when it was last saved. Click "← Back to Live" to return to the current live data.' },
      { label: 'Persistent Storage', desc: 'Archived season data is stored in your browser\'s localStorage. It persists between app restarts. Data is not lost unless you clear your browser storage.' },
    ],
  },
  {
    id: 'tray',
    icon: <History className="h-5 w-5" />,
    title: 'Tray & snapshots',
    items: [
      { label: 'Close to tray', desc: 'Closing the window minimizes to the system tray. The app keeps running so background snapshots can continue. Use Quit in the tray menu to fully exit.' },
      { label: 'Background snapshots', desc: 'While in the tray, the app refreshes the leaderboard on an interval you choose in Settings (1–24 hours). This builds Weekly Race history without opening the window.' },
      { label: 'Themes', desc: 'Pick Classic Gold, Blood, Frost, Nephalem, or Ember under Settings. Saved on this PC.' },
    ],
  },
  {
    id: 'calculator',
    icon: <Calculator className="h-5 w-5" />,
    title: 'Paragon Calculator',
    items: [
      { label: 'Current Paragon', desc: 'Enter your current Paragon level as the starting point.' },
      { label: 'Goal Paragon', desc: 'Enter the Paragon level you want to reach.' },
      { label: 'XP Speed', desc: 'Enter your farming speed in Trillion XP per hour. Use the quick-select presets (5T, 10T, 15T, 20T, 30T) for common speeds.' },
      { label: 'Hours per Day', desc: 'Enter how many hours per day you play. Use the quick presets or type your own value.' },
      { label: 'Result', desc: 'The calculator shows you exactly how many days it will take to reach your goal based on your inputs. Compare with the XP Rate shown for top players in the leaderboard.' },
    ],
  },

  {
    id: 'language',
    icon: <Globe className="h-5 w-5" />,
    title: 'Language',
    items: [
      { label: 'Language Selector', desc: 'Click the 🌐 Globe button in the controls bar to open the language dropdown. The app supports 16 languages including English, Swedish, German, French, Spanish, Dutch, Greek, Russian, Polish, Korean, Chinese and more.' },
      { label: 'Persistent Setting', desc: 'Your language choice is saved automatically and will be remembered the next time you open the app.' },
    ],
  },
  {
    id: 'challengerift',
    icon: <Zap className="h-5 w-5" />,
    title: 'Challenge Rift Card',
    items: [
      { label: 'Current Rift Number', desc: 'Shows this week\'s Challenge Rift number (e.g. #468).' },
      { label: 'Class Detection', desc: 'Detects this week\'s Challenge Rift class from the Blizzard ladder.' },
      { label: 'Reset Times', desc: 'Fixed reset times for EU, US, and KR. No live countdown — only the schedule for each region.' },
      { label: 'Your Timezone', desc: 'Shows your local timezone so you can relate to each region\'s reset time.' },
    ],
  },
];

export interface SettingsProps {
  syncMin: number;
  setSyncMin: (v: number) => void;
  use24h: boolean;
  setUse24h: (v: boolean) => void;
  paragonGoal: number;
  setParagonGoal: (v: number) => void;
  snapshotHours: number;
  setSnapshotHours: (v: number) => void;
  theme: string;
  setTheme: (v: any) => void;
}

export default function HelpModal({ syncMin, setSyncMin, use24h, setUse24h, paragonGoal, setParagonGoal, snapshotHours, setSnapshotHours, theme, setTheme }: SettingsProps) {
  const [open, setOpen] = useState(false);
  useModalDismiss(() => setOpen(false), open);
  const [activeSection, setActiveSection] = useState('settings');

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setOpen(true)}
        className="d3-btn"
        style={{ padding: '0.35rem 0.6rem' }}
        title="Settings"
      >
        <Settings className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] flex flex-col d3-card overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 60px rgba(245,197,66,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', boxShadow: '0 0 15px rgba(245,197,66,0.3)' }}>
                  <Settings className="h-5 w-5" style={{ color: '#0a0908' }} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-serif-display text-xl font-bold" style={{ color: 'var(--gold-bright)' }}>Settings & Guide</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure the app and explore all features</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-52 shrink-0 border-r overflow-y-auto py-2" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-inset)' }}>
                {SECTIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-sm transition-colors"
                    style={{
                      background: activeSection === s.id ? 'rgba(245,197,66,0.12)' : 'transparent',
                      color: activeSection === s.id ? 'var(--gold-bright)' : 'var(--text-secondary)',
                      borderLeft: activeSection === s.id ? '2px solid var(--gold-bright)' : '2px solid transparent',
                    }}
                  >
                    <span className="shrink-0" style={{ color: activeSection === s.id ? 'var(--gold-bright)' : 'var(--text-muted)' }}>{s.icon}</span>
                    <span className="font-medium truncate">{s.title}</span>
                    {activeSection === s.id && <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {activeSection === 'changelog' ? (
                  <div>
                    <div className="flex items-center gap-2.5 mb-6">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(245,197,66,0.1)', color: 'var(--gold-bright)', border: '1px solid rgba(245,197,66,0.3)' }}>
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-serif-display text-lg font-bold" style={{ color: 'var(--gold-bright)' }}>Changelog</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current version v{APP_VERSION}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {CHANGELOG.map(entry => (
                        <div key={entry.version} className="p-4 rounded-lg" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono-diablo font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>v{entry.version}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.date}</span>
                          </div>
                          <ul className="space-y-1.5">
                            {entry.items.map((item, i) => (
                              <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--gold-dark)' }}>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeSection === 'settings' ? (
                  <div>
                    <div className="flex items-center gap-2.5 mb-6">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(245,197,66,0.1)', color: 'var(--gold-bright)', border: '1px solid rgba(245,197,66,0.3)' }}>
                        <Settings className="h-5 w-5" />
                      </div>
                      <h3 className="font-serif-display text-lg font-bold" style={{ color: 'var(--gold-bright)' }}>Settings</h3>
                    </div>
                    <div className="space-y-4">
                      {/* Auto-Sync */}
                      <div className="p-4 rounded-lg flex items-center justify-between gap-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div className="font-semibold text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <RefreshCw className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} /> Auto-Sync Interval
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>How often the Paragon leaderboard automatically refreshes from the data source.</div>
                        </div>
                        <select
                          className="px-3 py-2 rounded text-sm font-mono-diablo font-bold cursor-pointer outline-none shrink-0"
                          style={{ background: 'var(--bg-card)', color: 'var(--gold-bright)', border: '1px solid var(--border-muted)', colorScheme: 'dark' }}
                          value={syncMin}
                          onChange={e => setSyncMin(+e.target.value)}
                        >
                          <option value={5}>5 min</option>
                          <option value={10}>10 min</option>
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                        </select>
                      </div>
                      {/* Clock Format */}
                      <div className="p-4 rounded-lg flex items-center justify-between gap-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div className="font-semibold text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Clock className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} /> Clock Format
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Choose between 24-hour clock or 12-hour (AM/PM) format for the local time display in the header.</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 p-1 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)' }}>
                          <button
                            onClick={() => setUse24h(true)}
                            className="px-3 py-1.5 rounded text-sm font-mono-diablo font-bold transition-colors"
                            style={{ background: use24h ? 'var(--gold-dark)' : 'transparent', color: use24h ? '#0a0908' : 'var(--text-secondary)' }}
                          >
                            24h
                          </button>
                          <button
                            onClick={() => setUse24h(false)}
                            className="px-3 py-1.5 rounded text-sm font-mono-diablo font-bold transition-colors"
                            style={{ background: !use24h ? 'var(--gold-dark)' : 'transparent', color: !use24h ? '#0a0908' : 'var(--text-secondary)' }}
                          >
                            12h AM/PM
                          </button>
                        </div>
                      </div>
                    </div>
                      {/* Paragon Goal */}
                      <div className="p-4 rounded-lg flex items-center justify-between gap-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div className="font-semibold text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--gold-bright)' }}>🎯</span> Paragon Goal
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sets your Paragon target. Updates the Goal Progress card and all progress calculations.</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 p-1 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)' }}>
                          {[10000, 15000, 20000].map(g => (
                            <button
                              key={g}
                              onClick={() => setParagonGoal(g)}
                              className="px-3 py-1.5 rounded text-sm font-mono-diablo font-bold transition-colors"
                              style={{ background: paragonGoal === g ? 'var(--gold-dark)' : 'transparent', color: paragonGoal === g ? '#0a0908' : 'var(--text-secondary)' }}
                            >
                              {g / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Background snapshots */}
                      <div className="p-4 rounded-lg flex items-center justify-between gap-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div className="font-semibold text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <History className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} /> Background snapshots
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            How often the tray process refreshes the leaderboard while the window is closed (needs app left running in tray).
                          </div>
                        </div>
                        <select
                          className="px-3 py-2 rounded text-sm font-mono-diablo font-bold cursor-pointer outline-none shrink-0"
                          style={{ background: 'var(--bg-card)', color: 'var(--gold-bright)', border: '1px solid var(--border-muted)', colorScheme: 'dark' }}
                          value={snapshotHours}
                          onChange={e => setSnapshotHours(+e.target.value)}
                        >
                          <option value={1}>Every 1h</option>
                          <option value={2}>Every 2h</option>
                          <option value={3}>Every 3h</option>
                          <option value={6}>Every 6h</option>
                          <option value={12}>Every 12h</option>
                          <option value={24}>Every 24h</option>
                        </select>
                      </div>
                      {/* Theme */}
                      <div className="p-4 rounded-lg" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <Sparkles className="h-4 w-4" style={{ color: 'var(--gold-bright)' }} /> Theme
                        </div>
                        <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Accent colors for the whole app. Saved on this PC.</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'classic', label: 'Classic Gold' },
                            { id: 'blood', label: 'Blood' },
                            { id: 'frost', label: 'Frost' },
                            { id: 'nephalem', label: 'Nephalem' },
                            { id: 'ember', label: 'Ember' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setTheme(opt.id)}
                              className="px-3 py-1.5 rounded text-xs font-bold border transition-colors"
                              style={{
                                background: theme === opt.id ? 'var(--gold-dark)' : 'var(--bg-card)',
                                color: theme === opt.id ? '#0a0908' : 'var(--text-secondary)',
                                borderColor: theme === opt.id ? 'var(--gold-bright)' : 'var(--border-muted)',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                  </div>
                ) : (
                  SECTIONS.filter(s => s.id === activeSection && s.id !== 'settings' && s.id !== 'changelog').map(s => (
                    <div key={s.id}>
                      <div className="flex items-center gap-2.5 mb-6">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(245,197,66,0.1)', color: 'var(--gold-bright)', border: '1px solid rgba(245,197,66,0.3)' }}>
                          {s.icon}
                        </div>
                        <h3 className="font-serif-display text-lg font-bold" style={{ color: 'var(--gold-bright)' }}>{s.title}</h3>
                      </div>
                      <div className="space-y-3">
                        {s.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex gap-4 p-4 rounded-lg"
                            style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}
                          >
                            {item.icon && (
                              <div className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center mt-0.5"
                                style={{ background: 'var(--bg-card)', color: 'var(--gold-bright)', border: '1px solid var(--border-muted)' }}>
                                {item.icon}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)', background: 'var(--bg-inset)' }}>
              <span>Diablo 3 Leaderboard v{APP_VERSION}</span>
              <button onClick={() => setOpen(false)} className="d3-btn d3-btn-primary text-xs" style={{ padding: '0.3rem 0.75rem' }}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
