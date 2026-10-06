import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowUpRight, FileText, Inbox, LockKeyhole, RefreshCw, Search } from 'lucide-react';
import useData from '../hooks/useData.js';
import { getOutbox } from '../services/operations.js';
import ActionDetail from '../components/ActionDetail.jsx';
import Dialog from '../components/Dialog.jsx';
import { Stagger, StaggerItem } from '../components/motion/Stagger.jsx';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, timeLabel } from '../components/ui.jsx';

export default function Outbox() {
  const query = useData(getOutbox);
  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [actionId, setActionId] = useState(null);
  const closeReceipt = useCallback(() => setReceipt(null), []);
  const closeAction = useCallback(() => setActionId(null), []);
  const filtered = query.data?.filter((item) => `${item.to} ${item.subject} ${item.attachmentName} ${item.tool}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <>
    <PageHeader eyebrow="SIMULATED EXECUTION RECEIPTS" title="Outbox" description="Proof of what the trust gate allowed. Every receipt links back to its evaluated action."><Button onClick={query.reload}><RefreshCw size={13} /> Refresh</Button></PageHeader>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><p className="flex items-center gap-2 font-mono text-[10px] text-muted"><Inbox size={13} /> NO REAL EMAILS OR EXTERNAL REQUESTS ARE SENT</p><div className="relative w-full sm:w-64"><Search size={14} className="absolute top-3.5 left-3 text-muted" /><input aria-label="Search receipts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipts…" className="field py-2.5! pl-9! text-xs!" /></div></div>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState error={query.error} retry={query.reload} /> : !filtered.length ? <div className="glass-card"><EmptyState title={search ? 'No matching receipts' : 'No receipts yet'} description={search ? 'Try another recipient, subject, or resource name.' : 'Trusted actions and approved reviews create simulated receipts here.'} action={!search} /></div> : <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <StaggerItem key={item._id} className="glass-card flex flex-col p-5"><div className="flex items-center justify-between"><span className="rounded-lg border border-line p-2.5"><FileText size={18} className="text-muted" /></span><span className={`badge ${item.redacted ? 'badge-privacy' : 'badge-trusted'}`}>{item.redacted ? <><LockKeyhole size={10} /> REDACTED</> : 'EXECUTED'}</span></div><h2 className="mt-5 text-base">{item.subject || item.attachmentName || item.tool}</h2><p className="mt-2 break-all font-mono text-[10px] text-muted">TO: {item.to || 'Internal read'}</p><p className="mt-3 text-[11px] text-muted">{item.attachmentName || 'No attachment'}</p><div className="mt-5 flex flex-1 items-end justify-between gap-3 border-t border-line pt-4"><span className="font-mono text-[9px] text-muted">{timeLabel(item.createdAt)}</span><button onClick={() => setReceipt(item)} className="flex items-center gap-2 text-[11px] hover:text-info">Inspect receipt <ArrowUpRight size={13} /></button></div></StaggerItem>)}</Stagger>}
    <AnimatePresence>{receipt && <Dialog key="receipt" title="Execution receipt" onClose={closeReceipt}><span className={`badge ${receipt.redacted ? 'badge-privacy' : 'badge-trusted'}`}>{receipt.redacted ? 'REDACTED & SENT' : 'SIMULATED EXECUTION'}</span><h3 className="mt-5 text-2xl">{receipt.subject || receipt.tool}</h3><dl className="my-6 space-y-3 text-xs text-muted"><div className="flex justify-between gap-4"><dt>Recipient</dt><dd className="break-all font-mono text-ink">{receipt.to || 'Internal'}</dd></div><div className="flex justify-between gap-4"><dt>Tool</dt><dd className="font-mono text-ink">{receipt.tool}</dd></div><div className="flex justify-between gap-4"><dt>Attachment</dt><dd className="text-right text-ink">{receipt.attachmentName || '—'}</dd></div><div className="flex justify-between gap-4"><dt>Created</dt><dd className="text-ink">{timeLabel(receipt.createdAt)}</dd></div></dl><p className="eyebrow mb-3">SAVED PAYLOAD SNAPSHOT</p><pre className="code-panel text-[#b4a1ff]">{receipt.bodyPreview || '(empty payload)'}</pre><Button className="mt-6" onClick={() => { setActionId(typeof receipt.action === 'object' ? receipt.action._id : receipt.action); setReceipt(null); }}>Inspect evaluated action <ArrowUpRight size={13} /></Button></Dialog>}{actionId && <ActionDetail key={actionId} id={actionId} onClose={closeAction} />}</AnimatePresence>
  </>;
}
