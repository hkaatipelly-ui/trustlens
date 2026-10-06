import { useState } from 'react';
import { Check, ChevronDown, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext.jsx';
import useData from '../hooks/useData.js';
import { decideApproval, getPending } from '../services/operations.js';
import TrustEvaluation from '../components/TrustEvaluation.jsx';
import { Stagger, StaggerItem } from '../components/motion/Stagger.jsx';
import { AgentAvatar, Button, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, timeLabel } from '../components/ui.jsx';

export default function Approvals() {
  const query = useData(getPending);
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const canReview = ['admin', 'approver'].includes(user.role);
  async function decide(id, decision) {
    if (busy) return;
    setBusy({ id, decision });
    try { await decideApproval(id, decision); toast.success({ approve: 'Action approved; simulated receipt created', redact: 'Redacted & sent to the simulated outbox', deny: 'Action denied' }[decision]); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(null); query.reload(); }
  }
  return <>
    <PageHeader eyebrow="HUMAN IN THE LOOP" title="Approval queue" description="The engine found uncertainty. Your judgment completes the decision."><span className="badge badge-suspicious">{query.data?.length || 0} PENDING</span><Button onClick={query.reload}><RefreshCw size={13} /> Refresh</Button></PageHeader>
    <div className="mb-6 flex items-start gap-3 rounded-control border border-line bg-surface/60 px-5 py-4"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-privacy" /><p className="text-[11px] leading-6 text-muted">Redact & Send uses the saved tokenized payload. Every review records who decided and when.{!canReview && <span className="block text-suspicious">Your viewer role can inspect actions. An admin or approver must make the decision.</span>}</p></div>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState error={query.error} retry={query.reload} /> : !query.data.length ? <div className="glass-card"><EmptyState title="All clear. Nothing waiting." description="Suspicious actions appear here for review. Run the Grey area scenario to try the approval workflow." action /></div> : <Stagger className="space-y-4">{query.data.map((action) => <StaggerItem key={action._id} className="glass-card overflow-hidden"><div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><AgentAvatar agent={action.agent} /><div><h2 className="text-base">{action.agent.name}</h2><p className="mt-1 font-mono text-[9px] text-muted">{action.tool} · {timeLabel(action.createdAt)}</p></div></div><div className="flex items-center gap-4"><span className="font-mono text-2xl text-suspicious">{action.evaluation.score}<span className="ml-1 text-[10px] text-muted">/100</span></span><StatusBadge status={action.status} /></div></div><p className="mt-5 break-words text-xs leading-7 text-muted">{action.task}</p><div className="mt-4 flex flex-wrap gap-2">{action.privacy.entityTypes.map((type) => <span key={type} className="badge badge-privacy">{type} ×{action.privacy.counts[type]}</span>)}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><button aria-expanded={expanded === action._id} onClick={() => setExpanded(expanded === action._id ? null : action._id)} className="flex items-center gap-2 text-[11px] text-muted hover:text-ink">Inspect checks & payload <ChevronDown size={13} className={expanded === action._id ? 'rotate-180' : ''} /></button><div className="flex flex-wrap gap-2"><Button className="btn-danger" disabled={!!busy || !canReview} loading={busy?.id === action._id && busy.decision === 'deny'} onClick={() => decide(action._id, 'deny')}><X size={13} /> Deny</Button><Button disabled={!!busy || !canReview} loading={busy?.id === action._id && busy.decision === 'approve'} onClick={() => decide(action._id, 'approve')}><Check size={13} /> Approve</Button><Button className="btn-privacy" disabled={!!busy || !canReview} loading={busy?.id === action._id && busy.decision === 'redact'} onClick={() => decide(action._id, 'redact')}><LockKeyhole size={13} /> Redact & Send</Button></div></div></div>{expanded === action._id && <div className="border-t border-line bg-canvas/30 p-5 sm:p-6"><TrustEvaluation evaluation={{ ...action.evaluation, privacy: action.privacy, tokenizedPayload: action.tokenizedPayload }} /></div>}</StaggerItem>)}</Stagger>}
  </>;
}
