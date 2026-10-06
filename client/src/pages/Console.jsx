import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronRight, FileWarning, Play, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import useData from '../hooks/useData.js';
import { getAgents, getScenarios } from '../services/catalog.js';
import { runAgent } from '../services/actions.js';
import { USING_MOCKS } from '../services/request.js';
import TrustEvaluation from '../components/TrustEvaluation.jsx';
import { Stagger, StaggerItem } from '../components/motion/Stagger.jsx';
import { AgentAvatar, Button, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui.jsx';

const scenarioMeta = {
  normal: { icon: ShieldCheck, color: 'text-trusted', level: 'TRUSTED', label: '01 / BUSINESS AS USUAL' },
  grey: { icon: FileWarning, color: 'text-suspicious', level: 'SUSPICIOUS', label: '02 / HUMAN IN THE LOOP' },
  attack: { icon: ShieldAlert, color: 'text-blocked', level: 'BLOCKED', label: '03 / PROMPT INJECTION' },
  permission: { icon: ShieldAlert, color: 'text-blocked', level: 'BLOCKED', label: '04 / PERMISSION BREACH' },
};

export default function Console() {
  const query = useData(async (options) => { const [agents, scenarios] = await Promise.all([getAgents(options), getScenarios(options)]); return { agents, scenarios }; });
  const [mode, setMode] = useState('scenario');
  const [selected, setSelected] = useState('normal');
  const [agentKey, setAgentKey] = useState('sales-assistant');
  const [task, setTask] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const resultRef = useRef(null);
  const reduce = useReducedMotion();

  async function run(event) {
    event.preventDefault();
    if (pending) return;
    if (mode === 'task' && (!task.trim() || task.length > 10000)) { setError('Enter a task between 1 and 10,000 characters.'); return; }
    setPending(true); setResult(null); setError('');
    try {
      const next = await runAgent(mode === 'scenario' ? { scenarioKey: selected } : { agentKey, task: task.trim() });
      setResult(next);
      toast.success(next.status === 'executed' ? 'Trusted action executed in the simulated outbox' : next.status === 'pending_approval' ? 'Action queued for human review' : 'Trust gate blocked the action');
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' }));
    } catch (cause) { setError(cause.message); toast.error(cause.message); }
    finally { setPending(false); }
  }

  return <>
    <PageHeader eyebrow="PROPOSE → SHIELD → EVALUATE → DECIDE" title="Agent Console" description="Watch an action pass through the trust gate. Nothing executes before the checks are complete."><span className="badge badge-neutral">SIMULATED EXECUTION</span></PageHeader>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState error={query.error} retry={query.reload} /> : <form onSubmit={run} aria-busy={pending}>
      <div className="mb-6 flex w-fit rounded-control border border-line bg-surface p-1" role="group" aria-label="Run mode">{[{ key: 'scenario', label: 'Scripted scenarios', icon: Play }, { key: 'task', label: 'Free-text task', icon: Sparkles }].map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-pressed={mode === key} disabled={pending} onClick={() => { setMode(key); setError(''); }} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs ${mode === key ? 'bg-elevated text-ink' : 'text-muted'}`}><Icon size={13} />{label}</button>)}</div>
      {mode === 'scenario' ? <><Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{query.data.scenarios.map((scenario) => { const meta = scenarioMeta[scenario.key] || scenarioMeta.normal; const Icon = meta.icon; return <StaggerItem key={scenario.key}><button type="button" aria-pressed={selected === scenario.key} disabled={pending} onClick={() => { setSelected(scenario.key); setError(''); }} className={`glass-card relative h-full w-full p-5 text-left ${selected === scenario.key ? 'border-white/30! bg-elevated!' : ''}`}><div className="mb-6 flex items-center justify-between"><Icon size={23} className={meta.color} /><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected === scenario.key ? 'border-ink bg-ink text-canvas' : 'border-white/20'}`}>{selected === scenario.key && <Check size={11} />}</span></div><p className="eyebrow text-[8px]!">{meta.label}</p><h2 className="mt-2 text-base font-medium">{scenario.title}</h2><p className="mt-2 min-h-10 text-[11px] leading-6 text-muted">{scenario.subtitle}</p><div className="mt-6"><StatusBadge level={meta.level} /></div></button></StaggerItem>; })}</Stagger><div className="glass-card mt-5 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6"><div className="min-w-0 flex-1"><p className="eyebrow mb-2">USER REQUEST</p><p className="break-words text-xs leading-7">{query.data.scenarios.find((item) => item.key === selected)?.task}</p></div><Button type="submit" loading={pending} className="btn-primary">{pending ? 'Evaluating action…' : 'Run scenario'}{!pending && <Play size={13} />}</Button></div></> : <div className="glass-card max-w-3xl p-6"><p className="mb-5 flex items-center gap-2 text-xs text-muted"><Sparkles size={14} className="text-info" /> Gemini proposes. Deterministic code decides.</p><label className="field-label" htmlFor="agent">Select agent</label><select id="agent" className="field" value={agentKey} onChange={(event) => setAgentKey(event.target.value)} disabled={pending}>{query.data.agents.map((agent) => <option key={agent.key} value={agent.key}>{agent.name}</option>)}</select><label htmlFor="agent-task" className="field-label mt-6">What should the agent do?</label><textarea id="agent-task" className="field min-h-36 resize-y leading-7" maxLength={10000} value={task} onChange={(event) => setTask(event.target.value)} disabled={pending} placeholder="Send the Q3 sales summary to my manager at manager@acme.in" />{USING_MOCKS && <p className="mt-3 text-[11px] leading-6 text-muted">Free-text tasks require live API mode and a server-side Gemini key. Scripted scenarios are available in this local demo.</p>}<Button type="submit" className="btn-primary mt-5" loading={pending}>{pending ? 'Evaluating action…' : 'Propose & evaluate'}{!pending && <ArrowRight size={14} />}</Button></div>}
    </form>}
    {error && <p role="alert" className="mt-5 rounded-control border border-unsafe/20 bg-unsafe/5 p-4 text-xs leading-7 text-unsafe">{error}</p>}
    {pending && <div className="mt-6"><LoadingState label="Waiting for the server’s proposal, privacy scan, and computed decision…" /></div>}
    <div ref={resultRef} className="scroll-mt-24" aria-live="polite"><AnimatePresence mode="wait">{result && <motion.div key={result.action._id} initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .25 }} className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_270px]"><TrustEvaluation evaluation={result.evaluation} /><aside className="glass-card p-5 xl:sticky xl:top-24"><p className="eyebrow mb-4">PIPELINE TRACE</p><StatusBadge status={result.status} /><Stagger className="mt-6 space-y-0">{result.timeline.map((entry, index) => <StaggerItem key={entry.stage}><div className="flex items-start gap-3"><div className="flex flex-col items-center"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-elevated font-mono text-[8px] text-muted">{String(index + 1).padStart(2, '0')}</span>{index < result.timeline.length - 1 && <span className="my-1 h-6 w-px bg-line" />}</div><div className="flex flex-1 justify-between gap-3 pt-1 text-[10px]"><span className="text-muted">{entry.label}</span><span className="shrink-0 font-mono text-[9px]">{Math.round(entry.ms)}ms</span></div></div></StaggerItem>)}</Stagger><p className="mt-4 border-t border-line pt-4 font-mono text-[9px] leading-6 text-muted">SOURCE: {result.source?.toUpperCase()}<br />COMPLETION OFFSETS FROM RUN START</p>{result.status === 'pending_approval' && <Link to="/approvals" className="btn mt-5 w-full border-suspicious/25! text-suspicious">Review action <ChevronRight size={13} /></Link>}{result.status === 'executed' && <Link to="/outbox" className="btn mt-5 w-full">View receipt <ChevronRight size={13} /></Link>}<Link to="/audit" className="mt-4 flex items-center gap-2 text-[11px] text-muted hover:text-ink">Open audit trail <ChevronRight size={12} /></Link></aside></motion.div>}</AnimatePresence></div>
    {!result && !pending && <div className="mt-8 flex items-center gap-3 border-t border-line pt-5 text-[11px] leading-6 text-muted"><AgentAvatar agent={query.data?.agents?.find((agent) => agent.key === (mode === 'task' ? agentKey : query.data?.scenarios?.find((s) => s.key === selected)?.agentKey))} />The action, decision, and stage events are persisted by the run pipeline.</div>}
  </>;
}
