import { motion, useReducedMotion } from 'motion/react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export default function LensVisual() {
  const reduce = useReducedMotion();
  return <div className="relative mx-auto my-8 w-full max-w-[450px] py-6" aria-hidden="true">
    <div className="relative mx-auto h-[260px] w-[260px] sm:h-[310px] sm:w-[310px]">
      <div className="absolute inset-10 rounded-full bg-info/5 blur-3xl" />
      <svg viewBox="0 0 320 320" fill="none" className="relative h-full w-full">
        <circle cx="160" cy="160" r="150" stroke="#ffffff08" strokeDasharray="2 8" /><circle cx="160" cy="160" r="128" stroke="#ffffff0b" /><circle cx="160" cy="160" r="104" stroke="#ffffff12" />
        <motion.g animate={reduce ? {} : { rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '160px 160px' }}><path d="M160 32a128 128 0 0 1 128 128M160 288A128 128 0 0 1 32 160" stroke="#38BDF8" strokeOpacity=".45" strokeWidth="1.5" /><circle cx="160" cy="32" r="3" fill="#38BDF8" /></motion.g>
        <motion.g animate={reduce ? {} : { rotate: -360 }} transition={{ duration: 32, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '160px 160px' }}><path d="M56 160a104 104 0 0 1 104-104M264 160a104 104 0 0 1-104 104" stroke="#E6EDF3" strokeOpacity=".25" /></motion.g>
        <circle cx="160" cy="160" r="65" fill="#0D1117" stroke="#ffffff14" /><circle cx="160" cy="160" r="45" stroke="#E6EDF3" strokeOpacity=".3" /><circle cx="160" cy="160" r="26" stroke="#E6EDF3" strokeWidth="1.5" /><circle cx="160" cy="160" r="8" fill="#E6EDF3" />
        <path d="M160 76v18M160 226v18M76 160h18M226 160h18" stroke="#E6EDF3" strokeOpacity=".3" />
      </svg>
      <div className="scan-line absolute top-1/2 left-0 h-px w-full bg-gradient-to-r from-transparent via-info/60 to-transparent shadow-[0_0_20px_#38bdf822]" />
      <div className="absolute -left-8 top-8 rounded-lg border border-line bg-surface/95 px-3 py-2 font-mono text-[9px] text-muted sm:-left-12"><span className="mr-2 text-privacy">↳</span> &lt;AADHAAR_1&gt;</div>
      <div className="absolute -right-6 top-40 rounded-lg border border-privacy/25 bg-surface/95 px-3 py-2 font-mono text-[9px] text-[#b4a1ff] sm:-right-12"><LockKeyhole size={11} className="mr-2 inline" /> &lt;PHONE_1&gt;</div>
      <div className="absolute bottom-4 -left-4 flex items-center gap-2 rounded-lg border border-trusted/20 bg-surface/95 px-3 py-2 font-mono text-[9px] text-trusted"><ShieldCheck size={12} /> VERIFIED BEFORE EXECUTION</div>
    </div>
    <div className="mt-10 flex items-center justify-center gap-4 font-mono text-[8px] tracking-widest text-muted"><span>PROPOSE</span><span className="text-white/20">→</span><span className="text-[#b4a1ff]">SHIELD</span><span className="text-white/20">→</span><span>EVALUATE</span><span className="text-white/20">→</span><span>DECIDE</span></div>
  </div>;
}
