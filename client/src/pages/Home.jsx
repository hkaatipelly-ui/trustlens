import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, ArrowUpRight, Bot, LockKeyhole, RefreshCw, ShieldBan, ShieldCheck } from 'lucide-react';
import useData from '../hooks/useData.js';
import { getStats } from '../services/operations.js';
import { getActions } from '../services/actions.js';
import { useGateway } from '../contexts/GatewayContext.jsx';
import { USING_MOCKS } from '../services/request.js';
import { useOperations } from '../contexts/OperationsContext.jsx';
import ActionDetail from '../components/ActionDetail.jsx';
import ActionTable from '../components/ActionTable.jsx';
import DemoResetButton from '../components/DemoResetButton.jsx';
import AnimatedNumber from '../components/motion/AnimatedNumber.jsx';
import PulseDot from '../components/motion/PulseDot.jsx';
import { Stagger, StaggerItem } from '../components/motion/Stagger.jsx';
import { Button, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

export default function Home() {
  const query = useData(async (options) => { const [stats, actions] = await Promise.all([getStats(options), getActions({ limit: 8 }, options)]); return { stats, actions }; });
  const health = useGateway();
  const { pendingCount } = useOperations();
  const [detail, setDetail] = useState(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const reduce = useReducedMotion();
  const stats = query.data?.stats;
  const distribution = stats ? [{ label: 'Trusted', count: stats.totals.trusted, color: '#22C55E', range: '75–100' }, { label: 'Suspicious', count: stats.totals.suspicious, color: '#F5B700', range: '40–74' }, { label: 'Unsafe', count: stats.totals.unsafe, color: '#EF4444', range: '0–39' }, { label: 'Hard blocked', count: stats.totals.blocked, color: '#FF3B5C', range: 'OVERRIDE' }] : [];
  let offset = 0;

  return <>
    <PageHeader eyebrow="WORKSPACE OVERVIEW" title="Command Center" description="A clear line of sight into every action your agents take."><DemoResetButton /><Button onClick={() => { query.reload(); health.reload(); }}><RefreshCw size={13} /> Refresh</Button><Link to="/console" className="btn btn-primary">Run an agent <ArrowUpRight size={14} /></Link></PageHeader>
    <div className="glass-card mb-6 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6"><div className="flex items-center gap-4"><div className={`rounded-xl border p-3 ${health.error ? 'border-unsafe/20 bg-unsafe/5' : 'border-trusted/20 bg-trusted/5'}`}><ShieldCheck size={22} className={health.error ? 'text-unsafe' : 'text-trusted'} /></div><div><h2 className="text-lg font-medium">{health.error ? 'Trust gate unavailable.' : health.data ? 'Trust gate online.' : 'Connecting to the trust gate.'}</h2><p className="mt-1 text-[11px] leading-6 text-muted">Agents propose. The engine evaluates. You stay in control.</p></div></div><div className="flex flex-wrap items-center gap-4"><span className="flex items-center gap-2 font-mono text-[10px] text-muted">{health.data?.status === 'ok' && !health.error ? <><PulseDot /> {USING_MOCKS ? 'MOCK API CONNECTED' : 'API connected ✓'}</> : health.error ? <span className="text-unsafe">API unavailable</span> : 'CONNECTING…'}</span>{pendingCount > 0 && <Link to="/approvals" className="btn border-suspicious/20! text-suspicious">{pendingCount} awaiting review <ArrowRight size={13} /></Link>}</div></div>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState error={query.error} retry={query.reload} /> : <>
      <Stagger className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Actions evaluated', value: stats.totals.evaluated, icon: Activity, color: 'text-ink', note: 'Every proposed action checked' },
        { label: 'Average trust score', value: stats.avgScore, icon: ShieldCheck, color: stats.avgScore >= 75 ? 'text-trusted' : stats.avgScore >= 40 ? 'text-suspicious' : 'text-unsafe', note: 'Code-computed · out of 100', decimals: 1 },
        { label: 'PII items shielded', value: stats.piiItemsShielded, icon: LockKeyhole, color: 'text-privacy', note: 'Personal data replaced with tokens' },
        { label: 'Hard blocks enforced', value: stats.totals.blocked, icon: ShieldBan, color: 'text-blocked', note: 'Permission & critical policy overrides' },
      ].map(({ label, value, icon: Icon, color, note, decimals }) => <StaggerItem key={label} className="glass-card p-5"><div className="flex items-center justify-between"><p className="text-[11px] text-muted">{label}</p><Icon size={15} className={color} /></div><p className={`mt-5 font-mono text-[32px] font-medium tracking-[-.05em] ${color}`}><AnimatedNumber value={value} decimals={decimals || 0} /></p><p className="mt-3 text-[9px] text-muted">{note}</p></StaggerItem>)}</Stagger>
      <div className="mb-6 grid min-w-0 gap-4 xl:grid-cols-[1.65fr_1fr]">
        <section className="glass-card min-w-0 p-5 sm:p-6"><div className="mb-7 flex items-start justify-between"><div><h2 className="text-base">Action activity</h2><p className="mt-1 text-[10px] text-muted">Every evaluation, across all agents</p></div><span className="badge badge-neutral">LAST 24H</span></div><div className="h-[190px] min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0}><AreaChart data={stats.last24h} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}><defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38BDF8" stopOpacity={.16} /><stop offset="100%" stopColor="#38BDF8" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#ffffff05" vertical={false} /><XAxis dataKey="hour" tickFormatter={(hour) => new Date(hour).toLocaleTimeString('en-US', { hour: '2-digit', hour12: false })} tick={{ fill: '#8B98A5', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} minTickGap={45} /><YAxis allowDecimals={false} tick={{ fill: '#8B98A5', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#131A23', border: '1px solid #ffffff15', borderRadius: 10, fontSize: 11 }} labelFormatter={(value) => new Date(value).toLocaleString()} formatter={(value) => [value, 'Evaluations']} /><Area type="monotone" dataKey="count" stroke="#38BDF8" strokeWidth={2} fill="url(#activity-fill)" isAnimationActive={!reduce} /></AreaChart></ResponsiveContainer></div><div className="mt-4 flex items-center gap-2 border-t border-line pt-4 font-mono text-[9px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-info" /> EVALUATED ACTIONS <span className="ml-auto">UTC-BASED HOURLY BUCKETS</span></div></section>
        <section className="glass-card p-5 sm:p-6"><h2 className="text-base">Trust distribution</h2><p className="mt-1 text-[10px] text-muted">Original evaluations · all time</p><div className="mt-6 flex items-center gap-7"><div className="relative h-32 w-32 shrink-0"><svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-label="Evaluation distribution"><circle cx="60" cy="60" r="48" fill="none" stroke="#ffffff05" strokeWidth="9" />{distribution.map((item) => { const portion = stats.totals.evaluated ? item.count / stats.totals.evaluated * 301.59 : 0; const start = offset; offset += portion; return <circle key={item.label} cx="60" cy="60" r="48" fill="none" stroke={item.color} strokeWidth="9" strokeDasharray={`${Math.max(0, portion - (portion ? 3 : 0))} 301.59`} strokeDashoffset={-start} />; })}</svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-2xl">{stats.totals.evaluated}</span><span className="eyebrow text-[7px]!">CHECKED</span></div></div><div className="min-w-0 flex-1 space-y-3">{distribution.map((item) => <div key={item.label} className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} /><span className="flex-1 text-muted">{item.label}</span><span className="font-mono">{item.count}</span></div>)}</div></div><p className="mt-7 border-t border-line pt-4 font-mono text-[9px] leading-5 text-muted">HARD BLOCKS OVERRIDE SCORE — ALWAYS.</p></section>
      </div>
      <section className="glass-card mb-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5"><div><h2 className="text-base">Recent actions</h2><p className="mt-1 text-[10px] text-muted">Decisions with a complete inspection trail</p></div><Link to="/audit" className="flex items-center gap-2 text-[11px] text-muted hover:text-ink">View audit log <ArrowUpRight size={13} /></Link></div><ActionTable actions={query.data.actions} onInspect={setDetail} /></section>
      <section className="grid gap-4 md:grid-cols-3">{stats.byAgent.map((agent) => <div key={agent.agent} className="glass-card flex items-center gap-4 p-4"><div className="rounded-lg border border-line p-2.5"><Bot size={18} className="text-muted" /></div><div className="flex-1"><h3 className="text-[13px]">{agent.agent}</h3><p className="mt-1 font-mono text-[9px] text-muted">{agent.count} EVALUATIONS</p></div><span className="font-mono text-lg">{agent.avgScore}<span className="ml-1 text-[8px] text-muted">AVG</span></span></div>)}</section>
    </>}
    <AnimatePresence>{detail && <ActionDetail key={detail} id={detail} onClose={closeDetail} />}</AnimatePresence>
  </>;
}
