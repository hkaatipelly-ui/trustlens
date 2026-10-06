import useData from '../hooks/useData.js';
import { getAction } from '../services/actions.js';
import Dialog from './Dialog.jsx';
import TrustEvaluation from './TrustEvaluation.jsx';
import { ErrorState, LoadingState, StatusBadge, timeLabel } from './ui.jsx';

export default function ActionDetail({ id, onClose }) {
  const { data, loading, error, reload } = useData((options) => getAction(id, options), [id], { interval: 0 });
  return <Dialog title="Action inspection" onClose={onClose}>{loading ? <LoadingState /> : error ? <ErrorState error={error} retry={reload} /> : <><div className="mb-6"><div className="mb-3 flex flex-wrap items-center gap-3"><StatusBadge status={data.status} /><span className="font-mono text-[9px] text-muted">{timeLabel(data.createdAt)}</span></div><h3 className="text-xl">{data.agent?.name}</h3><p className="mt-3 break-words text-xs leading-7 text-muted">{data.task}</p><div className="mt-3 font-mono text-[10px] text-muted">{data.tool} · {data.params.resourceKey || 'No resource'}</div>{data.decidedAt && <p className="mt-3 text-xs text-muted">Reviewed by {data.decidedBy?.name || 'an approver'} · {timeLabel(data.decidedAt)}</p>}</div><TrustEvaluation evaluation={{ ...data.evaluation, privacy: data.privacy, tokenizedPayload: data.tokenizedPayload }} /></>}</Dialog>;
}
