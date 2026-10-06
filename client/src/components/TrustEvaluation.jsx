import { Check, LockKeyhole, Minus, ShieldAlert, ShieldCheck } from 'lucide-react';
import AnimatedNumber from './motion/AnimatedNumber.jsx';
import { Stagger, StaggerItem } from './motion/Stagger.jsx';
import PulseDot from './motion/PulseDot.jsx';
import { StatusBadge } from './ui.jsx';

export default function TrustEvaluation({ evaluation }) {
  const { score, level, hardBlock, checks = [], privacy = { counts: {}, entityTypes: [] }, tokenizedPayload, explanation } = evaluation;
  const color = hardBlock ? 'text-blocked' : level === 'TRUSTED' ? 'text-trusted' : level === 'SUSPICIOUS' ? 'text-suspicious' : 'text-unsafe';
  const Icon = hardBlock ? ShieldAlert : ShieldCheck;
  return <section aria-label="Computed evaluation" className="space-y-5">
    <div className="glass-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-6 p-6 sm:p-7"><div><p className="eyebrow mb-3">DETERMINISTIC TRUST EVALUATION</p><h2 className="flex items-center gap-3 text-xl"><Icon className={color} size={22} />{hardBlock ? 'Execution blocked.' : level === 'TRUSTED' ? 'Clear to proceed.' : level === 'SUSPICIOUS' ? 'A human should take a look.' : 'Risk exceeds the trust gate.'}</h2><div className="mt-3"><StatusBadge level={level} /></div></div><div className={`flex items-baseline gap-2 font-mono ${color}`}><span data-testid="trust-score" className="text-[52px] font-medium leading-none tracking-[-.06em]"><AnimatedNumber value={score} /></span><span className="text-sm text-muted">/100</span></div></div>
      {hardBlock && <div className="flex items-center gap-3 border-y border-blocked/15 bg-blocked/5 px-6 py-3 font-mono text-[11px] text-blocked"><PulseDot blocked /> HARD BLOCK — overrides score</div>}
      {explanation && <p className="px-6 py-5 text-xs leading-7 text-muted">{explanation}</p>}
    </div>
    <Stagger className="grid gap-3 sm:grid-cols-2">{checks.map((check) => <StaggerItem key={check.id} className="glass-card p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={check.hardBlock ? 'text-blocked' : check.passed ? 'text-trusted' : 'text-suspicious'}>{check.passed ? <Check size={14} /> : check.hardBlock ? <ShieldAlert size={14} /> : <Minus size={14} />}</span><h3 className="text-[13px] font-medium">{check.name}</h3></div><span className={`font-mono text-[10px] ${check.hardBlock ? 'text-blocked' : 'text-muted'}`}>{check.hardBlock ? 'HARD BLOCK' : `−${check.penalty}`}</span></div><p className="mt-2 break-words text-[11px] leading-6 text-muted">{check.reason}</p></StaggerItem>)}</Stagger>
    <div className="glass-card p-5"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm"><LockKeyhole size={15} className="text-privacy" /> Privacy shield</h3><span className="eyebrow text-[8px]!">NO VAULT EXPOSED</span></div><div className="flex flex-wrap gap-2">{privacy.entityTypes.length ? privacy.entityTypes.map((type) => <span key={type} className="badge badge-privacy">{type} <span className="ml-1 opacity-70">×{privacy.counts[type]}</span></span>) : <p className="text-xs text-muted">No personal data detected in this payload.</p>}</div><h4 className="eyebrow mt-6 mb-3">TOKENIZED PAYLOAD</h4><pre className="code-panel text-[#b4a1ff]">{tokenizedPayload || '(empty payload)'}</pre></div>
    <p className="font-mono text-[9px] leading-5 text-muted">Scores are computed by code. Permission and critical policy checks override the numeric score.</p>
  </section>;
}
