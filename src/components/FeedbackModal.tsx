import { useState } from 'react';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { Bug, Lightbulb, X, Send } from 'lucide-react';
import { sendDiscordFeedback, type FeedbackType } from '../utils/discordFeedback';
import { APP_VERSION } from './WhatsNewModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: Props) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [error, setError] = useState('');

  useModalDismiss(onClose, open);

  if (!open) return null;

  const submit = async () => {
    setSending(true);
    setStatus('idle');
    setError('');
    const res = await sendDiscordFeedback({
      type,
      message,
      contact,
      appVersion: APP_VERSION,
    });
    setSending(false);
    if (res.ok) {
      setStatus('ok');
      setMessage('');
      setContact('');
      setTimeout(() => {
        setStatus('idle');
        onClose();
      }, 1200);
    } else {
      setStatus('err');
      setError(res.error || 'Failed to send');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md d3-card p-5 relative"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 40px var(--gold-glow)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-serif-display text-lg font-bold" style={{ color: 'var(--gold-bright)' }}>
              Feedback
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Report a bug or request a feature (GitHub Issues preferred on web)
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className={`d3-btn flex-1 ${type === 'bug' ? 'd3-btn-primary' : ''}`}
            onClick={() => setType('bug')}
          >
            <Bug className="h-4 w-4" /> Bug
          </button>
          <button
            type="button"
            className={`d3-btn flex-1 ${type === 'feature' ? 'd3-btn-primary' : ''}`}
            onClick={() => setType('feature')}
          >
            <Lightbulb className="h-4 w-4" /> Feature
          </button>
        </div>

        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          Message
        </label>
        <textarea
          className="d3-input w-full px-3 py-2 text-sm min-h-[120px] resize-y mb-3"
          placeholder={type === 'bug' ? 'What went wrong? Steps to reproduce…' : 'What would you like to see?'}
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={1800}
        />

        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          Contact (optional)
        </label>
        <input
          className="d3-input w-full px-3 py-1.5 text-sm mb-4"
          placeholder="Discord name if you want a reply"
          value={contact}
          onChange={e => setContact(e.target.value)}
          maxLength={100}
        />

        {status === 'ok' && (
          <p className="text-xs mb-3" style={{ color: 'var(--green)' }}>Sent — thank you!</p>
        )}
        {status === 'err' && (
          <p className="text-xs mb-3" style={{ color: '#ff8888' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="d3-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="d3-btn d3-btn-primary"
            disabled={sending || message.trim().length < 3}
            onClick={() => void submit()}
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
