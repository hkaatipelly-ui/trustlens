import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import useData from '../hooks/useData.js';
import { getAudit } from '../services/operations.js';
import ActionDetail from '../components/ActionDetail.jsx';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, timeLabel } from '../components/ui.jsx';

function eventStyle(event) { return event.includes('blocked') || event.includes('deny') ? 'badge-blocked' : event.includes('queued') ? 'badge-suspicious' : event.includes('privacy') || event.includes('redact') ? 'badge-privacy' : event.includes('executed') || event.includes('approve') ? 'badge-trusted' : 'badge-neutral'; }

export default function Audit() {
  const query = useData((options) => getAudit({ limit: 200 }, options));
  const [search, setSearch] = useState('');
  const [event, setEvent] = useState('');
  const [detail, setDetail] = useState(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const events = [...new Set(query.data?.map((item) => item.event) || [])];
  const rows = query.data?.filter((item) => (!event || item.event === event) && `${item.event} ${item.actor} ${item.actionRef}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <>
    <PageHeader eyebrow="THE COMPLETE DECISION TRAIL" title="Audit Log" description="Proposals, privacy scans, evaluations, and reviews — recorded in one timeline."><Button onClick={query.reload}><RefreshCw size={13} /> Refresh</Button></PageHeader>
    <div className="mb-5 flex flex-wrap items-center gap-3"><div className="relative w-full sm:w-72"><Search size={14} className="absolute top-3.5 left-3 text-muted" /><input aria-label="Search audit log" placeholder="Search actor, event, action…" className="field py-2.5! pl-9! text-xs!" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select aria-label="Filter audit events" className="field w-auto! py-2.5! text-xs!" value={event} onChange={(e) => setEvent(e.target.value)}><option value="">All events</option>{events.map((value) => <option key={value}>{value}</option>)}</select><span className="eyebrow ml-auto text-[8px]!">LATEST 200 EVENTS · NEWEST FIRST</span></div>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState error={query.error} retry={query.reload} /> : <section className="glass-card overflow-hidden">{!rows.length ? <EmptyState title="No events found" description="Run an agent to record its decision trail, or clear the active filters." action={!query.data.length} /> : <div className="divide-y divide-line">{rows.map((item) => <div key={item._id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3"><span className={`badge ${eventStyle(item.event)}`}>{item.event}</span><span className="min-w-0 flex-1 break-all font-mono text-[10px] text-muted">{item.actor}</span><span className="font-mono text-[9px] text-muted">{timeLabel(item.createdAt)}</span>{item.actionRef && <button className="icon-button" aria-label={`Inspect action for ${item.event} ${item._id.slice(-6)}`} onClick={() => setDetail(typeof item.actionRef === 'object' ? item.actionRef._id : item.actionRef)}><ArrowUpRight size={14} /></button>}</div><details className="mt-2"><summary className="w-fit font-mono text-[9px] text-muted hover:text-ink">Event details</summary><pre className="code-panel mt-3 text-muted">{JSON.stringify(item.details, null, 2)}</pre></details></div>)}</div>}</section>}
    <AnimatePresence>{detail && <ActionDetail key={detail} id={detail} onClose={closeDetail} />}</AnimatePresence>
  </>;
}
