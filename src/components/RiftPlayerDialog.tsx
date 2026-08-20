import { useModalDismiss } from '../hooks/useModalDismiss';
import { useState } from 'react';
import { Shield, X, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { formatRiftTime, type RiftEntry, type Region } from '../utils/blizzardApi';
import { type TKey } from '../i18n';
import { fmtInt } from '../utils/data';
import { toPng } from 'html-to-image';

type RiftRow = RiftEntry & { region: Region };
type MainTab = 'solo' | 'team2' | 'team3' | 'team4';

const TAB_LABELS: Record<MainTab, string> = {
  solo: 'Solo',
  team2: '2-Player',
  team3: '3-Player',
  team4: '4-Player',
};

interface Props {
  row: RiftRow;
  tab: MainTab;
  tr: (k: TKey) => string;
  onClose: () => void;
  rankLabel: string;
}

export default function RiftPlayerDialog({ row, tab, tr, onClose, rankLabel }: Props) {
  useModalDismiss(onClose);
  const tabLabel = TAB_LABELS[tab];
  const [copying, setCopying] = useState(false);

  const copyAsImage = async () => {
    const el = document.getElementById('rift-dialog-content');
    if (!el) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(el, { 
        cacheBust: true, 
        backgroundColor: '#141210',
        filter: (node) => !node.classList?.contains('no-capture')
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } catch (err) {
      console.error('Failed to copy image', err);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        id="rift-dialog-content"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto d3-card p-6 relative" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 40px var(--gold-glow)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', border: '1px solid var(--gold-bright)' }}
            >
              <Shield className="h-6 w-6" style={{ color: '#0a0908' }} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-serif-display text-2xl font-bold">
                {row.members.map(m => m.battletag.split('#')[0].toUpperCase()).join(' / ')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tabLabel} • {tr('riftGreaterRift')} • <span className="uppercase">{row.region}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)] no-capture" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatBox label={rankLabel} value={<span style={{ color: 'var(--gold-bright)' }}>#{row.rank}</span>} />
          <StatBox label={tr('riftGrLevel')} value={<span className="font-mono-diablo font-bold" style={{ color: 'var(--gold-bright)' }}>{row.score}</span>} />
          <StatBox label={tr('riftClearTime')} value={<span className="font-mono-diablo font-bold">{formatRiftTime(row.time)}</span>} />
          <StatBox label={tr('riftRegion')} value={<span className="font-mono-diablo font-bold uppercase">{row.region}</span>} />
        </div>

        {/* Team members */}
        <h3 className="text-xs uppercase font-bold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {row.members.length === 1 ? tr('riftName') : tr('riftName') + 's'}
        </h3>
        <div className="d3-card p-4 mb-6" style={{ background: 'var(--bg-inset)' }}>
          <div className="space-y-3">
            {row.members.map((m, i) => (
              <div key={i} className="flex items-center justify-between pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded flex items-center justify-center font-mono-diablo font-bold text-xs shrink-0"
                    style={{ background: 'var(--bg-card-alt)', color: 'var(--gold-bright)', border: '1px solid var(--border-muted)' }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-serif-display font-bold text-sm">
                      {m.battletag.split('#')[0].toUpperCase()}
                    </div>
                    {m.hero.class && (
                      <div className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {m.hero.class.replace(/-/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{tr('paragon')}</div>
                    <div className="font-mono-diablo font-bold text-sm" style={{ color: 'var(--gold-bright)' }}>
                      {fmtInt(m.hero.paragonLevel || 0)}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); window.open(`https://${row.region}.diablo3.blizzard.com/en-us/profile/${encodeURIComponent(m.battletag.replace('#', '-'))}/`, '_blank'); }}
                    className="d3-btn text-xs flex items-center gap-1 no-capture"
                    style={{ padding: '0.3rem 0.6rem' }}
                    title="View Blizzard profile"
                  >
                    <ExternalLink className="h-3 w-3" /> Profile
                   </button>
                 </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t no-capture" style={{ borderColor: 'var(--border-subtle)' }}>
          <button onClick={copyAsImage} disabled={copying} className="d3-btn d3-btn-primary">
            <ImageIcon className={`h-4 w-4 ${copying ? 'animate-pulse' : ''}`} />
            {copying ? '...' : tr('copyAsImage')}
          </button>
          <button onClick={onClose} className="d3-btn d3-btn-primary">{tr('closeWindow')}</button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d3-card p-4 text-center" style={{ background: 'var(--bg-inset)' }}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl lg:text-2xl font-bold">{value}</div>
    </div>
  );
}
