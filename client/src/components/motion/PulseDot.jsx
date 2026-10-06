import { motion, useReducedMotion } from 'motion/react';

export default function PulseDot({ blocked = false }) {
  const reduce = useReducedMotion();
  return <span className={`relative inline-flex h-2 w-2 shrink-0 ${blocked ? 'text-blocked' : 'text-trusted'}`} aria-hidden="true"><motion.span className="absolute inset-0 rounded-full border border-current" animate={reduce ? {} : { scale: [1, 2.5], opacity: [.7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} /><span className="h-2 w-2 rounded-full bg-current" /></span>;
}
