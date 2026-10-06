import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Braces, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { evaluate } from '../services/actions.js';
import { USING_MOCKS } from '../services/request.js';
import { PLAYGROUND_EXAMPLES } from '../lib/examples.js';
import TrustEvaluation from '../components/TrustEvaluation.jsx';
import { Button, PageHeader } from '../components/ui.jsx';

export default function Playground() {
  const [example, setExample] = useState(PLAYGROUND_EXAMPLES[0].key);
  const [proposal, setProposal] = useState(JSON.stringify(PLAYGROUND_EXAMPLES[0].proposal, null, 2));
  const [evaluation, setEvaluation] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const reduce = useReducedMotion();
  function select(key) {
    const selected = PLAYGROUND_EXAMPLES.find((item) => item.key === key);
    setExample(key); setProposal(JSON.stringify(selected.proposal, null, 2)); setEvaluation(null); setError('');
  }
  async function submit(event) {
    event.preventDefault(); setPending(true); setError(''); setEvaluation(null);
    try {
      const body = JSON.parse(proposal);
      if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.agentKey !== 'string' || typeof body.tool !== 'string' || !body.params || typeof body.params !== 'object' || Array.isArray(body.params)) throw new Error('Include agentKey, tool, and a params object in the proposal.');
      setEvaluation(await evaluate(body));
      toast.success('Read-only evaluation complete');
    } catch (cause) {
      const message = cause instanceof SyntaxError ? 'Enter a valid JSON object for the proposed action.' : cause.message;
      setError(message); toast.error(message);
    } finally { setPending(false); }
  }
  return <>
    <PageHeader eyebrow="A SANDBOX FOR THE TRUST ENGINE" title="Playground" description="Inspect a proposed action without executing it or adding it to action history."><span className="badge badge-neutral">READ-ONLY EVALUATION</span></PageHeader>
    {USING_MOCKS && <p className="mb-5 rounded-control border border-line bg-surface/60 p-4 text-[11px] leading-6 text-muted">Local mock mode uses business-hour fixtures for the four samples. Connect the live API to evaluate custom proposals.</p>}
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <form onSubmit={submit} aria-busy={pending} className="glass-card min-w-0 overflow-hidden xl:sticky xl:top-24"><div className="flex items-center justify-between border-b border-line p-5"><h2 className="flex items-center gap-2 text-sm"><Braces size={16} className="text-muted" /> Proposed action</h2><Button type="button" disabled={pending} onClick={() => select(example)} className="min-h-8! p-2!"><RotateCcw size={12} /> Reset</Button></div><div className="p-5"><label htmlFor="proposal-example" className="field-label">Load a sample</label><select id="proposal-example" className="field text-xs!" value={example} onChange={(event) => select(event.target.value)} disabled={pending}>{PLAYGROUND_EXAMPLES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><label htmlFor="proposal" className="eyebrow mt-6 mb-3 block">REQUEST BODY / JSON</label><textarea id="proposal" className="field min-h-[340px] resize-y font-mono text-[11px]! leading-7" spellCheck={false} aria-invalid={!!error} value={proposal} onChange={(event) => { setProposal(event.target.value); setError(''); }} disabled={pending} />{error && <p role="alert" className="mt-4 text-xs leading-7 text-unsafe">{error}</p>}<Button type="submit" loading={pending} className="btn-primary mt-5 w-full">{pending ? 'Evaluating…' : 'Evaluate action'}{!pending && <Play size={13} />}</Button><p className="mt-4 font-mono text-[9px] leading-6 text-muted">POST /api/trust/evaluate<br />AUTHENTICATED · NO TOOL EXECUTION</p></div></form>
      <div aria-live="polite" className="min-w-0"><AnimatePresence mode="wait">{evaluation ? <motion.div key="result" initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduce ? 1 : 0 }} transition={{ duration: reduce ? 0 : .25 }}><TrustEvaluation evaluation={evaluation} /></motion.div> : <motion.div key="empty" className="glass-card flex min-h-[380px] flex-col items-center justify-center px-8 text-center"><span className="rounded-2xl border border-line p-4"><FlaskConical size={28} className="text-muted" /></span><h2 className="mt-6 text-xl">Make the decision visible.</h2><p className="mt-3 max-w-xs text-xs leading-7 text-muted">{pending ? 'The server is evaluating permissions, data sensitivity, destinations, policies, behavior, and intent.' : 'Load a sample or write your own proposal. The engine returns a score and the checks behind it.'}</p><p className="eyebrow mt-8 text-[8px]!">HARD BLOCKS ALWAYS OVERRIDE SCORES</p></motion.div>}</AnimatePresence></div>
    </div>
  </>;
}
