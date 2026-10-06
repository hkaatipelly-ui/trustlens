import { AlertCircle, ArrowRight, LoaderCircle, RefreshCw, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeader({ eyebrow = 'TRUSTLENS / OPERATIONS', title, description, children }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="page-subtitle">{description}</p>}</div>{children && <div className="flex flex-wrap items-center gap-2">{children}</div>}</header>;
}

export function StatusBadge({ level, status }) {
  const labels = { executed: 'EXECUTED', pending_approval: 'NEEDS REVIEW', blocked: 'BLOCKED', denied: 'DENIED', approved: 'APPROVED', redacted_sent: 'REDACTED & SENT' };
  const styles = { executed: 'trusted', pending_approval: 'suspicious', blocked: 'blocked', denied: 'unsafe', approved: 'trusted', redacted_sent: 'privacy' };
  const style = level ? level.toLowerCase() : styles[status] || 'neutral';
  return <span className={`badge badge-${style}`}>{level || labels[status] || status}</span>;
}

export function Button({ children, loading, className = '', ...props }) {
  return <button className={`btn ${className}`} {...props} disabled={loading || props.disabled}>{loading && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}{children}</button>;
}

export function LoadingState({ label = 'Loading operations data…' }) {
  return <div className="glass-card p-8" role="status"><div className="flex items-center gap-3 text-muted"><LoaderCircle size={16} className="animate-spin" /><span className="text-xs">{label}</span></div><div className="mt-6 grid grid-cols-3 gap-4">{[1, 2, 3].map((n) => <div key={n} className="loading-shimmer h-24" />)}</div></div>;
}

export function ErrorState({ error, retry }) {
  return <div role="alert" className="glass-card flex flex-wrap items-center gap-4 p-6"><AlertCircle size={20} className="text-unsafe" /><div className="min-w-0 flex-1"><h2 className="text-base">Couldn’t load this view</h2><p className="mt-1 break-words text-xs leading-6 text-muted">{error?.message || 'Please check your connection and try again.'}</p></div>{retry && <Button onClick={retry}><RefreshCw size={13} /> Retry</Button>}</div>;
}

export function EmptyState({ title, description, action }) {
  return <div className="flex flex-col items-center py-16 px-6 text-center"><div className="mb-4 rounded-2xl border border-line bg-white/3 p-4"><SearchX size={24} className="text-muted" /></div><h2 className="text-lg">{title}</h2><p className="mt-2 max-w-sm text-xs leading-6 text-muted">{description}</p>{action && <Link to="/console" className="btn mt-5">Open Agent Console <ArrowRight size={14} /></Link>}</div>;
}

export function AgentAvatar({ agent }) {
  return <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-mono" style={{ color: agent?.avatarColor || '#8B98A5', background: `${agent?.avatarColor || '#8B98A5'}10`, borderColor: `${agent?.avatarColor || '#8B98A5'}25` }}>{(agent?.name || 'AI').split(' ').map((word) => word[0]).slice(0, 2).join('')}</span>;
}

export function timeLabel(value) {
  return value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
