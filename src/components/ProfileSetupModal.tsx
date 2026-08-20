import { useState } from 'react';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { User, X } from 'lucide-react';

interface Props {
  onSaved: () => void;
  onLater: () => void;
}

/**
 * First-launch My Profile setup — BattleTag + region, or Later.
 */
export default function ProfileSetupModal({ onSaved, onLater }: Props) {
  const [input, setInput] = useState('');
  const [region, setRegion] = useState<'eu' | 'us' | 'kr'>('eu');

  const cleaned = input.trim().replace(/\s+/g, '');
  const hasTag = cleaned.length >= 3 && cleaned.includes('#');


  const save = () => {
    if (!hasTag) return;
    try {
      localStorage.setItem('d3_my_btag', cleaned);
      localStorage.setItem('d3_my_region', region);
      localStorage.removeItem('d3_profile_setup_later');
    } catch { /* ignore */ }
    onSaved();
  };

  const later = () => {
    try {
      localStorage.setItem('d3_profile_setup_later', '1');
    } catch { /* ignore */ }
    onLater();
  };

  useModalDismiss(later);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={later}
    >
      <div
        className="w-full max-w-md d3-card p-6 relative"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-dark)',
          boxShadow: '0 0 50px var(--gold-glow)',
        }}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
              border: '1px solid var(--gold-bright)',
            }}
          >
            <User className="h-5 w-5" style={{ color: '#0a0908' }} />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif-display text-xl font-bold" style={{ color: 'var(--gold-bright)' }}>
              My Profile
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Enter your BattleTag to track your rank, friends comparison, and “Where am I?”
            </p>
          </div>
        </div>

        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
          BattleTag
        </label>
        <input
          autoFocus
          className="d3-input w-full px-3 py-2.5 text-sm mb-3"
          placeholder="Name#1234"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && hasTag) save();
          }}
        />

        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Region
        </label>
        <div className="flex gap-2 mb-6">
          {(['eu', 'us', 'kr'] as const).map(r => (
            <button
              key={r}
              type="button"
              className={`d3-btn flex-1 uppercase ${region === r ? 'd3-btn-primary' : ''}`}
              onClick={() => setRegion(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" className="d3-btn" onClick={later}>
            Later
          </button>
          {hasTag && (
            <button type="button" className="d3-btn d3-btn-primary" onClick={save}>
              Save
            </button>
          )}
        </div>

        <p className="text-[10px] mt-4" style={{ color: 'var(--text-muted)' }}>
          You can change this anytime under My Profile.
        </p>
      </div>
    </div>
  );
}
